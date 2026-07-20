import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Car } from "lucide-react";

export default function AutistaLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Se già loggato come autista, vai in home
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: a } = await supabase.from("autisti")
        .select("id, attivo, password_cambiata_at, privacy_accettata_at")
        .eq("auth_user_id", user.id).maybeSingle();
      if (a?.attivo) {
        navigate(a.password_cambiata_at && a.privacy_accettata_at ? "/autista" : "/autista/setup", { replace: true });
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error || !data.user) { toast.error("Email o password non corretti"); return; }

      const { data: autista } = await supabase.from("autisti")
        .select("id, attivo, password_cambiata_at, privacy_accettata_at")
        .eq("auth_user_id", data.user.id).maybeSingle();

      if (!autista || !autista.attivo) {
        await supabase.auth.signOut();
        toast.error("Accesso riservato agli autisti attivi");
        return;
      }

      // Escludi collisioni con altre categorie
      const [{ data: role }, { data: prof }, { data: cli }, { data: ute }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("profiles").select("org_id").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("clients").select("id").eq("auth_user_id", data.user.id).maybeSingle(),
        supabase.from("client_utenze").select("id").eq("auth_user_id", data.user.id).eq("attivo", true).maybeSingle(),
      ]);
      if (role || prof?.org_id || cli || ute) {
        await supabase.auth.signOut();
        toast.error("Questo account non è un autista");
        return;
      }

      await supabase.from("autisti").update({ ultimo_accesso_at: new Date().toISOString() }).eq("id", autista.id);
      navigate(autista.password_cambiata_at && autista.privacy_accettata_at ? "/autista" : "/autista/setup", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-2xl">Area Autisti</CardTitle>
          <CardDescription>Accedi con le credenziali fornite dalla tua azienda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso…" : "Accedi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
