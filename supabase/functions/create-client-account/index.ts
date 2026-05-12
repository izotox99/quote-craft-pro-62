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
    if (!authHeader) return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callingUser) {
      return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const email: string = (body?.email ?? "").toString().trim().toLowerCase();
    const password: string = (body?.password ?? "").toString();
    const client_id: string = (body?.client_id ?? "").toString();

    if (!email || !password || !client_id) {
      return jsonResponse({ error: "Email, password e client_id sono obbligatori", code: "missing_fields" }, 400);
    }
    if (!isValidEmail(email)) return jsonResponse({ error: "Email non valida", code: "invalid_email" }, 400);
    if (password.length < 6) {
      return jsonResponse({ error: "La password deve avere almeno 6 caratteri", code: "weak_password" }, 400);
    }

    // Verify caller belongs to the client's org
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

    if (clientErr || !clientRow) {
      return jsonResponse({ error: "Cliente non trovato", code: "client_not_found" }, 404);
    }
    if (!callerProfile?.org_id || callerProfile.org_id !== clientRow.org_id) {
      return jsonResponse({ error: "Non autorizzato per questo cliente", code: "forbidden" }, 403);
    }

    // Reject if email is already used by ANOTHER clients record (any org)
    const { data: otherClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .ilike("email", email)
      .neq("id", client_id)
      .maybeSingle();
    if (otherClient) {
      return jsonResponse(
        { error: "Email già usata da un altro cliente", code: "email_taken_client" },
        409
      );
    }

    // Find existing auth user with that email
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existing?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === email
    );

    // If found, ensure it is NOT an NCC account or another type of account
    if (existingUser) {
      const accountType = (existingUser.user_metadata as Record<string, unknown> | null)?.account_type;

      // Is it an NCC user (has profile or role)?
      const [{ data: prof }, { data: role }] = await Promise.all([
        supabaseAdmin.from("profiles").select("user_id").eq("user_id", existingUser.id).maybeSingle(),
        supabaseAdmin.from("user_roles").select("user_id").eq("user_id", existingUser.id).maybeSingle(),
      ]);
      if (prof || role) {
        return jsonResponse(
          { error: "Email già usata da un account NCC. Scegli un'altra email.", code: "email_taken_ncc" },
          409
        );
      }

      // Is it linked to a different client record?
      const { data: linkedClient } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("auth_user_id", existingUser.id)
        .maybeSingle();
      if (linkedClient && linkedClient.id !== client_id) {
        return jsonResponse(
          { error: "Email già collegata a un altro cliente", code: "email_taken_client" },
          409
        );
      }

      // If it's linked to an utenza (account_type === "client" but with utenza_id metadata)
      if (accountType === "client" && (existingUser.user_metadata as Record<string, unknown>)?.utenza_id) {
        return jsonResponse(
          { error: "Email già usata da un'utenza cliente", code: "email_taken_utenza" },
          409
        );
      }
    }

    let authUserId: string | null = clientRow.auth_user_id ?? null;
    let action: "created" | "updated" | "linked" = "updated";

    if (authUserId && existingUser && existingUser.id !== authUserId) {
      // The new email points to a different auth user than the one currently linked.
      // Re-link to the existing user and update its credentials.
      authUserId = existingUser.id;
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: { ...(existingUser.user_metadata ?? {}), account_type: "client" },
      });
      if (upErr) return jsonResponse({ error: upErr.message, code: "auth_update_failed" }, 400);

      await supabaseAdmin.from("clients").update({ auth_user_id: authUserId }).eq("id", client_id);
      action = "linked";
    } else if (authUserId) {
      // Already linked → update email + password
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email,
        password,
        email_confirm: true,
        user_metadata: { account_type: "client" },
      });
      if (upErr) return jsonResponse({ error: upErr.message, code: "auth_update_failed" }, 400);
      action = "updated";
    } else if (existingUser) {
      // Not linked, but a compatible client auth user already exists → link and reset password
      authUserId = existingUser.id;
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: { ...(existingUser.user_metadata ?? {}), account_type: "client" },
      });
      if (upErr) return jsonResponse({ error: upErr.message, code: "auth_update_failed" }, 400);

      const { error: linkErr } = await supabaseAdmin
        .from("clients")
        .update({ auth_user_id: authUserId })
        .eq("id", client_id);
      if (linkErr) return jsonResponse({ error: linkErr.message, code: "link_failed" }, 400);
      action = "linked";
    } else {
      // Create new auth user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { account_type: "client" },
      });
      if (createErr || !created.user) {
        return jsonResponse({ error: createErr?.message ?? "Errore creazione account", code: "auth_create_failed" }, 400);
      }
      authUserId = created.user.id;

      const { error: linkErr } = await supabaseAdmin
        .from("clients")
        .update({ auth_user_id: authUserId })
        .eq("id", client_id);
      if (linkErr) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        return jsonResponse({ error: linkErr.message, code: "link_failed" }, 400);
      }
      action = "created";
    }

    return jsonResponse({ success: true, user_id: authUserId, action });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? "Errore interno", code: "internal_error" }, 500);
  }
});
