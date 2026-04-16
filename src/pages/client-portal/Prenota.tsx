import { useState, useEffect } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { toast } from "sonner";
import { CalendarPlus, Send, Info } from "lucide-react";

const VEICOLI_DISPONIBILI = [
  "Autovettura 3 posti",
  "Luxury Car Serie S",
  "Minivan 7/8 posti",
  "Minivan 7 posti classe V",
  "Minibus 8 posti",
  "Minibus 16 Posti",
  "Bus 52 posti",
  "Veicolo disabili",
  "Servizio guida",
];

const TRANSFER_OPZIONI = [
  "Da / Per altro Luogo",
  "Da Aeroporto",
  "Da Civitavecchia",
  "Da Stazione",
  "Interno Città",
  "Per Aeroporto",
  "Per Civitavecchia",
  "Per Stazione",
];

const DISPOSIZIONE_OPZIONI = [
  "3 Ore", "4 Ore", "5 Ore", "6 Ore", "7 Ore", "8 Ore",
  "9 Ore", "10 Ore", "11 Ore", "12 Ore", "Mezza giornata", "Giornata intera",
];

const TOUR_OPZIONI = [
  "Da Civitavecchia Full Day",
  "Full Day Fuori Roma",
  "Full Day Roma",
  "Half Day Fuori Roma",
  "Half Day Roma",
];

const PAGAMENTO_OPZIONI = [
  { value: "fattura", label: "Fattura" },
  { value: "contante", label: "Contante" },
  { value: "carta_credito", label: "C. Credito" },
];

