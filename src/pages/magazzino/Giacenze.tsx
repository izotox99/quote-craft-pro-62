import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { formatoConfezione, pezziEConfezioni } from "@/lib/magazzino";

const INTERNO = "__interno__";
type Giacenza = { articolo_id: string; nome: string; unita_misura: string; scorta_minima: number; giacenza: number; sotto_scorta: boolean; attivo: boolean };
type Veicolo = { id: string; targa: string; marca: string | null; modello: string | null };
type Confez = { tipo_confezione: string | null; pezzi_per_confezione: number | null };

const oggi = () => new Date().toISOString().slice(0, 10);

export default function Giacenze() {
  const { canWrite } = useAuth();
  const [rows, setRows] = useState<Giacenza[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [confez, setConfez] = useState<Record<string, Confez>>({});
  const [scaricoOpen, setScaricoOpen] = useState(false);
  const [caricoOpen, setCaricoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scarico, setScarico] = useState({ articolo_id: "", quantita: "1", destinazione: INTERNO, data: oggi(), note: "" });
  const [carico, setCarico] = useState({ articolo_id: "", quantita: "1", motivo: "inventario_iniziale", data: oggi(), note: "" });

  const load = async () => {
    const [{ data: g }, { data: v }, { data: a }] = await Promise.all([
      supabase.from("magazzino_giacenze").select("*").order("nome"),
      supabase.from("veicoli").select("id, targa, marca, modello").eq("attivo", true).order("targa"),
      supabase.from("articoli").select("id, tipo_confezione, pezzi_per_confezione"),
    ]);
    setRows((g ?? []) as Giacenza[]);
    setVeicoli((v ?? []) as Veicolo[]);
    setConfez(Object.fromEntries((a ?? []).map((x) => [x.id, { tipo_confezione: x.tipo_confezione, pezzi_per_confezione: x.pezzi_per_confezione }])));
  };
  useEffect(() => { load(); }, []);

  const registraScarico = async (forza = false) => {
    const q = Number(scarico.quantita.replace(",", "."));
    if (!scarico.articolo_id) return toast.error("Seleziona un articolo");
    if (!q || q <= 0) return toast.error("Quantità non valida");
    const g = rows.find((r) => r.articolo_id === scarico.articolo_id);
    if (!forza && g && q > Number(g.giacenza)) {
      const ok = window.confirm(`Giacenza insufficiente (disponibili ${g.giacenza} ${g.unita_misura}). Registrare comunque il consumo come anomalia?`);
      if (!ok) return;
      forza = true;
    }
    setBusy(true);
    const { error } = await supabase.rpc("magazzino_registra_scarico", {
      _articolo_id: scarico.articolo_id,
      _quantita: q,
      _data: scarico.data,
      _veicolo_id: scarico.destinazione !== INTERNO ? scarico.destinazione : (null as unknown as string),
      _consumo_interno: scarico.destinazione === INTERNO,
      _note: scarico.note,
      _forza: forza,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Scarico registrato");
    setScaricoOpen(false);
    setScarico({ articolo_id: "", quantita: "1", destinazione: INTERNO, data: oggi(), note: "" });
    load();
  };

  const registraCarico = async () => {
    const q = Number(carico.quantita.replace(",", "."));
    if (!carico.articolo_id) return toast.error("Seleziona un articolo");
    if (!q || q <= 0) return toast.error("Quantità non valida");
    setBusy(true);
    const { error } = await supabase.rpc("magazzino_registra_carico_manuale", {
      _articolo_id: carico.articolo_id,
      _quantita: q,
      _data: carico.data,
      _motivo: carico.motivo as "inventario_iniziale" | "rettifica" | "reso" | "altro",
      _note: carico.note,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Carico registrato");
    setCaricoOpen(false);
    setCarico({ articolo_id: "", quantita: "1", motivo: "inventario_iniziale", data: oggi(), note: "" });
    load();
  };

  const opzioniArticoli = rows.filter((r) => r.attivo);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">Magazzino</h1>
          {canWrite && (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setCaricoOpen(true)}>
                <ArrowDownToLine className="h-4 w-4" /> Carico manuale / Rettifica
              </Button>
              <Button className="gap-2" onClick={() => setScaricoOpen(true)}>
                <ArrowUpFromLine className="h-4 w-4" /> Registra scarico
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Articolo</TableHead>
                  <TableHead>Disponibile (pezzi)</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Scorta min. (pz)</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.articolo_id} className={r.sotto_scorta ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className={r.sotto_scorta ? "font-semibold text-destructive" : ""}>
                      {pezziEConfezioni(Number(r.giacenza), confez[r.articolo_id]?.pezzi_per_confezione)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatoConfezione(confez[r.articolo_id]?.tipo_confezione, confez[r.articolo_id]?.pezzi_per_confezione)}
                    </TableCell>
                    <TableCell>{r.scorta_minima}</TableCell>
                    <TableCell>
                      {r.sotto_scorta ? <Badge variant="destructive">Sotto scorta</Badge> : <Badge variant="secondary">Ok</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nessun articolo a magazzino</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={scaricoOpen} onOpenChange={setScaricoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registra scarico</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Articolo</Label>
              <Select value={scarico.articolo_id} onValueChange={(v) => setScarico({ ...scarico, articolo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo" /></SelectTrigger>
                <SelectContent>
                  {opzioniArticoli.map((a) => (
                    <SelectItem key={a.articolo_id} value={a.articolo_id}>{a.nome} (disp. {a.giacenza} pz · {formatoConfezione(confez[a.articolo_id]?.tipo_confezione, confez[a.articolo_id]?.pezzi_per_confezione)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantità (pezzi)</Label>
              <Input inputMode="decimal" value={scarico.quantita} onChange={(e) => setScarico({ ...scarico, quantita: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={scarico.data} onChange={(e) => setScarico({ ...scarico, data: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Destinazione</Label>
              <Select value={scarico.destinazione} onValueChange={(v) => setScarico({ ...scarico, destinazione: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={INTERNO}>Consumo interno</SelectItem>
                  {veicoli.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{[v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - {v.targa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Note</Label>
              <Textarea rows={2} value={scarico.note} onChange={(e) => setScarico({ ...scarico, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={() => registraScarico()} disabled={busy}>Registra scarico</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={caricoOpen} onOpenChange={setCaricoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Carico manuale / Rettifica</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Articolo</Label>
              <Select value={carico.articolo_id} onValueChange={(v) => setCarico({ ...carico, articolo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo" /></SelectTrigger>
                <SelectContent>
                  {opzioniArticoli.map((a) => <SelectItem key={a.articolo_id} value={a.articolo_id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantità (pezzi)</Label>
              <Input inputMode="decimal" value={carico.quantita} onChange={(e) => setCarico({ ...carico, quantita: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={carico.data} onChange={(e) => setCarico({ ...carico, data: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Motivo</Label>
              <Select value={carico.motivo} onValueChange={(v) => setCarico({ ...carico, motivo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inventario_iniziale">Inventario iniziale</SelectItem>
                  <SelectItem value="rettifica">Rettifica</SelectItem>
                  <SelectItem value="reso">Reso</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Note</Label>
              <Textarea rows={2} value={carico.note} onChange={(e) => setCarico({ ...carico, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={registraCarico} disabled={busy}>Registra carico</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
