import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";

type Veicolo = {
  id: string; targa: string; tipo_macchina: string | null; marca: string | null;
  modello: string | null; colore: string | null; posti: number | null; note: string | null;
};

export default function Veicoli() {
  const { user } = useAuth();
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ targa: "", tipo_macchina: "", marca: "", modello: "", colore: "", posti: 4, note: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("veicoli").select("*").order("targa");
    setVeicoli(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async () => {
    const { error } = await supabase.from("veicoli").insert({
      targa: form.targa, tipo_macchina: form.tipo_macchina || null,
      marca: form.marca || null, modello: form.modello || null,
      colore: form.colore || null, posti: form.posti, note: form.note || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Veicolo aggiunto!"); setDialogOpen(false); load(); setForm({ targa: "", tipo_macchina: "", marca: "", modello: "", colore: "", posti: 4, note: "" }); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("veicoli").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Mezzi</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><PlusCircle className="h-4 w-4" /> Nuovo Veicolo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo Veicolo</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Targa *</Label><Input value={form.targa} onChange={e => setForm({ ...form, targa: e.target.value })} /></div>
                <div className="space-y-1"><Label>Tipo</Label><Input value={form.tipo_macchina} onChange={e => setForm({ ...form, tipo_macchina: e.target.value })} /></div>
                <div className="space-y-1"><Label>Marca</Label><Input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} /></div>
                <div className="space-y-1"><Label>Modello</Label><Input value={form.modello} onChange={e => setForm({ ...form, modello: e.target.value })} /></div>
                <div className="space-y-1"><Label>Colore</Label><Input value={form.colore} onChange={e => setForm({ ...form, colore: e.target.value })} /></div>
                <div className="space-y-1"><Label>Posti</Label><Input type="number" value={form.posti} onChange={e => setForm({ ...form, posti: +e.target.value })} /></div>
                <div className="space-y-1 sm:col-span-2"><Label>Note</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              </div>
              <div className="flex justify-end mt-4"><Button onClick={handleCreate} disabled={!form.targa}>Salva</Button></div>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Targa</TableHead><TableHead>Tipo</TableHead><TableHead>Marca</TableHead>
                  <TableHead>Modello</TableHead><TableHead>Colore</TableHead><TableHead>Posti</TableHead>
                  <TableHead>Note</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veicoli.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.targa}</TableCell>
                    <TableCell>{v.tipo_macchina}</TableCell><TableCell>{v.marca}</TableCell>
                    <TableCell>{v.modello}</TableCell><TableCell>{v.colore}</TableCell>
                    <TableCell>{v.posti}</TableCell><TableCell>{v.note}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {!loading && veicoli.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessun veicolo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
