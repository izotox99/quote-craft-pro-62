import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Search, Users, FileText, StickyNote, ChevronRight, X, RotateCcw, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { TariffarioUpload } from "@/components/clients/TariffarioUpload";

type Client = {
  id: string; name: string; email: string | null; company: string | null;
  phone: string | null; notes: string | null; created_at: string;
  societa_fattura: string | null; sede_legale: string | null;
  codice_fiscale: string | null; p_iva: string | null;
  nome_rappresentante: string | null; cognome_rappresentante: string | null;
  cap: string | null; provincia: string | null; citta: string | null; nazione: string | null;
  telefono_urg1: string | null; telefono_urg1_nota: string | null;
  telefono_urg2: string | null; telefono_urg2_nota: string | null;
  telefono_urg3: string | null; telefono_urg3_nota: string | null;
  fax: string | null; password_cliente: string | null; auth_user_id: string | null;
  org_id: string; tariffario_url: string | null; tariffario_nome: string | null;
  nota_tariffario: string | null; attivo: boolean;
};

const emptyForm = {
  company: "", societa_fattura: "", sede_legale: "", codice_fiscale: "", p_iva: "",
  nome_rappresentante: "", cognome_rappresentante: "",
  cap: "", provincia: "", citta: "", nazione: "",
  phone: "",
  telefono_urg1: "", telefono_urg1_nota: "",
  telefono_urg2: "", telefono_urg2_nota: "",
  telefono_urg3: "", telefono_urg3_nota: "",
  fax: "", email: "", password_cliente: "", notes: "",
  nota_tariffario: "",
};

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [utenzeInattive, setUtenzeInattive] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDisattivati, setShowDisattivati] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deactivateTarget, setDeactivateTarget] = useState<Client | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<{ client: Client; count: number } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("company", { nullsFirst: false }).order("name");
    const list = (data ?? []) as Client[];
    setClients(list);

    // Conta utenze inattive per client (attivo=false)
    if (list.length) {
      const { data: utenze } = await supabase
        .from("client_utenze")
        .select("parent_client_id")
        .eq("attivo", false)
        .in("parent_client_id", list.map(c => c.id));
      const counts: Record<string, number> = {};
      (utenze ?? []).forEach((u: any) => {
        counts[u.parent_client_id] = (counts[u.parent_client_id] ?? 0) + 1;
      });
      setUtenzeInattive(counts);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = clients
    .filter((c) => c.attivo === !showDisattivati)
    .filter((c) =>
      (c.company ?? c.name).toLowerCase().includes(search.toLowerCase()) ||
      ((c.nome_rappresentante ?? "") + " " + (c.cognome_rappresentante ?? "")).toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
    );

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      company: c.company ?? c.name ?? "",
      societa_fattura: c.societa_fattura ?? "", sede_legale: c.sede_legale ?? "",
      codice_fiscale: c.codice_fiscale ?? "", p_iva: c.p_iva ?? "",
      nome_rappresentante: c.nome_rappresentante ?? "", cognome_rappresentante: c.cognome_rappresentante ?? "",
      cap: c.cap ?? "", provincia: c.provincia ?? "", citta: c.citta ?? "", nazione: c.nazione ?? "",
      phone: c.phone ?? "",
      telefono_urg1: c.telefono_urg1 ?? "", telefono_urg1_nota: c.telefono_urg1_nota ?? "",
      telefono_urg2: c.telefono_urg2 ?? "", telefono_urg2_nota: c.telefono_urg2_nota ?? "",
      telefono_urg3: c.telefono_urg3 ?? "", telefono_urg3_nota: c.telefono_urg3_nota ?? "",
      fax: c.fax ?? "", email: c.email ?? "", password_cliente: "",
      notes: c.notes ?? "",
      nota_tariffario: c.nota_tariffario ?? "",
    });
    setDialogOpen(true);
  };

  const toNull = (v: string) => v.trim() || null;

  const handleSave = async () => {
    if (!form.company.trim()) { toast.error("La società è obbligatoria"); return; }
    if (!editing && form.email.trim() && !form.password_cliente.trim()) {
      toast.error("Inserisci una password per creare l'account cliente");
      return;
    }
    if (form.password_cliente.trim() && form.password_cliente.trim().length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }

    const payload = {
      name: form.company.trim(),
      email: toNull(form.email), company: toNull(form.company), phone: toNull(form.phone), notes: toNull(form.notes),
      societa_fattura: toNull(form.societa_fattura), sede_legale: toNull(form.sede_legale),
      codice_fiscale: toNull(form.codice_fiscale), p_iva: toNull(form.p_iva),
      nome_rappresentante: toNull(form.nome_rappresentante), cognome_rappresentante: toNull(form.cognome_rappresentante),
      cap: toNull(form.cap), provincia: toNull(form.provincia), citta: toNull(form.citta), nazione: toNull(form.nazione),
      telefono_urg1: toNull(form.telefono_urg1), telefono_urg1_nota: toNull(form.telefono_urg1_nota),
      telefono_urg2: toNull(form.telefono_urg2), telefono_urg2_nota: toNull(form.telefono_urg2_nota),
      telefono_urg3: toNull(form.telefono_urg3), telefono_urg3_nota: toNull(form.telefono_urg3_nota),
      fax: toNull(form.fax),
      nota_tariffario: toNull(form.nota_tariffario),
    };

    const { data: fnData, error: fnError } = await supabase.functions.invoke("create-client-account", {
      body: {
        client_id: editing?.id,
        client: payload,
        password: form.password_cliente.trim() || undefined,
      },
    });

    if (fnError || fnData?.error) {
      const message = fnData?.error || fnError?.message || "Errore durante il salvataggio";
      toast.error(message);
      return;
    }

    toast.success(editing ? "Cliente aggiornato" : "Cliente e account creati con successo!");
    setDialogOpen(false);
    load();
  };

  const tryDeactivate = async (client: Client) => {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("servizi")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("archiviato", false)
      .in("stato", ["nuovo", "confermato", "in_corso"])
      .gte("data_servizio", today);

    if ((count ?? 0) > 0) {
      setBlockedInfo({ client, count: count ?? 0 });
      return;
    }
    setDeactivateTarget(client);
  };

  const doDeactivate = async (clientId: string) => {
    const { error } = await supabase.from("clients").update({ attivo: false }).eq("id", clientId);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente disattivato");
    setDeactivateTarget(null);
    load();
  };

  const doReactivate = async (client: Client) => {
    const { error } = await supabase.from("clients").update({ attivo: true }).eq("id", client.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente riattivato");
    load();
  };

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const openTariffario = async (url: string) => {
    const { data } = await supabase.storage.from("tariffari-clienti").createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Impossibile aprire il file");
  };

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={200}>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {showDisattivati ? "Clienti disattivati" : "Lista Clienti"}
            </h1>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={showDisattivati ? "default" : "outline"}
                className="gap-2 rounded-lg"
                onClick={() => setShowDisattivati(v => !v)}
              >
                <ArchiveRestore className="h-4 w-4" />
                {showDisattivati ? "Torna agli attivi" : "Clienti disattivati"}
              </Button>
              {!showDisattivati && (
                <Button className="gap-2 rounded-lg" onClick={openCreate}>
                  <PlusCircle className="h-4 w-4" /> Aggiungere cliente
                </Button>
              )}
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cerca per società, contatto, email..." className="pl-9 rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {search
                      ? "Nessun cliente trovato"
                      : showDisattivati
                        ? "Nessun cliente disattivato"
                        : "Nessun cliente"}
                  </p>
                  {!search && !showDisattivati && (
                    <Button size="sm" className="mt-4 gap-2 rounded-lg" onClick={openCreate}>
                      <PlusCircle className="h-4 w-4" /> Aggiungi il primo cliente
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Società</TableHead>
                        <TableHead>Contatto</TableHead>
                        <TableHead className="w-16 text-center">Più</TableHead>
                        <TableHead className="w-24 text-center">Inattive</TableHead>
                        <TableHead className="w-20 text-center">Tariffario</TableHead>
                        <TableHead className="w-24 text-center">Nota Tarif</TableHead>
                        {showDisattivati && <TableHead className="w-24 text-center">Riattiva</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => {
                        const contatto = [c.nome_rappresentante, c.cognome_rappresentante].filter(Boolean).join(" ") || "—";
                        const inattiveCount = utenzeInattive[c.id] ?? 0;
                        return (
                          <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell
                              className="font-medium cursor-pointer"
                              onClick={() => openEdit(c)}
                            >
                              {c.company ?? c.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{contatto}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                title="Apri dettaglio"
                                onClick={() => navigate(`/clients/${c.id}`)}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell className="text-center">
                              {!showDisattivati ? (
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-sm tabular-nums text-muted-foreground min-w-[1.5rem] text-right">
                                    {inattiveCount}
                                  </span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => tryDeactivate(c)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Disattiva cliente</TooltipContent>
                                  </Tooltip>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {c.tariffario_url ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => openTariffario(c.tariffario_url!)}
                                    >
                                      <FileText className="h-4 w-4 text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{c.tariffario_nome ?? "Apri tariffario"}</TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {c.nota_tariffario ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <StickyNote className="h-4 w-4 text-primary" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="max-w-sm text-sm whitespace-pre-wrap">
                                    {c.nota_tariffario}
                                  </PopoverContent>
                                </Popover>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </TableCell>
                            {showDisattivati && (
                              <TableCell className="text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-primary"
                                      onClick={() => doReactivate(c)}
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Riattiva cliente</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 rounded-xl">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
                <DialogTitle className="text-xl font-display">
                  {editing ? "Modifica cliente" : "Nuovo Cliente"}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-140px)]">
                <div className="px-6 py-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Società *" value={form.company} onChange={v => set("company", v)} placeholder="Nome società" />
                    <Field label="Società per Fattura" value={form.societa_fattura} onChange={v => set("societa_fattura", v)} placeholder="Ragione sociale fatturazione" />
                    <Field label="Sede Legale" value={form.sede_legale} onChange={v => set("sede_legale", v)} placeholder="Indirizzo sede legale" />
                    <Field label="Codice fiscale" value={form.codice_fiscale} onChange={v => set("codice_fiscale", v)} placeholder="Codice fiscale" />
                    <Field label="P.IVA" value={form.p_iva} onChange={v => set("p_iva", v)} placeholder="Partita IVA" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nome Rappresentante" value={form.nome_rappresentante} onChange={v => set("nome_rappresentante", v)} placeholder="Nome" />
                    <Field label="Cognome Rappresentante" value={form.cognome_rappresentante} onChange={v => set("cognome_rappresentante", v)} placeholder="Cognome" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="CAP" value={form.cap} onChange={v => set("cap", v)} placeholder="00100" />
                    <Field label="Provincia" value={form.provincia} onChange={v => set("provincia", v)} placeholder="RM" />
                    <Field label="Città" value={form.citta} onChange={v => set("citta", v)} placeholder="Roma" />
                    <Field label="Nazione" value={form.nazione} onChange={v => set("nazione", v)} placeholder="Italia" />
                  </div>

                  <div className="space-y-3">
                    <Field label="Telefono" value={form.phone} onChange={v => set("phone", v)} placeholder="+39 06 000 0000" />
                    <TelUrgField label="Tel urg 1" tel={form.telefono_urg1} nota={form.telefono_urg1_nota}
                      onTelChange={v => set("telefono_urg1", v)} onNotaChange={v => set("telefono_urg1_nota", v)} />
                    <TelUrgField label="Tel urg 2" tel={form.telefono_urg2} nota={form.telefono_urg2_nota}
                      onTelChange={v => set("telefono_urg2", v)} onNotaChange={v => set("telefono_urg2_nota", v)} />
                    <TelUrgField label="Tel urg 3" tel={form.telefono_urg3} nota={form.telefono_urg3_nota}
                      onTelChange={v => set("telefono_urg3", v)} onNotaChange={v => set("telefono_urg3_nota", v)} />
                    <Field label="Fax" value={form.fax} onChange={v => set("fax", v)} placeholder="Fax" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="E-mail" value={form.email} onChange={v => set("email", v)} placeholder="email@esempio.com" type="email" />
                    <Field
                      label={editing ? "Password (lascia vuoto per non cambiare)" : "Password"}
                      value={form.password_cliente}
                      onChange={v => set("password_cliente", v)}
                      placeholder={editing ? "••••••••" : "Almeno 6 caratteri"}
                      type="password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Note</Label>
                    <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Note aggiuntive" className="rounded-lg min-h-[80px]" />
                  </div>

                  {editing && (
                    <div className="space-y-4 pt-2 border-t border-border/50">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tariffario</h3>
                      <TariffarioUpload
                        clientId={editing.id}
                        orgId={editing.org_id}
                        currentUrl={editing.tariffario_url}
                        currentName={editing.tariffario_nome}
                        onChange={async () => {
                          const { data } = await supabase.from("clients").select("*").eq("id", editing.id).single();
                          if (data) setEditing(data as Client);
                          load();
                        }}
                      />
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Nota Tariffario</Label>
                        <Textarea
                          value={form.nota_tariffario}
                          onChange={(e) => set("nota_tariffario", e.target.value)}
                          placeholder="Note sul tariffario (visibili nella colonna Nota Tarif)"
                          className="rounded-lg min-h-[80px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="px-6 py-4 border-t border-border/50">
                <Button className="w-full rounded-lg h-11 text-base font-medium" onClick={handleSave}>
                  {editing ? "Aggiorna cliente" : "Inserire"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disattivare questo cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Stai per disattivare <strong>{deactivateTarget?.company ?? deactivateTarget?.name}</strong>.
                  Il cliente rimarrà consultabile nello storico ma non sarà selezionabile per nuovi servizi.
                  Potrai riattivarlo in qualsiasi momento dalla vista "Clienti disattivati".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => deactivateTarget && doDeactivate(deactivateTarget.id)}>
                  Disattiva
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!blockedInfo} onOpenChange={(o) => !o && setBlockedInfo(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Impossibile disattivare</AlertDialogTitle>
                <AlertDialogDescription>
                  Il cliente <strong>{blockedInfo?.client.company ?? blockedInfo?.client.name}</strong> ha{" "}
                  <strong>{blockedInfo?.count}</strong> servizi attivi.
                  Completa o annulla i servizi in corso prima di disattivarlo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setBlockedInfo(null)}>Ho capito</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-lg h-10" />
    </div>
  );
}

function TelUrgField({ label, tel, nota, onTelChange, onNotaChange }: {
  label: string; tel: string; nota: string; onTelChange: (v: string) => void; onNotaChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input value={tel} onChange={(e) => onTelChange(e.target.value)} placeholder="Numero" className="rounded-lg h-10 flex-1" />
        <Input value={nota} onChange={(e) => onNotaChange(e.target.value)} placeholder="Nota" className="rounded-lg h-10 flex-1" />
      </div>
    </div>
  );
}
