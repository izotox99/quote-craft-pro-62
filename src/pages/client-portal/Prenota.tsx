import { useState, useEffect, useMemo } from "react";
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
import {
  CalendarPlus,
  Send,
  Info,
  Paperclip,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Car,
  User,
  CheckCircle2,
  RotateCcw,
  Pencil,
  Search,
  UserPlus,
  Phone,
  Mail,
} from "lucide-react";
import { format, parse } from "date-fns";
import { it } from "date-fns/locale";

const ALLEGATO_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx";
const ALLEGATO_MAX_MB = 10;

import {
  VEICOLI_DISPONIBILI,
  TIPOLOGIA_OPZIONI,
  TOUR_OPZIONI,
  DISPOSIZIONE_OPZIONI,
  PAGAMENTO_OPZIONI,
  TERMINAL_FIUMICINO,
  TERMINAL_CIAMPINO,
  STAZIONI_ROMA,
  detectLuogoSpeciale,
  LuogoField,
  tipologiaToDB,
  transferTipoForDB,
} from "@/lib/booking-shared";

type Passeggero = { id: string; nome: string; cognome: string | null; telefono: string | null; email: string | null };

const STEPS = [
  { num: 1, titolo: "Quando", sottotitolo: "Quando vuoi il servizio?", icon: CalendarIcon },
  { num: 2, titolo: "Dove", sottotitolo: "Da dove a dove?", icon: MapPin },
  { num: 3, titolo: "Servizio", sottotitolo: "Tipo di servizio e veicolo", icon: Car },
  { num: 4, titolo: "Passeggero", sottotitolo: "Chi viaggia?", icon: User },
  { num: 5, titolo: "Riepilogo", sottotitolo: "Verifica e conferma", icon: CheckCircle2 },
];

