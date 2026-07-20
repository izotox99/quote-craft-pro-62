import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AutistaHome() {
  const [nome, setNome] = useState<string>("");
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase.from("autisti")
        .select("nome, cognome").eq("auth_user_id", user.id).maybeSingle();
      if (a) setNome(`${a.cognome ?? ""} ${a.nome ?? ""}`.trim());

      const today = new Date().toISOString().slice(0, 10);
      const { count: c } = await supabase
        .from("servizi_autista_view" as any)
        .select("id", { count: "exact", head: true })
        .eq("data_servizio", today);
      setCount(c ?? 0);
      setLoading(false);
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/autista/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold">Ciao{nome ? `, ${nome}` : ""}</h1>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-1">
            <LogOut className="h-4 w-4" /> Esci
          </Button>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Servizi di oggi</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tabular-nums">{loading ? "…" : count}</div>
            <p className="text-xs text-muted-foreground mt-1">Assegnati a te per oggi</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
