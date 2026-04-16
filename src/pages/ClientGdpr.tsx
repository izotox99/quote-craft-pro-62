import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export default function ClientGdpr() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    const loadOrg = async () => {
      if (!user) return;
      const { data: client } = await supabase
        .from("clients")
        .select("org_id")
        .eq("auth_user_id", user.id)
        .single();
      if (client?.org_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", client.org_id)
          .single();
        if (org) setOrgName(org.name);
      }
    };
    loadOrg();
  }, [user]);

  const handleAccept = async () => {
    if (!accepted) {
      toast.error("Devi accettare l'informativa per continuare");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("clients")
      .update({ gdpr_accepted_at: new Date().toISOString() } as any)
      .eq("auth_user_id", user?.id);

    if (error) {
      toast.error("Errore nel salvataggio");
    } else {
      navigate("/client-portal");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-2xl rounded-2xl shadow-lg border-border/50">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-primary">
              INFORMATIVA AL TRATTAMENTO DEI DATI PERSONALI
            </h1>
          </div>

          <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
            <p className="text-center">
              I dati personali dell'utente sono utilizzati da <strong>{orgName || "la Società"}</strong>, che ne è titolare per il trattamento,
              nel rispetto dei principi di protezione dei dati personali stabiliti dal Regolamento GDPR 2016/679 e della
              normativa nazionale in vigore.
            </p>
            <p className="text-center">
              - Raccolta dati utenti per erogazione del servizio di trasporto con conducente
            </p>
            <p className="text-center">
              In particolare, per le finalità specificate di seguito i dati dell'utente saranno trattati SOLO su specifica
              accettazione del consenso:
            </p>
            <p className="text-center">
              - Invio di comunicazioni relative alla conferma dell'erogazione del servizio
            </p>
          </div>

          <div className="space-y-4 text-sm text-foreground leading-relaxed">
            <p className="text-center font-semibold">
              Il/I sottoscritto/i in calce identificato/i dichiara di aver ricevuto completa informativa ai sensi dell'art. 13 del
              Regolamento UE 2016/679 e della normativa nazionale in vigore, ed esprime il consenso al trattamento ed
              alla comunicazione dei propri dati personali, per le finalità e per la durata precisati nell'informativa.
            </p>
          </div>

          <div className="flex items-center gap-3 justify-center pt-4">
            <Checkbox
              id="gdpr-accept"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="h-5 w-5"
            />
            <label htmlFor="gdpr-accept" className="text-sm font-medium cursor-pointer">
              Accetta
            </label>
          </div>

          <Button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="w-full h-11 rounded-lg text-base font-medium"
          >
            {loading ? "Salvataggio..." : "Continua"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
