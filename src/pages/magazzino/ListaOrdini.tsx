import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PackageCheck, XCircle, Check, X } from "lucide-react";
import { formatoConfezione, numeroOrdine } from "@/lib/magazzino";

type Riga = {
  id: string; articolo_id: string; quantita: number; unita: string | null; prezzo_unitario: number | null;
  tipo_consumo: "macchine" | "consumo_interno"; veicolo_tipo: string | null; veicolo_id: string | null; note: string | null;
  tipo_confezione: string | null; pezzi_per_confezione: number | null;
  stato_ricezione?: string | null; quantita_ricevuta?: number | null;
};
type Ordine = {
  id: string; numero: number | null; data: string; stato: string; fornitore_id: string | null; note: string | null;
  ordini_righe: Riga[];
};

const STATO_LABEL: Record<string, string> = {
  bozza: "Bozza", convalidato: "Convalidato", ricevuto: "Ricevuto",
  parzialmente_ricevuto: "Parzialmente ricevuto", annullato: "Annullato",
};
const STATO_RIGA: Record<string, string> = { in_attesa: "In attesa", confermata: "Confermata", rimossa: "Rimossa" };

export default function ListaOrdini({ soloConsumoInterno = false }: { soloConsumoInterno?: boolean }) {
  const { canWrite } = useAuth();
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [articoli, setArticoli] = useState<Record<string, { nome: string; unita: string | null }>>({});
  const [fornitori, setFornitori] = useState<Record<string, string>>({});
  const [veicoli, setVeicoli] = useState<Record<string, { label: string; tipo: string | null; modello: string }>>({});
  const [dettaglioId, setDettaglioId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conferma, setConferma] = useState<Riga | null>(null);
  const [qta, setQta] = useState("");
  const [prezzo, setPrezzo] = useState("");

  const load = async () => {
    const [{ data: ord }, { data: art }, { data: forn }, { data: vei }] = await Promise.all([
      supabase.from("ordini").select("id, numero, data, stato, fornitore_id, note, ordini_righe(*)").neq("stato", "bozza").order("data", { ascending: false }),
      supabase.from("articoli").select("id, nome, unita_misura"),
      supabase.from("fornitori_magazzino").select("id, nome"),
      supabase.from("veicoli").select("id, targa, marca, modello, tipo_macchina"),
    ]);
    setOrdini((ord ?? []) as unknown as Ordine[]);
    setArticoli(Object.fromEntries((art ?? []).map((a: any) => [a.id, { nome: a.nome, unita: a.unita_misura }])));
    setFornitori(Object.fromEntries((forn ?? []).map((f) => [f.id, f.nome])));
    setVeicoli(Object.fromEntries((vei ?? []).map((v: any) => [v.id, {
      label: `${[v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - ${v.targa}`,
      tipo: v.tipo_macchina,
      modello: [v.marca, v.modello].filter(Boolean).join(" ") || v.targa,
    }])));
  };
  useEffect(() => { load(); }, []);

  const dettaglio = useMemo(() => ordini.find((o) => o.id === dettaglioId) ?? null, [ordini, dettaglioId]);

  const lista = useMemo(
    () => (soloConsumoInterno ? ordini.filter((o) => o.ordini_righe.some((r) => r.tipo_consumo === "consumo_interno")) : ordini),
    [ordini, soloConsumoInterno]
  );

  const totale = (o: Ordine) =>
    o.ordini_righe
      .filter((r) => r.stato_ricezione !== "rimossa")
      .reduce((s, r) => s + (r.prezzo_unitario ?? 0) * Number(r.quantita_ricevuta ?? r.quantita), 0);

  const azione = async (fn: "magazzino_ricevi_ordine" | "magazzino_annulla_ordine", id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, { _ordine_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(fn === "magazzino_ricevi_ordine" ? "Ordine ricevuto: carico registrato in magazzino" : "Ordine annullato");
    setDettaglioId(null);
    load();
  };

  const apriConferma = (r: Riga) => {
    setConferma(r);
    setQta(String(r.quantita_ricevuta ?? r.quantita));
    setPrezzo(r.prezzo_unitario != null ? String(r.prezzo_unitario) : "");
  };

  const validaRiga = async () => {
    if (!conferma) return;
    const q = Number(qta);
    if (!q || q <= 0) return toast.error("Indica la quantità arrivata");
    setBusy(true);
    const { error } = await supabase.rpc("magazzino_conferma_riga" as never, {
      _riga_id: conferma.id,
      _quantita: q,
      _prezzo_unitario: prezzo === "" ? null : Number(prezzo),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Riga confermata e caricata in magazzino");
    setConferma(null);
    load();
  };

  const rimuoviRiga = async (r: Riga) => {
    if (!confirm("Rimuovere questa riga dall'ordine? Non entrerà in magazzino.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("magazzino_rimuovi_riga" as never, { _riga_id: r.id } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Riga rimossa");
    load();
  };

  const veicoloDellaRiga = (r: Riga) =>
    r.tipo_consumo === "consumo_interno" ? "Consumo interno" : r.veicolo_id ? veicoli[r.veicolo_id]?.label ?? "—" : r.veicolo_tipo ?? "—";

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">{soloConsumoInterno ? "Ord. consumo interno" : "Lista ordine"}</h1>

        <Card>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead className="w-[180px]">Fornitore</TableHead>
                  <TableHead className="w-[160px]">Numero Ordine</TableHead>
                  <TableHead>Articoli e quantità</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((o) => (
                  <TableRow key={o.id} className="align-top">
                    <TableCell className="whitespace-nowrap">{new Date(o.data).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell>{o.fornitore_id ? fornitori[o.fornitore_id] ?? "—" : "—"}</TableCell>
                    <TableCell>
                      <button type="button" className="font-medium text-primary hover:underline" onClick={() => setDettaglioId(o.id)}>
                        {numeroOrdine(o.numero)}
                      </button>
                      <div className="mt-1">
                        <Badge variant={o.stato === "ricevuto" ? "default" : o.stato === "annullato" ? "destructive" : "secondary"}>
                          {STATO_LABEL[o.stato] ?? o.stato}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {o.ordini_righe.map((r) => (
                          <div
                            key={r.id}
                            className={`rounded-lg border px-3 py-2 text-xs leading-tight ${
                              r.stato_ricezione === "confermata"
                                ? "border-emerald-500/40 bg-emerald-500/10"
                                : r.stato_ricezione === "rimossa"
                                  ? "border-destructive/40 bg-destructive/10 line-through opacity-70"
                                  : "border-border/60 bg-muted/30"
                            }`}
                          >
                            <div className="font-medium">{articoli[r.articolo_id]?.nome ?? "—"}</div>
                            <div className="text-muted-foreground">
                              {formatoConfezione(r.tipo_confezione, r.pezzi_per_confezione)} ({Number(r.quantita_ricevuta ?? r.quantita)})
                            </div>
                          </div>
                        ))}
                        {o.ordini_righe.length === 0 && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {lista.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nessun ordine</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dettagli ordine */}
      <Dialog open={!!dettaglio} onOpenChange={(o) => !o && setDettaglioId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {numeroOrdine(dettaglio?.numero)} · {dettaglio ? fornitori[dettaglio.fornitore_id ?? ""] ?? "Senza fornitore" : ""}
              {dettaglio ? ` · ${new Date(dettaglio.data).toLocaleDateString("it-IT")}` : ""}
              {dettaglio ? ` · Totale ${totale(dettaglio) > 0 ? `€ ${totale(dettaglio).toFixed(2)}` : "—"}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Articolo</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead className="text-right">Ordinate</TableHead>
                  <TableHead className="text-right">Arrivate</TableHead>
                  <TableHead>Centro di costo</TableHead>
                  <TableHead className="text-right">Prezzo unità</TableHead>
                  <TableHead>Stato</TableHead>
                  {canWrite && <TableHead className="text-right">Ricezione</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dettaglio?.ordini_righe.map((r) => {
                  const stato = r.stato_ricezione ?? "in_attesa";
                  return (
                    <TableRow
                      key={r.id}
                      className={stato === "confermata" ? "bg-emerald-500/5" : stato === "rimossa" ? "bg-destructive/5 opacity-70" : ""}
                    >
                      <TableCell>{articoli[r.articolo_id]?.nome ?? "—"}</TableCell>
                      <TableCell>{formatoConfezione(r.tipo_confezione, r.pezzi_per_confezione)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(r.quantita)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantita_ricevuta != null ? Number(r.quantita_ricevuta) : "—"}</TableCell>
                      <TableCell>{veicoloDellaRiga(r)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.prezzo_unitario != null ? `€ ${Number(r.prezzo_unitario).toFixed(2)}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={stato === "confermata" ? "default" : stato === "rimossa" ? "destructive" : "secondary"}>
                          {STATO_RIGA[stato] ?? stato}
                        </Badge>
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-right whitespace-nowrap">
                          {stato === "in_attesa" && dettaglio?.stato !== "annullato" ? (
                            <>
                              <Button variant="ghost" size="icon" title="Conferma arrivo" onClick={() => apriConferma(r)}>
                                <Check className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Rimuovi riga" onClick={() => rimuoviRiga(r)}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {canWrite && (dettaglio?.stato === "convalidato" || dettaglio?.stato === "parzialmente_ricevuto") && (
            <DialogFooter className="gap-2">
              <Button variant="outline" className="gap-2" disabled={busy} onClick={() => azione("magazzino_annulla_ordine", dettaglio.id)}>
                <XCircle className="h-4 w-4" /> Annulla ordine
              </Button>
              <Button className="gap-2" disabled={busy} onClick={() => azione("magazzino_ricevi_ordine", dettaglio.id)}>
                <PackageCheck className="h-4 w-4" /> Conferma tutte le righe
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Conferma singola riga */}
      <Dialog open={!!conferma} onOpenChange={(o) => !o && setConferma(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Conferma ordine</DialogTitle></DialogHeader>
          {conferma && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo macchina</Label>
                  <Input readOnly disabled value={conferma.tipo_consumo === "consumo_interno" ? "Consumo interno" : (conferma.veicolo_id ? veicoli[conferma.veicolo_id]?.tipo ?? "—" : conferma.veicolo_tipo ?? "—")} />
                </div>
                <div>
                  <Label>Modello</Label>
                  <Input readOnly disabled value={conferma.veicolo_id ? veicoli[conferma.veicolo_id]?.modello ?? "—" : "—"} />
                </div>
              </div>
              <div>
                <Label>Fornitore</Label>
                <Input readOnly disabled value={dettaglio?.fornitore_id ? fornitori[dettaglio.fornitore_id] ?? "—" : "—"} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Articolo</Label>
                  <Input readOnly disabled value={articoli[conferma.articolo_id]?.nome ?? "—"} />
                </div>
                <div>
                  <Label>Unità</Label>
                  <Input readOnly disabled value={conferma.unita ?? articoli[conferma.articolo_id]?.unita ?? "—"} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qta-arrivata">Quantità</Label>
                  <Input id="qta-arrivata" inputMode="decimal" value={qta} onChange={(e) => setQta(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="prezzo-forn">Prezzo unità da fornitore (€)</Label>
                  <Input id="prezzo-forn" inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Il costo viene imputato a: <span className="font-medium text-foreground">{veicoloDellaRiga(conferma)}</span>
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConferma(null)}>Cancel</Button>
            <Button disabled={busy} onClick={validaRiga}>Validate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
