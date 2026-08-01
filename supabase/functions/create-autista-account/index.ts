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

function cleanEmail(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = v.toString().trim().toLowerCase();
  return s || null;
}
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function computePasswordFingerprint(password: string): Promise<string> {
  const secret = Deno.env.get("PASSWORD_FINGERPRINT_KEY");
  if (!secret) throw new Error("PASSWORD_FINGERPRINT_KEY non configurato");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  return data?.users?.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
}

async function checkRateLimit(admin: ReturnType<typeof createClient>, key: string, max = 20) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await admin.from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", key).gte("attempted_at", since);
  if ((count ?? 0) >= max) return false;
  await admin.from("login_attempts").insert({ email: key, success: false });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Metodo non consentito", code: "method_not_allowed" }, 405);

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
    if (authError || !callingUser) return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);

    if (!(await checkRateLimit(admin, `create_autista:${callingUser.id}`))) {
      return jsonResponse({ error: "Troppe richieste, riprova più tardi", code: "rate_limited" }, 429);
    }

    const { data: callerProfile } = await admin
      .from("profiles").select("org_id").eq("user_id", callingUser.id).maybeSingle();
    if (!callerProfile?.org_id) {
      return jsonResponse({ error: "Account NCC non configurato", code: "missing_org" }, 403);
    }

    const { data: canWrite } = await admin.rpc("can_write", { _user_id: callingUser.id });
    if (!canWrite) {
      return jsonResponse({ error: "Account in sola lettura: operazione non consentita", code: "read_only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const autistaId: string | null = body?.autista_id ?? null;
    const tipoRaw: string = (body?.tipo ?? "interno").toString();
    const tipo: "interno" | "esterno" = tipoRaw === "esterno" ? "esterno" : "interno";
    const table = tipo === "esterno" ? "autisti_esterni" : "autisti";
    const email = cleanEmail(body?.email);
    const password: string = (body?.password ?? "").toString();

    if (!autistaId) return jsonResponse({ error: "autista_id mancante", code: "missing_autista" }, 400);
    if (!email) return jsonResponse({ error: "Email obbligatoria per abilitare l'accesso all'app autisti", code: "missing_email" }, 400);
    if (!isValidEmail(email)) return jsonResponse({ error: "Email non valida", code: "invalid_email" }, 400);
    if (password && password.length < 6) {
      return jsonResponse({ error: "La password deve avere almeno 6 caratteri", code: "weak_password" }, 400);
    }

    const { data: autista, error: aErr } = await admin
      .from(table).select("id, org_id, auth_user_id, email").eq("id", autistaId).maybeSingle();
    if (aErr || !autista) return jsonResponse({ error: "Autista non trovato", code: "autista_not_found" }, 404);
    if ((autista as any).org_id !== callerProfile.org_id) {
      return jsonResponse({ error: "Non autorizzato per questo autista", code: "forbidden" }, 403);
    }

    // Password fingerprint uniqueness (shared con clienti/utenze)
    const ownerType = tipo === "esterno" ? "autista_esterno" : "autista";
    let passwordFingerprint: string | null = null;
    if (password) {
      passwordFingerprint = await computePasswordFingerprint(password);
      const { data: existingFp } = await admin
        .from("password_fingerprints").select("owner_type, owner_id")
        .eq("fingerprint", passwordFingerprint).maybeSingle();
      if (existingFp && !(existingFp.owner_type === ownerType && existingFp.owner_id === autistaId)) {
        return jsonResponse({
          error: "Password già in uso da un altro account, scegline una diversa.",
          code: "password_in_use",
        }, 409);
      }
    }

    // Email non deve collidere con NCC/cliente/utenza/altro autista
    const existingAuthUser = await findUserByEmail(admin, email);
    if (existingAuthUser) {
      const [{ data: prof }, { data: role }, { data: cli }, { data: ute }, { data: otherAutInt }, { data: otherAutExt }] = await Promise.all([
        admin.from("profiles").select("user_id").eq("user_id", existingAuthUser.id).maybeSingle(),
        admin.from("user_roles").select("user_id").eq("user_id", existingAuthUser.id).maybeSingle(),
        admin.from("clients").select("id").eq("auth_user_id", existingAuthUser.id).maybeSingle(),
        admin.from("client_utenze").select("id").eq("auth_user_id", existingAuthUser.id).maybeSingle(),
        admin.from("autisti").select("id").eq("auth_user_id", existingAuthUser.id).maybeSingle(),
        admin.from("autisti_esterni").select("id").eq("auth_user_id", existingAuthUser.id).maybeSingle(),
      ]);
      if (prof || role) return jsonResponse({ error: "Email già usata da un account NCC", code: "email_taken_ncc" }, 409);
      if (cli) return jsonResponse({ error: "Email già usata da un cliente", code: "email_taken_client" }, 409);
      if (ute) return jsonResponse({ error: "Email già usata da un'utenza cliente", code: "email_taken_utenza" }, 409);
      const collidesInterno = otherAutInt && !(tipo === "interno" && otherAutInt.id === autistaId);
      const collidesEsterno = otherAutExt && !(tipo === "esterno" && otherAutExt.id === autistaId);
      if (collidesInterno || collidesEsterno) {
        return jsonResponse({ error: "Email già usata da un altro autista", code: "email_taken_autista" }, 409);
      }
    }

    let authUserId = (autista as any).auth_user_id ?? existingAuthUser?.id ?? null;
    let authAction: "none" | "created" | "updated" | "linked" = "none";

    if (authUserId) {
      const updates: Record<string, unknown> = {
        email, email_confirm: true,
        user_metadata: { account_type: "autista" },
      };
      if (password) updates.password = password;
      const { error } = await admin.auth.admin.updateUserById(authUserId, updates);
      if (error) return jsonResponse({ error: error.message, code: "auth_update_failed" }, 400);
      authAction = (autista as any).auth_user_id ? "updated" : "linked";
    } else {
      if (!password) return jsonResponse({ error: "Password obbligatoria per creare l'account autista", code: "password_required" }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { account_type: "autista" },
      });
      if (error || !created.user) {
        return jsonResponse({ error: error?.message ?? "Errore creazione account", code: "auth_create_failed" }, 400);
      }
      authUserId = created.user.id;
      authAction = "created";
    }

    const updatePayload: Record<string, unknown> = {
      email, auth_user_id: authUserId,
    };
    if (password) updatePayload.password_cambiata_at = null;
    const { error: uErr } = await admin.from(table).update(updatePayload).eq("id", autistaId);
    if (uErr) {
      if (authAction === "created" && authUserId) await admin.auth.admin.deleteUser(authUserId);
      return jsonResponse({ error: uErr.message, code: "autista_save_failed" }, 400);
    }

    if (passwordFingerprint) {
      await admin.from("password_fingerprints").delete()
        .eq("owner_type", ownerType).eq("owner_id", autistaId);
      const { error: fpErr } = await admin.from("password_fingerprints").insert({
        fingerprint: passwordFingerprint,
        owner_type: ownerType,
        owner_id: autistaId,
        org_id: callerProfile.org_id,
      });
      if (fpErr) {
        return jsonResponse({
          error: "Password già in uso da un altro account, scegline una diversa.",
          code: "password_in_use",
        }, 409);
      }
    }


    return jsonResponse({ success: true, autista_id: autistaId, user_id: authUserId, auth_action: authAction });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? "Errore interno", code: "internal_error" }, 500);
  }
});
