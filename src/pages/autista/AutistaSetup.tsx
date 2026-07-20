import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ProtectedAutistaRoute } from "@/components/ProtectedAutistaRoute";

function SetupInner() {
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("La password deve avere almeno 8 caratteri");
    if (password !== conferma) return toast.error("Le password non coincidono");
    if (!privacy) return toast.error("Devi accettare l'informativa privacy");

    setSaving(true);
    try {
      const { error: pErr } = await supabase.auth.updateUser({ password });
      if (pErr) throw pErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta");

      const now = new Date().toISOString();
      const { data: aInt } = await supabase.from("autisti").select("id").eq("auth_user_id", user.id).maybeSingle();
      const table = aInt ? "autisti" : "autisti_esterni";
      const { error } = await supabase.from(table)
        .update({ password_cambiata_at: now, privacy_accettata_at: now })
        .eq("auth_user_id", user.id);
      if (error) throw error;

      toast.success("Impostazioni salvate");
      navigate("/autista", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-xl">Primo accesso</CardTitle>
          <CardDescription>Imposta una nuova password e accetta l'informativa privacy per continuare.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nuova password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label>Conferma password</Label>
              <Input type="password" value={conferma} onChange={(e) => setConferma(e.target.value)} required />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(!!v)} />
              <span>Accetto l'informativa privacy e il trattamento dei dati per finalità operative.</span>
            </label>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Salvataggio…" : "Continua"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AutistaSetup() {
  return (
    <ProtectedAutistaRoute requireSetup={false}>
      <SetupInner />
    </ProtectedAutistaRoute>
  );
}
