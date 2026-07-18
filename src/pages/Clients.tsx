import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, Search, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
};

const emptyForm = {
  name: "", email: "", company: "", phone: "", notes: "",
  societa_fattura: "", sede_legale: "", codice_fiscale: "", p_iva: "",
  nome_rappresentante: "", cognome_rappresentante: "",
  cap: "", provincia: "", citta: "", nazione: "",
  telefono_urg1: "", telefono_urg1_nota: "",
  telefono_urg2: "", telefono_urg2_nota: "",
  telefono_urg3: "", telefono_urg3_nota: "",
  fax: "", password_cliente: "",
};

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients((data ?? []) as Client[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name, email: c.email ?? "", company: c.company ?? "", phone: c.phone ?? "", notes: c.notes ?? "",
      societa_fattura: c.societa_fattura ?? "", sede_legale: c.sede_legale ?? "",
      codice_fiscale: c.codice_fiscale ?? "", p_iva: c.p_iva ?? "",
      nome_rappresentante: c.nome_rappresentante ?? "", cognome_rappresentante: c.cognome_rappresentante ?? "",
      cap: c.cap ?? "", provincia: c.provincia ?? "", citta: c.citta ?? "", nazione: c.nazione ?? "",
      telefono_urg1: c.telefono_urg1 ?? "", telefono_urg1_nota: c.telefono_urg1_nota ?? "",
      telefono_urg2: c.telefono_urg2 ?? "", telefono_urg2_nota: c.telefono_urg2_nota ?? "",
      telefono_urg3: c.telefono_urg3 ?? "", telefono_urg3_nota: c.telefono_urg3_nota ?? "",
      // Password is intentionally never prefilled — users type a NEW password to change it,
      // or leave empty to keep the existing one.
      fax: c.fax ?? "", password_cliente: "",
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

  const handleDelete = async (id: string) => {
    const { data: fnData, error: fnError } = await supabase.functions.invoke("delete-client-account", {
      body: { client_id: id },
    });
    if (fnError || fnData?.error) {
      toast.error(fnData?.error || fnError?.message || "Errore durante l'eliminazione");
      return;
    }
    toast.success("Cliente eliminato");
    load();
  };

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">Lista Clienti</h1>
          <Button className="gap-2 w-full sm:w-auto rounded-lg" onClick={openCreate}>
            <PlusCircle className="h-4 w-4" /> Aggiungi cliente
          </Button>
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
                <p className="mt-3 text-sm text-muted-foreground">{search ? "Nessun cliente trovato" : "Nessun cliente"}</p>
                {!search && (
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
                      <TableHead>Telefono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Città</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/clients/${c.id}`)}>
                        <TableCell className="font-medium">{c.company ?? c.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {[c.nome_rappresentante, c.cognome_rappresentante].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.citta ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
                {/* Dati società */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dati Società</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Società *" value={form.company} onChange={v => set("company", v)} placeholder="Nome società" />
                    <Field label="Società per fattura" value={form.societa_fattura} onChange={v => set("societa_fattura", v)} placeholder="Ragione sociale fatturazione" />
                    <Field label="Sede legale" value={form.sede_legale} onChange={v => set("sede_legale", v)} placeholder="Indirizzo sede legale" />
                    <Field label="Codice fiscale" value={form.codice_fiscale} onChange={v => set("codice_fiscale", v)} placeholder="Codice fiscale" />
                    <Field label="P. IVA" value={form.p_iva} onChange={v => set("p_iva", v)} placeholder="Partita IVA" />
                  </div>
                </div>

                {/* Rappresentante */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Rappresentante</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nome" value={form.nome_rappresentante} onChange={v => set("nome_rappresentante", v)} placeholder="Nome" />
                    <Field label="Cognome" value={form.cognome_rappresentante} onChange={v => set("cognome_rappresentante", v)} placeholder="Cognome" />
                  </div>
                </div>

                {/* Indirizzo */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Indirizzo</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Field label="CAP" value={form.cap} onChange={v => set("cap", v)} placeholder="00100" />
                    <Field label="Provincia" value={form.provincia} onChange={v => set("provincia", v)} placeholder="RM" />
                    <Field label="Città" value={form.citta} onChange={v => set("citta", v)} placeholder="Roma" />
                    <Field label="Nazione" value={form.nazione} onChange={v => set("nazione", v)} placeholder="Italia" />
                  </div>
                </div>

                {/* Contatti */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contatti</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Telefono" value={form.phone} onChange={v => set("phone", v)} placeholder="+39 06 000 0000" />
                    <Field label="E-mail" value={form.email} onChange={v => set("email", v)} placeholder="email@esempio.com" type="email" />
                    <Field label="Fax" value={form.fax} onChange={v => set("fax", v)} placeholder="Fax" />
                  </div>

                  <div className="space-y-3">
                    <TelUrgField label="Tel. urgenza 1" tel={form.telefono_urg1} nota={form.telefono_urg1_nota}
                      onTelChange={v => set("telefono_urg1", v)} onNotaChange={v => set("telefono_urg1_nota", v)} />
                    <TelUrgField label="Tel. urgenza 2" tel={form.telefono_urg2} nota={form.telefono_urg2_nota}
                      onTelChange={v => set("telefono_urg2", v)} onNotaChange={v => set("telefono_urg2_nota", v)} />
                    <TelUrgField label="Tel. urgenza 3" tel={form.telefono_urg3} nota={form.telefono_urg3_nota}
                      onTelChange={v => set("telefono_urg3", v)} onNotaChange={v => set("telefono_urg3_nota", v)} />
                  </div>
                </div>

                {/* Accesso */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Accesso</h3>
                  <Field
                    label={editing ? "Cambia password (lascia vuoto per non modificarla)" : "Password"}
                    value={form.password_cliente}
                    onChange={v => set("password_cliente", v)}
                    placeholder={editing ? "••••••••" : "Almeno 6 caratteri"}
                    type="password"
                  />
                </div>

                {/* Note */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Note</h3>
                  <Field label="Note" value={form.notes} onChange={v => set("notes", v)} placeholder="Note aggiuntive" />
                </div>
              </div>
            </ScrollArea>
            <div className="px-6 py-4 border-t border-border/50">
              <Button className="w-full rounded-lg h-11 text-base font-medium" onClick={handleSave}>
                {editing ? "Aggiorna cliente" : "Inserire"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
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
