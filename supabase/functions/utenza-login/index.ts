import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e password obbligatori" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find utenza by email + plain password (legacy storage on client_utenze)
    const { data: utenza, error: utenzaErr } = await admin
      .from("client_utenze")
      .select("id, email, password, attivo, auth_user_id, parent_client_id")
      .eq("email", email)
      .maybeSingle();

    if (utenzaErr || !utenza) {
      return new Response(JSON.stringify({ error: "Credenziali non valide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!utenza.attivo) {
      return new Response(JSON.stringify({ error: "Utenza disattivata" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (utenza.password !== password) {
      return new Response(JSON.stringify({ error: "Credenziali non valide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reuse a strong, deterministic auth password (the one user provided isn't enough on its own).
    // Use a per-utenza derived password so the auth account can be re-signed-in via the same flow.
    const authPassword = `utz_${utenza.id}_${utenza.password}`;

    let authUserId = utenza.auth_user_id as string | null;

    if (!authUserId) {
      // Try to find by email first (might already exist as parent client account, etc.)
      // We cannot share the same email with parent client, so we use a synthetic email per utenza.
      const syntheticEmail = `utenza+${utenza.id}@portal.local`;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: authPassword,
        email_confirm: true,
        user_metadata: { utenza_id: utenza.id, real_email: utenza.email },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || "Errore creazione account" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authUserId = created.user.id;

      await admin.from("client_utenze").update({ auth_user_id: authUserId }).eq("id", utenza.id);
    } else {
      // Make sure the password matches our derived one
      await admin.auth.admin.updateUserById(authUserId, { password: authPassword });
    }

    return new Response(
      JSON.stringify({
        synthetic_email: `utenza+${utenza.id}@portal.local`,
        auth_password: authPassword,
        utenza_id: utenza.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
