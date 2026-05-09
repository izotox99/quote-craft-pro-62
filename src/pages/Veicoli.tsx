import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Pencil, Power, PowerOff, Search, Car as CarIcon, Trash2, Image as ImageIcon } from "lucide-react";

const TIPI_MEZZO = ["Berlina", "Van", "Minibus", "SUV", "Limousine", "Bus", "Altro"];

type Veicolo = {
  id: string;
  targa: string;
  tipo_macchina: string | null;
  marca: string | null;
  modello: string | null;
  colore: string | null;
  posti: number | null;
  note: string | null;
  attivo: boolean;
  dati_tecnici: string | null;
  km_attuale: number | null;
  km_prima_scadenza: number | null;
  data_immatricolazione: string | null;
  telaio: string | null;
  consumo_km_litro: number | null;
  manutenzione_ordinaria: string | null;
  visibile_servizi: boolean;
  visibile_magazzino: boolean;
  km_voucher: number | null;
  km_iniziale: number | null;
  prezzo_acquisto: number | null;
  quota_mensile_credito: number | null;
  data_inizio_credito: string | null;
  data_ultima_quota_credito: string | null;
  photo_url: string | null;
};

const emptyForm = {
  tipo_macchina: "",
  targa: "",
  modello: "",
  dati_tecnici: "",
  km_iniziale: "" as string | number,
  consumo_km_litro: "" as string | number,
  manutenzione_ordinaria: "",
  visibile_servizi: true,
  visibile_magazzino: true,
  km_voucher: "" as string | number,
  prezzo_acquisto: "" as string | number,
  quota_mensile_credito: "" as string | number,
  data_inizio_credito: "",
  data_ultima_quota_credito: "",
  // mantenuti per la tabella
  marca: "",
  colore: "",
  posti: 4,
  telaio: "",
  data_immatricolazione: "",
  km_attuale: "" as string | number,
  km_prima_scadenza: "" as string | number,
  note: "",
};

