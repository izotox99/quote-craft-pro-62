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

type Ruolo = "admin" | "viewer";
function parseRuolo(v: unknown): Ruolo | null {
  const s = (v ?? "").toString();
  return s === "admin" || s === "viewer" ? s : null;
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 1000) return null;
    page += 1;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non consentito", code: "method_not_allowed" }, 405);
  }

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

    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);

    // Solo il titolare dell'organizzazione può gestire i membri
    const { data: org } = await admin
      .from("organizations")
      .select("id, name, owner_user_id")
      .eq("owner_user_id", caller.id)
      .maybeSingle();

    if (!org) {
      return jsonResponse(
        { error: "Solo il titolare dell'organizzazione può gestire i membri", code: "not_owner" },
        403,
      );
    }

    const body = await req.json().catch(() => ({}));
    const action: string = (body?.action ?? "list").toString();

    // ---------- LIST ----------
    if (action === "list") {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, full_name, created_at")
        .eq("org_id", org.id);

      const ids = (profiles ?? []).map((p) => p.user_id);
      const { data: roles } = ids.length
        ? await admin.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };

      const membri = [] as unknown[];
      for (const p of profiles ?? []) {
        const { data: u } = await admin.auth.admin.getUserById(p.user_id);
        const ruoli = (roles ?? []).filter((r) => r.user_id === p.user_id).map((r) => r.role);
        membri.push({
          user_id: p.user_id,
          full_name: p.full_name,
          email: u?.user?.email ?? null,
          ruolo: ruoli.includes("viewer") && ruoli.length === 1 ? "viewer" : (ruoli[0] ?? "viewer"),
          ruoli,
          is_owner: p.user_id === org.owner_user_id,
          ultimo_accesso: u?.user?.last_sign_in_at ?? null,
          invito_accettato: !!u?.user?.last_sign_in_at,
          created_at: p.created_at,
        });
      }

      membri.sort((a: any, b: any) => Number(b.is_owner) - Number(a.is_owner));
      return jsonResponse({ org: { id: org.id, name: org.name }, membri });
    }

    // ---------- INVITE ----------
    if (action === "invite") {
      const email = cleanEmail(body?.email);
      const ruolo = parseRuolo(body?.ruolo);
      const fullName = (body?.full_name ?? "").toString().trim() || null;
      const redirectTo = (body?.redirect_to ?? "").toString() || undefined;

      if (!email) return jsonResponse({ error: "Email obbligatoria", code: "missing_email" }, 400);
      if (!isValidEmail(email)) return jsonResponse({ error: "Email non valida", code: "invalid_email" }, 400);
      if (!ruolo) return jsonResponse({ error: "Ruolo non valido", code: "invalid_role" }, 400);

      // Email già usata da un cliente / utenza / autista?
      const [cli, ute, aut, autE] = await Promise.all([
        admin.from("clients").select("id").ilike("email", email).limit(1),
        admin.from("client_utenze").select("id").ilike("email", email).limit(1),
        admin.from("autisti").select("id").ilike("email", email).limit(1),
        admin.from("autisti_esterni").select("id").ilike("email", email).limit(1),
      ]);
      if (cli.data?.length) {
        return jsonResponse({ error: "Email già usata da un account cliente", code: "email_taken_client" }, 409);
      }
      if (ute.data?.length) {
        return jsonResponse({ error: "Email già usata da un'utenza cliente", code: "email_taken_utenza" }, 409);
      }
      if (aut.data?.length || autE.data?.length) {
        return jsonResponse({ error: "Email già usata da un autista", code: "email_taken_autista" }, 409);
      }

      const existing = await findUserByEmail(admin, email);
      let userId: string;

      if (existing) {
        const { data: existingProfile } = await admin
          .from("profiles").select("org_id").eq("user_id", existing.id).maybeSingle();
        if (existingProfile?.org_id && existingProfile.org_id !== org.id) {
          return jsonResponse(
            { error: "Email già usata da un altro account NCC", code: "email_taken_ncc" },
            409,
          );
        }
        if (existingProfile?.org_id === org.id) {
          return jsonResponse({ error: "Questa persona è già un membro", code: "already_member" }, 409);
        }
        userId = existing.id;
        await admin.from("profiles").upsert(
          { user_id: userId, org_id: org.id, full_name: fullName },
          { onConflict: "user_id" },
        );
      } else {
        const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { account_type: "org_member", full_name: fullName },
          redirectTo,
        });
        if (inviteErr || !invited?.user) {
          return jsonResponse(
            { error: inviteErr?.message ?? "Invito non riuscito", code: "invite_failed" },
            400,
          );
        }
        userId = invited.user.id;
        const { error: pErr } = await admin
          .from("profiles").insert({ user_id: userId, org_id: org.id, full_name: fullName });
        if (pErr) {
          await admin.auth.admin.deleteUser(userId);
          return jsonResponse({ error: pErr.message, code: "profile_failed" }, 400);
        }
      }

      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: ruolo });
      if (rErr) return jsonResponse({ error: rErr.message, code: "role_failed" }, 400);

      return jsonResponse({ success: true, user_id: userId, ruolo, invitato: !existing });
    }

    // ---------- CHANGE ROLE ----------
    if (action === "change_role") {
      const userId = (body?.user_id ?? "").toString();
      const ruolo = parseRuolo(body?.ruolo);
      if (!userId) return jsonResponse({ error: "user_id mancante", code: "missing_user" }, 400);
      if (!ruolo) return jsonResponse({ error: "Ruolo non valido", code: "invalid_role" }, 400);
      if (userId === org.owner_user_id) {
        return jsonResponse({ error: "Il titolare non può cambiare il proprio ruolo", code: "owner_locked" }, 403);
      }

      const { data: prof } = await admin
        .from("profiles").select("user_id").eq("user_id", userId).eq("org_id", org.id).maybeSingle();
      if (!prof) return jsonResponse({ error: "Membro non trovato", code: "not_member" }, 404);

      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: ruolo });
      if (rErr) return jsonResponse({ error: rErr.message, code: "role_failed" }, 400);

      return jsonResponse({ success: true, user_id: userId, ruolo });
    }

    // ---------- REVOKE ----------
    if (action === "revoke") {
      const userId = (body?.user_id ?? "").toString();
      if (!userId) return jsonResponse({ error: "user_id mancante", code: "missing_user" }, 400);
      if (userId === org.owner_user_id) {
        return jsonResponse({ error: "Il titolare non può essere rimosso", code: "owner_locked" }, 403);
      }

      const { data: prof } = await admin
        .from("profiles").select("user_id").eq("user_id", userId).eq("org_id", org.id).maybeSingle();
      if (!prof) return jsonResponse({ error: "Membro non trovato", code: "not_member" }, 404);

      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("user_id", userId).eq("org_id", org.id);
      await admin.auth.admin.deleteUser(userId).catch(() => {});

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Azione non riconosciuta", code: "unknown_action" }, 400);
  } catch (e) {
    console.error("manage-org-members error", e);
    return jsonResponse({ error: (e as Error).message ?? "Errore interno", code: "internal_error" }, 500);
  }
});
