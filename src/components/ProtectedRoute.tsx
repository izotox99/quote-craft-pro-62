import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, organization } = useAuth();
  const [checkingClient, setCheckingClient] = useState(true);
  const [isClientAccount, setIsClientAccount] = useState(false);

  useEffect(() => {
    let active = true;
    const checkClient = async () => {
      setCheckingClient(true);
      setIsClientAccount(false);

      if (!user || role || organization) {
        if (active) setCheckingClient(false);
        return;
      }

      const [{ data: client }, { data: utenza }] = await Promise.all([
        supabase.from("clients").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("client_utenze").select("id").eq("auth_user_id", user.id).eq("attivo", true).maybeSingle(),
      ]);

      if (!active) return;
      setIsClientAccount(!!client || !!utenza);
      setCheckingClient(false);
    };

    if (!loading) checkClient();
    return () => { active = false; };
  }, [loading, user, role, organization]);

  if (loading || checkingClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role && organization) return <>{children}</>;

  if (isClientAccount) return <Navigate to="/login" replace />;

  return <Navigate to="/login" replace />;
}
