import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Info, LogOut, ShieldCheck, Star } from "lucide-react";

const APP_VERSION = "1.0.0";

type Notif = {
  nuovi_servizi: boolean;
  modifiche_servizi: boolean;
  comunicazioni: boolean;
  ferie: boolean;
};

const DEFAULT_NOTIF: Notif = {
  nuovi_servizi: true,
  modifiche_servizi: true,
  comunicazioni: true,
  ferie: true,
};

export default function AutistaImpostazioni() {
  const navigate = useNavigate();
  const [me, setMe] = useState<{ id: string; org_id: string } | null>(null);
  const [notif, setNotif] = useState<Notif>(DEFAULT_NOTIF);
  const [privacy, setPrivacy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: a } = await supabase
        .from("autisti").select("id, org_id").eq("auth_user_id", user.id).maybeSingle();
      if (!a) return;
      setMe({ id: a.id, org_id: a.org_id });
      const { data: p } = await supabase
        .from("autisti_preferenze").select("notifiche").eq("autista_id", a.id).maybeSingle();
      if (p?.notifiche) setNotif({ ...DEFAULT_NOTIF, ...(p.notifiche as unknown as Notif) });
    })();
  }, []);

  const save = async (next: Notif) => {
    setNotif(next);
    if (!me) return;
    const { error } = await supabase
      .from("autisti_preferenze")
      .upsert({ autista_id: me.id, org_id: me.org_id, notifiche: next as any }, { onConflict: "autista_id" });
    if (error) toast.error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/autista/login");
  };

  const row = (key: keyof Notif, label: string, desc: string) => (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-0">
      <div className="min-w-0">
        <Label htmlFor={key} className="text-sm">{label}</Label>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Switch id={key} checked={notif[key]} onCheckedChange={(v) => save({ ...notif, [key]: v })} />
    </div>
  );

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <button onClick={() => navigate("/autista")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <h1 className="font-display font-semibold text-lg">Impostazioni</h1>

        <Card className="p-4 rounded-2xl">
          <div className="text-xs uppercase font-semibold text-muted-foreground mb-1">Notifiche</div>
          {row("nuovi_servizi", "Nuovi servizi assegnati", "Avviso quando l'ufficio ti assegna un servizio")}
          {row("modifiche_servizi", "Modifiche ai servizi", "Cambi di orario, luogo o passeggeri")}
          {row("comunicazioni", "Comunicazioni e note", "Messaggi inviati dall'ufficio")}
          {row("ferie", "Esito richieste ferie", "Approvazione o rifiuto delle tue richieste")}
        </Card>

        <Card className="rounded-2xl divide-y overflow-hidden">
          <button
            onClick={() => navigate("/autista/preferiti")}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left"
          >
            <Star className="h-5 w-5 text-primary" />
            <span className="flex-1 text-sm font-medium">Tasti preferiti</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setPrivacy((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left"
          >
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="flex-1 text-sm font-medium">Informativa privacy</span>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition ${privacy ? "rotate-90" : ""}`} />
          </button>
          {privacy && (
            <div className="px-4 py-3 text-[12px] leading-relaxed text-muted-foreground space-y-2">
              <p>
                I dati raccolti dall'app (presenze, ore, servizi, spese, posizione dei servizi assegnati,
                foto dei giustificativi) sono trattati dalla tua azienda esclusivamente per la gestione
                del rapporto di lavoro e dei servizi di noleggio con conducente.
              </p>
              <p>
                La fotografia del profilo viene mostrata al cliente solo se hai dato consenso esplicito
                nella pagina Profilo; puoi revocarlo in qualsiasi momento.
              </p>
              <p>
                Puoi richiedere accesso, rettifica o cancellazione dei tuoi dati contattando l'ufficio.
                Le credenziali di accesso sono gestite dall'azienda.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-4 rounded-2xl text-sm flex items-center gap-2 text-muted-foreground">
          <Info className="h-4 w-4" />
          Versione app <span className="font-medium tabular-nums text-foreground">{APP_VERSION}</span>
        </Card>

        <p className="text-[11px] text-muted-foreground px-1">
          La password è gestita dall'ufficio: per cambiarla contatta l'azienda.
        </p>

        <Button variant="destructive" className="w-full min-h-[44px]" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" /> Esci
        </Button>
      </div>
    </AutistaLayout>
  );
}
