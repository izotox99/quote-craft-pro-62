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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) {
      return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const client_id: string = (body?.client_id ?? "").toString();
    if (!client_id) {
      return jsonResponse({ error: "client_id obbligatorio", code: "missing_fields" }, 400);
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", callingUser.id)
      .maybeSingle();

    const { data: clientRow, error: clientErr } = await admin
      .from("clients")
      .select("id, org_id, auth_user_id, email")
      .eq("id", client_id)
      .maybeSingle();

    if (clientErr || !clientRow) {
      return jsonResponse({ error: "Cliente non trovato", code: "client_not_found" }, 404);
    }
    if (!callerProfile?.org_id || callerProfile.org_id !== clientRow.org_id) {
      return jsonResponse({ error: "Non autorizzato per questo cliente", code: "forbidden" }, 403);
    }

    const authUserId = clientRow.auth_user_id as string | null;

    // Delete the client row first (cascades by FK as per current schema; manual cleanup not needed
    // because related tables filter by org_id and don't FK to clients.id strictly).
    const { error: delErr } = await admin.from("clients").delete().eq("id", client_id);
    if (delErr) return jsonResponse({ error: delErr.message, code: "delete_failed" }, 400);

    // Try to delete the auth user too, if no other client / utenza references it.
    if (authUserId) {
      const [{ data: otherClient }, { data: utenzaLink }] = await Promise.all([
        admin.from("clients").select("id").eq("auth_user_id", authUserId).maybeSingle(),
        admin.from("client_utenze").select("id").eq("auth_user_id", authUserId).maybeSingle(),
      ]);

      // Don't touch NCC accounts even if they happened to share the email.
      const [{ data: prof }, { data: role }] = await Promise.all([
        admin.from("profiles").select("user_id").eq("user_id", authUserId).maybeSingle(),
        admin.from("user_roles").select("user_id").eq("user_id", authUserId).maybeSingle(),
      ]);

      if (!otherClient && !utenzaLink && !prof && !role) {
        await admin.auth.admin.deleteUser(authUserId);
      }
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? "Errore interno", code: "internal_error" }, 500);
  }
});
