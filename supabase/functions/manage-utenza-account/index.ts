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

    const { data: { user: callingUser }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !callingUser) {
      return jsonResponse({ error: "Non autorizzato", code: "unauthorized" }, 401);
    }

    // Risolve il parent_client_id del chiamante (cliente titolare del portale).
    const { data: parentClient } = await admin
      .from("clients")
      .select("id, org_id")
      .eq("auth_user_id", callingUser.id)
      .maybeSingle();

    if (!parentClient) {
      return jsonResponse({ error: "Account cliente non trovato", code: "not_client" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action: string = (body?.action ?? "").toString();

    // --- Azione: create ---
    if (action === "create") {
      const nome = cleanString(body?.nome);
      const cognome = cleanString(body?.cognome);
      const cellulare = cleanString(body?.cellulare);
      const email = cleanString(body?.email)?.toLowerCase() ?? null;
      const password = (body?.password ?? "").toString();
      const tipo = body?.tipo === "gruppo" ? "gruppo" : "singolo";

      if (!nome || !email || !password) {
        return jsonResponse({ error: "Campi obbligatori mancanti", code: "missing_fields" }, 400);
      }
      if (!isValidEmail(email)) {
        return jsonResponse({ error: "Email non valida", code: "invalid_email" }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: "La password deve avere almeno 6 caratteri", code: "weak_password" }, 400);
      }

      const fingerprint = await computePasswordFingerprint(password);
      const { data: existingFp } = await admin
        .from("password_fingerprints")
        .select("owner_type, owner_id")
        .eq("fingerprint", fingerprint)
        .maybeSingle();
      if (existingFp) {
        return jsonResponse({
          error: "Password già in uso da un altro account, scegline una diversa.",
          code: "password_in_use",
        }, 409);
      }

      // Hash bcrypt via RPC esistente.
      const { data: hash, error: hashErr } = await admin.rpc("hash_utenza_password", { _password: password });
      if (hashErr || !hash) {
        return jsonResponse({ error: "Errore nella cifratura della password", code: "hash_failed" }, 500);
      }

      const { data: inserted, error: insErr } = await admin
        .from("client_utenze")
        .insert({
          parent_client_id: parentClient.id,
          nome,
          cognome: cognome ?? "",
          cellulare,
          email,
          password_hash: hash,
          tipo,
        })
        .select("id")
        .single();

      if (insErr || !inserted) {
        return jsonResponse({ error: insErr?.message ?? "Errore inserimento utenza", code: "insert_failed" }, 400);
      }

      const { error: fpErr } = await admin.from("password_fingerprints").insert({
        fingerprint,
        owner_type: "utenza",
        owner_id: inserted.id,
        org_id: parentClient.org_id,
      });
      if (fpErr) {
        // Rollback dell'utenza per mantenere la coerenza.
        await admin.from("client_utenze").delete().eq("id", inserted.id);
        return jsonResponse({
          error: "Password già in uso da un altro account, scegline una diversa.",
          code: "password_in_use",
        }, 409);
      }

      return jsonResponse({ success: true, utenza_id: inserted.id });
    }

    // --- Azione: update ---
    if (action === "update") {
      const utenzaId = cleanString(body?.utenza_id);
      if (!utenzaId) {
        return jsonResponse({ error: "utenza_id obbligatorio", code: "missing_fields" }, 400);
      }
      const { data: utenzaRow, error: utenzaErr } = await admin
        .from("client_utenze")
        .select("id, parent_client_id")
        .eq("id", utenzaId)
        .maybeSingle();
      if (utenzaErr || !utenzaRow) {
        return jsonResponse({ error: "Utenza non trovata", code: "not_found" }, 404);
      }
      if (utenzaRow.parent_client_id !== parentClient.id) {
        return jsonResponse({ error: "Non autorizzato", code: "forbidden" }, 403);
      }

      const updateData: Record<string, unknown> = {};
      if (body?.nome !== undefined) updateData.nome = cleanString(body.nome) ?? "";
      if (body?.cognome !== undefined) updateData.cognome = cleanString(body.cognome) ?? "";
      if (body?.cellulare !== undefined) updateData.cellulare = cleanString(body.cellulare);
      if (body?.email !== undefined) {
        const email = cleanString(body.email)?.toLowerCase() ?? null;
        if (email && !isValidEmail(email)) {
          return jsonResponse({ error: "Email non valida", code: "invalid_email" }, 400);
        }
        updateData.email = email;
      }
      if (body?.tipo !== undefined) updateData.tipo = body.tipo === "gruppo" ? "gruppo" : "singolo";

      const password = (body?.password ?? "").toString();
      if (password) {
        if (password.length < 6) {
          return jsonResponse({ error: "La password deve avere almeno 6 caratteri", code: "weak_password" }, 400);
        }
        const fingerprint = await computePasswordFingerprint(password);
        const { data: existingFp } = await admin
          .from("password_fingerprints")
          .select("owner_type, owner_id")
          .eq("fingerprint", fingerprint)
          .maybeSingle();
        if (existingFp && !(existingFp.owner_type === "utenza" && existingFp.owner_id === utenzaId)) {
          return jsonResponse({
            error: "Password già in uso da un altro account, scegline una diversa.",
            code: "password_in_use",
          }, 409);
        }

        const { data: hash, error: hashErr } = await admin.rpc("hash_utenza_password", { _password: password });
        if (hashErr || !hash) {
          return jsonResponse({ error: "Errore nella cifratura della password", code: "hash_failed" }, 500);
        }
        updateData.password_hash = hash;

        await admin
          .from("password_fingerprints")
          .delete()
          .eq("owner_type", "utenza")
          .eq("owner_id", utenzaId);
        const { error: fpErr } = await admin.from("password_fingerprints").insert({
          fingerprint,
          owner_type: "utenza",
          owner_id: utenzaId,
          org_id: parentClient.org_id,
        });
        if (fpErr) {
          return jsonResponse({
            error: "Password già in uso da un altro account, scegline una diversa.",
            code: "password_in_use",
          }, 409);
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updErr } = await admin.from("client_utenze").update(updateData).eq("id", utenzaId);
        if (updErr) return jsonResponse({ error: updErr.message, code: "update_failed" }, 400);
      }
      return jsonResponse({ success: true });
    }

    // --- Azione: toggle_attivo ---
    if (action === "toggle_attivo") {
      const utenzaId = cleanString(body?.utenza_id);
      if (!utenzaId) return jsonResponse({ error: "utenza_id obbligatorio", code: "missing_fields" }, 400);
      const { data: row } = await admin
        .from("client_utenze")
        .select("attivo, parent_client_id")
        .eq("id", utenzaId)
        .maybeSingle();
      if (!row || row.parent_client_id !== parentClient.id) {
        return jsonResponse({ error: "Non autorizzato", code: "forbidden" }, 403);
      }
      const { error } = await admin.from("client_utenze").update({ attivo: !row.attivo }).eq("id", utenzaId);
      if (error) return jsonResponse({ error: error.message, code: "update_failed" }, 400);
      return jsonResponse({ success: true, attivo: !row.attivo });
    }

    // --- Azione: delete ---
    if (action === "delete") {
      const utenzaId = cleanString(body?.utenza_id);
      if (!utenzaId) return jsonResponse({ error: "utenza_id obbligatorio", code: "missing_fields" }, 400);
      const { data: row } = await admin
        .from("client_utenze")
        .select("id, parent_client_id, auth_user_id")
        .eq("id", utenzaId)
        .maybeSingle();
      if (!row || row.parent_client_id !== parentClient.id) {
        return jsonResponse({ error: "Non autorizzato", code: "forbidden" }, 403);
      }

      const { error: delErr } = await admin.from("client_utenze").delete().eq("id", utenzaId);
      if (delErr) return jsonResponse({ error: delErr.message, code: "delete_failed" }, 400);

      await admin
        .from("password_fingerprints")
        .delete()
        .eq("owner_type", "utenza")
        .eq("owner_id", utenzaId);

      // Cleanup auth user se non referenziato altrove.
      if (row.auth_user_id) {
        const [{ data: otherUtenza }, { data: otherClient }, { data: prof }, { data: roleRow }] = await Promise.all([
          admin.from("client_utenze").select("id").eq("auth_user_id", row.auth_user_id).maybeSingle(),
          admin.from("clients").select("id").eq("auth_user_id", row.auth_user_id).maybeSingle(),
          admin.from("profiles").select("user_id").eq("user_id", row.auth_user_id).maybeSingle(),
          admin.from("user_roles").select("user_id").eq("user_id", row.auth_user_id).maybeSingle(),
        ]);
        if (!otherUtenza && !otherClient && !prof && !roleRow) {
          await admin.auth.admin.deleteUser(row.auth_user_id);
        }
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Azione non riconosciuta", code: "unknown_action" }, 400);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? "Errore interno", code: "internal_error" }, 500);
  }
});
