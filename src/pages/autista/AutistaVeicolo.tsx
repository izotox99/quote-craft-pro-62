import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Car, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  apriSessioneVeicolo, chiudiSessioneVeicolo, getSessioneVeicoloAttiva, getVeicoliOccupati,
  VeicoloOccupato, VeicoloSessione,
} from "@/lib/veicoloSessione";

type Veicolo = {
  id: string; targa: string; marca: string | null; modello: string | null;
  km_attuale: number | null; photo_url: string | null;
};

function Targa({ value }: { value: string }) {
  return (
    <span className="inline-flex items-stretch rounded-[4px] overflow-hidden border-2 border-slate-800 bg-white font-mono tracking-widest">
      <span className="bg-blue-700 text-white text-[8px] leading-none flex flex-col items-center justify-end px-1 py-1">
        <span className="text-[9px]">★</span>
        <span className="font-bold">I</span>
      </span>
      <span className="px-2 py-0.5 font-bold text-slate-900 text-sm">{value}</span>
      <span className="bg-blue-700 text-white text-[8px] leading-none flex items-end justify-center px-1 py-1 font-bold">
        <span>I</span>
      </span>
    </span>
  );
}

export default function AutistaVeicolo() {
  const navigate = useNavigate();
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [occupati, setOccupati] = useState<VeicoloOccupato[]>([]);
  const [sessione, setSessione] = useState<VeicoloSessione | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selDialog, setSelDialog] = useState<Veicolo | null>(null);
  const [kmInizioInput, setKmInizioInput] = useState("");
  const [chiudiOpen, setChiudiOpen] = useState(false);
  const [kmFineInput, setKmFineInput] = useState("");

  const load = async () => {
    const [{ data }, sess, occ] = await Promise.all([
      supabase.from("veicoli").select("id, targa, marca, modello, km_attuale, photo_url").eq("attivo", true).order("targa"),
      getSessioneVeicoloAttiva(),
      getVeicoliOccupati(),
    ]);
    setVeicoli((data ?? []) as Veicolo[]);
    setSessione(sess);
    setOccupati(occ);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openSelect = (v: Veicolo) => {
    const occ = occupati.find((o) => o.veicolo_id === v.id && o.autista_id !== sessione?.veicolo_id);
    if (occ && sessione?.veicolo_id !== v.id) {
      toast.error(`Veicolo già in uso da ${occ.autista_nome}`);
      return;
    }
    setKmInizioInput(v.km_attuale != null ? String(v.km_attuale) : "");
    setSelDialog(v);
  };

  const conferma = async () => {
    if (!selDialog) return;
    const km = kmInizioInput.trim() === "" ? null : Number(kmInizioInput);
    if (km !== null && (!Number.isFinite(km) || km < 0)) return toast.error("Km iniziali non validi");
    setBusy(true);
    try {
      await apriSessioneVeicolo(selDialog.id, km);
      toast.success(`Veicolo ${selDialog.targa} selezionato`);
      setSelDialog(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore nella selezione");
    } finally { setBusy(false); }
  };

  const confermaChiusura = async () => {
    const km = kmFineInput.trim() === "" ? null : Number(kmFineInput);
    if (km !== null && (!Number.isFinite(km) || km < 0)) return toast.error("Km finali non validi");
    setBusy(true);
    try {
      await chiudiSessioneVeicolo(km);
      toast.success("Veicolo deselezionato");
      setChiudiOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore");
    } finally { setBusy(false); }
  };

  const v = sessione?.veicolo ?? null;
  const altri = veicoli.filter((x) => x.id !== sessione?.veicolo_id);

  return (
    <AutistaLayout>
      <div className="space-y-3 pb-24">
        <button onClick={() => navigate("/autista")} className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>

        {/* Veicolo in uso */}
        <div className="rounded-[18px] border bg-card p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Veicolo in uso</div>
          {loading ? (
            <div className="text-sm text-muted-foreground mt-2">Caricamento…</div>
          ) : v ? (
            <div className="mt-2 space-y-3">
              {v.photo_url ? (
                <img src={v.photo_url} alt={`Veicolo ${v.targa}`} loading="lazy"
                  className="w-full h-40 object-cover rounded-xl border" />
              ) : (
                <div className="w-full h-24 rounded-xl border bg-muted flex items-center justify-center">
                  <Car className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="font-display font-semibold">
                  {[v.marca, v.modello].filter(Boolean).join(" ") || "Veicolo"}
                </div>
                <Targa value={v.targa} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Km inizio</Label>
                  <Input
                    inputMode="numeric"
                    value={sessione?.km_inizio ?? ""}
                    onChange={async (e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setSessione((s) => (s ? { ...s, km_inizio: val } : s));
                    }}
                    onBlur={async () => {
                      await supabase.from("autisti_veicolo_sessioni" as any)
                        .update({ km_inizio: sessione?.km_inizio ?? null }).eq("id", sessione!.id);
                    }}
                    className="h-10 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Km fine</Label>
                  <Input
                    inputMode="numeric"
                    value={sessione?.km_fine ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setSessione((s) => (s ? { ...s, km_fine: val } : s));
                    }}
                    onBlur={async () => {
                      await supabase.from("autisti_veicolo_sessioni" as any)
                        .update({ km_fine: sessione?.km_fine ?? null }).eq("id", sessione!.id);
                    }}
                    className="h-10 mt-1"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Telepass</span><span>{v.telepass || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Viacard</span><span>{v.viacard || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">N. autorizzazione</span><span>{v.autorizzazione_numero || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Comune autorizzazione</span><span>{v.autorizzazione_comune || "—"}</span></div>
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => { setKmFineInput(sessione?.km_fine != null ? String(sessione.km_fine) : (v.km_attuale != null ? String(v.km_attuale) : "")); setChiudiOpen(true); }}
              >
                Deseleziona veicolo
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-1">Nessun veicolo selezionato</div>
          )}
        </div>

        {/* Altri veicoli */}
        <div className="rounded-[18px] border bg-card p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Altri veicoli</div>
          {altri.map((x) => {
            const occ = occupati.find((o) => o.veicolo_id === x.id);
            return (
              <div key={x.id} className={`rounded-xl border p-3 flex items-center gap-3 ${occ ? "opacity-70" : ""}`}>
                <div className="rounded-lg bg-muted p-2"><Car className="h-5 w-5 text-muted-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{[x.marca, x.modello].filter(Boolean).join(" ") || "Veicolo"}</div>
                  <div className="mt-1"><Targa value={x.targa} /></div>
                  {occ && (
                    <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> In uso da {occ.autista_nome}
                    </div>
                  )}
                </div>
                <Button size="sm" variant={occ ? "outline" : "default"} disabled={busy} onClick={() => openSelect(x)}>
                  {occ ? "Non disp." : "Seleziona"}
                </Button>
              </div>
            );
          })}
          {!loading && altri.length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">Nessun altro veicolo disponibile</div>
          )}
        </div>
      </div>

      {/* Dialog km iniziali */}
      <Dialog open={!!selDialog} onOpenChange={(o) => !o && setSelDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Km iniziali</DialogTitle>
            <DialogDescription>
              Conferma i chilometri di partenza per {selDialog?.targa}.
            </DialogDescription>
          </DialogHeader>
          <Input inputMode="numeric" value={kmInizioInput} onChange={(e) => setKmInizioInput(e.target.value)} className="h-11" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelDialog(null)}>Annulla</Button>
            <Button disabled={busy} onClick={conferma}>Seleziona veicolo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog km finali */}
      <Dialog open={chiudiOpen} onOpenChange={setChiudiOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Km finali</DialogTitle>
            <DialogDescription>
              Inserisci i chilometri finali: aggiorneranno il contachilometri del mezzo se superiori.
            </DialogDescription>
          </DialogHeader>
          <Input inputMode="numeric" value={kmFineInput} onChange={(e) => setKmFineInput(e.target.value)} className="h-11" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChiudiOpen(false)}>Annulla</Button>
            <Button variant="destructive" disabled={busy} onClick={confermaChiusura}>Deseleziona</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AutistaLayout>
  );
}
