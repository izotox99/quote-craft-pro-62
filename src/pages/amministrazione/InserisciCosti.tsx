import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Pencil, Plus, Search, Settings2, Trash2, Wallet, X } from "lucide-react";
import { TipiCostoDialog } from "@/components/amministrazione/TipiCostoDialog";
import {
  addMesi, classeScadenza, dataIt, eur, fetchTipiCosto, RICORRENZE, statoScadenza,
  TIPI_PAGAMENTO, type AmbitoCosto, type TipoCosto,
} from "@/lib/costi";

type Autista = { id: string; nome: string | null; cognome: string | null };
type Veicolo = { id: string; targa: string; modello: string | null; tipo_macchina: string | null };

const nomeAutista = (a?: Autista) => (a ? `${a.cognome ?? ""} ${a.nome ?? ""}`.trim() || "Autista" : "—");
const nomeVeicolo = (v?: Veicolo) => (v ? `${v.targa} - ${v.modello ?? v.tipo_macchina ?? ""}`.trim() : "—");
const NESSUNO = "__nessuno__";

export default function InserisciCosti() {
  const [tab, setTab] = useState("autisti");
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Inserisci Costi
          </h1>
          <p className="text-sm text-muted-foreground">Costi senza fattura e gestione delle scadenze.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="autisti">Autisti interni</TabsTrigger>
            <TabsTrigger value="macchine">Spese Macchine</TabsTrigger>
            <TabsTrigger value="altri">Altri Costi</TabsTrigger>
          </TabsList>
          <TabsContent value="autisti" className="mt-4"><SpeseAutisti /></TabsContent>
          <TabsContent value="macchine" className="mt-4"><SpeseMacchine /></TabsContent>
          <TabsContent value="altri" className="mt-4"><AltriCosti /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ---------- helpers UI ---------- */

function GestisciTipi({ ambito, onChanged }: { ambito: AmbitoCosto; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setOpen(true)}>
        <Settings2 className="h-3 w-3" /> gestisci voci
      </button>
      <TipiCostoDialog open={open} onOpenChange={setOpen} ambito={ambito} onChanged={onChanged} />
    </>
  );
}

function ScadenzaCell({ data, preavviso }: { data: string | null; preavviso: number }) {
  const stato = statoScadenza(data, preavviso);
  return <span className={classeScadenza(stato)}>{dataIt(data)}</span>;
}

