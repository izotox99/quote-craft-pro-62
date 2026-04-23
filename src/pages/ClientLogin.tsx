import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Car, LogIn } from "lucide-react";

export default function ClientLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Inserisci email e password");
      return;
    }
    setLoading(true);
    try {
      // 1) Try parent-client login (direct auth)
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        const { data: client } = await supabase
          .from("clients")
          .select("id, gdpr_accepted_at")
          .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (client) {
          if (!client.gdpr_accepted_at) navigate("/client-portal/gdpr");
          else navigate("/client-portal");
          return;
        }
        // Logged in but not a client → sign out and try utenza fallback
        await supabase.auth.signOut();
      }

      // 2) Fallback: try utenza login via edge function
      const { data: utenzaResp, error: fnErr } = await supabase.functions.invoke("utenza-login", {
        body: { email, password },
      });
      if (fnErr || !utenzaResp?.synthetic_email) {
        toast.error("Credenziali non valide");
        return;
      }

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: utenzaResp.synthetic_email,
        password: utenzaResp.auth_password,
      });
      if (signErr) {
        toast.error("Errore di accesso");
        return;
      }

      // Utenze skip GDPR (parent client already accepted)
      navigate("/client-portal");
    } catch {
      toast.error("Errore durante il login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md rounded-2xl shadow-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Car className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Area Clienti</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Accedi con le credenziali fornite dalla tua società
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="La tua email"
                className="rounded-lg h-11"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="La tua password"
                className="rounded-lg h-11"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-lg text-base font-medium gap-2" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <a href="/login" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Sei una società di NCC? Accedi qui
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
