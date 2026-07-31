import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  PlusCircle, Pencil, Power, PowerOff, Search, Car as CarIcon, Trash2,
  Image as ImageIcon, FileText, Ticket, StickyNote, AlertTriangle, Wrench,
} from "lucide-react";
import { VoucherDialog } from "@/components/veicoli/VoucherDialog";

const TIPI_MEZZO = [
  "Autovettura 3 posti", "Bus 52 posti", "Luxury Car Serie S", "Minibus 16 Posti",
  "Minibus 8 posti", "Minivan 7 posti classe V", "Minivan 7/8 posti", "Servizio guida", "Veicolo disabili",
];

type Veicolo = {
  id: string; targa: string; tipo_macchina: string | null; marca: string | null; modello: string | null;
  colore: string | null; posti: number | null; note: string | null; attivo: boolean;
  dati_tecnici: string | null; km_attuale: number | null; km_prima_scadenza: number | null;
  intervallo_tagliando_km: number | null; tagliando_alert_stato: string | null;
  tagliando_ultimo_km: number | null; tagliando_ultimo_at: string | null;
  data_immatricolazione: string | null; telaio: string | null; consumo_km_litro: number | null;
  manutenzione_ordinaria: string | null; visibile_servizi: boolean; visibile_magazzino: boolean;
  km_voucher: number | null; km_iniziale: number | null; prezzo_acquisto: number | null;
  quota_mensile_credito: number | null; data_inizio_credito: string | null;
  data_ultima_quota_credito: string | null; photo_url: string | null;
};

type Totals = { ord: number; straord: number; gasolio: number; spese: number };

const emptyForm = {
  tipo_macchina: "", targa: "", modello: "", dati_tecnici: "",
  km_iniziale: "" as string | number, consumo_km_litro: "" as string | number,
  manutenzione_ordinaria: "", visibile_servizi: true, visibile_magazzino: true,
  km_voucher: "" as string | number, prezzo_acquisto: "" as string | number,
  quota_mensile_credito: "" as string | number, data_inizio_credito: "", data_ultima_quota_credito: "",
  marca: "", colore: "", posti: 4, telaio: "", data_immatricolazione: "",
  km_attuale: "" as string | number, km_prima_scadenza: "" as string | number,
  intervallo_tagliando_km: 20000 as string | number, note: "",
};

