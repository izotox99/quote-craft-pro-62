import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, organization } = useAuth();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);
  const [isClientAccount, setIsClientAccount] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      setCheckingAccess(true);
      setHasDashboardAccess(false);
      setIsClientAccount(false);

      if (!user) {
        if (active) setCheckingAccess(false);
        return;
      }

      if (role && organization) {
        if (active) {
          setHasDashboardAccess(true);
          setCheckingAccess(false);
        }
        return;
      }

      const [{ data: profile }, { data: roles }, { data: client }, { data: utenza }, { data: autista }] = await Promise.all([
        supabase.from("profiles").select("org_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
        supabase.from("clients").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("client_utenze").select("id").eq("auth_user_id", user.id).eq("attivo", true).maybeSingle(),
        supabase.from("autisti").select("id").eq("auth_user_id", user.id).eq("attivo", true).maybeSingle(),
      ]);

      if (!active) return;
      // Un autista non può mai entrare nella dashboard NCC
      if (autista) {
        setHasDashboardAccess(false);
        setIsClientAccount(false);
        setCheckingAccess(false);
        return;
      }
      setHasDashboardAccess(!!profile?.org_id && Array.isArray(roles) && roles.length > 0);
      setIsClientAccount(!!client || !!utenza);
      setCheckingAccess(false);

    };

    if (!loading) checkAccess();
    return () => { active = false; };
  }, [loading, user, role, organization]);

  if (loading || checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (hasDashboardAccess) return <>{children}</>;
  if (isClientAccount) return <Navigate to="/login" replace />;

  return <Navigate to="/login" replace />;
}
