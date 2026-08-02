import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, UserPlus, Crown, Eye, Pencil } from "lucide-react";

type Membro = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  ruolo: string;
  is_owner: boolean;
  ultimo_accesso: string | null;
  invito_accettato: boolean;
};

const RUOLO_LABEL: Record<string, string> = {
  admin: "Amministratore",
  manager: "Responsabile",
  agent: "Operatore",
  viewer: "Visualizzatore (sola lettura)",
};

export function TeamMembers() {
  const { isOwner } = useAuth();
  const [membri, setMembri] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [ruolo, setRuolo] = useState<"admin" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [daRevocare, setDaRevocare] = useState<Membro | null>(null);

  const call = useCallback(async (body: Record<string, unknown>) => {
    return await invokeEdge<any>("manage-org-members", body);
  }, []);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call({ action: "list" });
      setMembri(res.membri ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Impossibile caricare i membri");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    if (isOwner) load();
    else setLoading(false);
  }, [isOwner, load]);

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Membri del team</CardTitle>
          <CardDescription>
            Solo il titolare dell'organizzazione può invitare e gestire i membri.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const invita = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await call({
        action: "invite",
        email: email.trim(),
        ruolo,
        full_name: nome.trim() || null,
        redirect_to: `${window.location.origin}/reset-password`,
      });
      toast.success("Invito inviato: la persona riceverà un'email per impostare la password");
      setEmail("");
      setNome("");
      setRuolo("viewer");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Invito non riuscito");
    } finally {
      setInviting(false);
    }
  };

  const cambiaRuolo = async (m: Membro, nuovo: string) => {
    try {
      await call({ action: "change_role", user_id: m.user_id, ruolo: nuovo });
      toast.success("Ruolo aggiornato");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Modifica non riuscita");
    }
  };

  const revoca = async () => {
    if (!daRevocare) return;
    try {
      await call({ action: "revoke", user_id: daRevocare.user_id });
      toast.success("Accesso revocato");
      setDaRevocare(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Revoca non riuscita");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invita una persona
          </CardTitle>
          <CardDescription>
            L'invitato accede solo alla tua organizzazione. Non condividere mai le tue credenziali.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4 md:items-end">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="socio@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-nome">Nome (opzionale)</Label>
            <Input id="invite-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ruolo</Label>
            <Select value={ruolo} onValueChange={(v) => setRuolo(v as "admin" | "viewer")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — lettura e scrittura</SelectItem>
                <SelectItem value="viewer">Visualizzatore — sola lettura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4">
            <Button onClick={invita} disabled={inviting || !email.trim()}>
              {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Invia invito
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membri del team</CardTitle>
          <CardDescription>Il titolare non può essere rimosso né declassato.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : membri.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessun membro</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membri.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {m.is_owner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                          {m.full_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.email ?? "—"}</TableCell>
                      <TableCell>
                        {m.is_owner ? (
                          <Badge variant="secondary">Titolare</Badge>
                        ) : (
                          <Select value={m.ruolo} onValueChange={(v) => cambiaRuolo(m, v)}>
                            <SelectTrigger className="h-8 w-[210px]">
                              <SelectValue>{RUOLO_LABEL[m.ruolo] ?? m.ruolo}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Admin</span>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Visualizzatore</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.invito_accettato
                          ? <Badge variant="outline">Attivo</Badge>
                          : <Badge variant="outline" className="text-amber-600">Invito in attesa</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {!m.is_owner && (
                          <Button variant="ghost" size="sm" className="text-destructive"
                            onClick={() => setDaRevocare(m)}>
                            Revoca
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!daRevocare} onOpenChange={(o) => !o && setDaRevocare(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocare l'accesso?</AlertDialogTitle>
            <AlertDialogDescription>
              {daRevocare?.email} non potrà più accedere alla tua organizzazione. I dati che ha inserito restano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={revoca}>Revoca accesso</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
