import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimePicker } from "@/components/ui/time-picker";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Wrench, X, Users } from "lucide-react";
import { romeToday } from "@/lib/romeDate";
import { OperaiDialog, nomeOperaio, type Operaio } from "@/components/veicoli/OperaiDialog";

type Mode = "ord" | "straord";

type Row = {
  id: string;
  data: string;
  km?: number | null;
  km_attuale?: number | null;
  tipo?: string | null;
  tipo_riparazione?: string | null;
  note?: string | null;
  ricambi?: string | null;
  fornitore?: string | null;
  ordine?: string | null;
  totale: number;
  intervento_tipo?: string | null;
  operaio_id?: string | null;
  ora_inizio?: string | null;
  ora_fine?: string | null;
  costo_materiale?: number | null;
  costo_manodopera?: number | null;
};

type Articolo = { id: string; nome: string; unita_misura: string; prezzo_unitario: number | null };

const CAT: Record<Mode, string> = { ord: "ordinaria", straord: "straordinaria" };
type Riga = { articolo_id: string; quantita: string; prezzo_unitario: string };

const NESSUNO = "__nessuno__";
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

export function SectionManutenzione({ veicoloId, mode, targa }: { veicoloId: string; mode: Mode; targa?: string }) {
  const isOrd = mode === "ord";
  const table = isOrd ? "veicoli_manutenzione_ord" : "veicoli_manutenzione_straord";
  const kmField = isOrd ? "km" : "km_attuale";
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // magazzino / operai
  const [operai, setOperai] = useState<Operaio[]>([]);
  const [operaiOpen, setOperaiOpen] = useState(false);
  const [articoli, setArticoli] = useState<Articolo[]>([]);
  const [giacenze, setGiacenze] = useState<Record<string, number>>({});
  const [righe, setRighe] = useState<Riga[]>([]);
  const [righeOriginali, setRigheOriginali] = useState<Record<string, number>>({});
  const [fornitori, setFornitori] = useState<{ id: string; nome: string }[]>([]);
  const [tipiRiparazione, setTipiRiparazione] = useState<string[]>([]);

  const load = async () => {
    const { data } = await supabase.from(table).select("*").eq("veicolo_id", veicoloId).order("data", { ascending: false });
    setRows((data ?? []) as Row[]);
  };

  const loadMagazzino = async () => {
    const [{ data: a }, { data: m }, { data: o }, { data: f }, { data: tr }] = await Promise.all([
      supabase.from("articoli").select("id, nome, unita_misura, prezzo_unitario").eq("attivo", true).contains("categorie", [CAT[mode]]).order("nome"),
      supabase.from("movimenti_magazzino").select("articolo_id, tipo, quantita"),
      supabase.from("operai").select("id, nome, cognome, mansione, costo_orario, attivo").eq("attivo", true).order("nome"),
      supabase.from("fornitori_magazzino").select("id, nome").eq("attivo", true).order("nome"),
      supabase.from("config_tipi_costo" as never).select("valore, attivo, ordine").eq("ambito", "riparazione").order("ordine"),
    ]);
    setArticoli((a ?? []) as Articolo[]);
    const g: Record<string, number> = {};
    (m ?? []).forEach((x: any) => {
      g[x.articolo_id] = (g[x.articolo_id] ?? 0) + (x.tipo === "carico" ? Number(x.quantita) : -Number(x.quantita));
    });
    setGiacenze(g);
    setOperai((o ?? []) as Operaio[]);
    setFornitori((f ?? []) as { id: string; nome: string }[]);
    setTipiRiparazione(((tr ?? []) as any[]).filter((t) => t.attivo).map((t) => t.valore as string));
  };

  useEffect(() => { load(); }, [veicoloId, mode]);
  useEffect(() => { loadMagazzino(); }, [mode]);


  const giacenzaDisponibile = (articoloId: string) =>
    (giacenze[articoloId] ?? 0) + (righeOriginali[articoloId] ?? 0);

  const openNew = () => {
    setEditing(null);
    setForm({ data: romeToday(), totale: "", intervento_tipo: "esterno" });
    setRighe([]);
    setRigheOriginali({});
    setOpen(true);
  };

  const openEdit = async (r: Row) => {
    setEditing(r);
    setForm({ ...r, ora_inizio: hhmm(r.ora_inizio), ora_fine: hhmm(r.ora_fine), intervento_tipo: r.intervento_tipo ?? "esterno" });
    setRighe([]);
    setRigheOriginali({});
    {
      const { data } = await supabase
        .from("movimenti_magazzino")
        .select("articolo_id, quantita, prezzo_unitario")
        .eq(isOrd ? "manutenzione_ord_id" : "manutenzione_straord_id", r.id);
      const rr = (data ?? []).map((x: any) => ({
        articolo_id: x.articolo_id,
        quantita: String(x.quantita),
        prezzo_unitario: x.prezzo_unitario != null ? String(x.prezzo_unitario) : "",
      }));
      setRighe(rr);
      const orig: Record<string, number> = {};
      (data ?? []).forEach((x: any) => { orig[x.articolo_id] = (orig[x.articolo_id] ?? 0) + Number(x.quantita); });
      setRigheOriginali(orig);
    }
    setOpen(true);
  };

  const totaleMateriale = useMemo(
    () => righe.reduce((s, r) => s + (Number(r.quantita) || 0) * (Number(r.prezzo_unitario) || 0), 0),
    [righe]
  );

  const oreIntervento = useMemo(() => {
    if (!form.ora_inizio || !form.ora_fine) return 0;
    const [h1, m1] = form.ora_inizio.split(":").map(Number);
    const [h2, m2] = form.ora_fine.split(":").map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return diff / 60;
  }, [form.ora_inizio, form.ora_fine]);

  const operaioSel = operai.find((o) => o.id === form.operaio_id);
  const totaleManodopera = (operaioSel?.costo_orario ?? 0) * oreIntervento;

  const salvaRpc = async (forza: boolean): Promise<boolean> => {
    const righePayload = form.intervento_tipo === "interno"
      ? righe
          .filter((r) => r.articolo_id && Number(r.quantita) > 0)
          .map((r) => ({ articolo_id: r.articolo_id, quantita: Number(r.quantita), prezzo_unitario: r.prezzo_unitario === "" ? null : Number(r.prezzo_unitario) }))
      : [];
    const payload = {
      _id: editing?.id ?? null,
      _veicolo_id: veicoloId,
      _data: form.data || romeToday(),
      _km: form[kmField] ? Number(form[kmField]) : null,
      _intervento_tipo: form.intervento_tipo ?? "esterno",
      _tipo: form.tipo || null,
      _note: form.note || null,
      _ricambi: form.ricambi || null,
      _fornitore: form.fornitore || null,
      _operaio_id: form.intervento_tipo === "interno" ? (form.operaio_id || null) : null,
      _ora_inizio: form.intervento_tipo === "interno" && form.ora_inizio ? form.ora_inizio : null,
      _ora_fine: form.intervento_tipo === "interno" && form.ora_fine ? form.ora_fine : null,
      _righe: righePayload,
      _totale_esterno: form.intervento_tipo === "esterno" ? (form.totale ? Number(form.totale) : 0) : null,
      _forza: forza,
      ...(isOrd ? {} : {
        _tipo_riparazione: form.tipo_riparazione || null,
        _ordine: form.ordine || null,
        _km_manutenzione: form.km_manutenzione ? Number(form.km_manutenzione) : null,
        _fornitore_id: form.intervento_tipo === "esterno" ? (form.fornitore_id || null) : null,
      }),
    };
    const { error } = await supabase.rpc(
      (isOrd ? "manutenzione_ord_salva" : "manutenzione_straord_salva") as any,
      payload as any
    );
    if (error) {
      if (/Giacenza insufficiente/.test(error.message) && !forza) {
        if (confirm(`${error.message}. Procedere comunque? Il movimento sarà marcato come anomalia.`)) {
          return salvaRpc(true);
        }
        return false;
      }
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await salvaRpc(false);
      if (!ok) return;
      toast.success(editing ? "Aggiornato" : "Aggiunto");
      setOpen(false);
      load();
      loadMagazzino();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Row) => {
    if (!confirm("Eliminare questo intervento? Gli eventuali scarichi di magazzino collegati verranno stornati.")) return;
    const { error } = await supabase.from(table).delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato");
    load();
    loadMagazzino();
  };

  const totale = rows.reduce((sum, r) => sum + (Number(r.totale) || 0), 0);
  const eur = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const interno = form.intervento_tipo === "interno";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Totale: <span className="font-semibold text-foreground">{eur(totale)}</span>
        </div>
        <div className="flex gap-2">
          {(
            <Button variant="outline" onClick={() => setOperaiOpen(true)} className="gap-2">
              <Users className="h-4 w-4" /> Operai
            </Button>
          )}
          <Button onClick={openNew} className="gap-2"><PlusCircle className="h-4 w-4" /> Aggiungi intervento</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Km</TableHead>
              {mode === "straord" && <TableHead>Tipo riparazione</TableHead>}
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Operaio</TableHead>
              <TableHead className="hidden md:table-cell">Note</TableHead>
              <TableHead className="hidden lg:table-cell">Ricambi</TableHead>
              <TableHead className="hidden lg:table-cell">Fornitore</TableHead>
              {mode === "straord" && <TableHead className="hidden xl:table-cell">Ordine</TableHead>}
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={mode === "straord" ? 11 : 10} className="text-center py-10 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />Nessun intervento registrato
              </TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.data).toLocaleDateString("it-IT")}</TableCell>
                <TableCell className="text-right tabular-nums">{(r.km ?? r.km_attuale)?.toLocaleString("it-IT") ?? "—"}</TableCell>
                {mode === "straord" && <TableCell>{r.tipo_riparazione ?? "—"}</TableCell>}
                <TableCell>
                  <Badge variant={r.intervento_tipo === "interno" ? "default" : "secondary"}>
                    {r.intervento_tipo === "interno" ? "Intervento interno" : "Intervento esterno"}
                  </Badge>
                </TableCell>
                {(
                  <TableCell className="hidden md:table-cell text-sm">
                    {operai.find((o) => o.id === r.operaio_id) ? nomeOperaio(operai.find((o) => o.id === r.operaio_id)!) : "—"}
                  </TableCell>
                )}
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[240px] truncate">{r.note ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{r.ricambi ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.fornitore ?? "—"}</TableCell>
                {mode === "straord" && <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{r.ordine ?? "—"}</TableCell>}
                <TableCell className="text-right tabular-nums font-medium">
                  {eur(Number(r.totale) || 0)}
                  {r.intervento_tipo === "interno" && (
                    <div className="text-[11px] font-normal text-muted-foreground">
                      mat. {eur(Number(r.costo_materiale) || 0)} · mdo {eur(Number(r.costo_manodopera) || 0)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica intervento" : "Nuovo intervento"}</DialogTitle>
          </DialogHeader>
          {mode === "straord" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Targa</Label><Input value={targa ?? ""} readOnly disabled /></div>
              <div><Label>Km Attuale</Label>
                <Input inputMode="numeric" value={form.km_attuale ?? ""} onChange={(e) => setForm({ ...form, km_attuale: e.target.value })} /></div>
              <div><Label>Data intervento</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div>
                <Label>Tipo riparazione</Label>
                <Select value={form.tipo_riparazione || undefined} onValueChange={(v) => setForm({ ...form, tipo_riparazione: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    {tipiRiparazione.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Km manutenzione</Label>
                <Input inputMode="numeric" value={form.km_manutenzione ?? ""} onChange={(e) => setForm({ ...form, km_manutenzione: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.intervento_tipo ?? "esterno"} onValueChange={(v) => setForm({ ...form, intervento_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interno">Intervento interno</SelectItem>
                    <SelectItem value="esterno">Officina esterna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Note / Acquisto</Label>
                <Textarea value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></div>
              {!interno && (
                <>
                  <div>
                    <Label>Fornitore</Label>
                    <Select value={form.fornitore_id ?? NESSUNO} onValueChange={(v) => setForm({ ...form, fornitore_id: v === NESSUNO ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NESSUNO}>Nessuno</SelectItem>
                        {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Costo (€)</Label>
                    <Input inputMode="decimal" value={form.totale ?? ""} onChange={(e) => setForm({ ...form, totale: e.target.value })} /></div>
                </>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div><Label>Km manutenzione</Label>
              <Input inputMode="numeric" value={form.km ?? ""} onChange={(e) => setForm({ ...form, km: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.intervento_tipo ?? "esterno"} onValueChange={(v) => setForm({ ...form, intervento_tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">Intervento interno</SelectItem>
                  <SelectItem value="esterno">Officina esterna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Note</Label><Textarea value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Ricambi</Label><Textarea value={form.ricambi ?? ""} onChange={(e) => setForm({ ...form, ricambi: e.target.value })} rows={2} placeholder="es. Filtro aria [1], Filtro olio [1]" /></div>
            {!interno && (
              <>
                <div>
                  <Label>Fornitore</Label>
                  <Select value={form.fornitore_id ?? NESSUNO} onValueChange={(v) => {
                    const f = fornitori.find((x) => x.id === v);
                    setForm({ ...form, fornitore_id: v === NESSUNO ? null : v, fornitore: f?.nome ?? null });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NESSUNO}>Nessuno</SelectItem>
                      {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Costo (€)</Label><Input inputMode="decimal" value={form.totale ?? ""} onChange={(e) => setForm({ ...form, totale: e.target.value })} /></div>
              </>
            )}
          </div>
          )}


          {interno && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold">Magazzino</h3>
                <Button variant="outline" size="sm" onClick={() => setOperaiOpen(true)} className="gap-1.5">
                  <PlusCircle className="h-4 w-4" /> Nuovo operaio
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Operaio</Label>
                  <Select value={form.operaio_id ?? NESSUNO} onValueChange={(v) => setForm({ ...form, operaio_id: v === NESSUNO ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NESSUNO}>Nessuno</SelectItem>
                      {operai.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{nomeOperaio(o)}{o.mansione ? ` — ${o.mansione}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ora inizio</Label><TimePicker value={form.ora_inizio ?? ""} onChange={(v) => setForm({ ...form, ora_inizio: v })} /></div>
                <div><Label>Ora fine</Label><TimePicker value={form.ora_fine ?? ""} onChange={(v) => setForm({ ...form, ora_fine: v })} /></div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Articolo</TableHead>
                      <TableHead className="text-right">Qta Mag</TableHead>
                      <TableHead className="text-right">Qta richiesta</TableHead>
                      <TableHead className="text-right">Prezzo Unità</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {righe.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Nessun materiale</TableCell></TableRow>
                    )}
                    {righe.map((r, i) => {
                      const art = articoli.find((a) => a.id === r.articolo_id);
                      const disp = r.articolo_id ? giacenzaDisponibile(r.articolo_id) : 0;
                      const eccede = Number(r.quantita) > disp;
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <Select
                              value={r.articolo_id || undefined}
                              onValueChange={(v) => {
                                const a = articoli.find((x) => x.id === v);
                                setRighe(righe.map((x, j) => j === i
                                  ? { ...x, articolo_id: v, prezzo_unitario: x.prezzo_unitario || (a?.prezzo_unitario != null ? String(a.prezzo_unitario) : "") }
                                  : x));
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Seleziona articolo" /></SelectTrigger>
                              <SelectContent>
                                {articoli.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {r.articolo_id ? `${disp} pz` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              inputMode="decimal"
                              className={`text-right ${eccede ? "border-destructive" : ""}`}
                              value={r.quantita}
                              onChange={(e) => setRighe(righe.map((x, j) => j === i ? { ...x, quantita: e.target.value } : x))}
                            />
                            {eccede && <div className="text-[11px] text-destructive mt-1">Giacenza insufficiente (disponibili {disp})</div>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              inputMode="decimal"
                              className="text-right"
                              value={r.prezzo_unitario}
                              onChange={(e) => setRighe(righe.map((x, j) => j === i ? { ...x, prezzo_unitario: e.target.value } : x))}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => setRighe(righe.filter((_, j) => j !== i))}>
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => setRighe([...righe, { articolo_id: "", quantita: "", prezzo_unitario: "" }])} className="gap-1.5">
                  <PlusCircle className="h-4 w-4" /> Aggiungi materiale
                </Button>
                <div className="text-sm text-muted-foreground">
                  Materiale <span className="font-semibold text-foreground">{eur(totaleMateriale)}</span>
                  {" · "}Manodopera <span className="font-semibold text-foreground">{eur(totaleManodopera)}</span>
                  {" · "}Totale <span className="font-semibold text-foreground">{eur(totaleMateriale + totaleManodopera)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Le quantità sono espresse in PEZZI (non in confezioni).</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>{editing ? "Salva" : "Aggiungi"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OperaiDialog
        open={operaiOpen}
        onOpenChange={setOperaiOpen}
        onSaved={(nuovo) => { loadMagazzino(); if (nuovo) setForm((f: any) => ({ ...f, operaio_id: nuovo.id })); }}
      />
    </div>
  );
}
