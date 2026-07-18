import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Undo2, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  servizioId: string | null;
  onChanged?: () => void;
};

type Partner = { id: string; name: string };
type Dispatch = {
  id: string;
  stato: "inviato" | "accettato" | "rifiutato" | "completato" | "ritirato";
  org_b: string;
  prezzo_concordato: number;
  dispatched_at: string;
  responded_at: string | null;
};

const statoLabel: Record<string, string> = {
  inviato: "In attesa",
  accettato: "Accettato",
  rifiutato: "Rifiutato",
  ritirato: "Ritirato",
  completato: "Completato",
};

export function NetworkDispatchDialog({ open, onOpenChange, servizioId, onChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [partnerNames, setPartnerNames] = useState<Record<string, string>>({});
  const [selectedPartner, setSelectedPartner] = useState("");
  const [prezzo, setPrezzo] = useState("");

  const active = dispatches.find(d => d.stato === "inviato" || d.stato === "accettato") || null;

  useEffect(() => {
    if (!open || !servizioId) return;
    (async () => {
      setLoading(true);
      const [{ data: orgs }, { data: disp }] = await Promise.all([
        supabase.rpc("network_visible_orgs"),
        supabase.from("servizi_network").select("id, stato, org_b, prezzo_concordato, dispatched_at, responded_at").eq("servizio_a_id", servizioId).order("dispatched_at", { ascending: false }),
      ]);
      const orgList = (orgs ?? []) as Partner[];
      setPartners(orgList);
      const map: Record<string, string> = {};
      orgList.forEach(o => { map[o.id] = o.name; });
      setPartnerNames(map);
      setDispatches((disp ?? []) as Dispatch[]);
      setSelectedPartner("");
      setPrezzo("");
      setLoading(false);
    })();
  }, [open, servizioId]);

  const handleDispatch = async () => {
    if (!servizioId || !selectedPartner) return;
    const p = parseFloat(prezzo);
    if (isNaN(p) || p < 0) {
      toast.error("Prezzo concordato non valido");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("network_dispatch_servizio", {
      _servizio_id: servizioId,
      _partner_org_id: selectedPartner,
      _prezzo_concordato: p,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Servizio inviato al partner");
    onChanged?.();
    onOpenChange(false);
  };

  const handleWithdraw = async () => {
    if (!servizioId) return;
    if (!confirm("Ritirare il servizio dal network? La copia lato partner verrà eliminata.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("network_withdraw_servizio", { _servizio_id: servizioId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Servizio ritirato dal network");
    onChanged?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Passaggio al network</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : active ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Partner</span>
                <span className="text-sm font-medium">{partnerNames[active.org_b] || active.org_b.slice(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Stato</span>
                <Badge variant={active.stato === "accettato" ? "default" : "outline"}>{statoLabel[active.stato]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Prezzo concordato</span>
                <span className="text-sm font-mono">€ {Number(active.prezzo_concordato).toFixed(2)}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ritirando il servizio, la copia lato partner viene eliminata e il tuo servizio torna a stato "nuovo" senza fornitore.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
              <Button variant="destructive" onClick={handleWithdraw} disabled={busy} className="gap-1.5">
                <Undo2 className="h-4 w-4" /> Ritira dal network
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nessun partner attivo nel tuo network.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Partner</Label>
                  <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                    <SelectTrigger><SelectValue placeholder="Seleziona partner…" /></SelectTrigger>
                    <SelectContent>
                      {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prezzo concordato (€)</Label>
                  <Input type="number" min="0" step="0.01" value={prezzo} onChange={e => setPrezzo(e.target.value)} placeholder="0,00" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Verranno condivisi solo i dati operativi del servizio (luoghi, orari, veicolo, passeggeri, note). Cliente finale, contatti e importi restano riservati.
                </p>
              </>
            )}
            {dispatches.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Storico</p>
                {dispatches.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="truncate">{partnerNames[d.org_b] || d.org_b.slice(0, 8)}</span>
                    <span className="text-muted-foreground">{statoLabel[d.stato]}</span>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button onClick={handleDispatch} disabled={busy || !selectedPartner || !prezzo} className="gap-1.5">
                <Send className="h-4 w-4" /> Invia al partner
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
