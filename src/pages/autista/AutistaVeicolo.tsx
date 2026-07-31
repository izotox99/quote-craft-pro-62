import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Check } from "lucide-react";
import { toast } from "sonner";
import {
  apriSessioneVeicolo,
  chiudiSessioneVeicolo,
  getSessioneVeicoloAttiva,
  VeicoloSessione,
} from "@/lib/veicoloSessione";

type Veicolo = { id: string; targa: string; marca: string | null; modello: string | null; km_attuale: number | null };

export default function AutistaVeicolo() {
  const navigate = useNavigate();
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [sessione, setSessione] = useState<VeicoloSessione | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("veicoli")
      .select("id, targa, marca, modello, km_attuale")
      .eq("attivo", true)
      .order("targa");
    setVeicoli((data ?? []) as Veicolo[]);
    setSessione(await getSessioneVeicoloAttiva());
  };

  useEffect(() => { load(); }, []);

  const seleziona = async (id: string) => {
    setBusy(true);
    try {
      await apriSessioneVeicolo(id);
      toast.success("Veicolo selezionato");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore");
    } finally { setBusy(false); }
  };

  const rilascia = async () => {
    setBusy(true);
    try {
      await chiudiSessioneVeicolo();
      toast.success("Veicolo rilasciato");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore");
    } finally { setBusy(false); }
  };

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground font-semibold">Veicolo in uso</div>
          {sessione?.veicolo ? (
            <>
              <div className="font-display font-semibold text-lg mt-1">{sessione.veicolo.targa}</div>
              <div className="text-sm text-muted-foreground">
                {[sessione.veicolo.marca, sessione.veicolo.modello].filter(Boolean).join(" ") || "—"}
              </div>
              <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={rilascia}>
                Rilascia veicolo
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground mt-1">Nessun veicolo selezionato</div>
          )}
        </Card>

        <div className="space-y-2">
          {veicoli.map((v) => {
            const attivo = sessione?.veicolo_id === v.id;
            return (
              <button
                key={v.id}
                disabled={busy}
                onClick={() => seleziona(v.id)}
                className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 bg-card ${attivo ? "border-primary" : ""}`}
              >
                <div className="rounded-lg bg-muted p-2"><Car className="h-5 w-5 text-muted-foreground" /></div>
                <div className="flex-1">
                  <div className="font-medium">{v.targa}</div>
                  <div className="text-xs text-muted-foreground">
                    {[v.marca, v.modello].filter(Boolean).join(" ") || "—"}
                    {v.km_attuale != null && ` · ${v.km_attuale.toLocaleString("it-IT")} km`}
                  </div>
                </div>
                {attivo && <Check className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
          {veicoli.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">Nessun veicolo disponibile</div>
          )}
        </div>

        <Button variant="ghost" className="w-full" onClick={() => navigate("/autista")}>Torna alla home</Button>
      </div>
    </AutistaLayout>
  );
}
