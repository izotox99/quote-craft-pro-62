import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Non autorizzato" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callingUser) return jsonResponse({ error: "Non autorizzato" }, 401);

    const body = await req.json().catch(() => ({}));
    const email: string = (body?.email ?? "").toString().trim().toLowerCase();
    const password: string = (body?.password ?? "").toString();
    const client_id: string = (body?.client_id ?? "").toString();

    if (!email || !password || !client_id) {
      return jsonResponse({ error: "Email, password e client_id sono obbligatori" }, 400);
    }
    if (!isValidEmail(email)) return jsonResponse({ error: "Email non valida" }, 400);
    if (password.length < 6) return jsonResponse({ error: "La password deve avere almeno 6 caratteri" }, 400);

    // Verify caller is admin/manager of the client's org
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("user_id", callingUser.id)
      .maybeSingle();

    const { data: clientRow, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id, org_id, auth_user_id, email")
      .eq("id", client_id)
      .maybeSingle();

    if (clientErr || !clientRow) return jsonResponse({ error: "Cliente non trovato" }, 404);
    if (!callerProfile?.org_id || callerProfile.org_id !== clientRow.org_id) {
      return jsonResponse({ error: "Non autorizzato per questo cliente" }, 403);
    }

    let authUserId: string | null = clientRow.auth_user_id ?? null;
    let action: "created" | "updated" | "linked" = "updated";

    // 1) Already linked → just update email + password
    if (authUserId) {
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email,
        password,
        email_confirm: true,
        user_metadata: { account_type: "client" },
      });
      if (upErr) return jsonResponse({ error: upErr.message }, 400);
      action = "updated";
    } else {
      // 2) Not linked: see if an auth user already exists with that email
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existing?.users?.find(
        (u) => (u.email ?? "").toLowerCase() === email
      );

      if (existingUser) {
        authUserId = existingUser.id;
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
          user_metadata: { ...(existingUser.user_metadata ?? {}), account_type: "client" },
        });
        if (upErr) return jsonResponse({ error: upErr.message }, 400);
        action = "linked";
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { account_type: "client" },
        });
        if (createErr || !created.user) {
          return jsonResponse({ error: createErr?.message ?? "Errore creazione account" }, 400);
        }
        authUserId = created.user.id;
        action = "created";
      }

      const { error: linkErr } = await supabaseAdmin
        .from("clients")
        .update({ auth_user_id: authUserId })
        .eq("id", client_id);
      if (linkErr) return jsonResponse({ error: linkErr.message }, 400);
    }

    return jsonResponse({ success: true, user_id: authUserId, action });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? "Errore interno" }, 500);
  }
});
