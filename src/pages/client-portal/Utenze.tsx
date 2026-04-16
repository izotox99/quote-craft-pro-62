import { useEffect, useState } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, User, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Utenza {
  id: string;
  nome: string;
  cognome: string;
  cellulare: string | null;
  email: string;
  password: string;
  tipo: "singolo" | "gruppo";
  attivo: boolean;
}

const emptyForm = { nome: "", cognome: "", cellulare: "", email: "", password: "", tipo: "singolo" as "singolo" | "gruppo" };

export default function Utenze() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [utenze, setUtenze] = useState<Utenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (client) {
        setClientId(client.id);
        await fetchUtenze(client.id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const fetchUtenze = async (cid: string) => {
    const { data } = await supabase
      .from("client_utenze")
      .select("*")
      .eq("parent_client_id", cid)
      .order("created_at", { ascending: false });
    if (data) setUtenze(data as Utenza[]);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: Utenza) => {
    setEditingId(u.id);
    setForm({ nome: u.nome, cognome: u.cognome, cellulare: u.cellulare || "", email: u.email, password: u.password, tipo: u.tipo });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!clientId) return;
    if (!form.nome || !form.email || (!editingId && !form.password)) {
      toast.error("Compila i campi obbligatori");
      return;
    }
    setSaving(true);

    if (editingId) {
      const updateData: any = {
        nome: form.nome,
        cognome: form.cognome,
        cellulare: form.cellulare || null,
        email: form.email,
        tipo: form.tipo,
      };
      if (form.password) updateData.password = form.password;

      const { error } = await supabase.from("client_utenze").update(updateData).eq("id", editingId);
      if (error) {
        toast.error("Errore durante il salvataggio");
      } else {
        toast.success("Utenza aggiornata");
        setDialogOpen(false);
        await fetchUtenze(clientId);
      }
    } else {
      const { error } = await supabase.from("client_utenze").insert({
        parent_client_id: clientId,
        nome: form.nome,
        cognome: form.cognome,
        cellulare: form.cellulare || null,
        email: form.email,
        password: form.password,
        tipo: form.tipo,
      });
      if (error) {
        toast.error("Errore durante il salvataggio");
      } else {
        toast.success("Utenza aggiunta");
        setDialogOpen(false);
        await fetchUtenze(clientId);
      }
    }
    setSaving(false);
  };

  const handleToggle = async (id: string, attivo: boolean) => {
    if (!clientId) return;
    await supabase.from("client_utenze").update({ attivo: !attivo }).eq("id", id);
    await fetchUtenze(clientId);
    toast.success(attivo ? "Utenza disattivata" : "Utenza attivata");
  };

  const handleDelete = async (id: string) => {
    if (!clientId) return;
    await supabase.from("client_utenze").delete().eq("id", id);
    await fetchUtenze(clientId);
    toast.success("Utenza eliminata");
  };

  if (loading) return (
    <ClientPortalLayout>
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </ClientPortalLayout>
  );

  return (
    <ClientPortalLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Utenze</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestisci gli accessi dei tuoi collaboratori al portale.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifica Utenza" : "Aggiungi Utenza"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cognome</Label>
                  <Input value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cellulare</Label>
                <Input value={form.cellulare} onChange={e => setForm({ ...form, cellulare: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{editingId ? "Password (lascia vuoto per non cambiare)" : "Password *"}</Label>
                <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editingId ? "••••••••" : ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: "singolo" | "gruppo") => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singolo">Per singolo</SelectItem>
                    <SelectItem value="gruppo">Per gruppo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.tipo === "singolo"
                    ? "L'utente potrà gestire le richieste solo per se stesso."
                    : "L'utente potrà gestire le richieste per sé e per le altre persone autorizzate."}
                </p>
              </div>
              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? "Salvataggio..." : editingId ? "Salva modifiche" : "Aggiungi"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-0">
            {utenze.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Nessuna utenza</p>
                <p className="text-xs mt-1">Clicca "Aggiungi" per creare la prima utenza.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rappresentante</TableHead>
                    <TableHead>Cellulare</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utenze.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome} {u.cognome}</TableCell>
                      <TableCell>{u.cellulare || "—"}</TableCell>
                      <TableCell className="text-xs">{u.email}</TableCell>
                      <TableCell className="text-xs font-mono">{u.password.substring(0, 12)}…</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.attivo ? "default" : "secondary"}
                          className="cursor-pointer text-xs"
                          onClick={() => handleToggle(u.id, u.attivo)}
                        >
                          {u.attivo ? "Attivo" : "Disattivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs gap-1">
                          {u.tipo === "singolo" ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                          {u.tipo === "singolo" ? "Singolo" : "Gruppo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      </div>
    </ClientPortalLayout>
  );
}
