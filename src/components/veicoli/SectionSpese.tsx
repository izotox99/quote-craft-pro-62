import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Receipt, AlertTriangle } from "lucide-react";

const TIPI_SPESA = ["Assicurazione", "Revisione Annuale", "Bollo", "Multa", "Tagliando", "Pulizia", "Altro"];

type Row = {
  id: string;
  tipo: string;
  data_intervento: string | null;
  data_scadenza: string | null;
  importo_spese: number;
  totale_fattura: number;
  note: string | null;
};

export function SectionSpese({ veicoloId }: { veicoloId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    const { data } = await supabase.from("veicoli_spese").select("*").eq("veicolo_id", veicoloId).order("data_intervento", { ascending: false, nullsFirst: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, [veicoloId]);

  const openNew = () => { setEditing(null); setForm({ tipo: "Assicurazione" }); setOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const handleSave = async () => {
    const payload = {
      veicolo_id: veicoloId,
      tipo: form.tipo,
      data_intervento: form.data_intervento || null,
      data_scadenza: form.data_scadenza || null,
      importo_spese: form.importo_spese ? Number(form.importo_spese) : 0,
      totale_fattura: form.totale_fattura ? Number(form.totale_fattura) : 0,
      note: form.note || null,
    };
    const { error } = editing
      ? await supabase.from("veicoli_spese").update(payload as any).eq("id", editing.id)
      : await supabase.from("veicoli_spese").insert([payload] as any);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Aggiornato" : "Aggiunto");
    setOpen(false); load();
  };

  const handleDelete = async (r: Row) => {
    if (!confirm("Eliminare questa spesa?")) return;
    const { error } = await supabase.from("veicoli_spese").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato"); load();
  };

  const totaleSpese = rows.reduce((s, r) => s + (Number(r.importo_spese) || 0), 0);
  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Totale: <span className="font-semibold text-foreground">{totaleSpese.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
        </div>
        <Button onClick={openNew} className="gap-2"><PlusCircle className="h-4 w-4" /> Aggiungi spesa</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Data intervento</TableHead>
              <TableHead>Data scadenza</TableHead>
              <TableHead className="text-right">Importo</TableHead>
              <TableHead className="text-right">Totale fattura</TableHead>
              <TableHead className="hidden md:table-cell">Note</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />Nessuna spesa registrata
              </TableCell></TableRow>
            )}
            {rows.map((r) => {
              const scad = r.data_scadenza ? new Date(r.data_scadenza) : null;
              const giorni = scad ? Math.round((scad.getTime() - today.getTime()) / 86400000) : null;
              const warn = giorni !== null && giorni <= 30 && giorni >= 0;
              const expired = giorni !== null && giorni < 0;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.tipo}</TableCell>
                  <TableCell>{r.data_intervento ? new Date(r.data_intervento).toLocaleDateString("it-IT") : "—"}</TableCell>
                  <TableCell>
                    {scad ? (
                      <span className={`flex items-center gap-1 ${expired ? "text-destructive font-semibold" : warn ? "text-amber-600 font-semibold" : ""}`}>
                        {(expired || warn) && <AlertTriangle className="h-3.5 w-3.5" />}
                        {scad.toLocaleDateString("it-IT")}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.importo_spese).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.totale_fattura).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[240px] truncate">{r.note ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Modifica spesa" : "Nuova spesa"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPI_SPESA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data intervento</Label><Input type="date" value={form.data_intervento ?? ""} onChange={(e) => setForm({ ...form, data_intervento: e.target.value })} /></div>
            <div><Label>Data scadenza</Label><Input type="date" value={form.data_scadenza ?? ""} onChange={(e) => setForm({ ...form, data_scadenza: e.target.value })} /></div>
            <div><Label>Importo spese (€)</Label><Input inputMode="decimal" value={form.importo_spese ?? ""} onChange={(e) => setForm({ ...form, importo_spese: e.target.value })} /></div>
            <div><Label>Totale fattura (€)</Label><Input inputMode="decimal" value={form.totale_fattura ?? ""} onChange={(e) => setForm({ ...form, totale_fattura: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Note</Label><Textarea value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} /></div>
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
