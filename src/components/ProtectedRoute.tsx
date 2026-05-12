import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, organization } = useAuth();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasDashboardAccess, setHasDashboardAccess] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      if (loading) return;
      if (!user) {
        if (active) {
          setHasDashboardAccess(false);
          setCheckingAccess(false);
        }
        return;
      }

      if (role && organization) {
        if (active) {
          setHasDashboardAccess(true);
          setCheckingAccess(false);
        }
        return;
      }

      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
        supabase.from("profiles").select("org_id").eq("user_id", user.id).maybeSingle(),
      ]);

      if (active) {
        setHasDashboardAccess(Boolean(roles?.length && profile?.org_id));
        setCheckingAccess(false);
      }
    };

    checkAccess();
    return () => { active = false; };
  }, [loading, organization, role, user]);

  if (loading || checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!hasDashboardAccess) return <Navigate to="/client-portal" replace />;
  return <>{children}</>;
}
