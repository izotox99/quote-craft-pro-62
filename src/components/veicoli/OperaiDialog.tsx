import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export type Operaio = {
  id: string;
  nome: string;
  cognome: string | null;
  mansione: string | null;
  costo_orario: number | null;
  attivo: boolean;
};

export function nomeOperaio(o: Operaio) {
  return [o.nome, o.cognome].filter(Boolean).join(" ");
}

export function OperaiDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (nuovo?: Operaio) => void;
}) {
  const [rows, setRows] = useState<Operaio[]>([]);
  const [form, setForm] = useState<any>({ nome: "", cognome: "", mansione: "", costo_orario: "" });

  const load = async () => {
    const { data } = await supabase
      .from("operai")
      .select("id, nome, cognome, mansione, costo_orario, attivo")
      .eq("attivo", true)
      .order("nome");
    setRows((data ?? []) as Operaio[]);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const add = async () => {
    if (!form.nome?.trim()) return toast.error("Inserisci il nome");
    const { data, error } = await supabase
      .from("operai")
      .insert([{
        nome: form.nome.trim(),
        cognome: form.cognome?.trim() || null,
        mansione: form.mansione?.trim() || null,
        costo_orario: form.costo_orario ? Number(form.costo_orario) : null,
      }] as any)
      .select("id, nome, cognome, mansione, costo_orario, attivo")
      .single();
    if (error) return toast.error(error.message);
    toast.success("Operaio aggiunto");
    setForm({ nome: "", cognome: "", mansione: "", costo_orario: "" });
    await load();
    onSaved?.(data as Operaio);
  };

  const remove = async (o: Operaio) => {
    const { error } = await supabase.from("operai").update({ attivo: false } as any).eq("id", o.id);
    if (error) return toast.error(error.message);
    await load();
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Operai</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Cognome</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
          <div><Label>Mansione</Label><Input value={form.mansione} onChange={(e) => setForm({ ...form, mansione: e.target.value })} placeholder="es. Meccanico" /></div>
          <div><Label>Costo orario (€)</Label><Input inputMode="decimal" value={form.costo_orario} onChange={(e) => setForm({ ...form, costo_orario: e.target.value })} /></div>
        </div>
        <Button onClick={add} className="self-start">Aggiungi operaio</Button>

        <div className="max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Mansione</TableHead>
                <TableHead className="text-right">Costo orario</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nessun operaio</TableCell></TableRow>
              )}
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{nomeOperaio(o)}</TableCell>
                  <TableCell>{o.mansione ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.costo_orario != null ? Number(o.costo_orario).toLocaleString("it-IT", { style: "currency", currency: "EUR" }) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(o)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