function Ricerca({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Cerca…" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------- Tab 1: spese autisti ---------- */

type RigaAutista = {
  id: string; autista_id: string; tipo: string; data_intervento: string | null; data_scadenza: string | null;
  importo_spese: number | null; totale_fattura: number | null; tipo_pagamento: string | null; giorni_preavviso: number;
};

const emptyAutista = { autista_id: "", tipo: "", data_intervento: "", data_scadenza: "", importo_spese: "", tipo_pagamento: NESSUNO, giorni_preavviso: "30" };

function SpeseAutisti() {
  const { canWrite } = useAuth();
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [tipi, setTipi] = useState<TipoCosto[]>([]);
  const [rows, setRows] = useState<RigaAutista[]>([]);
  const [form, setForm] = useState({ ...emptyAutista });
  const [editing, setEditing] = useState<RigaAutista | null>(null);
  const [q, setQ] = useState("");

  const loadTipi = async () => setTipi(await fetchTipiCosto("autista"));

  const load = async () => {
    const [{ data: aut }, { data: sp }] = await Promise.all([
      supabase.from("autisti").select("id, nome, cognome").order("cognome"),
      supabase.from("autisti_spese").select("id, autista_id, tipo, data_intervento, data_scadenza, importo_spese, totale_fattura, tipo_pagamento, giorni_preavviso")
        .order("data_scadenza", { ascending: true, nullsFirst: false }),
    ]);
    setAutisti((aut ?? []) as Autista[]);
    setRows((sp ?? []) as unknown as RigaAutista[]);
  };
  useEffect(() => { load(); loadTipi(); }, []);

  const salva = async () => {
    if (!form.autista_id) return toast.error("Seleziona l'autista");
    if (!form.tipo) return toast.error("Seleziona il tipo di inserimento");
    const payload = {
      autista_id: form.autista_id,
      tipo: form.tipo,
      data_intervento: form.data_intervento || null,
      data_scadenza: form.data_scadenza || null,
      importo_spese: form.importo_spese ? Number(form.importo_spese.replace(",", ".")) : null,
      tipo_pagamento: form.tipo_pagamento !== NESSUNO ? form.tipo_pagamento : null,
      giorni_preavviso: Number(form.giorni_preavviso || "30"),
      centro_costo: "autista",
      origine: "ufficio",
    };
    const { error } = editing
      ? await supabase.from("autisti_spese").update(payload as never).eq("id", editing.id)
      : await supabase.from("autisti_spese").insert([payload] as never);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Costo aggiornato" : "Costo registrato");
    setForm({ ...emptyAutista }); setEditing(null); load();
  };

  const modifica = (r: RigaAutista) => {
    setEditing(r);
    setForm({
      autista_id: r.autista_id, tipo: r.tipo,
      data_intervento: r.data_intervento ?? "", data_scadenza: r.data_scadenza ?? "",
      importo_spese: r.importo_spese != null ? String(r.importo_spese) : "",
      tipo_pagamento: r.tipo_pagamento ?? NESSUNO,
      giorni_preavviso: String(r.giorni_preavviso ?? 30),
    });
  };

  const elimina = async (r: RigaAutista) => {
    if (!confirm("Eliminare questa riga?")) return;
    const { error } = await supabase.from("autisti_spese").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const filtrati = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) =>
      !s || r.tipo.toLowerCase().includes(s) || nomeAutista(autisti.find((a) => a.id === r.autista_id)).toLowerCase().includes(s)
    );
  }, [rows, autisti, q]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Autista *</Label>
            <Select value={form.autista_id} onValueChange={(v) => setForm({ ...form, autista_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona autista" /></SelectTrigger>
              <SelectContent>{autisti.map((a) => <SelectItem key={a.id} value={a.id}>{nomeAutista(a)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label>Tipo inserimento *</Label><GestisciTipi ambito="autista" onChanged={loadTipi} /></div>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
              <SelectContent>{tipi.map((t) => <SelectItem key={t.id} value={t.valore}>{t.valore}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data intervento</Label>
            <Input type="date" value={form.data_intervento} onChange={(e) => setForm({ ...form, data_intervento: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Data scadenza</Label>
            <Input type="date" value={form.data_scadenza} onChange={(e) => setForm({ ...form, data_scadenza: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Importo spese (€)</Label>
            <Input inputMode="decimal" value={form.importo_spese} onChange={(e) => setForm({ ...form, importo_spese: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo di pagamento</Label>
            <Select value={form.tipo_pagamento} onValueChange={(v) => setForm({ ...form, tipo_pagamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NESSUNO}>Non specificato</SelectItem>
                {TIPI_PAGAMENTO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Preavviso scadenza (giorni)</Label>
            <Input inputMode="numeric" value={form.giorni_preavviso} onChange={(e) => setForm({ ...form, giorni_preavviso: e.target.value })} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button onClick={salva} disabled={!canWrite} className="gap-2">
              <Plus className="h-4 w-4" /> {editing ? "Salva modifiche" : "Registra costo"}
            </Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm({ ...emptyAutista }); }} className="gap-1"><X className="h-4 w-4" /> Annulla</Button>}
          </div>
        </CardContent>
      </Card>

      <Ricerca value={q} onChange={setQ} />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Autista</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Data intervento</TableHead><TableHead>Data scadenza</TableHead>
                <TableHead className="text-right">Importo spese</TableHead>
                <TableHead className="text-right">Totale fattura</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrati.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{nomeAutista(autisti.find((a) => a.id === r.autista_id))}</TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell>{dataIt(r.data_intervento)}</TableCell>
                  <TableCell><ScadenzaCell data={r.data_scadenza} preavviso={r.giorni_preavviso ?? 30} /></TableCell>
                  <TableCell className="text-right tabular-nums">{eur(r.importo_spese)}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(r.totale_fattura)}</TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => modifica(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => elimina(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtrati.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nessun costo registrato</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Tab 2: spese macchine ---------- */

type RigaVeicolo = {
  id: string; veicolo_id: string; tipo: string; data_intervento: string | null; data_scadenza: string | null;
  importo_spese: number | null; totale_fattura: number | null; note: string | null; fornitore: string | null;
  tipo_pagamento: string | null; ricorrenza: string | null; giorni_preavviso: number;
};

const emptyVeicolo = {
  veicolo_id: "", tipo: "", data_intervento: "", tipo_pagamento: NESSUNO, importo_spese: "", note: "",
  fornitore: "", ricorrenza: "nessuno", data_scadenza: "", giorni_preavviso: "30",
};

function SpeseMacchine() {
  const { canWrite } = useAuth();
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [tipi, setTipi] = useState<TipoCosto[]>([]);
  const [rows, setRows] = useState<RigaVeicolo[]>([]);
  const [form, setForm] = useState({ ...emptyVeicolo });
  const [editing, setEditing] = useState<RigaVeicolo | null>(null);
  const [q, setQ] = useState("");

  const loadTipi = async () => setTipi(await fetchTipiCosto("veicolo"));

  const load = async () => {
    const [{ data: vs }, { data: sp }] = await Promise.all([
      supabase.from("veicoli").select("id, targa, modello, tipo_macchina").eq("attivo", true).order("targa"),
      supabase.from("veicoli_spese").select("*").order("data_scadenza", { ascending: true, nullsFirst: false }),
    ]);
    setVeicoli((vs ?? []) as Veicolo[]);
    setRows((sp ?? []) as unknown as RigaVeicolo[]);
  };
  useEffect(() => { load(); loadTipi(); }, []);

  const tipoRicorrente = tipi.find((t) => t.valore === form.tipo)?.ricorrente ?? false;

  const setRicorrenza = (v: string) => {
    const mesi = RICORRENZE.find((r) => r.value === v)?.mesi ?? 0;
    setForm((f) => ({
      ...f,
      ricorrenza: v,
      data_scadenza: mesi > 0 && f.data_intervento ? addMesi(f.data_intervento, mesi) : f.data_scadenza,
    }));
  };

  const setDataIntervento = (v: string) => {
    const mesi = RICORRENZE.find((r) => r.value === form.ricorrenza)?.mesi ?? 0;
    setForm((f) => ({ ...f, data_intervento: v, data_scadenza: mesi > 0 && v ? addMesi(v, mesi) : f.data_scadenza }));
  };

  const salva = async () => {
    if (!form.veicolo_id) return toast.error("Seleziona la macchina");
    if (!form.tipo) return toast.error("Seleziona il tipo di spesa");
    const payload = {
      veicolo_id: form.veicolo_id,
      tipo: form.tipo,
      data_intervento: form.data_intervento || null,
      data_scadenza: form.data_scadenza || null,
      importo_spese: form.importo_spese ? Number(form.importo_spese.replace(",", ".")) : 0,
      note: form.note || null,
      fornitore: form.fornitore || null,
      tipo_pagamento: form.tipo_pagamento !== NESSUNO ? form.tipo_pagamento : null,
      ricorrenza: tipoRicorrente ? form.ricorrenza : null,
      giorni_preavviso: Number(form.giorni_preavviso || "30"),
      centro_costo: "veicolo",
    };
    const { error } = editing
      ? await supabase.from("veicoli_spese").update(payload as never).eq("id", editing.id)
      : await supabase.from("veicoli_spese").insert([payload] as never);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Costo aggiornato" : "Costo registrato");
    setForm({ ...emptyVeicolo }); setEditing(null); load();
  };

  const modifica = (r: RigaVeicolo) => {
    setEditing(r);
    setForm({
      veicolo_id: r.veicolo_id, tipo: r.tipo, data_intervento: r.data_intervento ?? "",
      tipo_pagamento: r.tipo_pagamento ?? NESSUNO, importo_spese: r.importo_spese != null ? String(r.importo_spese) : "",
      note: r.note ?? "", fornitore: r.fornitore ?? "", ricorrenza: r.ricorrenza ?? "nessuno",
      data_scadenza: r.data_scadenza ?? "", giorni_preavviso: String(r.giorni_preavviso ?? 30),
    });
  };

  const elimina = async (r: RigaVeicolo) => {
    if (!confirm("Eliminare questa riga?")) return;
    const { error } = await supabase.from("veicoli_spese").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const filtrati = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) =>
      !s || r.tipo.toLowerCase().includes(s) || nomeVeicolo(veicoli.find((v) => v.id === r.veicolo_id)).toLowerCase().includes(s)
      || (r.note ?? "").toLowerCase().includes(s) || (r.fornitore ?? "").toLowerCase().includes(s)
    );
  }, [rows, veicoli, q]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Macchina *</Label>
            <Select value={form.veicolo_id} onValueChange={(v) => setForm({ ...form, veicolo_id: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona macchina" /></SelectTrigger>
              <SelectContent>{veicoli.map((v) => <SelectItem key={v.id} value={v.id}>{nomeVeicolo(v)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label>Tipo spese *</Label><GestisciTipi ambito="veicolo" onChanged={loadTipi} /></div>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
              <SelectContent>{tipi.map((t) => <SelectItem key={t.id} value={t.valore}>{t.valore}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data intervento</Label>
            <Input type="date" value={form.data_intervento} onChange={(e) => setDataIntervento(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo di pagamento</Label>
            <Select value={form.tipo_pagamento} onValueChange={(v) => setForm({ ...form, tipo_pagamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NESSUNO}>Non specificato</SelectItem>
                {TIPI_PAGAMENTO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Importo spese (€)</Label>
            <Input inputMode="decimal" value={form.importo_spese} onChange={(e) => setForm({ ...form, importo_spese: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Fornitore</Label>
            <Input value={form.fornitore} onChange={(e) => setForm({ ...form, fornitore: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Note</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          {tipoRicorrente && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 sm:col-span-3">
              <Label className="text-sm font-semibold">Scadenze</Label>
              <RadioGroup value={form.ricorrenza} onValueChange={setRicorrenza} className="flex flex-wrap gap-4">
                {RICORRENZE.map((r) => (
                  <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value={r.value} id={`ric-${r.value}`} /> {r.label}
                  </label>
                ))}
              </RadioGroup>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Data scadenza</Label>
                  <Input type="date" value={form.data_scadenza} onChange={(e) => setForm({ ...form, data_scadenza: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Preavviso scadenza (giorni)</Label>
                  <Input inputMode="numeric" value={form.giorni_preavviso} onChange={(e) => setForm({ ...form, giorni_preavviso: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">La data scadenza è calcolata dalla data intervento e resta modificabile a mano.</p>
            </div>
          )}

          <div className="flex items-end gap-2 sm:col-span-3">
            <Button onClick={salva} disabled={!canWrite} className="gap-2">
              <Plus className="h-4 w-4" /> {editing ? "Salva modifiche" : "Registra costo"}
            </Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm({ ...emptyVeicolo }); }} className="gap-1"><X className="h-4 w-4" /> Annulla</Button>}
          </div>
        </CardContent>
      </Card>

      <Ricerca value={q} onChange={setQ} />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Macchina</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Data intervento</TableHead><TableHead>Data scadenza</TableHead>
                <TableHead className="text-right">Importo spese</TableHead>
                <TableHead className="text-right">Totale fattura</TableHead>
                <TableHead>Note</TableHead><TableHead>Fornitore</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrati.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{nomeVeicolo(veicoli.find((v) => v.id === r.veicolo_id))}</TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell>{dataIt(r.data_intervento)}</TableCell>
                  <TableCell><ScadenzaCell data={r.data_scadenza} preavviso={r.giorni_preavviso ?? 30} /></TableCell>
                  <TableCell className="text-right tabular-nums">{eur(r.importo_spese)}</TableCell>
                  <TableCell className="text-right tabular-nums">{eur(r.totale_fattura)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{r.note ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.fornitore ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => modifica(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => elimina(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtrati.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nessun costo registrato</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Tab 3: altri costi ---------- */

type RigaGenerale = {
  id: string; descrizione: string; categoria: string | null; data: string | null; data_scadenza: string | null;
  importo: number | null; tipo_pagamento: string | null; fornitore: string | null; note: string | null; giorni_preavviso: number;
};

const emptyGenerale = {
  descrizione: "", categoria: "", data: "", data_scadenza: "", importo: "",
  tipo_pagamento: NESSUNO, fornitore: "", note: "", giorni_preavviso: "30",
};

function AltriCosti() {
  const { canWrite } = useAuth();
  const [tipi, setTipi] = useState<TipoCosto[]>([]);
  const [rows, setRows] = useState<RigaGenerale[]>([]);
  const [form, setForm] = useState({ ...emptyGenerale });
  const [editing, setEditing] = useState<RigaGenerale | null>(null);
  const [q, setQ] = useState("");

  const loadTipi = async () => setTipi(await fetchTipiCosto("generale"));
  const load = async () => {
    const { data } = await supabase.from("costi_generali" as never).select("*").order("data", { ascending: false, nullsFirst: false });
    setRows((data ?? []) as unknown as RigaGenerale[]);
  };
  useEffect(() => { load(); loadTipi(); }, []);

  const salva = async () => {
    if (!form.descrizione.trim()) return toast.error("La descrizione è obbligatoria");
    const payload = {
      descrizione: form.descrizione.trim(),
      categoria: form.categoria || null,
      data: form.data || null,
      data_scadenza: form.data_scadenza || null,
      importo: form.importo ? Number(form.importo.replace(",", ".")) : 0,
      tipo_pagamento: form.tipo_pagamento !== NESSUNO ? form.tipo_pagamento : null,
      fornitore: form.fornitore || null,
      note: form.note || null,
      giorni_preavviso: Number(form.giorni_preavviso || "30"),
      centro_costo: "generale",
    };
    const { error } = editing
      ? await supabase.from("costi_generali" as never).update(payload as never).eq("id", editing.id)
      : await supabase.from("costi_generali" as never).insert([payload] as never);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Costo aggiornato" : "Costo registrato");
    setForm({ ...emptyGenerale }); setEditing(null); load();
  };

  const modifica = (r: RigaGenerale) => {
    setEditing(r);
    setForm({
      descrizione: r.descrizione, categoria: r.categoria ?? "", data: r.data ?? "", data_scadenza: r.data_scadenza ?? "",
      importo: r.importo != null ? String(r.importo) : "", tipo_pagamento: r.tipo_pagamento ?? NESSUNO,
      fornitore: r.fornitore ?? "", note: r.note ?? "", giorni_preavviso: String(r.giorni_preavviso ?? 30),
    });
  };

  const elimina = async (r: RigaGenerale) => {
    if (!confirm("Eliminare questa riga?")) return;
    const { error } = await supabase.from("costi_generali" as never).delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const filtrati = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => !s || r.descrizione.toLowerCase().includes(s) || (r.categoria ?? "").toLowerCase().includes(s) || (r.fornitore ?? "").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrizione *</Label>
            <Input value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="es. Canone gestionale" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label>Categoria</Label><GestisciTipi ambito="generale" onChanged={loadTipi} /></div>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
              <SelectContent>{tipi.map((t) => <SelectItem key={t.id} value={t.valore}>{t.valore}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Data scadenza</Label>
            <Input type="date" value={form.data_scadenza} onChange={(e) => setForm({ ...form, data_scadenza: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Importo (€)</Label>
            <Input inputMode="decimal" value={form.importo} onChange={(e) => setForm({ ...form, importo: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo di pagamento</Label>
            <Select value={form.tipo_pagamento} onValueChange={(v) => setForm({ ...form, tipo_pagamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NESSUNO}>Non specificato</SelectItem>
                {TIPI_PAGAMENTO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fornitore</Label>
            <Input value={form.fornitore} onChange={(e) => setForm({ ...form, fornitore: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Preavviso scadenza (giorni)</Label>
            <Input inputMode="numeric" value={form.giorni_preavviso} onChange={(e) => setForm({ ...form, giorni_preavviso: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Note</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-3">
            <Button onClick={salva} disabled={!canWrite} className="gap-2">
              <Plus className="h-4 w-4" /> {editing ? "Salva modifiche" : "Registra costo"}
            </Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm({ ...emptyGenerale }); }} className="gap-1"><X className="h-4 w-4" /> Annulla</Button>}
          </div>
        </CardContent>
      </Card>

      <Ricerca value={q} onChange={setQ} />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrizione</TableHead><TableHead>Categoria</TableHead>
                <TableHead>Data</TableHead><TableHead>Data scadenza</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Pagamento</TableHead><TableHead>Fornitore</TableHead><TableHead>Note</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrati.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.descrizione}</TableCell>
                  <TableCell>{r.categoria ?? "—"}</TableCell>
                  <TableCell>{dataIt(r.data)}</TableCell>
                  <TableCell><ScadenzaCell data={r.data_scadenza} preavviso={r.giorni_preavviso ?? 30} /></TableCell>
                  <TableCell className="text-right tabular-nums">{eur(r.importo)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.tipo_pagamento ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.fornitore ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{r.note ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => modifica(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => elimina(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtrati.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nessun costo registrato</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
