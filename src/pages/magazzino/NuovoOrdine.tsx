import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, X, Check, Settings2 } from "lucide-react";
import { FornitoriMagazzinoDialog, fetchFornitoriMagazzino, type FornitoreMagazzino } from "@/components/magazzino/FornitoriMagazzinoDialog";
import { useNavigate } from "react-router-dom";
import { formatoConfezione } from "@/lib/magazzino";

const TUTTE = "__tutte__";
const NESSUNO = "__nessuno__";

type Articolo = { id: string; nome: string; unita_misura: string; fornitore_default_id: string | null; prezzo_unitario: number | null; tipo_confezione: string | null; quantita_per_confezione: number | null; unita_base: string | null; mostra_in_ordini: boolean | null };
type Veicolo = { id: string; targa: string; modello: string | null; marca: string | null; tipo_macchina: string | null };
type Riga = {
  id: string;
  tipo_consumo: "macchine" | "consumo_interno";
  veicolo_tipo: string | null;
  veicolo_id: string | null;
  fornitore_id: string | null;
  articolo_id: string;
  quantita: number;
  unita: string | null;
  prezzo_unitario: number | null;
  note: string | null;
  tipo_confezione: string | null;
  pezzi_per_confezione: number | null;
};

export default function NuovoOrdine() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [fornitori, setFornitori] = useState<FornitoreMagazzino[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [ordineId, setOrdineId] = useState<string | null>(null);
  const [righe, setRighe] = useState<Riga[]>([]);
  const [fornDialog, setFornDialog] = useState(false);
  const [convalidaOpen, setConvalidaOpen] = useState(false);
  const [selezionate, setSelezionate] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [tipoConsumo, setTipoConsumo] = useState<"macchine" | "consumo_interno">("macchine");
  const [veicoloTipo, setVeicoloTipo] = useState<string>(TUTTE);
  const [veicoloId, setVeicoloId] = useState<string>(NESSUNO);
  const [fornitoreId, setFornitoreId] = useState<string>(NESSUNO);
  const [articoloId, setArticoloId] = useState<string>("");
  const [quantita, setQuantita] = useState<string>("1");
  const [prezzo, setPrezzo] = useState<string>("");
  const [note, setNote] = useState("");

  const articolo = articoli.find((a) => a.id === articoloId);

  const loadBase = async () => {
    const [{ data: art }, forn, { data: vei }] = await Promise.all([
      supabase.from("articoli").select("id, nome, unita_misura, fornitore_default_id, prezzo_unitario, tipo_confezione, quantita_per_confezione, unita_base, mostra_in_ordini").eq("attivo", true).eq("mostra_in_ordini", true).order("nome"),
      fetchFornitoriMagazzino(),
      supabase.from("veicoli").select("id, targa, modello, marca, tipo_macchina").eq("attivo", true).order("targa"),
    ]);
    setArticoli((art ?? []) as Articolo[]);
    setFornitori(forn.filter((f) => f.attivo));
    setVeicoli((vei ?? []) as Veicolo[]);
  };

  const loadBozza = async () => {
    const { data: ord } = await supabase
      .from("ordini")
      .select("id")
      .eq("stato", "bozza")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ord) {
      setOrdineId(null);
      setRighe([]);
      return;
    }
    setOrdineId(ord.id);
    const { data: r } = await supabase.from("ordini_righe").select("*").eq("ordine_id", ord.id).order("created_at");
    setRighe((r ?? []) as Riga[]);
  };

  useEffect(() => {
    loadBase();
    loadBozza();
  }, []);

  useEffect(() => {
    if (articolo) {
      if (articolo.fornitore_default_id) setFornitoreId(articolo.fornitore_default_id);
      setPrezzo(articolo.prezzo_unitario != null ? String(articolo.prezzo_unitario) : "");
    }
  }, [articoloId]);

  const tipiVeicolo = useMemo(
    () => Array.from(new Set(veicoli.map((v) => v.tipo_macchina).filter(Boolean) as string[])).sort(),
    [veicoli]
  );
  const veicoliFiltrati = useMemo(
    () => (veicoloTipo === TUTTE ? veicoli : veicoli.filter((v) => v.tipo_macchina === veicoloTipo)),
    [veicoli, veicoloTipo]
  );

  const nomeArticolo = (id: string) => articoli.find((a) => a.id === id)?.nome ?? "—";
  const nomeFornitore = (id: string | null) => (id ? fornitori.find((f) => f.id === id)?.nome ?? "—" : "—");
  const labelVeicolo = (id: string | null) => {
    const v = veicoli.find((x) => x.id === id);
    return v ? `${[v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - ${v.targa}` : "—";
  };

  const aggiungiRiga = async () => {
    if (!articoloId) return toast.error("Seleziona un articolo");
    const q = Number(quantita.replace(",", "."));
    if (!q || q <= 0) return toast.error("Quantità non valida");
    setSalvando(true);
    let oid = ordineId;
    if (!oid) {
      const { data, error } = await supabase.from("ordini").insert({ stato: "bozza" } as never).select("id").single();
      if (error) { setSalvando(false); return toast.error(error.message); }
      oid = data.id;
      setOrdineId(oid);
    }
    const { error } = await supabase.from("ordini_righe").insert({
      ordine_id: oid,
      tipo_consumo: tipoConsumo,
      veicolo_tipo: tipoConsumo === "macchine" && veicoloTipo !== TUTTE ? veicoloTipo : null,
      veicolo_id: tipoConsumo === "macchine" && veicoloId !== NESSUNO ? veicoloId : null,
      fornitore_id: fornitoreId !== NESSUNO ? fornitoreId : null,
      articolo_id: articoloId,
      quantita: q,
      unita: articolo?.unita_misura ?? null,
      tipo_confezione: articolo?.tipo_confezione ?? "singolo",
      pezzi_per_confezione: Math.max(1, Number(articolo?.quantita_per_confezione ?? 1)),
      prezzo_unitario: prezzo ? Number(prezzo.replace(",", ".")) : null,
      note: note || null,
    } as never);
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Riga aggiunta all'ordine");
    setArticoloId("");
    setQuantita("1");
    setPrezzo("");
    setNote("");
    loadBozza();
  };

  const rimuoviRiga = async (id: string) => {
    const { error } = await supabase.from("ordini_righe").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadBozza();
  };

  const apriConvalida = () => {
    setSelezionate(righe.map((r) => r.id));
    setConvalidaOpen(true);
  };

  const convalida = async () => {
    if (!ordineId || selezionate.length === 0) return toast.error("Seleziona almeno una riga");
    setSalvando(true);
    const { error } = await supabase.rpc("magazzino_convalida_righe", { _ordine_id: ordineId, _riga_ids: selezionate });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Ordine convalidato");
    setConvalidaOpen(false);
    await loadBozza();
    navigate("/magazzino/ordini");
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Nuovo ordine</h1>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dati riga ordine</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tipo Consumo</Label>
              <Select value={tipoConsumo} onValueChange={(v) => setTipoConsumo(v as typeof tipoConsumo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="macchine">Macchine</SelectItem>
                  <SelectItem value="consumo_interno">Consumo interno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo macchina</Label>
              <Select value={veicoloTipo} onValueChange={(v) => { setVeicoloTipo(v); setVeicoloId(NESSUNO); }} disabled={tipoConsumo === "consumo_interno"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TUTTE}>Tutte le macchine</SelectItem>
                  {tipiVeicolo.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Modello</Label>
              <Select value={veicoloId} onValueChange={setVeicoloId} disabled={tipoConsumo === "consumo_interno"}>
                <SelectTrigger><SelectValue placeholder="Nessun mezzo specifico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NESSUNO}>Nessun mezzo specifico</SelectItem>
                  {veicoliFiltrati.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {[v.marca, v.modello].filter(Boolean).join(" ") || "Mezzo"} - {v.targa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Fornitore</Label>
                <button type="button" className="text-xs text-primary hover:underline inline-flex items-center gap-1" onClick={() => setFornDialog(true)}>
                  <Settings2 className="h-3 w-3" /> gestisci fornitori
                </button>
              </div>
              <Select value={fornitoreId} onValueChange={setFornitoreId}>
                <SelectTrigger><SelectValue placeholder="Seleziona fornitore" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NESSUNO}>Nessun fornitore</SelectItem>
                  {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Articolo</Label>
              <Select value={articoloId} onValueChange={setArticoloId}>
                <SelectTrigger><SelectValue placeholder="Seleziona articolo" /></SelectTrigger>
                <SelectContent>
                  {articoli.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Unità</Label>
              <Input value={articolo?.unita_misura ?? ""} readOnly disabled placeholder="—" />
            </div>

            <div className="space-y-1.5">
              <Label>Quantità (confezioni)</Label>
              <Input inputMode="decimal" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Prezzo unitario (€)</Label>
              <Input inputMode="decimal" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} placeholder="—" />
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Note</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <Button onClick={aggiungiRiga} disabled={!canWrite || salvando} className="gap-2">
                <Plus className="h-4 w-4" /> Aggiungi all'ordine
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ordine in bozza ({righe.length} righe)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consumo interno</TableHead>
                    <TableHead>Tipo macchina</TableHead>
                    <TableHead>Modello</TableHead>
                    <TableHead>Fornitore</TableHead>
                    <TableHead>Articolo</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Quantità</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {righe.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.tipo_consumo === "consumo_interno" ? "SI" : "NO"}</TableCell>
                      <TableCell>{r.veicolo_tipo ?? (r.tipo_consumo === "macchine" ? "Tutte le macchine" : "—")}</TableCell>
                      <TableCell>{labelVeicolo(r.veicolo_id)}</TableCell>
                      <TableCell>{nomeFornitore(r.fornitore_id)}</TableCell>
                      <TableCell>{nomeArticolo(r.articolo_id)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatoConfezione(r.tipo_confezione, r.pezzi_per_confezione)}</TableCell>
                      <TableCell>
                        {r.quantita} conf.
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({Number(r.quantita) * Math.max(1, Number(r.pezzi_per_confezione ?? 1))} pz)
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => rimuoviRiga(r.id)} disabled={!canWrite}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {righe.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Nessuna riga nell'ordine</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="gap-2">
                <Plus className="h-4 w-4" /> Aggiungi
              </Button>
              <Button onClick={apriConvalida} disabled={!canWrite || righe.length === 0} className="gap-2">
                <Check className="h-4 w-4" /> Convalida ordine
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <FornitoriMagazzinoDialog open={fornDialog} onOpenChange={setFornDialog} onChanged={loadBase} />

      <Dialog open={convalidaOpen} onOpenChange={setConvalidaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convalida ordine</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seleziona le righe da convalidare. Le righe con fornitori diversi generano un ordine per ciascun fornitore; quelle non selezionate restano in bozza.
          </p>
          <div className="max-h-[40vh] space-y-2 overflow-auto">
            {righe.map((r) => (
              <label key={r.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2 text-sm">
                <Checkbox
                  checked={selezionate.includes(r.id)}
                  onCheckedChange={(c) => setSelezionate((s) => (c ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                />
                <span className="flex-1">
                  {nomeArticolo(r.articolo_id)} · {r.quantita} × {formatoConfezione(r.tipo_confezione, r.pezzi_per_confezione)} · {nomeFornitore(r.fornitore_id)}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={convalida} disabled={salvando || selezionate.length === 0}>Convalida selezionate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
