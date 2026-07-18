import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const accounts = [
    { email: "test-orga@roadtoitaly.test", password: "TestOrgA-2026!", company_name: "Test Org A" },
    { email: "test-orgb@roadtoitaly.test", password: "TestOrgB-2026!", company_name: "Test Partner B" },
  ];

  const results: any[] = [];

  for (const acc of accounts) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { company_name: acc.company_name },
    });

    if (error) {
      results.push({ email: acc.email, error: error.message });
      continue;
    }

    const userId = created.user!.id;
    // Wait briefly then verify handle_new_user side effects
    await new Promise((r) => setTimeout(r, 500));

    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, org_id")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    let org = null;
    if (profile?.org_id) {
      const { data: o } = await admin
        .from("organizations")
        .select("id, name")
        .eq("id", profile.org_id)
        .maybeSingle();
      org = o;
    }

    results.push({
      email: acc.email,
      user_id: userId,
      profile,
      role: role?.role ?? null,
      organization: org,
      ok: !!(profile?.org_id && role?.role === "admin" && org),
    });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
