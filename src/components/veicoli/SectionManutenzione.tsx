import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Wrench } from "lucide-react";

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
};

export function SectionManutenzione({ veicoloId, mode }: { veicoloId: string; mode: Mode }) {
  const table = mode === "ord" ? "veicoli_manutenzione_ord" : "veicoli_manutenzione_straord";
  const kmField = mode === "ord" ? "km" : "km_attuale";
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    const { data } = await supabase.from(table).select("*").eq("veicolo_id", veicoloId).order("data", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, [veicoloId, mode]);

  const openNew = () => {
    setEditing(null);
    setForm({ data: new Date().toISOString().split("T")[0], totale: "" });
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({ ...r });
    setOpen(true);
  };
  const handleSave = async () => {
    const payload: any = {
      veicolo_id: veicoloId,
      data: form.data,
      [kmField]: form[kmField] ? Number(form[kmField]) : null,
      tipo: form.tipo || null,
      note: form.note || null,
      ricambi: form.ricambi || null,
      fornitore: form.fornitore || null,
      totale: form.totale ? Number(form.totale) : 0,
    };
    if (mode === "straord") {
      payload.tipo_riparazione = form.tipo_riparazione || null;
      payload.ordine = form.ordine || null;
    }
    const { error } = editing
      ? await supabase.from(table as any).update(payload as any).eq("id", editing.id)
      : await supabase.from(table as any).insert([payload] as any);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Aggiornato" : "Aggiunto");
    setOpen(false); load();
  };
  const handleDelete = async (r: Row) => {
    if (!confirm("Eliminare questo intervento?")) return;
    const { error } = await supabase.from(table).delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato"); load();
  };

  const totale = rows.reduce((sum, r) => sum + (Number(r.totale) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Totale: <span className="font-semibold text-foreground">{totale.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
        </div>
        <Button onClick={openNew} className="gap-2"><PlusCircle className="h-4 w-4" /> Aggiungi intervento</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Km</TableHead>
              {mode === "straord" && <TableHead>Tipo riparazione</TableHead>}
              <TableHead>Tipo</TableHead>
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
              <TableRow><TableCell colSpan={mode === "straord" ? 10 : 8} className="text-center py-10 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />Nessun intervento registrato
              </TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.data).toLocaleDateString("it-IT")}</TableCell>
                <TableCell className="text-right tabular-nums">{(r.km ?? r.km_attuale)?.toLocaleString("it-IT") ?? "—"}</TableCell>
                {mode === "straord" && <TableCell>{r.tipo_riparazione ?? "—"}</TableCell>}
                <TableCell>{r.tipo ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[240px] truncate">{r.note ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{r.ricambi ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.fornitore ?? "—"}</TableCell>
                {mode === "straord" && <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{r.ordine ?? "—"}</TableCell>}
                <TableCell className="text-right tabular-nums font-medium">
                  {Number(r.totale).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica intervento" : "Nuovo intervento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div><Label>Km {mode === "ord" ? "manutenzione" : "attuale"}</Label>
              <Input inputMode="numeric" value={form[kmField] ?? ""} onChange={(e) => setForm({ ...form, [kmField]: e.target.value })} /></div>
            {mode === "straord" && (
              <div><Label>Tipo riparazione</Label><Input value={form.tipo_riparazione ?? ""} onChange={(e) => setForm({ ...form, tipo_riparazione: e.target.value })} placeholder="es. Reparazione meccanica" /></div>
            )}
            <div><Label>Tipo</Label><Input value={form.tipo ?? ""} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="es. Intervento intero" /></div>
            <div className="sm:col-span-2"><Label>Note</Label><Textarea value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Ricambi</Label><Textarea value={form.ricambi ?? ""} onChange={(e) => setForm({ ...form, ricambi: e.target.value })} rows={2} placeholder="es. Filtro aria [1], Filtro olio [1]" /></div>
            <div><Label>Fornitore</Label><Input value={form.fornitore ?? ""} onChange={(e) => setForm({ ...form, fornitore: e.target.value })} /></div>
            {mode === "straord" && (
              <div><Label>Ordine</Label><Input value={form.ordine ?? ""} onChange={(e) => setForm({ ...form, ordine: e.target.value })} placeholder="es. ORD-595" /></div>
            )}
            <div><Label>Totale (€)</Label><Input inputMode="decimal" value={form.totale ?? ""} onChange={(e) => setForm({ ...form, totale: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={handleSave}>{editing ? "Salva" : "Aggiungi"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
