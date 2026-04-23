import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedClientRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) { setChecking(false); return; }
      const { data: client } = await supabase
        .from("clients")
        .select("id, gdpr_accepted_at")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (client) {
        setIsClient(true);
        setGdprAccepted(!!client.gdpr_accepted_at);
        setChecking(false);
        return;
      }
      const { data: utenza } = await supabase
        .from("client_utenze")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("attivo", true)
        .maybeSingle();
      if (utenza) {
        setIsClient(true);
        setGdprAccepted(true);
      }
      setChecking(false);
    };
    if (!loading) check();
  }, [user, loading]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/client-login" replace />;
  if (!isClient) return <Navigate to="/client-login" replace />;
  if (!gdprAccepted) return <Navigate to="/client-portal/gdpr" replace />;

  return <>{children}</>;
}
