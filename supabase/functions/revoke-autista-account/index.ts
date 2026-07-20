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
  if (req.method !== "POST") return jsonResponse({ error: "Metodo non consentito" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Non autorizzato" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser } } = await userClient.auth.getUser();
    if (!callingUser) return jsonResponse({ error: "Non autorizzato" }, 401);

    const { data: callerProfile } = await admin
      .from("profiles").select("org_id").eq("user_id", callingUser.id).maybeSingle();
    if (!callerProfile?.org_id) return jsonResponse({ error: "Org mancante" }, 403);

    const body = await req.json().catch(() => ({}));
    const autistaId: string | null = body?.autista_id ?? null;
    const tipoRaw: string = (body?.tipo ?? "interno").toString();
    const tipo: "interno" | "esterno" = tipoRaw === "esterno" ? "esterno" : "interno";
    const table = tipo === "esterno" ? "autisti_esterni" : "autisti";
    const ownerType = tipo === "esterno" ? "autista_esterno" : "autista";

    if (!autistaId) return jsonResponse({ error: "autista_id mancante" }, 400);

    const { data: autista } = await admin
      .from(table).select("id, org_id, auth_user_id").eq("id", autistaId).maybeSingle();
    if (!autista) return jsonResponse({ error: "Autista non trovato" }, 404);
    if ((autista as any).org_id !== callerProfile.org_id) {
      return jsonResponse({ error: "Non autorizzato" }, 403);
    }

    const authUserId = (autista as any).auth_user_id;
    if (authUserId) {
      // Prima azzera il riferimento per evitare cascade indesiderati
      await admin.from(table).update({
        auth_user_id: null,
        password_cambiata_at: null,
        privacy_accettata_at: null,
      }).eq("id", autistaId);
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }

    await admin.from("password_fingerprints").delete()
      .eq("owner_type", ownerType).eq("owner_id", autistaId);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? "Errore" }, 500);
  }
});
