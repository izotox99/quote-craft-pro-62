import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  if (status >= 400) console.error("create-client-account error response", status, JSON.stringify(body));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.toString().trim();
  return trimmed ? trimmed : null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function computePasswordFingerprint(password: string): Promise<string> {
  const secret = Deno.env.get("PASSWORD_FINGERPRINT_KEY");
  if (!secret) throw new Error("PASSWORD_FINGERPRINT_KEY non configurato");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}


const writableClientFields = [
  "name",
  "email",
  "company",
  "phone",
  "notes",
  "societa_fattura",
  "sede_legale",
  "codice_fiscale",
  "p_iva",
  "nome_rappresentante",
  "cognome_rappresentante",
  "cap",
  "provincia",
  "citta",
  "nazione",
  "telefono_urg1",
  "telefono_urg1_nota",
  "telefono_urg2",
  "telefono_urg2_nota",
  "telefono_urg3",
  "telefono_urg3_nota",
  "fax",
  "nota_tariffario",
] as const;

function normalizeClientPayload(input: Record<string, unknown>) {
  const payload: Record<string, string | null> = {};
  for (const field of writableClientFields) payload[field] = cleanString(input[field]);

  payload.email = payload.email?.toLowerCase() ?? null;
  payload.company = payload.company ?? payload.name;
  payload.name = payload.company ?? payload.name;
  payload.password_cliente = null;

  return payload;
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  return data?.users?.find((user) => (user.email ?? "").toLowerCase() === email) ?? null;
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
    if (authError || !callingUser) {
      return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", callingUser.id)
      .maybeSingle();

    if (!callerProfile?.org_id) {
      return jsonResponse({ error: "Account NCC non configurato", code: "missing_org" }, 403);
    }

    const { data: canWrite } = await admin.rpc("can_write", { _user_id: callingUser.id });
    if (!canWrite) {
      return jsonResponse({ error: "Account in sola lettura: operazione non consentita", code: "read_only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const clientId: string | null = cleanString(body?.client_id);
    const clientInput = (body?.client && typeof body.client === "object" ? body.client : body) as Record<string, unknown>;
    const clientPayload = normalizeClientPayload(clientInput);
    const email = clientPayload.email;
    const password: string = (body?.password ?? body?.password_cliente ?? "").toString();

    if (!clientPayload.name) {
      return jsonResponse({ error: "La società è obbligatoria", code: "missing_company" }, 400);
    }
    if (email && !isValidEmail(email)) {
      return jsonResponse({ error: "Email non valida", code: "invalid_email" }, 400);
    }
    if (password && password.length < 6) {
      return jsonResponse({ error: "La password deve avere almeno 6 caratteri", code: "weak_password" }, 400);
    }

    // Fingerprint HMAC della password: se fornita, garantisci unicità tra tutti gli account cliente/utenza.
    let passwordFingerprint: string | null = null;
    if (password) {
      passwordFingerprint = await computePasswordFingerprint(password);
      const { data: existingFp } = await admin
        .from("password_fingerprints")
        .select("owner_type, owner_id")
        .eq("fingerprint", passwordFingerprint)
        .eq("org_id", callerProfile.org_id)
        .maybeSingle();
      if (existingFp && !(existingFp.owner_type === "client" && clientId && existingFp.owner_id === clientId)) {
        return jsonResponse({
          error: "Password già in uso da un altro account, scegline una diversa.",
          code: "password_in_use",
        }, 409);
      }
    }


    let existingClient: { id: string; org_id: string; auth_user_id: string | null; email: string | null } | null = null;
    if (clientId) {
      const { data, error } = await admin
        .from("clients")
        .select("id, org_id, auth_user_id, email")
        .eq("id", clientId)
        .maybeSingle();

      if (error || !data) return jsonResponse({ error: "Cliente non trovato", code: "client_not_found" }, 404);
      if (data.org_id !== callerProfile.org_id) {
        return jsonResponse({ error: "Non autorizzato per questo cliente", code: "forbidden" }, 403);
      }
      existingClient = data;
    }

    if (!existingClient && email && !password) {
      return jsonResponse({ error: "Inserisci una password per creare l'account cliente", code: "password_required" }, 400);
    }

    if (email) {
      let otherClientQuery = admin
        .from("clients")
        .select("id, auth_user_id, org_id")
        .ilike("email", email)
        .eq("org_id", callerProfile.org_id);
      if (clientId) otherClientQuery = otherClientQuery.neq("id", clientId);
      const { data: otherClient } = await otherClientQuery.maybeSingle();
      if (otherClient) {
        return jsonResponse({ error: "Email già usata da un altro cliente della tua organizzazione", code: "email_taken_client" }, 409);
      }
    }

    let authUserId = existingClient?.auth_user_id ?? null;
    let authAction: "none" | "created" | "updated" | "linked" = "none";
    let existingAuthUser = email ? await findUserByEmail(admin, email) : null;

    if (existingAuthUser) {
      const [{ data: prof }, { data: role }, { data: utenzaLink }] = await Promise.all([
        admin.from("profiles").select("user_id").eq("user_id", existingAuthUser.id).maybeSingle(),
        admin.from("user_roles").select("user_id").eq("user_id", existingAuthUser.id).maybeSingle(),
        admin.from("client_utenze").select("id").eq("auth_user_id", existingAuthUser.id).maybeSingle(),
      ]);

      if (prof || role) {
        return jsonResponse({ error: "Email già usata da un account NCC. Scegli un'altra email.", code: "email_taken_ncc" }, 409);
      }
      if (utenzaLink) {
        return jsonResponse({ error: "Email già usata da un'utenza cliente", code: "email_taken_utenza" }, 409);
      }

      const { data: linkedClient } = await admin
        .from("clients")
        .select("id")
        .eq("auth_user_id", existingAuthUser.id)
        .maybeSingle();
      if (linkedClient && linkedClient.id !== clientId) {
        return jsonResponse({ error: "Email già collegata a un altro cliente", code: "email_taken_client" }, 409);
      }
    }

    if (email) {
      if (authUserId) {
        const updates: Record<string, unknown> = {
          email,
          email_confirm: true,
          user_metadata: { account_type: "client" },
        };
        if (password) updates.password = password;
        const { error } = await admin.auth.admin.updateUserById(authUserId, updates);
        if (error) return jsonResponse({ error: error.message, code: "auth_update_failed" }, 400);
        authAction = "updated";
      } else if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        const updates: Record<string, unknown> = {
          email_confirm: true,
          user_metadata: { ...(existingAuthUser.user_metadata ?? {}), account_type: "client" },
        };
        if (password) updates.password = password;
        const { error } = await admin.auth.admin.updateUserById(authUserId, updates);
        if (error) return jsonResponse({ error: error.message, code: "auth_update_failed" }, 400);
        authAction = "linked";
      } else {
        if (!password) return jsonResponse({ error: "Password obbligatoria per creare l'account", code: "password_required" }, 400);
        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { account_type: "client" },
        });
        if (error || !created.user) {
          return jsonResponse({ error: error?.message ?? "Errore creazione account", code: "auth_create_failed" }, 400);
        }
        authUserId = created.user.id;
        authAction = "created";
      }
    }

    const dbPayload = {
      ...clientPayload,
      org_id: callerProfile.org_id,
      created_by: callingUser.id,
      auth_user_id: authUserId,
    };

    const { data: savedClient, error: saveError } = existingClient
      ? await admin
          .from("clients")
          .update({ ...clientPayload, org_id: callerProfile.org_id, auth_user_id: authUserId })
          .eq("id", existingClient.id)
          .select("id")
          .single()
      : await admin
          .from("clients")
          .insert(dbPayload)
          .select("id")
          .single();

    if (saveError || !savedClient) {
      if (!existingClient && authAction === "created" && authUserId) await admin.auth.admin.deleteUser(authUserId);
      return jsonResponse({ error: saveError?.message ?? "Errore salvataggio cliente", code: "client_save_failed" }, 400);
    }

    // Registra il fingerprint della nuova password (rimpiazza quello precedente per lo stesso cliente).
    if (passwordFingerprint) {
      await admin
        .from("password_fingerprints")
        .delete()
        .eq("owner_type", "client")
        .eq("owner_id", savedClient.id)
        .eq("org_id", callerProfile.org_id);
      const { error: fpErr } = await admin.from("password_fingerprints").insert({
        fingerprint: passwordFingerprint,
        owner_type: "client",
        owner_id: savedClient.id,
        org_id: callerProfile.org_id,
      });
      if (fpErr) {
        // Race molto improbabile: un altro account ha appena registrato lo stesso fingerprint.
        return jsonResponse({
          error: "Password già in uso da un altro account, scegline una diversa.",
          code: "password_in_use",
        }, 409);
      }
    }

    return jsonResponse({ success: true, client_id: savedClient.id, user_id: authUserId, action: existingClient ? "updated" : "created", auth_action: authAction });

  } catch (err) {
    console.error("create-client-account exception", err);
    return jsonResponse({ error: (err as Error).message ?? "Errore interno", code: "internal_error" }, 500);
  }
});
