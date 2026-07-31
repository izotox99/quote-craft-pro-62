import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Star } from "lucide-react";
import { applyTilePrefs, TilePref } from "@/lib/autistaTiles";
import { romeToday } from "@/lib/romeDate";

const todayISO = (offset = 0) => romeToday(offset);

export default function AutistaHome() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [inServizio, setInServizio] = useState(false);
  const [inizioTurno, setInizioTurno] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [counts, setCounts] = useState({ oggi: 0, domani: 0, dopodomani: 0 });
  const [tilePrefs, setTilePrefs] = useState<TilePref[] | null>(null);
  const [sessioneVeicolo, setSessioneVeicolo] = useState<VeicoloSessione | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let autistaId: string | null = null;
      const { data: aInt } = await supabase.from("autisti").select("id, nome, cognome").eq("auth_user_id", user.id).maybeSingle();
      if (aInt) {
        setNome(`${aInt.nome ?? ""} ${aInt.cognome ?? ""}`.trim());
        autistaId = aInt.id;
      } else {
        const { data: aExt } = await supabase.from("autisti_esterni").select("id, nome").eq("auth_user_id", user.id).maybeSingle();
        if (aExt) { setNome(aExt.nome ?? ""); autistaId = aExt.id; }
      }

      if (aInt) {
        const { data: pref } = await supabase
          .from("autisti_preferenze").select("tasti").eq("autista_id", aInt.id).maybeSingle();
        setTilePrefs((pref?.tasti as unknown as TilePref[]) ?? null);
      }



      // Stato presenza reale
      if (autistaId) {
        const { data: pres } = await supabase
          .from("autisti_presenze")
          .select("inizio_at, fine_at")
          .is("fine_at", null)
          .order("inizio_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pres) {
          setInServizio(true);
          setInizioTurno(pres.inizio_at);
          const hrs = (Date.now() - new Date(pres.inizio_at).getTime()) / 3600000;
          if (hrs > 16) setWarn("Turno aperto da oltre 16 ore: ricordati di terminarlo");
        }
      }

      const load = async (date: string) => {
        const { count } = await supabase
          .from("servizi_autista_view" as any)
          .select("id", { count: "exact", head: true })
          .eq("data_servizio", date)
          .in("stato", ["confermato", "in_corso", "da_confermare"])
          .neq("stato_autista", "concluso");
        return count ?? 0;
      };
      const todayCount = await load(todayISO(0));
      setCounts({
        oggi: todayCount,
        domani: await load(todayISO(1)),
        dopodomani: await load(todayISO(2)),
      });

      // avviso: servizi già iniziati oggi ma nessun turno aperto
      if (!inizioTurno && autistaId) {
        const { count: started } = await supabase
          .from("servizi_autista_view" as any)
          .select("id", { count: "exact", head: true })
          .eq("data_servizio", todayISO(0))
          .eq("stato_autista", "in_corso");
        if ((started ?? 0) > 0) {
          setWarn("Hai servizi in corso ma nessun turno di presenza aperto");
        }
      }
    })();
  }, []);


  const badges: Record<string, number> = {
    oggi: counts.oggi, domani: counts.domani, dopodomani: counts.dopodomani,
  };
  const tiles = applyTilePrefs(tilePrefs).map((t) => ({
    label: t.label, icon: t.icon, to: t.to,
    badge: t.badgeKey ? badges[t.badgeKey] : undefined,
  }));

  return (
    <AutistaLayout>
      <div className="space-y-3">
        {/* Stato autista */}
        <button
          onClick={() => navigate("/autista/presenza")}
          className={`w-full rounded-xl p-4 flex items-center justify-between text-left shadow-sm ${
            inServizio ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-800"
          }`}
        >
          <div>
            <div className="text-xs opacity-80">Autista</div>
            <div className="font-display font-semibold text-lg">{nome || "—"}</div>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            {inServizio && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
            )}
            {inServizio ? `IN SERVIZIO dalle ${new Date(inizioTurno!).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}` : "NON IN SERVIZIO"}
          </div>
        </button>

        {warn && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2 text-xs">
            ⚠ {warn}
          </div>
        )}


        {/* Veicolo in uso */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-3">
              <Car className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase text-muted-foreground font-semibold">Veicolo in uso</div>
              {sessioneVeicolo?.veicolo ? (
                <>
                  <div className="font-semibold mt-1">{sessioneVeicolo.veicolo.targa}</div>
                  <div className="text-xs text-muted-foreground">
                    {[sessioneVeicolo.veicolo.marca, sessioneVeicolo.veicolo.modello].filter(Boolean).join(" ") || "—"}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground mt-1">Nessun veicolo selezionato</div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => navigate("/autista/veicolo")}
              >
                {sessioneVeicolo ? "Cambia veicolo" : "Seleziona veicolo"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Griglia 3x3 */}
        <div className="grid grid-cols-3 gap-2">
          {tiles.map(({ label, icon: Icon, to, badge }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="relative aspect-square rounded-xl bg-white border shadow-sm hover:shadow-md active:scale-95 transition flex flex-col items-center justify-center gap-1 p-2"
            >
              <Icon className="h-6 w-6 text-primary" />
              <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
              {typeof badge === "number" && badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate("/autista/preferiti")}
          className="w-full mt-2 py-3 rounded-xl border-dashed border-2 text-xs text-muted-foreground flex items-center justify-center gap-2"
        >
          <Star className="h-4 w-4" /> Modifica tasti preferiti
        </button>
      </div>
    </AutistaLayout>
  );
}
