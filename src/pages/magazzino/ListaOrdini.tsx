import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PackageCheck, XCircle } from "lucide-react";

type Riga = {
  id: string; articolo_id: string; quantita: number; unita: string | null; prezzo_unitario: number | null;
  tipo_consumo: "macchine" | "consumo_interno"; veicolo_tipo: string | null; veicolo_id: string | null; note: string | null;
};
type Ordine = {
  id: string; numero: number | null; data: string; stato: string; fornitore_id: string | null; note: string | null;
  ordini_righe: Riga[];
};

const STATO_LABEL: Record<string, string> = { bozza: "Bozza", convalidato: "Convalidato", ricevuto: "Ricevuto", annullato: "Annullato" };

export default function ListaOrdini({ soloConsumoInterno = false }: { soloConsumoInterno?: boolean }) {
  const { canWrite } = useAuth();
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [articoli, setArticoli] = useState<Record<string, string>>({});
  const [fornitori, setFornitori] = useState<Record<string, string>>({});
  const [veicoli, setVeicoli] = useState<Record<string, string>>({});
  const [dettaglio, setDettaglio] = useState<Ordine | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: ord }, { data: art }, { data: forn }, { data: vei }] = await Promise.all([
      supabase.from("ordini").select("id, numero, data, stato, fornitore_id, note, ordini_righe(*)").neq("stato", "bozza").order("data", { ascending: false }),
      supabase.from("articoli").select("id, nome"),
      supabase.from("fornitori_magazzino").select("id, nome"),
      supabase.from("veicoli").select("id, targa, marca, modello"),
    ]);
    setOrdini((ord ?? []) as unknown as Ordine[]);
    setArticoli(Object.fromEntries((art ?? []).map((a) => [a.id, a.nome])));
    setFornitori(Object.fromEntries((forn ?? []).map((f) => [f.id, f.nome])));
    setVeicoli(Object.fromEntries((vei ?? []).map((v) => [v.id, `${[v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - ${v.targa}`])));
  };
  useEffect(() => { load(); }, []);

  const lista = useMemo(
    () => (soloConsumoInterno ? ordini.filter((o) => o.ordini_righe.some((r) => r.tipo_consumo === "consumo_interno")) : ordini),
    [ordini, soloConsumoInterno]
  );

  const totale = (o: Ordine) =>
    o.ordini_righe.reduce((s, r) => s + (r.prezzo_unitario ?? 0) * Number(r.quantita), 0);

  const azione = async (fn: "magazzino_ricevi_ordine" | "magazzino_annulla_ordine", id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, { _ordine_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(fn === "magazzino_ricevi_ordine" ? "Ordine ricevuto: carico registrato in magazzino" : "Ordine annullato");
    setDettaglio(null);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">{soloConsumoInterno ? "Ord. consumo interno" : "Lista ordine"}</h1>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Righe</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Totale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setDettaglio(o)}>
                    <TableCell className="font-medium">#{o.numero ?? "—"}</TableCell>
                    <TableCell>{new Date(o.data).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell>{o.fornitore_id ? fornitori[o.fornitore_id] ?? "—" : "—"}</TableCell>
                    <TableCell>{o.ordini_righe.length}</TableCell>
                    <TableCell>
                      <Badge variant={o.stato === "ricevuto" ? "default" : o.stato === "annullato" ? "destructive" : "secondary"}>
                        {STATO_LABEL[o.stato] ?? o.stato}
                      </Badge>
                    </TableCell>
                    <TableCell>{totale(o) > 0 ? `€ ${totale(o).toFixed(2)}` : "—"}</TableCell>
                  </TableRow>
                ))}
                {lista.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nessun ordine</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!dettaglio} onOpenChange={(o) => !o && setDettaglio(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Ordine #{dettaglio?.numero ?? "—"} · {dettaglio ? fornitori[dettaglio.fornitore_id ?? ""] ?? "Senza fornitore" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Articolo</TableHead>
                  <TableHead>Qtà</TableHead>
                  <TableHead>Consumo interno</TableHead>
                  <TableHead>Mezzo</TableHead>
                  <TableHead>Prezzo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dettaglio?.ordini_righe.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{articoli[r.articolo_id] ?? "—"}</TableCell>
                    <TableCell>{r.quantita} {r.unita ?? ""}</TableCell>
                    <TableCell>{r.tipo_consumo === "consumo_interno" ? "SI" : "NO"}</TableCell>
                    <TableCell>{r.veicolo_id ? veicoli[r.veicolo_id] ?? "—" : r.veicolo_tipo ?? "—"}</TableCell>
                    <TableCell>{r.prezzo_unitario != null ? `€ ${r.prezzo_unitario}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {canWrite && dettaglio?.stato === "convalidato" && (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="gap-2" disabled={busy} onClick={() => azione("magazzino_annulla_ordine", dettaglio.id)}>
                <XCircle className="h-4 w-4" /> Annulla ordine
              </Button>
              <Button className="gap-2" disabled={busy} onClick={() => azione("magazzino_ricevi_ordine", dettaglio.id)}>
                <PackageCheck className="h-4 w-4" /> Segna come ricevuto
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
