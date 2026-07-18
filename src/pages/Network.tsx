import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Copy, Check, X, Trash2, PlusCircle } from "lucide-react";

type PartnerRow = {
  id: string;
  org_a: string;
  org_b: string | null;
  invited_by_email: string | null;
  invite_code: string;
  stato: "invitato" | "attivo" | "rifiutato" | "revocato";
  invited_at: string;
  responded_at: string | null;
  org_a_name?: string;
  org_b_name?: string;
};

export default function Network() {
  const { user, organization } = useAuth();
  const myOrgId = organization?.id;
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("network_partners")
      .select("*")
      .order("invited_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const orgIds = Array.from(new Set(((data ?? []) as PartnerRow[]).flatMap(r => [r.org_a, r.org_b].filter(Boolean) as string[])));
    let orgMap: Record<string, string> = {};
    if (orgIds.length) {
      const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds);
      orgMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]));
    }
    setRows(((data ?? []) as PartnerRow[]).map(r => ({
      ...r,
      org_a_name: orgMap[r.org_a],
      org_b_name: r.org_b ? orgMap[r.org_b] : undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    const { error } = await supabase.rpc("network_invite_partner", { _email: email, _org_b: undefined as any });
    if (error) toast.error(error.message);
    else {
      toast.success("Invito creato. Condividi il codice con il partner.");
      setInviteOpen(false);
      setInviteEmail("");
      load();
    }
  };

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code) return;
    const { error } = await supabase.rpc("network_respond_invite", { _invite_code: code, _accept: true, _partnership_id: undefined as any });
    if (error) toast.error(error.message);
    else {
      toast.success("Partnership attivata");
      setRedeemOpen(false);
      setRedeemCode("");
      load();
    }
  };

  const handleRespond = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc("network_respond_invite", { _partnership_id: id, _accept: accept, _invite_code: undefined as any });
    if (error) toast.error(error.message);
    else { toast.success(accept ? "Invito accettato" : "Invito rifiutato"); load(); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revocare questa partnership? I fornitori collegati verranno scollegati.")) return;
    const { error } = await supabase.rpc("network_revoke_partnership", { _partnership_id: id });
    if (error) toast.error(error.message);
    else { toast.success("Partnership revocata"); load(); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Codice copiato");
  };

  const inviatiFromMe = rows.filter(r => r.org_a === myOrgId && r.stato === "invitato");
  const inviatiToMe = rows.filter(r => r.org_b === myOrgId && r.stato === "invitato");
  const attivi = rows.filter(r => r.stato === "attivo");
  const chiusi = rows.filter(r => r.stato === "rifiutato" || r.stato === "revocato");

  const partnerLabel = (r: PartnerRow) =>
    r.org_a === myOrgId ? (r.org_b_name || r.invited_by_email || "—") : r.org_a_name || "—";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold font-display">Network partner</h1>
          <div className="flex gap-2">
            <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Inserisci codice invito</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Accetta invito con codice</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <Label>Codice invito</Label>
                  <Input value={redeemCode} onChange={e => setRedeemCode(e.target.value)} placeholder="es. 3f9c…" />
                </div>
                <DialogFooter>
                  <Button onClick={handleRedeem} disabled={!redeemCode.trim()}>Accetta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><PlusCircle className="h-4 w-4" /> Invita partner</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invita un'organizzazione partner</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Email dell'amministratore partner</Label>
                    <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      Verrà generato un codice invito da condividere al partner. Il partner lo inserirà dalla sua area Network per accettare.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>Genera invito</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Partner attivi</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Dal</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attivi.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{partnerLabel(r)}</TableCell>
                    <TableCell>{r.responded_at ? new Date(r.responded_at).toLocaleDateString("it-IT") : "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRevoke(r.id)} title="Revoca">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && attivi.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nessun partner attivo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inviti inviati in attesa</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Codice</TableHead>
                  <TableHead>Inviato</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviatiFromMe.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.invited_by_email || r.org_b_name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[240px]">{r.invite_code}</span>
                        <Button variant="ghost" size="icon" onClick={() => copyCode(r.invite_code)} title="Copia">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(r.invited_at).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRevoke(r.id)} title="Annulla invito">
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && inviatiFromMe.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nessun invito in attesa</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inviti ricevuti</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Da</TableHead>
                  <TableHead>Ricevuto</TableHead>
                  <TableHead className="w-40"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviatiToMe.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.org_a_name || "—"}</TableCell>
                    <TableCell>{new Date(r.invited_at).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRespond(r.id, true)} className="gap-1">
                          <Check className="h-3.5 w-3.5" /> Accetta
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRespond(r.id, false)} className="gap-1">
                          <X className="h-3.5 w-3.5" /> Rifiuta
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && inviatiToMe.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nessun invito in arrivo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {chiusi.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Storico</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chiusi.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{partnerLabel(r)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.stato}</Badge>
                      </TableCell>
                      <TableCell>{new Date(r.responded_at || r.invited_at).toLocaleDateString("it-IT")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
