import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";

type Accessorio = {
  id: string;
  nome: string;
  prezzo: number;
  attivo: boolean;
};

export default function ClientiAccessori() {
  const { user } = useAuth();
  const [items, setItems] = useState<Accessorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Accessorio | null>(null);
  const [form, setForm] = useState({ nome: "", prezzo: "0", attivo: true });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accessori_catalogo")
      .select("id, nome, prezzo, attivo")
      .order("nome");
    if (error) toast.error(error.message);
    setItems(((data ?? []) as any[]).map(x => ({ ...x, prezzo: Number(x.prezzo) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", prezzo: "0", attivo: true });
    setDialogOpen(true);
  };

  const openEdit = (a: Accessorio) => {
    setEditing(a);
    setForm({ nome: a.nome, prezzo: String(a.prezzo), attivo: a.attivo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome obbligatorio"); return; }
    const payload = {
      nome: form.nome.trim(),
      prezzo: Number(form.prezzo) || 0,
      attivo: form.attivo,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("accessori_catalogo").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("accessori_catalogo").insert(payload as any));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Accessorio aggiornato" : "Accessorio creato");
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (a: Accessorio) => {
    if (!window.confirm(`Eliminare "${a.nome}"?`)) return;
    const { error } = await supabase.from("accessori_catalogo").delete().eq("id", a.id);
    if (error) {
      // FK RESTRICT: se usato in servizi_accessori
      toast.error("Impossibile eliminare: l'accessorio è usato in uno o più servizi. Disattivalo invece di eliminarlo.");
      return;
    }
    toast.success("Accessorio eliminato");
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Gestione accessori</h1>
            <p className="text-sm text-muted-foreground">Catalogo accessori disponibili in prenotazione</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nuovo accessorio
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Caricamento…</div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">Nessun accessorio configurato</p>
                <Button variant="link" onClick={openNew} className="mt-2">Aggiungi il primo</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Prezzo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-[120px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.nome}</TableCell>
                      <TableCell className="text-right">€ {a.prezzo.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.attivo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {a.attivo ? "Attivo" : "Disattivato"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(a)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica accessorio" : "Nuovo accessorio"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="es. Seggiolino auto" />
              </div>
              <div className="space-y-1.5">
                <Label>Prezzo (€)</Label>
                <Input type="number" step="0.01" min="0" value={form.prezzo} onChange={e => setForm(f => ({ ...f, prezzo: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label>Attivo</Label>
                <Switch checked={form.attivo} onCheckedChange={v => setForm(f => ({ ...f, attivo: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSave}>{editing ? "Salva" : "Crea"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