export default function Prenota() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [utenze, setUtenze] = useState<{ id: string; nome: string; cognome: string; cellulare: string | null; email: string }[]>([]);
  const [passeggeri, setPasseggeri] = useState<Passeggero[]>([]);
  const [step, setStep] = useState(1);
  const [ultimoServizio, setUltimoServizio] = useState<any>(null);
  const [showPasseggeroSuggest, setShowPasseggeroSuggest] = useState(false);

  const empty = {
    data_servizio: "",
    ora_inizio: "",
    contatto: "",
    telefono_contatto: "",
    email_contatto: "",
    n_passeggeri: "1",
    n_bagagli: "0",
    veicolo_tipo: "",
    tipologia_servizio: "",
    tour_tipo: "",
    disposizione_oraria: "",
    luogo_inizio: "",
    luogo_inizio_dettaglio: "",
    luogo_fine: "",
    luogo_fine_dettaglio: "",
    itinerario: "",
    info_autista: "",
    note: "",
    tipo_pagamento: "",
    prezzo: "",
    citta: "",
    accessori: "",
  };

  const [form, setForm] = useState(empty);
  const [allegato, setAllegato] = useState<File | null>(null);
  const [activeUtenzaId, setActiveUtenzaId] = useState<string | null>(null);

  const loadPasseggeri = async (cId: string) => {
    const { data } = await supabase
      .from("passeggeri_rubrica")
      .select("id, nome, cognome, telefono, email")
      .eq("client_id", cId)
      .order("nome");
    setPasseggeri(data ?? []);
  };

  const loadUltimoServizio = async (cId: string, uId: string | null) => {
    let query = supabase
      .from("servizi")
      .select("*")
      .eq("client_id", cId)
      .eq("archiviato", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (uId) query = query.eq("utenza_id", uId);
    const { data } = await query;
    if (data && data.length > 0) setUltimoServizio(data[0]);
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: client } = await supabase
        .from("clients")
        .select("id, org_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      let resolvedClientId: string | null = null;
      let resolvedOrgId: string | null = null;
      let resolvedUtenzaId: string | null = null;

      if (client) {
        resolvedClientId = client.id;
        resolvedOrgId = client.org_id;
      } else {
        const { data: utenza } = await supabase
          .from("client_utenze")
          .select("id, parent_client_id, clients:parent_client_id(id, org_id)")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (utenza) {
          resolvedUtenzaId = utenza.id;
          setActiveUtenzaId(utenza.id);
          resolvedClientId = utenza.parent_client_id;
          // @ts-ignore
          resolvedOrgId = utenza.clients?.org_id ?? null;
        }
      }

      if (resolvedClientId) setClientId(resolvedClientId);
      if (resolvedOrgId) setOrgId(resolvedOrgId);

      if (resolvedClientId) {
        const { data: utenzeData } = await supabase
          .from("client_utenze")
          .select("id, nome, cognome, cellulare, email")
          .eq("parent_client_id", resolvedClientId)
          .eq("attivo", true);
        setUtenze(utenzeData ?? []);
        await loadPasseggeri(resolvedClientId);
        await loadUltimoServizio(resolvedClientId, resolvedUtenzaId);
      }
    };
    load();
  }, [user]);

  const set = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const getTipologiaDB = (): string => {
    if (form.tipologia_servizio === "tour") return "tour";
    if (form.tipologia_servizio === "transfer_interno" || form.tipologia_servizio === "transfer_regionale") return "transfer";
    return "altro";
  };

  const tipologiaLabel = (val: string) =>
    TIPOLOGIA_OPZIONI.find(t => t.value === val)?.label ?? val;

  const luogoInizioSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio),
    [form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio]
  );
  const luogoFineSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_fine, form.citta, form.luogo_fine_dettaglio),
    [form.luogo_fine, form.citta, form.luogo_fine_dettaglio]
  );

  useEffect(() => {
    if (!luogoInizioSpeciale && form.luogo_inizio_dettaglio) set("luogo_inizio_dettaglio", "");
  }, [luogoInizioSpeciale]);
  useEffect(() => {
    if (!luogoFineSpeciale && form.luogo_fine_dettaglio) set("luogo_fine_dettaglio", "");
  }, [luogoFineSpeciale]);

  // Suggerimenti passeggeri filtrati
  const passeggeriFiltrati = useMemo(() => {
    const q = form.contatto.toLowerCase().trim();
    if (!q) return passeggeri.slice(0, 6);
    return passeggeri
      .filter(p => `${p.nome} ${p.cognome ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [form.contatto, passeggeri]);

  const passeggeroEsiste = useMemo(() => {
    const q = form.contatto.toLowerCase().trim();
    if (!q) return true;
    return passeggeri.some(p => `${p.nome}${p.cognome ? " " + p.cognome : ""}`.toLowerCase().trim() === q);
  }, [form.contatto, passeggeri]);

  const selezionaPasseggero = (p: Passeggero) => {
    setForm(prev => ({
      ...prev,
      contatto: `${p.nome}${p.cognome ? " " + p.cognome : ""}`,
      telefono_contatto: p.telefono ?? "",
      email_contatto: p.email ?? "",
    }));
    setShowPasseggeroSuggest(false);
  };

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

  const upsertPasseggero = async () => {
    if (!clientId || !orgId || !form.contatto.trim()) return;
    const exists = passeggeri.find(p =>
      `${p.nome}${p.cognome ? " " + p.cognome : ""}`.toLowerCase().trim() === form.contatto.toLowerCase().trim() &&
      (p.telefono ?? "") === (form.telefono_contatto ?? "") &&
      (p.email ?? "") === (form.email_contatto ?? "")
    );
    if (exists) return;
    const [nome, ...rest] = form.contatto.trim().split(" ");
    const cognome = rest.join(" ") || null;
    const { data } = await supabase.from("passeggeri_rubrica").insert({
      org_id: orgId,
      client_id: clientId,
      nome,
      cognome,
      telefono: form.telefono_contatto || null,
      email: form.email_contatto || null,
      created_by: user?.id ?? null,
    }).select("id, nome, cognome, telefono, email").single();
    if (data) setPasseggeri(prev => [...prev, data]);
  };

  // Riprendi nominativi ultima prenotazione (solo passeggero)
  const duplicaUltimo = () => {
    if (!ultimoServizio) return;
    const u = ultimoServizio;
    setForm(prev => ({
      ...prev,
      contatto: u.contatto ?? "",
      telefono_contatto: u.telefono_contatto ?? "",
      email_contatto: u.email_contatto ?? "",
    }));
    toast.success("Nominativi passeggero ripresi dall'ultima prenotazione.");
  };

  // Validazione step
  const validateStep = (n: number): boolean => {
    if (n === 1) {
      if (!form.data_servizio) { toast.error("Seleziona la data"); return false; }
      if (!form.ora_inizio) { toast.error("Seleziona l'ora di inizio"); return false; }
    }
    if (n === 2) {
      if (!form.citta) { toast.error("Seleziona la città"); return false; }
      if (!form.luogo_inizio.trim()) { toast.error("Inserisci il luogo di inizio"); return false; }
      if (!form.luogo_fine.trim()) { toast.error("Inserisci il luogo di fine"); return false; }
      // Per FCO/CIA il dettaglio deve essere un terminal vero. Per stazione basta il nome esatto.
      const inizioTerminalOk =
        luogoInizioSpeciale?.tipo === "fiumicino" ? TERMINAL_FIUMICINO.includes(form.luogo_inizio_dettaglio) :
        luogoInizioSpeciale?.tipo === "ciampino" ? TERMINAL_CIAMPINO.includes(form.luogo_inizio_dettaglio) :
        luogoInizioSpeciale?.tipo === "stazione" ? STAZIONI_ROMA.includes(form.luogo_inizio.trim()) :
        luogoInizioSpeciale?.tipo === "aeroporto_generico" ? false :
        true;
      if (luogoInizioSpeciale && !inizioTerminalOk) {
        toast.error(
          luogoInizioSpeciale.tipo === "aeroporto_generico" ? "Specifica quale aeroporto (inizio)" :
          luogoInizioSpeciale.tipo === "stazione" ? "Specifica quale stazione (inizio)" :
          "Specifica il terminal (inizio)"
        );
        return false;
      }
      const fineTerminalOk =
        luogoFineSpeciale?.tipo === "fiumicino" ? TERMINAL_FIUMICINO.includes(form.luogo_fine_dettaglio) :
        luogoFineSpeciale?.tipo === "ciampino" ? TERMINAL_CIAMPINO.includes(form.luogo_fine_dettaglio) :
        luogoFineSpeciale?.tipo === "stazione" ? STAZIONI_ROMA.includes(form.luogo_fine.trim()) :
        luogoFineSpeciale?.tipo === "aeroporto_generico" ? false :
        true;
      if (luogoFineSpeciale && !fineTerminalOk) {
        toast.error(
          luogoFineSpeciale.tipo === "aeroporto_generico" ? "Specifica quale aeroporto (fine)" :
          luogoFineSpeciale.tipo === "stazione" ? "Specifica quale stazione (fine)" :
          "Specifica il terminal (fine)"
        );
        return false;
      }
    }
    if (n === 3) {
      if (!form.tipologia_servizio) { toast.error("Seleziona la tipologia di servizio"); return false; }
      if (!form.veicolo_tipo) { toast.error("Seleziona il veicolo"); return false; }
      if (!form.veicolo_tipo) { toast.error("Seleziona il veicolo"); return false; }
    }
    if (n === 4) {
      if (!form.contatto.trim()) { toast.error("Inserisci il nome del passeggero"); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep(s => Math.min(5, s + 1));
  };
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    // Validazione finale completa
    for (let i = 1; i <= 4; i++) {
      if (!validateStep(i)) return;
    }
    if (!form.tipo_pagamento) { toast.error("Seleziona il tipo di pagamento"); return; }
    if (!clientId || !orgId) return;

    setLoading(true);

    const luogoInizioFinale = form.luogo_inizio_dettaglio
      ? `${form.luogo_inizio} - ${form.luogo_inizio_dettaglio}`
      : form.luogo_inizio;
    const luogoFineFinale = form.luogo_fine_dettaglio
      ? `${form.luogo_fine} - ${form.luogo_fine_dettaglio}`
      : form.luogo_fine;

    let transferTipoDB: string | null = null;
    if (form.tipologia_servizio === "transfer_interno") transferTipoDB = "Transfer interno città";
    else if (form.tipologia_servizio === "transfer_regionale") transferTipoDB = "Transfer regionale";

    const { data: inserted, error } = await supabase.from("servizi").insert({
      data_servizio: form.data_servizio,
      ora_inizio: form.ora_inizio || null,
      tipologia: getTipologiaDB() as any,
      contatto: form.contatto,
      telefono_contatto: form.telefono_contatto || null,
      email_contatto: form.email_contatto || null,
      n_passeggeri: parseInt(form.n_passeggeri) || 1,
      n_bagagli: parseInt(form.n_bagagli) || 0,
      veicolo_tipo: form.veicolo_tipo || null,
      transfer_tipo: transferTipoDB,
      tour_tipo: form.tour_tipo || null,
      disposizione_oraria: form.disposizione_oraria || null,
      luogo_inizio: luogoInizioFinale || null,
      luogo_fine: luogoFineFinale || null,
      itinerario: form.itinerario || null,
      info_autista: form.info_autista || null,
      citta: form.citta || null,
      note: form.note || null,
      accessori: form.accessori || null,
      tipo_pagamento: form.tipo_pagamento || null,
      prezzo: form.prezzo ? parseFloat(form.prezzo) : null,
      client_id: clientId,
      org_id: orgId,
      stato: "nuovo" as any,
      utenza_id: activeUtenzaId,
    } as any).select("id").single();

    if (error || !inserted) {
      toast.error("Errore nella prenotazione: " + (error?.message ?? ""));
      setLoading(false);
      return;
    }

    await upsertPasseggero();

    if (allegato) {
      const safeName = allegato.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/${inserted.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("servizi-allegati")
        .upload(path, allegato, { contentType: allegato.type, upsert: false });
      if (upErr) {
        toast.error("Servizio creato ma upload allegato fallito: " + upErr.message);
      } else {
        await supabase.from("servizi")
          .update({ allegato_path: path, allegato_nome: allegato.name } as any)
          .eq("id", inserted.id);
      }
    }

    toast.success("Prenotazione inviata con successo!");

    // Ricarica ultimo servizio per "duplica"
    await loadUltimoServizio(clientId, activeUtenzaId);

    setForm(empty);
    setAllegato(null);
    setLoading(false);
  };

  // Riepilogo helper
  const Riga = ({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className="text-sm font-medium text-foreground break-words">{value || <span className="text-muted-foreground italic">—</span>}</div>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="text-xs text-primary hover:underline shrink-0 inline-flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Modifica
        </button>
      )}
    </div>
  );

  return (
    <ClientPortalLayout>
      <div className="max-w-2xl mx-auto space-y-5 pb-24">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display font-bold flex items-center gap-2 text-lg">
            <CalendarPlus className="h-6 w-6 text-primary" />
            Nuovo Servizio
          </h1>
        </div>

        {/* Card Riprendi nominativi ultima prenotazione */}
        {ultimoServizio && ultimoServizio.contatto && (
          <Card className="rounded-xl border-primary/30 bg-gradient-to-br from-primary/5 to-accent/30 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Usa l'ultimo passeggero</p>
                <p className="text-xs text-muted-foreground truncate">
                  {ultimoServizio.contatto}
                  {ultimoServizio.telefono_contatto ? ` · ${ultimoServizio.telefono_contatto}` : ""}
                  {ultimoServizio.email_contatto ? ` · ${ultimoServizio.email_contatto}` : ""}
                </p>
              </div>
              <Button type="button" size="sm" onClick={duplicaUltimo} className="rounded-lg shrink-0">
                Riprendi
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info box */}
        <Card className="rounded-xl border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p>Compila tutte le sezioni. Dalla pagina <strong>Lista Servizi</strong> potrai modificare la prenotazione.</p>
                <p className="text-xs text-destructive font-medium">Modifica e annulla: fino a 12 ore prima del servizio.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* SEZIONE 1: Quando */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" /> Quando vuoi il servizio?
              </h2>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data del servizio <span className="text-destructive">*</span></Label>
                <DatePicker value={form.data_servizio} onChange={(v) => set("data_servizio", v)} placeholder="Seleziona data" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Ora di inizio <span className="text-destructive">*</span></Label>
                <TimePicker value={form.ora_inizio} onChange={(v) => set("ora_inizio", v)} placeholder="Seleziona ora" />
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 2: Dove */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Da dove a dove?
              </h2>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Città di servizio <span className="text-destructive">*</span></Label>
                <Select value={form.citta} onValueChange={(v) => set("citta", v)}>
                  <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona città" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Roma">Roma</SelectItem>
                    <SelectItem value="Napoli">Napoli</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <LuogoField
                label="Luogo inizio"
                value={form.luogo_inizio}
                onChange={(v) => set("luogo_inizio", v)}
                dettaglio={form.luogo_inizio_dettaglio}
                onDettaglioChange={(v) => set("luogo_inizio_dettaglio", v)}
                speciale={luogoInizioSpeciale}
              />
              <LuogoField
                label="Luogo fine"
                value={form.luogo_fine}
                onChange={(v) => set("luogo_fine", v)}
                dettaglio={form.luogo_fine_dettaglio}
                onDettaglioChange={(v) => set("luogo_fine_dettaglio", v)}
                speciale={luogoFineSpeciale}
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Itinerario (opzionale)</Label>
                <Textarea
                  value={form.itinerario}
                  onChange={(e) => set("itinerario", e.target.value)}
                  placeholder="Descrivi il percorso, le tappe, gli orari..."
                  className="rounded-lg min-h-[70px] resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 3: Servizio */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" /> Tipo di servizio e veicolo
              </h2>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipologia di servizio <span className="text-destructive">*</span></Label>
                <Select
                  value={form.tipologia_servizio}
                  onValueChange={(v) => setForm(p => ({ ...p, tipologia_servizio: v, tour_tipo: v === "tour" ? p.tour_tipo : "", disposizione_oraria: "" }))}
                >
                  <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona tipologia" /></SelectTrigger>
                  <SelectContent>
                    {TIPOLOGIA_OPZIONI.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.tipologia_servizio === "tour" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tipo di tour</Label>
                  <Select value={form.tour_tipo} onValueChange={(v) => set("tour_tipo", v)}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona tour" /></SelectTrigger>
                    <SelectContent>
                      {TOUR_OPZIONI.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">N. persone</Label>
                  <Input type="number" min="1" value={form.n_passeggeri} onChange={(e) => set("n_passeggeri", e.target.value)} className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">N. bagagli</Label>
                  <Input type="number" min="0" value={form.n_bagagli} onChange={(e) => set("n_bagagli", e.target.value)} className="rounded-lg h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Accessori (opzionale)</Label>
                <Input value={form.accessori} onChange={(e) => set("accessori", e.target.value)} placeholder="es. seggiolino, WiFi..." className="rounded-lg h-10" />
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 3b: Disposizione oraria (solo se tipologia=disposizione) */}
          {(form.tipologia_servizio === "transfer_interno" || form.tipologia_servizio === "transfer_regionale") && (
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Disposizione oraria
                </h2>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Durata <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.disposizione_oraria} onValueChange={(v) => set("disposizione_oraria", v)}>
                    <SelectTrigger className="rounded-lg h-10">
                      <SelectValue placeholder="Seleziona durata" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPOSIZIONE_OPZIONI.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEZIONE 4: Passeggero */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-5">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Chi viaggia?
              </h2>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Nome passeggero <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={form.contatto}
                    onChange={(e) => set("contatto", e.target.value)}
                    placeholder="Cerca o digita un nuovo nome…"
                    className="rounded-lg h-11 pl-9 pr-9"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                  />
                  {form.contatto && (
                    <button
                      type="button"
                      onClick={() => { set("contatto", ""); set("telefono_contatto", ""); set("email_contatto", ""); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
                      aria-label="Cancella"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {passeggeri.length > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border flex items-center justify-between">
                      <span>Dalla rubrica</span>
                      <span className="text-[10px] font-normal normal-case">
                        {passeggeriFiltrati.length} {passeggeriFiltrati.length === 1 ? "risultato" : "risultati"}
                      </span>
                    </div>
                    {passeggeriFiltrati.length > 0 ? (
                      <ul className="max-h-64 overflow-y-auto divide-y divide-border/60">
                        {passeggeriFiltrati.map(p => {
                          const fullName = `${p.nome}${p.cognome ? " " + p.cognome : ""}`;
                          const isSelected =
                            form.contatto.trim().toLowerCase() === fullName.toLowerCase().trim();
                          return (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => selezionaPasseggero(p)}
                                className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                                  isSelected ? "bg-primary/10" : "hover:bg-accent"
                                }`}
                              >
                                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                                  {p.nome.charAt(0).toUpperCase()}
                                  {p.cognome ? p.cognome.charAt(0).toUpperCase() : ""}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate flex items-center gap-2">
                                    {fullName}
                                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                                  </div>
                                  {(p.telefono || p.email) && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {[p.telefono, p.email].filter(Boolean).join(" · ")}
                                    </div>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Nessun passeggero trovato in rubrica
                      </div>
                    )}
                  </div>
                )}

                {form.contatto.trim() && !passeggeroEsiste && (
                  <div className="flex items-start gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground">
                    <UserPlus className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>
                      <strong className="font-semibold">{form.contatto}</strong> non è in rubrica — lo salveremo automaticamente al termine così la prossima volta lo trovi subito.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> Telefono
                  </Label>
                  <Input value={form.telefono_contatto} onChange={(e) => set("telefono_contatto", e.target.value)} placeholder="+39…" className="rounded-lg h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> Email
                  </Label>
                  <Input type="email" value={form.email_contatto} onChange={(e) => set("email_contatto", e.target.value)} placeholder="email@esempio.com" className="rounded-lg h-10" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE 5: Pagamento + extra */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Pagamento e dettagli
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tipo pagamento <span className="text-destructive">*</span></Label>
                  <Select value={form.tipo_pagamento} onValueChange={(v) => set("tipo_pagamento", v)}>
                    <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {PAGAMENTO_OPZIONI.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Prezzo (opzionale)</Label>
                  <Input type="number" step="0.01" value={form.prezzo} onChange={(e) => set("prezzo", e.target.value)} placeholder="0.00" className="rounded-lg h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Info per l'autista (opzionale)</Label>
                <Textarea value={form.info_autista} onChange={(e) => set("info_autista", e.target.value)} placeholder="Informazioni utili per l'autista" className="rounded-lg min-h-[60px] resize-y" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Note (opzionale)</Label>
                <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Note aggiuntive..." className="rounded-lg min-h-[60px] resize-y" />
              </div>

              {/* Allegato */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Allegato per l'autista (opzionale)
                </Label>
                {allegato ? (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/60 bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{allegato.name}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setAllegato(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="allegato-input" className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/30 transition-colors cursor-pointer">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Plus className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Scegli un file</p>
                      <p className="text-xs text-muted-foreground">PDF, Word, Excel o immagini · max {ALLEGATO_MAX_MB}MB</p>
                    </div>
                    <input
                      id="allegato-input"
                      type="file"
                      accept={ALLEGATO_ACCEPT}
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > ALLEGATO_MAX_MB * 1024 * 1024) {
                          toast.error(`File troppo grande. Massimo ${ALLEGATO_MAX_MB}MB.`);
                          e.target.value = "";
                          return;
                        }
                        setAllegato(f);
                      }}
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer submit sticky */}
        <div className="sticky bottom-4 z-20 mt-6">
          <div className="flex items-center gap-3 p-2 rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg">
            <Button type="button" onClick={handleSubmit} disabled={loading} className="rounded-lg gap-1.5 w-full">
              <Send className="h-4 w-4" />
              {loading ? "Invio..." : "Conferma prenotazione"}
            </Button>
          </div>
        </div>
      </div>
    </ClientPortalLayout>
  );
}
