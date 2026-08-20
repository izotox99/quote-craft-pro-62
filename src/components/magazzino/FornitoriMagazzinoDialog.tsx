import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Pencil, Plus, Power } from "lucide-react";

export type FornitoreMagazzino = {
  id: string;
  nome: string;
  telefono: string | null;
  email: string | null;
  indirizzo: string | null;
  note: string | null;
  attivo: boolean;
};

export async function fetchFornitoriMagazzino() {
  const { data } = await supabase
    .from("fornitori_magazzino")
    .select("id, nome, telefono, email, indirizzo, note, attivo")
    .order("nome");
  return (data ?? []) as FornitoreMagazzino[];
}

const EMPTY = { nome: "", telefono: "", email: "", indirizzo: "", note: "" };

export function FornitoriMagazzinoDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const { canWrite } = useAuth();
  const [rows, setRows] = useState<FornitoreMagazzino[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => setRows(await fetchFornitoriMagazzino());

  useEffect(() => {
    if (open) load();
  }, [open]);

  const salva = async () => {
    if (!form.nome.trim()) return toast.error("Il nome del fornitore è obbligatorio");
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      telefono: form.telefono || null,
      email: form.email || null,
      indirizzo: form.indirizzo || null,
      note: form.note || null,
    };
    const { error } = editingId
      ? await supabase.from("fornitori_magazzino").update(payload).eq("id", editingId)
      : await supabase.from("fornitori_magazzino").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Fornitore aggiornato" : "Fornitore aggiunto");
    setForm(EMPTY);
    setEditingId(null);
    await load();
    onChanged?.();
  };

  const toggleAttivo = async (f: FornitoreMagazzino) => {
    const { error } = await supabase.from("fornitori_magazzino").update({ attivo: !f.attivo }).eq("id", f.id);
    if (error) return toast.error(error.message);
    await load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fornitori magazzino</DialogTitle>
        </DialogHeader>

        {canWrite && (
          <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="es. AMAZON EU S.A R.L." />
            </div>
            <div className="space-y-1.5">
              <Label>Telefono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Indirizzo</Label>
              <Input value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Note</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={salva} disabled={saving} className="gap-2">
                <Plus className="h-4 w-4" /> {editingId ? "Salva modifiche" : "Aggiungi fornitore"}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
                  Nuovo
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="max-h-[40vh] overflow-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id} className={f.attivo ? "" : "opacity-50"}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>{f.telefono ?? "—"}</TableCell>
                  <TableCell>{f.email ?? "—"}</TableCell>
                  <TableCell>{f.attivo ? "Attivo" : "Disattivato"}</TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingId(f.id); setForm({ nome: f.nome, telefono: f.telefono ?? "", email: f.email ?? "", indirizzo: f.indirizzo ?? "", note: f.note ?? "" }); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleAttivo(f)}>
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nessun fornitore magazzino
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