export default function Prenota() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [utenze, setUtenze] = useState<{ id: string; nome: string; cognome: string; cellulare: string | null; email: string }[]>([]);

  const empty = {
    data_servizio: "",
    ora_inizio: "",
    contatto: "",
    telefono_contatto: "",
    email_contatto: "",
    n_passeggeri: "1",
    n_bagagli: "0",
    veicolo_tipo: "",
    transfer_tipo: "",
    disposizione_oraria: "",
    tour_tipo: "",
    luogo_inizio: "",
    itinerario: "",
    luogo_fine: "",
    info_autista: "",
    centro_costo: "",
    note: "",
    tipo_pagamento: "",
    prezzo: "",
    citta: "",
  };

  const [form, setForm] = useState(empty);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id, org_id")
        .eq("auth_user_id", user.id)
        .single();
      if (data) {
        setClientId(data.id);
        setOrgId(data.org_id);
        // Load utenze for this client
        const { data: utenzeData } = await supabase
          .from("client_utenze")
          .select("id, nome, cognome, cellulare, email")
          .eq("parent_client_id", data.id)
          .eq("attivo", true);
        setUtenze(utenzeData ?? []);
      }
    };
    load();
  }, [user]);

  const set = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const handleUtenzaSelect = (utenzaId: string) => {
    const u = utenze.find(u => u.id === utenzaId);
    if (u) {
      setForm(p => ({
        ...p,
        contatto: `${u.nome} ${u.cognome}`,
        telefono_contatto: u.cellulare ?? "",
        email_contatto: u.email,
      }));
    }
  };

  // Logic: Tour esclude Transfer/Disposizione. Transfer richiede Disposizione.
  const hasTour = !!form.tour_tipo;
  const hasTransfer = !!form.transfer_tipo;

  const handleTourChange = (v: string) => {
    if (v === "__clear__") {
      set("tour_tipo", "");
    } else {
      setForm(p => ({ ...p, tour_tipo: v, transfer_tipo: "", disposizione_oraria: "" }));
    }
  };

  const handleTransferChange = (v: string) => {
    if (v === "__clear__") {
      set("transfer_tipo", "");
    } else {
      setForm(p => ({ ...p, transfer_tipo: v, tour_tipo: "" }));
    }
  };

  const handleDisposizioneChange = (v: string) => {
    if (v === "__clear__") {
      set("disposizione_oraria", "");
    } else {
      setForm(p => ({ ...p, disposizione_oraria: v, tour_tipo: "" }));
    }
  };

  // Build tipologia from selections
  const getTipologia = (): string => {
    if (form.tour_tipo) return "tour";
    if (form.transfer_tipo) return "transfer";
    if (form.disposizione_oraria) return "disposizione";
    return "altro";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data_servizio || !form.contatto || !form.veicolo_tipo) {
      toast.error("Data, passeggero e veicolo sono obbligatori");
      return;
    }
    if (!clientId || !orgId) return;

    setLoading(true);
    const { error } = await supabase.from("servizi").insert({
      data_servizio: form.data_servizio,
      ora_inizio: form.ora_inizio || null,
      tipologia: getTipologia() as any,
      contatto: form.contatto,
      telefono_contatto: form.telefono_contatto || null,
      email_contatto: form.email_contatto || null,
      n_passeggeri: parseInt(form.n_passeggeri) || 1,
      n_bagagli: parseInt(form.n_bagagli) || 0,
      veicolo_tipo: form.veicolo_tipo || null,
      transfer_tipo: form.transfer_tipo || null,
      disposizione_oraria: form.disposizione_oraria || null,
      tour_tipo: form.tour_tipo || null,
      luogo_inizio: form.luogo_inizio || null,
      luogo_fine: form.luogo_fine || null,
      itinerario: form.itinerario || null,
      info_autista: form.info_autista || null,
      centro_costo: form.centro_costo || null,
      citta: form.citta || null,
      note: form.note || null,
      tipo_pagamento: form.tipo_pagamento || null,
      prezzo: form.prezzo ? parseFloat(form.prezzo) : null,
      client_id: clientId,
      org_id: orgId,
      stato: "nuovo" as any,
    } as any);

    if (error) {
      toast.error("Errore nella prenotazione: " + error.message);
    } else {
      toast.success("Prenotazione inviata con successo!");
      setForm(empty);
    }
    setLoading(false);
  };

  return (
    <ClientPortalLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <CalendarPlus className="h-6 w-6 text-primary" />
          Nuovo Servizio
        </h1>

        {/* Info box */}
        <Card className="rounded-xl border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p>A seguito di una prenotazione, nella pagina <strong>Lista Servizi</strong> è possibile verificare e modificare i dati.</p>
                <p>Ogni sera prima del servizio, viene comunicato con e-mail o SMS il contatto dell'autista delegato.</p>
                <p className="text-xs text-destructive font-medium">Modifica e annulla: fino a 12 ore prima dell'orario del servizio.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Città servizio */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-semibold whitespace-nowrap">Città di Servizio <span className="text-destructive">*</span></Label>
                <Select value={form.citta} onValueChange={(v) => set("citta", v)}>
                  <SelectTrigger className="rounded-lg h-10 max-w-xs"><SelectValue placeholder="Seleziona città" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Roma">Roma</SelectItem>
                    <SelectItem value="Napoli">Napoli</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Dati principali */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Data <span className="text-destructive">*</span></Label>
                  <DatePicker value={form.data_servizio} onChange={(v) => set("data_servizio", v)} placeholder="Seleziona data" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Ora inizio <span className="text-destructive">*</span></Label>
                  <TimePicker value={form.ora_inizio} onChange={(v) => set("ora_inizio", v)} placeholder="Seleziona ora" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Passeggero <span className="text-destructive">*</span></Label>
                  {utenze.length > 0 ? (
                    <Select onValueChange={handleUtenzaSelect}>
                      <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona utenza" /></SelectTrigger>
                      <SelectContent>
                        {utenze.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.contatto} onChange={(e) => set("contatto", e.target.value)} placeholder="Nome passeggero" className="rounded-lg h-10" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Telefono</Label>
                  <Input value={form.telefono_contatto} onChange={(e) => set("telefono_contatto", e.target.value)} placeholder="+39..." className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                  <Input type="email" value={form.email_contatto} onChange={(e) => set("email_contatto", e.target.value)} placeholder="email@esempio.com" className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">N. Persone <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" value={form.n_passeggeri} onChange={(e) => set("n_passeggeri", e.target.value)} className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Numero bagagli</Label>
                  <Input type="number" min="0" value={form.n_bagagli} onChange={(e) => set("n_bagagli", e.target.value)} className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Veicolo <span className="text-destructive">*</span></Label>
                  <Select value={form.veicolo_tipo} onValueChange={(v) => set("veicolo_tipo", v)}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona veicolo" /></SelectTrigger>
                    <SelectContent>
                      {VEICOLI_DISPONIBILI.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tipo servizio: Transfer / Disposizione / Tour */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Tipo servizio</p>
              <p className="text-xs text-muted-foreground -mt-2">
                Se scegli un <strong>Tour</strong>, Transfer e Disposizione non sono selezionabili. Se scegli un <strong>Transfer</strong>, il Tour non è disponibile.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Transfer</Label>
                  <Select value={form.transfer_tipo || "__clear__"} onValueChange={handleTransferChange} disabled={hasTour}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__">---</SelectItem>
                      {TRANSFER_OPZIONI.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Disposizione Oraria</Label>
                  <Select value={form.disposizione_oraria || "__clear__"} onValueChange={handleDisposizioneChange} disabled={hasTour}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__">---</SelectItem>
                      {DISPOSIZIONE_OPZIONI.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tour</Label>
                  <Select value={form.tour_tipo || "__clear__"} onValueChange={handleTourChange} disabled={hasTransfer || !!form.disposizione_oraria}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__">---</SelectItem>
                      {TOUR_OPZIONI.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Percorso */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Luogo inizio <span className="text-destructive">*</span></Label>
                  <Input value={form.luogo_inizio} onChange={(e) => set("luogo_inizio", e.target.value)} placeholder="Inserire Hotel, via, o n. volo" className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Luogo fine <span className="text-destructive">*</span></Label>
                  <Input value={form.luogo_fine} onChange={(e) => set("luogo_fine", e.target.value)} placeholder="Inserire Hotel, via, o n. volo" className="rounded-lg h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Itinerario</Label>
                <Input value={form.itinerario} onChange={(e) => set("itinerario", e.target.value)} placeholder="Descrivi il percorso" className="rounded-lg h-10" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Info autista</Label>
                  <Input value={form.info_autista} onChange={(e) => set("info_autista", e.target.value)} placeholder="Informazioni per l'autista" className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Centro di costo</Label>
                  <Input value={form.centro_costo} onChange={(e) => set("centro_costo", e.target.value)} className="rounded-lg h-10" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pagamento + Note */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tipo pagamento <span className="text-destructive">*</span></Label>
                  <Select value={form.tipo_pagamento} onValueChange={(v) => set("tipo_pagamento", v)}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      {PAGAMENTO_OPZIONI.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Prezzo</Label>
                  <Input type="number" step="0.01" value={form.prezzo} onChange={(e) => set("prezzo", e.target.value)} placeholder="0.00" className="rounded-lg h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Note</Label>
                <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Note aggiuntive..." className="rounded-lg min-h-[80px]" />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full h-11 rounded-lg text-base font-medium gap-2" disabled={loading}>
            <Send className="h-4 w-4" />
            {loading ? "Invio in corso..." : "Invia prenotazione"}
          </Button>
        </form>
      </div>
    </ClientPortalLayout>
  );
}