export default function Veicoli() {
  const { user } = useAuth();
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"attivi" | "disattivati">("attivi");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Veicolo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Veicolo | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("veicoli").select("*").order("targa");
    setVeicoli((data ?? []) as Veicolo[]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const filtered = useMemo(() => {
    return veicoli
      .filter((v) => (view === "attivi" ? v.attivo : !v.attivo))
      .filter((v) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return [v.targa, v.marca, v.modello, v.telaio].some((f) => (f ?? "").toLowerCase().includes(s));
      });
  }, [veicoli, view, search]);

  const counts = useMemo(() => ({
    attivi: veicoli.filter((v) => v.attivo).length,
    disattivati: veicoli.filter((v) => !v.attivo).length,
  }), [veicoli]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Veicolo) => {
    setEditing(v);
    setForm({
      targa: v.targa ?? "",
      marca: v.marca ?? "",
      modello: v.modello ?? "",
      tipo_macchina: v.tipo_macchina ?? "",
      colore: v.colore ?? "",
      posti: v.posti ?? 4,
      telaio: v.telaio ?? "",
      data_immatricolazione: v.data_immatricolazione ?? "",
      km_attuale: v.km_attuale ?? "",
      km_prima_scadenza: v.km_prima_scadenza ?? "",
      dati_tecnici: v.dati_tecnici ?? "",
      note: v.note ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.targa.trim()) {
      toast.error("La targa è obbligatoria");
      return;
    }
    const payload = {
      targa: form.targa.trim().toUpperCase(),
      marca: form.marca || null,
      modello: form.modello || null,
      tipo_macchina: form.tipo_macchina || null,
      colore: form.colore || null,
      posti: Number(form.posti) || null,
      telaio: form.telaio || null,
      data_immatricolazione: form.data_immatricolazione || null,
      km_attuale: form.km_attuale === "" ? null : Number(form.km_attuale),
      km_prima_scadenza: form.km_prima_scadenza === "" ? null : Number(form.km_prima_scadenza),
      dati_tecnici: form.dati_tecnici || null,
      note: form.note || null,
    };
    if (editing) {
      const { error } = await supabase.from("veicoli").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Mezzo aggiornato");
    } else {
      const { error } = await supabase.from("veicoli").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Mezzo aggiunto");
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    load();
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
    if (error) toast.error(error.message);
    else toast.success("Mezzo eliminato");
    setConfirmDelete(null);
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <CarIcon className="h-6 w-6 text-primary" /> Lista Mezzi
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestisci la flotta aziendale: aggiungi, modifica o disattiva i mezzi.
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
              <TabsTrigger value="attivi" className="gap-2">
                Attivi <Badge variant="secondary" className="ml-1">{counts.attivi}</Badge>
              </TabsTrigger>
              <TabsTrigger value="disattivati" className="gap-2">
                Disattivati <Badge variant="secondary" className="ml-1">{counts.disattivati}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per targa, marca, modello..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Targa</TableHead>
                  <TableHead>Modello</TableHead>
                  <TableHead className="hidden md:table-cell">Dati tecnici</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Km attuale</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Km prima scadenza</TableHead>
                  <TableHead className="hidden xl:table-cell">Note</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Caricamento...</TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <CarIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      {view === "attivi" ? "Nessun mezzo attivo" : "Nessun mezzo disattivato"}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((v) => {
                  const kmDiff = v.km_attuale != null && v.km_prima_scadenza != null
                    ? v.km_prima_scadenza - v.km_attuale : null;
                  const scadenzaWarn = kmDiff !== null && kmDiff < 5000;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="font-semibold">{v.targa}</div>
                        {v.colore && <div className="text-xs text-muted-foreground">{v.colore}</div>}
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
                          <span className={scadenzaWarn ? "text-destructive font-semibold" : ""}>
                            {v.km_prima_scadenza.toLocaleString("it-IT")}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground max-w-xs truncate">
                        {v.note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(v)} title="Modifica">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAttivo(v)}
                            title={v.attivo ? "Disattiva" : "Riattiva"}
                          >
                            {v.attivo
                              ? <PowerOff className="h-4 w-4 text-amber-600" />
                              : <Power className="h-4 w-4 text-emerald-600" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(v)}
                            title="Elimina"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica mezzo" : "Aggiungi mezzo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Targa *</Label>
              <Input value={form.targa} onChange={(e) => setForm({ ...form, targa: e.target.value })} placeholder="AB123CD" />
            </div>
            <div className="space-y-1.5"><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Modello</Label><Input value={form.modello} onChange={(e) => setForm({ ...form, modello: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Tipo</Label><Input value={form.tipo_macchina} onChange={(e) => setForm({ ...form, tipo_macchina: e.target.value })} placeholder="Berlina, Van..." /></div>
            <div className="space-y-1.5"><Label>Colore</Label><Input value={form.colore} onChange={(e) => setForm({ ...form, colore: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Posti</Label><Input type="number" value={form.posti} onChange={(e) => setForm({ ...form, posti: +e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Data immatricolazione</Label><Input type="date" value={form.data_immatricolazione} onChange={(e) => setForm({ ...form, data_immatricolazione: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Telaio</Label><Input value={form.telaio} onChange={(e) => setForm({ ...form, telaio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Km attuale</Label><Input type="number" value={form.km_attuale} onChange={(e) => setForm({ ...form, km_attuale: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Km prima scadenza</Label><Input type="number" value={form.km_prima_scadenza} onChange={(e) => setForm({ ...form, km_prima_scadenza: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Dati tecnici</Label><Input value={form.dati_tecnici} onChange={(e) => setForm({ ...form, dati_tecnici: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Note</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave}>{editing ? "Salva modifiche" : "Aggiungi"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il mezzo {confirmDelete?.targa}?</AlertDialogTitle>
            <AlertDialogDescription>
              L'eliminazione è permanente. Se vuoi conservarne lo storico, disattivalo invece di eliminarlo.
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
    </DashboardLayout>
  );
}
