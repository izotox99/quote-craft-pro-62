import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non consentito", code: "method_not_allowed" }, 405);
  }

  // Parse body safely
  let payload: { email?: unknown; password?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Richiesta non valida (JSON malformato)", code: "invalid_json" }, 400);
  }

  const rawEmail = payload?.email;
  const rawPassword = payload?.password;

  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
    return jsonResponse(
      { error: "Email e password sono obbligatori", code: "missing_fields" },
      400
    );
  }

  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;

  if (!email || !password) {
    return jsonResponse(
      { error: "Email e password sono obbligatori", code: "missing_fields" },
      400
    );
  }

  if (!isValidEmail(email)) {
    return jsonResponse(
      { error: "Formato email non valido", code: "invalid_email_format" },
      400
    );
  }

  if (password.length < 1 || password.length > 200) {
    return jsonResponse(
      { error: "Password non valida", code: "invalid_password_length" },
      400
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[utenza-login] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse(
      { error: "Configurazione server mancante", code: "server_misconfigured" },
      500
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Find utenza by email (case-insensitive)
    const { data: utenza, error: utenzaErr } = await admin
      .from("client_utenze")
      .select("id, email, password, attivo, auth_user_id, parent_client_id")
      .ilike("email", email)
      .maybeSingle();

    if (utenzaErr) {
      console.error("[utenza-login] DB lookup error:", utenzaErr.message);
      return jsonResponse(
        { error: "Errore durante la verifica delle credenziali", code: "db_error" },
        500
      );
    }

    if (!utenza) {
      console.log("[utenza-login] No utenza found for email");
      return jsonResponse(
        { error: "Email o password non corretti", code: "invalid_credentials" },
        401
      );
    }

    if (!utenza.attivo) {
      console.log(`[utenza-login] Utenza ${utenza.id} is disabled`);
      return jsonResponse(
        {
          error: "La tua utenza è stata disattivata. Contatta l'amministratore.",
          code: "account_disabled",
        },
        403
      );
    }

    if (utenza.password !== password) {
      console.log(`[utenza-login] Wrong password for utenza ${utenza.id}`);
      return jsonResponse(
        { error: "Email o password non corretti", code: "invalid_credentials" },
        401
      );
    }

    // Derived auth password (deterministic per utenza)
    const authPassword = `utz_${utenza.id}_${utenza.password}`;
    const syntheticEmail = `utenza+${utenza.id}@portal.local`;

    let authUserId = utenza.auth_user_id as string | null;

    if (!authUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: authPassword,
        email_confirm: true,
        user_metadata: { utenza_id: utenza.id, real_email: utenza.email },
      });

      if (createErr || !created.user) {
        console.error("[utenza-login] createUser error:", createErr?.message);
        return jsonResponse(
          {
            error: "Impossibile creare l'account di accesso. Riprova più tardi.",
            code: "auth_create_failed",
          },
          500
        );
      }

      authUserId = created.user.id;
      const { error: updErr } = await admin
        .from("client_utenze")
        .update({ auth_user_id: authUserId })
        .eq("id", utenza.id);

      if (updErr) {
        console.error("[utenza-login] Failed to link auth_user_id:", updErr.message);
      }
    } else {
      const { error: pwErr } = await admin.auth.admin.updateUserById(authUserId, {
        password: authPassword,
      });
      if (pwErr) {
        console.error("[utenza-login] updateUserById error:", pwErr.message);
        return jsonResponse(
          {
            error: "Impossibile aggiornare le credenziali di accesso. Riprova più tardi.",
            code: "auth_update_failed",
          },
          500
        );
      }
    }

    return jsonResponse({
      synthetic_email: syntheticEmail,
      auth_password: authPassword,
      utenza_id: utenza.id,
    });
  } catch (err) {
    console.error("[utenza-login] Unexpected error:", (err as Error).message);
    return jsonResponse(
      { error: "Errore imprevisto. Riprova più tardi.", code: "internal_error" },
      500
    );
  }
});
