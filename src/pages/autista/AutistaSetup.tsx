import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ProtectedAutistaRoute } from "@/components/ProtectedAutistaRoute";

function SetupInner() {
  const [privacy, setPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacy) return toast.error("Devi accettare l'informativa privacy per continuare");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta");

      const now = new Date().toISOString();
      const { data: aInt } = await supabase.from("autisti").select("id").eq("auth_user_id", user.id).maybeSingle();
      const table = aInt ? "autisti" : "autisti_esterni";
      const { error } = await supabase.from(table)
        .update({ privacy_accettata_at: now })
        .eq("auth_user_id", user.id);
      if (error) throw error;

      toast.success("Informativa accettata");
      navigate("/autista", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-xl">Informativa privacy</CardTitle>
          <CardDescription>
            Per proseguire, leggi l'informativa e accetta il trattamento dei dati per finalità operative.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm leading-relaxed space-y-2 mb-4">
            <p>
              I dati personali (anagrafica, contatti, patente, codice fiscale) e i dati di servizio
              (presenze, ore lavorate, servizi eseguiti, chilometraggi) sono trattati dall'azienda
              titolare per finalità di gestione del rapporto di lavoro/collaborazione, pianificazione
              e rendicontazione dei servizi di noleggio con conducente.
            </p>
            <p>
              I dati sono conservati per il tempo necessario agli obblighi contrattuali, contabili e
              fiscali. Non vengono ceduti a terzi al di fuori dei casi previsti dalla legge o
              necessari all'esecuzione del servizio (es. clienti a cui è destinato il servizio).
            </p>
            <p>
              In qualunque momento puoi esercitare i diritti previsti dal GDPR (accesso, rettifica,
              cancellazione, limitazione, opposizione) contattando l'ufficio della tua azienda.
            </p>
            <p className="text-muted-foreground">
              Le credenziali di accesso all'app sono gestite esclusivamente dall'ufficio: per
              modifica o reimpostazione della password rivolgiti al tuo referente aziendale.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(!!v)} />
              <span>Ho letto e accetto l'informativa privacy e il trattamento dei dati per finalità operative.</span>
            </label>
            <Button type="submit" className="w-full" disabled={saving || !privacy}>
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
