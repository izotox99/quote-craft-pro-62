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
import { PlusCircle, Trash2 } from "lucide-react";

type Autista = {
  id: string; nome: string; cognome: string; telefono: string | null;
  email: string | null; patente: string | null; note: string | null;
};

export default function Autisti() {
  const { user } = useAuth();
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cognome: "", telefono: "", email: "", patente: "", note: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("autisti").select("*").order("cognome");
    setAutisti(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async () => {
    const { error } = await supabase.from("autisti").insert({
      nome: form.nome, cognome: form.cognome,
      telefono: form.telefono || null, email: form.email || null,
      patente: form.patente || null, note: form.note || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Autista aggiunto!"); setDialogOpen(false); load(); setForm({ nome: "", cognome: "", telefono: "", email: "", patente: "", note: "" }); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("autisti").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Autisti</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><PlusCircle className="h-4 w-4" /> Nuovo Autista</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo Autista</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-1"><Label>Cognome *</Label><Input value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} /></div>
                <div className="space-y-1"><Label>Telefono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Patente</Label><Input value={form.patente} onChange={e => setForm({ ...form, patente: e.target.value })} /></div>
                <div className="space-y-1"><Label>Note</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              </div>
              <div className="flex justify-end mt-4"><Button onClick={handleCreate} disabled={!form.nome || !form.cognome}>Salva</Button></div>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cognome</TableHead><TableHead>Nome</TableHead><TableHead>Telefono</TableHead>
                  <TableHead>Email</TableHead><TableHead>Patente</TableHead><TableHead>Note</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autisti.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.cognome}</TableCell>
                    <TableCell>{a.nome}</TableCell><TableCell>{a.telefono}</TableCell>
                    <TableCell>{a.email}</TableCell><TableCell>{a.patente}</TableCell>
                    <TableCell>{a.note}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {!loading && autisti.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun autista</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
