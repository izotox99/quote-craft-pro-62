import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non consentito", code: "method_not_allowed" }, 405);
  }

  let payload: { email?: unknown; password?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Richiesta non valida (JSON malformato)", code: "invalid_json" }, 400);
  }

  const rawEmail = payload?.email;
  const rawPassword = payload?.password;

  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
    return jsonResponse({ error: "Email e password sono obbligatori", code: "missing_fields" }, 400);
  }

  const email = rawEmail.trim().toLowerCase();
  const password = rawPassword;

  if (!email || !password) {
    return jsonResponse({ error: "Email e password sono obbligatori", code: "missing_fields" }, 400);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ error: "Formato email non valido", code: "invalid_email_format" }, 400);
  }
  if (password.length < 1 || password.length > 200) {
    return jsonResponse({ error: "Password non valida", code: "invalid_password_length" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[utenza-login] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse({ error: "Configurazione server mancante", code: "server_misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const ip = getClientIp(req);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();

  const recordAttempt = async (success: boolean) => {
    const { error } = await admin.from("login_attempts").insert({
      email,
      ip_address: ip,
      success,
    });
    if (error) console.error("[utenza-login] log attempt error:", error.message);
  };

  try {
    // ---- Rate limiting ----
    const { count: emailFails } = await admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("success", false)
      .gte("attempted_at", windowStart);

    let ipFails = 0;
    if (ip) {
      const { count } = await admin
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .eq("success", false)
        .gte("attempted_at", windowStart);
      ipFails = count ?? 0;
    }

    if ((emailFails ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS || ipFails >= RATE_LIMIT_MAX_ATTEMPTS) {
      return jsonResponse(
        {
          error: `Troppi tentativi di accesso. Riprova tra ${RATE_LIMIT_WINDOW_MIN} minuti.`,
          code: "rate_limited",
        },
        429
      );
    }

    // ---- Lookup utenza ----
    const { data: utenza, error: utenzaErr } = await admin
      .from("client_utenze")
      .select("id, email, password_hash, attivo, auth_user_id, parent_client_id")
      .ilike("email", email)
      .maybeSingle();

    if (utenzaErr) {
      console.error("[utenza-login] DB lookup error:", utenzaErr.message);
      return jsonResponse({ error: "Errore durante la verifica delle credenziali", code: "db_error" }, 500);
    }

    if (!utenza) {
      await recordAttempt(false);
      return jsonResponse({ error: "Email o password non corretti", code: "invalid_credentials" }, 401);
    }

    if (!utenza.attivo) {
      // Not a credential failure — don't count against rate limit
      return jsonResponse(
        { error: "La tua utenza è stata disattivata. Contatta l'amministratore.", code: "account_disabled" },
        403
      );
    }

    // ---- Verify password (bcrypt hash only) ----
    if (!utenza.password_hash) {
      console.error("[utenza-login] utenza senza password_hash:", utenza.id);
      await recordAttempt(false);
      return jsonResponse({ error: "Email o password non corretti", code: "invalid_credentials" }, 401);
    }

    const { data: verifyResult, error: verifyErr } = await admin.rpc("verify_utenza_password", {
      _utenza_id: utenza.id,
      _password: password,
    });
    if (verifyErr) {
      console.error("[utenza-login] verify_utenza_password error:", verifyErr.message);
      return jsonResponse({ error: "Errore durante la verifica delle credenziali", code: "verify_error" }, 500);
    }
    if (!verifyResult) {
      await recordAttempt(false);
      return jsonResponse({ error: "Email o password non corretti", code: "invalid_credentials" }, 401);
    }

    // ---- Ensure auth.users entry (created once, password never overwritten) ----
    const syntheticEmail = `utenza+${utenza.id}@portal.local`;
    let authUserId = utenza.auth_user_id as string | null;

    if (!authUserId) {
      // Long random password — never sent to client, never reused.
      const randBytes = new Uint8Array(32);
      crypto.getRandomValues(randBytes);
      const permanentPassword = Array.from(randBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: permanentPassword,
        email_confirm: true,
        user_metadata: { utenza_id: utenza.id, real_email: utenza.email, account_type: "client" },
      });

      if (createErr || !created.user) {
        console.error("[utenza-login] createUser error:", createErr?.message);
        return jsonResponse(
          { error: "Impossibile creare l'account di accesso. Riprova più tardi.", code: "auth_create_failed" },
          500
        );
      }

      authUserId = created.user.id;
      const { error: linkErr } = await admin
        .from("client_utenze")
        .update({ auth_user_id: authUserId })
        .eq("id", utenza.id);
      if (linkErr) console.error("[utenza-login] link auth_user_id error:", linkErr.message);
    }

    // ---- Mint a session via magic link → verifyOtp ----
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("[utenza-login] generateLink error:", linkErr?.message);
      return jsonResponse(
        { error: "Impossibile generare la sessione. Riprova più tardi.", code: "session_generate_failed" },
        500
      );
    }

    const { data: verified, error: otpErr } = await admin.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    });

    if (otpErr || !verified?.session) {
      console.error("[utenza-login] verifyOtp error:", otpErr?.message);
      return jsonResponse(
        { error: "Impossibile aprire la sessione. Riprova più tardi.", code: "session_verify_failed" },
        500
      );
    }

    await recordAttempt(true);

    return jsonResponse({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      utenza_id: utenza.id,
    });
  } catch (err) {
    console.error("[utenza-login] Unexpected error:", (err as Error).message);
    return jsonResponse({ error: "Errore imprevisto. Riprova più tardi.", code: "internal_error" }, 500);
  }
});
