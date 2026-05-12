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
        const uid = (await supabase.auth.getUser()).data.user?.id;
        const { data: client } = await supabase
          .from("clients")
          .select("id, gdpr_accepted_at")
          .eq("auth_user_id", uid)
          .maybeSingle();

        if (client) {
          if (!client.gdpr_accepted_at) navigate("/client-portal/gdpr");
          else navigate("/client-portal");
          return;
        }
        // Logged in but not a client → check utenza link before falling back
        const { data: utenzaLink } = await supabase
          .from("client_utenze")
          .select("id, attivo")
          .eq("auth_user_id", uid)
          .maybeSingle();
        if (utenzaLink?.attivo) {
          navigate("/client-portal");
          return;
        }
        await supabase.auth.signOut();
        toast.error("Account non collegato a un profilo cliente. Contatta l'amministratore.");
        return;
      }

      // 2) Fallback: try utenza login via edge function
      const { data: utenzaResp, error: fnErr } = await supabase.functions.invoke("utenza-login", {
        body: { email: email.trim().toLowerCase(), password },
      });

      // Edge function returned a non-2xx: extract specific error message
      if (fnErr) {
        let msg = "Email o password non corretti";
        const ctx = (fnErr as { context?: Response }).context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const raw = await ctx.text();
            if (raw) {
              const body = JSON.parse(raw);
              if (body?.error) msg = body.error;
            }
          } catch {
            // ignore parse errors, keep default
          }
        }
        toast.error(msg);
        return;
      }

      if (!utenzaResp?.synthetic_email) {
        toast.error(utenzaResp?.error || "Credenziali non valide");
        return;
      }

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: utenzaResp.synthetic_email,
        password: utenzaResp.auth_password,
      });
      if (signErr) {
        toast.error("Errore di accesso. Riprova più tardi.");
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
          <div className="mt-6 pt-4 border-t border-border/50 text-center space-y-2">
            <p className="text-xs text-muted-foreground">Sei una società di NCC?</p>
            <Button asChild variant="outline" className="w-full h-10 rounded-lg">
              <a href="/login">Accedi come NCC</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
