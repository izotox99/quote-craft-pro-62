import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedAutistaRoute({
  children,
  requireSetup = true,
}: {
  children: React.ReactNode;
  requireSetup?: boolean;
}) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAutista, setIsAutista] = useState(false);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      setChecking(true);
      if (!user) { if (active) setChecking(false); return; }

      const [{ data: autInt }, { data: autExt }] = await Promise.all([
        supabase.from("autisti")
          .select("id, attivo, password_cambiata_at, privacy_accettata_at")
          .eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("autisti_esterni")
          .select("id, attivo, password_cambiata_at, privacy_accettata_at")
          .eq("auth_user_id", user.id).maybeSingle(),
      ]);

      const autista = (autInt?.attivo ? autInt : null) ?? (autExt?.attivo ? autExt : null);
      if (!active) return;
      if (!autista) {
        setIsAutista(false);
        setChecking(false);
        return;
      }

      const [{ data: role }, { data: prof }, { data: cli }, { data: ute }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("org_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("clients").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("client_utenze").select("id").eq("auth_user_id", user.id).eq("attivo", true).maybeSingle(),
      ]);
      if (!active) return;

      if (role || prof?.org_id || cli || ute) {
        setIsAutista(false);
      } else {
        setIsAutista(true);
        setSetupDone(!!autista.password_cambiata_at && !!autista.privacy_accettata_at);
      }
      setChecking(false);
    };
    if (!loading) check();
    return () => { active = false; };
  }, [user, loading]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/autista/login" replace />;
  if (!isAutista) return <Navigate to="/autista/login" replace />;
  if (requireSetup && !setupDone) return <Navigate to="/autista/setup" replace />;

  return <>{children}</>;
}