const eur = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function Veicoli() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [totals, setTotals] = useState<Record<string, Totals>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"attivi" | "disattivati">("attivi");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Veicolo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Veicolo | null>(null);
  const [voucherFor, setVoucherFor] = useState<Veicolo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("veicoli").select("*").order("targa");
    const list = (data ?? []) as Veicolo[];
    setVeicoli(list);

    // Aggregati per ogni mezzo
    const ids = list.map((v) => v.id);
    if (ids.length) {
      const [ord, str, gas, spe] = await Promise.all([
        supabase.from("veicoli_manutenzione_ord").select("veicolo_id, totale").in("veicolo_id", ids),
        supabase.from("veicoli_manutenzione_straord").select("veicolo_id, totale").in("veicolo_id", ids),
        supabase.from("veicoli_gasolio").select("veicolo_id, prezzo_totale").in("veicolo_id", ids),
        supabase.from("veicoli_spese").select("veicolo_id, importo_spese").in("veicolo_id", ids),
      ]);
      const t: Record<string, Totals> = {};
      ids.forEach((id) => { t[id] = { ord: 0, straord: 0, gasolio: 0, spese: 0 }; });
      (ord.data ?? []).forEach((r: any) => { t[r.veicolo_id].ord += Number(r.totale) || 0; });
      (str.data ?? []).forEach((r: any) => { t[r.veicolo_id].straord += Number(r.totale) || 0; });
      (gas.data ?? []).forEach((r: any) => { t[r.veicolo_id].gasolio += Number(r.prezzo_totale) || 0; });
      (spe.data ?? []).forEach((r: any) => { t[r.veicolo_id].spese += Number(r.importo_spese) || 0; });
      setTotals(t);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const filtered = useMemo(() => {
    return veicoli
      .filter((v) => (view === "attivi" ? v.attivo : !v.attivo))
      .filter((v) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return [v.targa, v.marca, v.modello, v.telaio, v.tipo_macchina].some((f) => (f ?? "").toLowerCase().includes(s));
      });
  }, [veicoli, view, search]);

  const counts = useMemo(() => ({
    attivi: veicoli.filter((v) => v.attivo).length,
    disattivati: veicoli.filter((v) => !v.attivo).length,
  }), [veicoli]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setPhotoFile(null); setDialogOpen(true); };

  const openEdit = (v: Veicolo) => {
    setEditing(v);
    setForm({
      tipo_macchina: v.tipo_macchina ?? "", targa: v.targa ?? "", modello: v.modello ?? "",
      dati_tecnici: v.dati_tecnici ?? "", km_iniziale: v.km_iniziale ?? "",
      consumo_km_litro: v.consumo_km_litro ?? "", manutenzione_ordinaria: v.manutenzione_ordinaria ?? "",
      visibile_servizi: v.visibile_servizi ?? true, visibile_magazzino: v.visibile_magazzino ?? true,
      km_voucher: v.km_voucher ?? "", prezzo_acquisto: v.prezzo_acquisto ?? "",
      quota_mensile_credito: v.quota_mensile_credito ?? "",
      data_inizio_credito: v.data_inizio_credito ?? "", data_ultima_quota_credito: v.data_ultima_quota_credito ?? "",
      marca: v.marca ?? "", colore: v.colore ?? "", posti: v.posti ?? 4, telaio: v.telaio ?? "",
      data_immatricolazione: v.data_immatricolazione ?? "",
      km_attuale: v.km_attuale ?? "", km_prima_scadenza: v.km_prima_scadenza ?? "",
      intervallo_tagliando_km: v.intervallo_tagliando_km ?? 20000, note: v.note ?? "",
    });
    setPhotoFile(null); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.targa.trim()) { toast.error("La targa è obbligatoria"); return; }
    setSaving(true);
    try {
      const num = (v: string | number) => v === "" ? null : Number(v);
      const payload: any = {
        targa: form.targa.trim().toUpperCase(),
        tipo_macchina: form.tipo_macchina || null, modello: form.modello || null,
        dati_tecnici: form.dati_tecnici || null, km_iniziale: num(form.km_iniziale),
        consumo_km_litro: num(form.consumo_km_litro), manutenzione_ordinaria: form.manutenzione_ordinaria || null,
        visibile_servizi: form.visibile_servizi, visibile_magazzino: form.visibile_magazzino,
        km_voucher: num(form.km_voucher), prezzo_acquisto: num(form.prezzo_acquisto),
        quota_mensile_credito: num(form.quota_mensile_credito),
        data_inizio_credito: form.data_inizio_credito || null,
        data_ultima_quota_credito: form.data_ultima_quota_credito || null,
        marca: form.marca || null, colore: form.colore || null,
        posti: Number(form.posti) || null, telaio: form.telaio || null,
        data_immatricolazione: form.data_immatricolazione || null,
        km_attuale: num(form.km_attuale), km_prima_scadenza: num(form.km_prima_scadenza),
        intervallo_tagliando_km: num(form.intervallo_tagliando_km) ?? 20000, note: form.note || null,
      };
      let id = editing?.id;
      if (editing) {
        const { error } = await supabase.from("veicoli").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("veicoli").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (photoFile && id) {
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${id}/photo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("veicoli-foto").upload(path, photoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("veicoli-foto").getPublicUrl(path);
        await supabase.from("veicoli").update({ photo_url: pub.publicUrl }).eq("id", id);
      }
      toast.success(editing ? "Mezzo aggiornato" : "Mezzo aggiunto");
      setDialogOpen(false); setEditing(null); setForm(emptyForm); setPhotoFile(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore salvataggio");
    } finally { setSaving(false); }
  };

  const toggleAttivo = async (v: Veicolo) => {
    const { error } = await supabase.from("veicoli").update({ attivo: !v.attivo }).eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success(v.attivo ? "Mezzo disattivato" : "Mezzo riattivato");
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("veicoli").delete().eq("id", confirmDelete.id);
    if (error) toast.error(error.message); else toast.success("Mezzo eliminato");
    setConfirmDelete(null); load();
  };

  const goTab = (id: string, tab: string) => navigate(`/veicoli/${id}?tab=${tab}`);

  const tagliandoEseguito = async (v: Veicolo) => {
    const { data, error } = await supabase.rpc("veicolo_tagliando_eseguito", {
      _veicolo_id: v.id, _km: v.km_attuale ?? null, _intervallo: v.intervallo_tagliando_km ?? null,
    });
    if (error) return toast.error(error.message);
    const nuovo = (data as any)?.km_prima_scadenza;
    toast.success(`Tagliando registrato. Nuova soglia: ${nuovo?.toLocaleString("it-IT") ?? "—"} km`);
    load();
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold font-display flex items-center gap-2">
                <CarIcon className="h-6 w-6 text-primary" /> Lista Macchine
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestisci la flotta: documenti, manutenzioni, carburante, spese e voucher giornalieri.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <PlusCircle className="h-4 w-4" /> Aggiungi mezzo
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Tabs value={view} onValueChange={(v) => setView(v as "attivi" | "disattivati")}>
              <TabsList>
                <TabsTrigger value="attivi" className="gap-2">Attivi <Badge variant="secondary">{counts.attivi}</Badge></TabsTrigger>
                <TabsTrigger value="disattivati" className="gap-2">Disattivati <Badge variant="secondary">{counts.disattivati}</Badge></TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca per targa, modello..." className="pl-9" />
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Targa</TableHead>
                    <TableHead>Modello</TableHead>
                    <TableHead className="hidden md:table-cell">Dati tecnici</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Km Attuale</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Km Prima Scad.</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">M.Ord</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">M.Stra</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Gasolio</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Spese</TableHead>
                    <TableHead className="text-center">Azioni</TableHead>
                    <TableHead className="hidden xl:table-cell">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">Caricamento...</TableCell></TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        <CarIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        {view === "attivi" ? "Nessun mezzo attivo" : "Nessun mezzo disattivato"}
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((v) => {
                    const t = totals[v.id] ?? { ord: 0, straord: 0, gasolio: 0, spese: 0 };
                    const kmDiff = v.km_attuale != null && v.km_prima_scadenza != null
                      ? v.km_prima_scadenza - v.km_attuale : null;
                    const stato = kmDiff === null ? "ok" : kmDiff <= 0 ? "scaduto" : kmDiff <= 5000 ? "avviso" : "ok";
                    return (
                      <TableRow
                        key={v.id}
                        className={
                          stato === "scaduto"
                            ? "group bg-destructive/10 hover:bg-destructive/15"
                            : stato === "avviso"
                              ? "group bg-amber-500/10 hover:bg-amber-500/15"
                              : "group"
                        }
                      >
                        <TableCell>
                          <div className="font-semibold">{v.targa}</div>
                          {v.tipo_macchina && <div className="text-xs text-muted-foreground">{v.tipo_macchina}</div>}
                          {stato === "scaduto" && (
                            <Badge variant="destructive" className="mt-1 gap-1 text-[10px]">
                              <AlertTriangle className="h-3 w-3" /> Tagliando da eseguire: soglia superata
                            </Badge>
                          )}
                          {stato === "avviso" && (
                            <Badge className="mt-1 gap-1 text-[10px] bg-amber-500 text-white hover:bg-amber-500">
                              <AlertTriangle className="h-3 w-3" /> Tagliando in avvicinamento: mancano {kmDiff!.toLocaleString("it-IT")} km
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{[v.marca, v.modello].filter(Boolean).join(" ") || "—"}</div>
                          {v.posti != null && <div className="text-xs text-muted-foreground">{v.posti} posti</div>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {v.data_immatricolazione && <div>{new Date(v.data_immatricolazione).toLocaleDateString("it-IT")}</div>}
                          {v.telaio && <div className="font-mono text-xs">{v.telaio}</div>}
                          {!v.data_immatricolazione && !v.telaio && (v.dati_tecnici || "—")}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums">
                          {v.km_attuale != null ? v.km_attuale.toLocaleString("it-IT") : "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right tabular-nums">
                          {v.km_prima_scadenza != null ? (
                            <div>
                              <span className={stato === "scaduto" ? "text-destructive font-semibold" : stato === "avviso" ? "text-amber-600 font-semibold" : ""}>
                                {v.km_prima_scadenza.toLocaleString("it-IT")}
                              </span>
                              {kmDiff !== null && (
                                <div className="text-[10px] text-muted-foreground">
                                  {kmDiff > 0 ? `mancano ${kmDiff.toLocaleString("it-IT")} km` : `superata di ${Math.abs(kmDiff).toLocaleString("it-IT")} km`}
                                </div>
                              )}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <button onClick={() => goTab(v.id, "man-ord")} className="text-primary hover:underline tabular-nums text-sm">
                            {eur(t.ord)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <button onClick={() => goTab(v.id, "man-str")} className="text-primary hover:underline tabular-nums text-sm">
                            {eur(t.straord)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          <button onClick={() => goTab(v.id, "gasolio")} className="text-primary hover:underline tabular-nums text-sm">
                            {eur(t.gasolio)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          <button onClick={() => goTab(v.id, "spese")} className="text-primary hover:underline tabular-nums text-sm">
                            {eur(t.spese)}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setVoucherFor(v)}>
                                <Ticket className="h-4 w-4 text-primary" />
                              </Button>
                            </TooltipTrigger><TooltipContent>Voucher</TooltipContent></Tooltip>

                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => goTab(v.id, "documenti")}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger><TooltipContent>Documenti</TooltipContent></Tooltip>

                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger><TooltipContent>Modifica info</TooltipContent></Tooltip>

                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => tagliandoEseguito(v)}>
                                <Wrench className="h-4 w-4 text-emerald-600" />
                              </Button>
                            </TooltipTrigger><TooltipContent>
                              Tagliando eseguito (sposta la soglia di {(v.intervallo_tagliando_km ?? 20000).toLocaleString("it-IT")} km)
                            </TooltipContent></Tooltip>


                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => toggleAttivo(v)}>
                                {v.attivo
                                  ? <PowerOff className="h-4 w-4 text-amber-600" />
                                  : <Power className="h-4 w-4 text-emerald-600" />}
                              </Button>
                            </TooltipTrigger><TooltipContent>{v.attivo ? "Disattiva" : "Riattiva"}</TooltipContent></Tooltip>

                            <Tooltip><TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(v)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger><TooltipContent>Elimina</TooltipContent></Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground max-w-xs">
                          {v.note ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 truncate">
                                  <StickyNote className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{v.note}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs whitespace-pre-wrap">{v.note}</TooltipContent>
                            </Tooltip>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Add / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-display">
                {editing ? "Modifica Macchina" : "Nuova Macchina"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <VField label="Tipo">
                <Select value={form.tipo_macchina || undefined} onValueChange={(v) => setForm({ ...form, tipo_macchina: v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>{TIPI_MEZZO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </VField>
              <VField label="Targa"><Input value={form.targa} onChange={(e) => setForm({ ...form, targa: e.target.value.toUpperCase() })} /></VField>
              <VField label="Modello"><Input value={form.modello} onChange={(e) => setForm({ ...form, modello: e.target.value })} /></VField>
              <VField label="Dati tecnici"><Input value={form.dati_tecnici} onChange={(e) => setForm({ ...form, dati_tecnici: e.target.value })} /></VField>
              <VField label="Km iniziale"><Input inputMode="decimal" value={form.km_iniziale} onChange={(e) => setForm({ ...form, km_iniziale: e.target.value })} /></VField>
              <VField label="Km attuale"><Input inputMode="decimal" value={form.km_attuale} onChange={(e) => setForm({ ...form, km_attuale: e.target.value })} /></VField>
              <VField label="Km prima scadenza (soglia tagliando)"><Input inputMode="decimal" value={form.km_prima_scadenza} onChange={(e) => setForm({ ...form, km_prima_scadenza: e.target.value })} /></VField>
              <VField label="Intervallo tagliando (km)"><Input inputMode="decimal" value={form.intervallo_tagliando_km} onChange={(e) => setForm({ ...form, intervallo_tagliando_km: e.target.value })} /></VField>
              <VField label="Consumo km / 1L"><Input inputMode="decimal" value={form.consumo_km_litro} onChange={(e) => setForm({ ...form, consumo_km_litro: e.target.value })} /></VField>
              <VField label="Manutenzione ordinaria"><Input value={form.manutenzione_ordinaria} onChange={(e) => setForm({ ...form, manutenzione_ordinaria: e.target.value })} /></VField>
              <VField label="Visibile in servizi">
                <div className="flex items-center h-10"><Checkbox checked={form.visibile_servizi} onCheckedChange={(c) => setForm({ ...form, visibile_servizi: !!c })} /></div>
              </VField>
              <VField label="Visibile in magazzino">
                <div className="flex items-center h-10"><Checkbox checked={form.visibile_magazzino} onCheckedChange={(c) => setForm({ ...form, visibile_magazzino: !!c })} /></div>
              </VField>
              <VField label="Km - Voucher"><Input inputMode="decimal" value={form.km_voucher} onChange={(e) => setForm({ ...form, km_voucher: e.target.value })} /></VField>

              <Separator className="my-4" />
              <h3 className="text-lg font-display italic font-semibold">Info</h3>
              <VField label="Telaio"><Input value={form.telaio} onChange={(e) => setForm({ ...form, telaio: e.target.value })} /></VField>
              <VField label="Data immatricolazione"><Input type="date" value={form.data_immatricolazione} onChange={(e) => setForm({ ...form, data_immatricolazione: e.target.value })} /></VField>
              <VField label="Prezzo acquisto"><Input inputMode="decimal" value={form.prezzo_acquisto} onChange={(e) => setForm({ ...form, prezzo_acquisto: e.target.value })} /></VField>
              <VField label="Quota mensile credito"><Input inputMode="decimal" value={form.quota_mensile_credito} onChange={(e) => setForm({ ...form, quota_mensile_credito: e.target.value })} /></VField>
              <VField label="Data Inizio Credito"><Input type="date" value={form.data_inizio_credito} onChange={(e) => setForm({ ...form, data_inizio_credito: e.target.value })} /></VField>
              <VField label="Data Ultima quota"><Input type="date" value={form.data_ultima_quota_credito} onChange={(e) => setForm({ ...form, data_ultima_quota_credito: e.target.value })} /></VField>
              <VField label="Note"><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></VField>
              <VField label="Foto">
                <div className="space-y-2">
                  <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
                  {editing?.photo_url && !photoFile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ImageIcon className="h-3 w-3" /> Foto attuale presente
                    </div>
                  )}
                </div>
              </VField>
            </div>
            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSave} disabled={saving}>{editing ? "Salva modifiche" : "Inserisci"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare il mezzo {confirmDelete?.targa}?</AlertDialogTitle>
              <AlertDialogDescription>
                L'eliminazione è permanente e cancella anche documenti, manutenzioni, gasolio e spese collegate. Se vuoi conservarne lo storico, disattivalo invece di eliminarlo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <VoucherDialog
          open={!!voucherFor}
          onOpenChange={(o) => !o && setVoucherFor(null)}
          veicolo={voucherFor ? { id: voucherFor.id, targa: voucherFor.targa, tipo_macchina: voucherFor.tipo_macchina, km_attuale: voucherFor.km_attuale } : null}
        />
      </TooltipProvider>
    </DashboardLayout>
  );
}

function VField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-3">
      <Label className="text-sm italic font-semibold text-right">{label}:</Label>
      <div>{children}</div>
    </div>
  );
}
