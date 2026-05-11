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

type Fornitore = { id: string; nome: string; telefono: string | null; email: string | null; note: string | null };

export default function FornitoriCS() {
  const { user } = useAuth();
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", telefono: "", email: "", note: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("fornitori_cs").select("*").order("nome");
    setFornitori(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async () => {
    const { error } = await supabase.from("fornitori_cs").insert({
      nome: form.nome, telefono: form.telefono || null,
      email: form.email || null, note: form.note || null,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Fornitore aggiunto!"); setDialogOpen(false); load(); setForm({ nome: "", telefono: "", email: "", note: "" }); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("fornitori_cs").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Fornitori CS</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><PlusCircle className="h-4 w-4" /> Nuovo Fornitore</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo Fornitore</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-1"><Label>Telefono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Note</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              </div>
              <div className="flex justify-end mt-4"><Button onClick={handleCreate} disabled={!form.nome}>Salva</Button></div>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Telefono</TableHead>
                  <TableHead>Email</TableHead><TableHead>Note</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornitori.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.telefono}</TableCell><TableCell>{f.email}</TableCell>
                    <TableCell>{f.note}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {!loading && fornitori.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun fornitore</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
