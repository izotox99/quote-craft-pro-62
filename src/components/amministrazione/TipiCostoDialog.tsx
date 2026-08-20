import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { AmbitoCosto, TipoCosto } from "@/lib/costi";

const TITOLI: Record<AmbitoCosto, string> = {
  autista: "Tipi inserimento autisti",
  veicolo: "Tipi spese macchine",
  generale: "Categorie altri costi",
};

export function TipiCostoDialog({
  open, onOpenChange, ambito, onChanged,
}: { open: boolean; onOpenChange: (o: boolean) => void; ambito: AmbitoCosto; onChanged: () => void }) {
  const [rows, setRows] = useState<TipoCosto[]>([]);
  const [nuovo, setNuovo] = useState("");
  const [nuovoRic, setNuovoRic] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("config_tipi_costo" as never).select("*").eq("ambito", ambito).order("ordine").order("valore");
    setRows((data ?? []) as unknown as TipoCosto[]);
  };
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, ambito]);

  const aggiungi = async () => {
    const v = nuovo.trim();
    if (!v) return;
    const { error } = await supabase.from("config_tipi_costo" as never).insert([{ ambito, valore: v, ricorrente: nuovoRic, ordine: rows.length + 1 }] as never);
    if (error) return toast.error(error.message);
    setNuovo(""); setNuovoRic(false);
    await load(); onChanged();
  };

  const patch = async (r: TipoCosto, values: Partial<TipoCosto>) => {
    const { error } = await supabase.from("config_tipi_costo" as never).update(values as never).eq("id", r.id);
    if (error) return toast.error(error.message);
    await load(); onChanged();
  };

  const elimina = async (r: TipoCosto) => {
    if (!confirm(`Eliminare "${r.valore}"?`)) return;
    const { error } = await supabase.from("config_tipi_costo" as never).delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    await load(); onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{TITOLI[ambito]}</DialogTitle></DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span className={`flex-1 text-sm ${r.attivo ? "" : "line-through text-muted-foreground"}`}>{r.valore}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={r.ricorrente} onCheckedChange={(v) => patch(r, { ricorrente: v })} />
                ricorrente
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={r.attivo} onCheckedChange={(v) => patch(r, { attivo: v })} />
                attivo
              </label>
              <Button size="icon" variant="ghost" onClick={() => elimina(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nessuna voce configurata</p>}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label>Nuova voce</Label>
          <div className="flex items-center gap-2">
            <Input value={nuovo} onChange={(e) => setNuovo(e.target.value)} placeholder="es. Permesso ZTL" onKeyDown={(e) => e.key === "Enter" && aggiungi()} />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Switch checked={nuovoRic} onCheckedChange={setNuovoRic} /> ricorrente
            </label>
            <Button onClick={aggiungi} className="gap-1"><Plus className="h-4 w-4" /> Aggiungi</Button>
          </div>
          <p className="text-xs text-muted-foreground">Le voci “ricorrenti” mostrano il blocco Scadenze con il calcolo automatico della data.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
