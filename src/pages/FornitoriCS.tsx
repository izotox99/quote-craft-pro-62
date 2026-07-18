import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Trash2, Pencil, Network as NetworkIcon } from "lucide-react";

type Fornitore = {
  id: string;
  nome: string;
  telefono: string | null;
  email: string | null;
  note: string | null;
  partner_org_id: string | null;
};

type PartnerOption = { org_id: string; org_name: string };

const NO_PARTNER = "__none__";

export default function FornitoriCS() {
  const { user, organization } = useAuth();
  const myOrgId = organization?.id;
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [partnerOrgs, setPartnerOrgs] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fornitore | null>(null);
  const [form, setForm] = useState({ nome: "", telefono: "", email: "", note: "", partner_org_id: NO_PARTNER });

  const partnerName = (id: string | null) =>
    id ? partnerOrgs.find(p => p.org_id === id)?.org_name : undefined;

  const load = async () => {
    setLoading(true);
    const [{ data: forn }, { data: partners }] = await Promise.all([
      supabase.from("fornitori_cs").select("*").order("nome"),
      supabase.from("network_partners").select("org_a, org_b, stato").eq("stato", "attivo"),
    ]);
    const otherOrgIds = Array.from(new Set(((partners ?? []) as any[])
      .map(p => (p.org_a === myOrgId ? p.org_b : p.org_a))
      .filter(Boolean))) as string[];
    let orgs: PartnerOption[] = [];
    if (otherOrgIds.length) {
      const { data: orgRows } = await supabase.from("organizations").select("id, name").in("id", otherOrgIds);
      orgs = (orgRows ?? []).map(o => ({ org_id: o.id, org_name: o.name }));
    }
    setPartnerOrgs(orgs);
    setFornitori((forn ?? []) as Fornitore[]);
    setLoading(false);
  };

  useEffect(() => { if (user && myOrgId) load(); }, [user, myOrgId]);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", telefono: "", email: "", note: "", partner_org_id: NO_PARTNER });
    setDialogOpen(true);
  };

  const openEdit = (f: Fornitore) => {
    setEditing(f);
    setForm({
      nome: f.nome,
      telefono: f.telefono ?? "",
      email: f.email ?? "",
      note: f.note ?? "",
      partner_org_id: f.partner_org_id ?? NO_PARTNER,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload: any = {
      nome: form.nome,
      telefono: form.telefono || null,
      email: form.email || null,
      note: form.note || null,
      partner_org_id: form.partner_org_id === NO_PARTNER ? null : form.partner_org_id,
    };
    const { error } = editing
      ? await supabase.from("fornitori_cs").update(payload).eq("id", editing.id)
      : await supabase.from("fornitori_cs").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Fornitore aggiornato" : "Fornitore aggiunto");
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare il fornitore?")) return;
    const { error } = await supabase.from("fornitori_cs").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Fornitori CS</h1>
          <Button className="gap-2" onClick={openNew}>
            <PlusCircle className="h-4 w-4" /> Nuovo Fornitore
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica fornitore" : "Nuovo fornitore"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-1"><Label>Telefono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
              <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Note</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Collega a partner del network</Label>
                <Select value={form.partner_org_id} onValueChange={v => setForm({ ...form, partner_org_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARTNER}>Nessuno (fornitore esterno)</SelectItem>
                    {partnerOrgs.map(p => (
                      <SelectItem key={p.org_id} value={p.org_id}>{p.org_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se collegato a un partner, i servizi assegnati a questo fornitore verranno passati automaticamente all'org partner (attivo dallo Step 2).
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={!form.nome}>Salva</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornitori.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>
                      {f.partner_org_id ? (
                        <Badge variant="secondary" className="gap-1">
                          <NetworkIcon className="h-3 w-3" />
                          {partnerName(f.partner_org_id) || "Partner"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{f.telefono}</TableCell>
                    <TableCell>{f.email}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{f.note}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && fornitori.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun fornitore</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
