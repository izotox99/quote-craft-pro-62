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

// A handful of well-known compromised passwords (they appear millions of times in HIBP).
const LEAKED_PASSWORDS = ["Password123!", "Qwerty12345", "Welcome2024!"];

function strongPassword() {
  // 24 random bytes -> base64url, plus a digit & symbol — guaranteed not in HIBP.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `Zx9!${b64}`;
}

function isHibpRejection(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("pwned") ||
    m.includes("compromised") ||
    m.includes("data breach") ||
    m.includes("breach") ||
    m.includes("weak_password") ||
    m.includes("hibp")
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  // ---- AuthZ: only admins can run this ----
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return jsonResponse({ error: "Forbidden — admin only" }, 403);

  // ---- Run the verification ----
  const anon = createClient(supabaseUrl, anonKey);
  const results: Array<{
    name: string;
    description: string;
    expected: "rejected" | "accepted";
    outcome: "rejected" | "accepted" | "error";
    passed: boolean;
    detail?: string;
  }> = [];
  const createdUserIds: string[] = [];

  // 1) Signup with a leaked password — must be rejected
  for (const pwd of LEAKED_PASSWORDS) {
    const email = `hibp-check+${crypto.randomUUID()}@portal.local`;
    const { data, error } = await anon.auth.signUp({ email, password: pwd });
    if (error) {
      results.push({
        name: `Signup blocca password compromessa "${pwd.slice(0, 4)}…"`,
        description: "Registrazione con password presente in HIBP",
        expected: "rejected",
        outcome: isHibpRejection(error.message) ? "rejected" : "error",
        passed: isHibpRejection(error.message),
        detail: error.message,
      });
    } else {
      // Got created → protection NOT enforced. Track for cleanup.
      if (data.user?.id) createdUserIds.push(data.user.id);
      results.push({
        name: `Signup blocca password compromessa "${pwd.slice(0, 4)}…"`,
        description: "Registrazione con password presente in HIBP",
        expected: "rejected",
        outcome: "accepted",
        passed: false,
        detail: "Signup riuscito: la protezione HIBP non sta filtrando questa password.",
      });
    }
  }

  // 2) Control: signup with a strong random password — must succeed
  const strongEmail = `hibp-check+${crypto.randomUUID()}@portal.local`;
  const strongPwd = strongPassword();
  const { data: strongData, error: strongErr } = await anon.auth.signUp({
    email: strongEmail,
    password: strongPwd,
  });
  if (strongErr) {
    results.push({
      name: "Signup accetta password forte (controllo)",
      description: "Una password casuale di 24+ caratteri deve passare",
      expected: "accepted",
      outcome: "error",
      passed: false,
      detail: strongErr.message,
    });
  } else {
    if (strongData.user?.id) createdUserIds.push(strongData.user.id);
    results.push({
      name: "Signup accetta password forte (controllo)",
      description: "Una password casuale di 24+ caratteri deve passare",
      expected: "accepted",
      outcome: "accepted",
      passed: true,
    });

    // 3) Update existing user password to a leaked one — must be rejected
    if (strongData.user?.id) {
      const { error: updErr } = await admin.auth.admin.updateUserById(strongData.user.id, {
        password: LEAKED_PASSWORDS[0],
      });
      if (updErr) {
        results.push({
          name: "Reset blocca password compromessa",
          description: "Cambio password verso una password presente in HIBP",
          expected: "rejected",
          outcome: isHibpRejection(updErr.message) ? "rejected" : "error",
          passed: isHibpRejection(updErr.message),
          detail: updErr.message,
        });
      } else {
        results.push({
          name: "Reset blocca password compromessa",
          description: "Cambio password verso una password presente in HIBP",
          expected: "rejected",
          outcome: "accepted",
          passed: false,
          detail: "Update riuscito: la protezione HIBP non blocca i reset password.",
        });
      }
    }
  }

  // ---- Cleanup: delete every user we created during the test ----
  for (const id of createdUserIds) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch (e) {
      console.error("[verify-hibp-protection] cleanup failed:", (e as Error).message);
    }
  }

  const allPassed = results.every((r) => r.passed);
  return jsonResponse({
    ok: allPassed,
    summary: allPassed
      ? "Protezione leaked password attiva e funzionante."
      : "Almeno un controllo è fallito. Verifica la configurazione di sicurezza.",
    results,
    cleaned_up: createdUserIds.length,
  });
});
