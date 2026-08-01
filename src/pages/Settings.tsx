import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { TeamMembers } from "@/components/TeamMembers";
import { Building2, User, Users, Layers, ShieldCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function Settings() {
  const { user, role, organization, refreshOrg, isOwner } = useAuth();
  const isAdmin = role === "admin";

  const [fullName, setFullName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgIndustry, setOrgIndustry] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDept, setNewDept] = useState("");

  // Security check state
  type HibpResult = {
    name: string;
    description: string;
    expected: "rejected" | "accepted";
    outcome: "rejected" | "accepted" | "error";
    passed: boolean;
    detail?: string;
  };
  const [hibpRunning, setHibpRunning] = useState(false);
  const [hibpReport, setHibpReport] = useState<{
    ok: boolean;
    summary: string;
    results: HibpResult[];
  } | null>(null);

  const runHibpCheck = async () => {
    setHibpRunning(true);
    setHibpReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-hibp-protection", { body: {} });
      if (error) {
        toast.error(error.message || "Errore durante il controllo");
        return;
      }
      setHibpReport(data);
      if (data?.ok) toast.success("Tutti i controlli sono passati");
      else toast.warning("Alcuni controlli sono falliti — vedi dettagli");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore imprevisto");
    } finally {
      setHibpRunning(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setFullName(data.full_name ?? "");
    });
    if (organization) {
      setOrgName(organization.name);
      setOrgWebsite(organization.website ?? "");
      setOrgPhone(organization.phone ?? "");
      setOrgAddress(organization.address ?? "");
      setOrgIndustry(organization.industry ?? "");
    }
    if (isAdmin) {
      supabase.from("profiles").select("user_id, full_name").then(({ data }) => {
        if (data) {
          Promise.all(data.map(async (p: any) => {
            const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", p.user_id);
            return { ...p, roles: roles?.map((r: any) => r.role) ?? [] };
          })).then(setMembers);
        }
      });
      supabase.from("departments").select("*").order("name").then(({ data }) => setDepartments(data ?? []));
    }
  }, [user, organization, isAdmin]);

  const saveProfile = async () => {
    setProfileLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("user_id", user!.id);
    setProfileLoading(false);
    if (error) toast.error(error.message); else toast.success("Profilo aggiornato");
  };

  const saveOrg = async () => {
    if (!organization) return;
    setOrgLoading(true);
    const { error } = await supabase.from("organizations").update({
      name: orgName, website: orgWebsite || null, phone: orgPhone || null,
      address: orgAddress || null, industry: orgIndustry || null,
    } as any).eq("id", organization.id);
    setOrgLoading(false);
    if (error) toast.error(error.message); else { toast.success("Organizzazione aggiornata"); refreshOrg(); }
  };

  const addDepartment = async () => {
    if (!newDept.trim() || !organization) return;
    const { error } = await supabase.from("departments").insert({ name: newDept, org_id: organization.id } as any);
    if (error) toast.error(error.message); else {
      toast.success("Reparto aggiunto");
      setNewDept("");
      supabase.from("departments").select("*").order("name").then(({ data }) => setDepartments(data ?? []));
    }
  };

  const deleteDepartment = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) toast.error(error.message); else {
      toast.success("Reparto eliminato");
      setDepartments(departments.filter((d) => d.id !== id));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Impostazioni</h1>
          <p className="text-sm text-muted-foreground">Gestisci il tuo profilo e la tua organizzazione</p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" /> Profilo</TabsTrigger>
            {isAdmin && <TabsTrigger value="organization" className="gap-2"><Building2 className="h-4 w-4" /> Organizzazione</TabsTrigger>}
            {isOwner && <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" /> Team</TabsTrigger>}
            {isAdmin && <TabsTrigger value="departments" className="gap-2"><Layers className="h-4 w-4" /> Reparti</TabsTrigger>}
            {isAdmin && <TabsTrigger value="security" className="gap-2"><ShieldCheck className="h-4 w-4" /> Sicurezza</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Il tuo profilo</CardTitle>
                <CardDescription>Aggiorna le tue informazioni personali</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Il tuo nome" />
                </div>
                <div className="space-y-2">
                  <Label>Ruolo</Label>
                  <Badge variant="outline">{role ?? "agente"}</Badge>
                </div>
                <Button onClick={saveProfile} disabled={profileLoading}>
                  {profileLoading ? "Salvataggio..." : "Salva profilo"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="organization" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Impostazioni organizzazione</CardTitle>
                  <CardDescription>Gestisci le informazioni della tua azienda</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome organizzazione</Label>
                      <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Settore</Label>
                      <Input value={orgIndustry} onChange={(e) => setOrgIndustry(e.target.value)} placeholder="es. Trasporti" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Sito web</Label>
                      <Input value={orgWebsite} onChange={(e) => setOrgWebsite(e.target.value)} placeholder="https://" />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefono</Label>
                      <Input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Indirizzo</Label>
                    <Input value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} />
                  </div>
                  <Button onClick={saveOrg} disabled={orgLoading}>
                    {orgLoading ? "Salvataggio..." : "Salva organizzazione"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="team" className="mt-6">
              <TeamMembers />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="departments" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Reparti</CardTitle>
                  <CardDescription>Organizza il tuo team in reparti</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Nome reparto" />
                    <Button onClick={addDepartment}>Aggiungi</Button>
                  </div>
                  {departments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nessun reparto</p>
                  ) : (
                    <div className="space-y-2">
                      {departments.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <span className="font-medium text-sm">{d.name}</span>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDepartment(d.id)}>
                            Elimina
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="security" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Verifica protezione password compromesse
                  </CardTitle>
                  <CardDescription>
                    Esegue 5 test reali contro Lovable Cloud Auth per assicurarsi che le password
                    presenti nel database HIBP (Have I Been Pwned) vengano rifiutate sia in
                    registrazione che in cambio password. Gli account creati durante il test
                    vengono eliminati automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button onClick={runHibpCheck} disabled={hibpRunning} className="gap-2">
                      {hibpRunning ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Verifica in corso…</>
                      ) : (
                        <><ShieldCheck className="h-4 w-4" /> Esegui verifica</>
                      )}
                    </Button>
                    {hibpReport && (
                      <Badge
                        variant="outline"
                        className={
                          hibpReport.ok
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                        }
                      >
                        {hibpReport.ok ? "Tutti i test passati" : "Alcuni test falliti"}
                      </Badge>
                    )}
                  </div>

                  {hibpReport && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{hibpReport.summary}</p>
                      <div className="space-y-2">
                        {hibpReport.results.map((r, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-3 rounded-lg border p-3 ${
                              r.passed
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-destructive/30 bg-destructive/5"
                            }`}
                          >
                            {r.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{r.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  atteso: {r.expected === "rejected" ? "rifiutato" : "accettato"}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  esito: {r.outcome === "rejected" ? "rifiutato" : r.outcome === "accepted" ? "accettato" : "errore"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                              {r.detail && (
                                <p className="text-xs font-mono bg-muted/50 rounded px-2 py-1 mt-1.5 break-words">
                                  {r.detail}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
