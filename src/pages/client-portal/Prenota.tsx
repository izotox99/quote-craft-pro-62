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
import { CalendarPlus, Send, Info, Paperclip, X, Plus } from "lucide-react";

const ALLEGATO_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx";
const ALLEGATO_MAX_MB = 10;

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

// Tipologia unica
const TIPOLOGIA_OPZIONI = [
  { value: "transfer_interno", label: "Transfer interno città" },
  { value: "transfer_regionale", label: "Transfer regionale" },
  { value: "tour", label: "Tour" },
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

// Terminal aeroporti / stazioni
const TERMINAL_FIUMICINO = ["Terminal 1", "Terminal 3", "Arrivi", "Partenze"];
const TERMINAL_CIAMPINO = ["Arrivi", "Partenze"];
const STAZIONI_ROMA = ["Roma Termini", "Roma Tiburtina", "Roma Ostiense", "Roma Trastevere", "Roma Tuscolana"];
const AEROPORTI_ROMA = [
  { value: "Aeroporto Fiumicino", label: "Aeroporto di Fiumicino (FCO)" },
  { value: "Aeroporto Ciampino", label: "Aeroporto di Ciampino (CIA)" },
];

type LuogoSpeciale =
  | null
  | { tipo: "aeroporto_generico"; opzioni: { value: string; label: string }[] }
  | { tipo: "fiumicino" | "ciampino"; opzioni: string[] }
  | { tipo: "stazione"; opzioni: string[] };

function detectLuogoSpeciale(testo: string, citta: string, dettaglio: string): LuogoSpeciale {
  const t = testo.toLowerCase().trim();
  if (!t) return null;
  const isRoma = citta === "Roma";

  // Match esplicito Fiumicino
  if (/fiumicino|fco/.test(t)) return { tipo: "fiumicino", opzioni: TERMINAL_FIUMICINO };
  // Match esplicito Ciampino
  if (/ciampino|cia\b/.test(t)) return { tipo: "ciampino", opzioni: TERMINAL_CIAMPINO };

  // Roma + parole aeroporto generiche → forza scelta tra FCO/CIA
  // Intercetta anche refusi/parziali: aer, aere, aereo, aereoporto, aeroporto, aeroport, airport
  const aeroportoGenericoMatch =
    t.includes("aer") ||
    t.includes("aere") ||
    t.includes("aereo") ||
    t.includes("aereoporto") ||
    t.includes("aeroporto") ||
    t.includes("aeroport") ||
    t.includes("airport");

  if (isRoma && aeroportoGenericoMatch) {
    if (dettaglio === "Aeroporto Fiumicino") return { tipo: "fiumicino", opzioni: TERMINAL_FIUMICINO };
    if (dettaglio === "Aeroporto Ciampino") return { tipo: "ciampino", opzioni: TERMINAL_CIAMPINO };
    return { tipo: "aeroporto_generico", opzioni: AEROPORTI_ROMA };
  }

  // Stazioni
  if (/stazione|termini|tiburtina|ostiense|trastevere|tuscolana/.test(t)) {
    return { tipo: "stazione", opzioni: STAZIONI_ROMA };
  }

  return null;
}

type Passeggero = { id: string; nome: string; cognome: string | null; telefono: string | null; email: string | null };

/**
 * Campo "Luogo" con autocompletamento contestuale.
 * Quando rileva un luogo speciale (aeroporto/stazione/terminal) mostra un pannello
 * di suggerimenti SOTTO il textarea. Cliccando un'opzione il valore sostituisce
 * (o completa) il contenuto del campo.
 */
function LuogoField({
  label,
  value,
  onChange,
  dettaglio,
  onDettaglioChange,
  speciale,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dettaglio: string;
  onDettaglioChange: (v: string) => void;
  speciale: LuogoSpeciale;
}) {
  const handlePick = (val: string, lbl: string) => {
    if (!speciale) return;
    if (speciale.tipo === "aeroporto_generico" || speciale.tipo === "stazione") {
      // Sostituisce il contenuto del textarea col nome scelto.
      // Per aeroporto_generico salviamo anche dettaglio (chiave per matchare FCO/CIA)
      onChange(lbl);
      if (speciale.tipo === "aeroporto_generico") onDettaglioChange(val);
    } else {
      // Terminal / settore: salva nel dettaglio, lasciando il nome aeroporto nel campo
      onDettaglioChange(val);
    }
  };

  const showSuggestions =
    !!speciale &&
    (speciale.tipo === "aeroporto_generico" ||
      speciale.tipo === "stazione" ||
      ((speciale.tipo === "fiumicino" || speciale.tipo === "ciampino") && !dettaglio));

  const headerText =
    !speciale
      ? ""
      : speciale.tipo === "aeroporto_generico"
      ? "Quale aeroporto?"
      : speciale.tipo === "stazione"
      ? "Quale stazione?"
      : "A quale terminal?";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Inserire Hotel, via, n. volo o aeroporto/stazione"
          className="rounded-lg min-h-[60px] resize-y"
        />
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-150">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary bg-accent/40 border-b border-border">
              {headerText}
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
              {speciale!.opzioni.map((o: any) => {
                const val = typeof o === "string" ? o : o.value;
                const lbl = typeof o === "string" ? o : o.label;
                return (
                  <li key={val}>
                    <button
                      type="button"
                      onClick={() => handlePick(val, lbl)}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      {lbl}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {/* Conferma scelta terminal/stazione: mini badge sotto */}
      {speciale && dettaglio && (speciale.tipo === "fiumicino" || speciale.tipo === "ciampino") && (
        <div className="flex items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-accent text-accent-foreground">
            {dettaglio}
            <button
              type="button"
              onClick={() => onDettaglioChange("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cambia terminal"
            >
              ×
            </button>
          </span>
        </div>
      )}
    </div>
  );
}


export default function Prenota() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [utenze, setUtenze] = useState<{ id: string; nome: string; cognome: string; cellulare: string | null; email: string }[]>([]);
  const [passeggeri, setPasseggeri] = useState<Passeggero[]>([]);

  const empty = {
    data_servizio: "",
    ora_inizio: "",
    contatto: "",
    telefono_contatto: "",
    email_contatto: "",
    n_passeggeri: "1",
    n_bagagli: "0",
    veicolo_tipo: "",
    tipologia_servizio: "", // transfer_interno | transfer_regionale | tour
    tour_tipo: "",
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
  };

  const [form, setForm] = useState(empty);
  const [allegato, setAllegato] = useState<File | null>(null);
  const [activeUtenzaId, setActiveUtenzaId] = useState<string | null>(null);
  const [keepPasseggero, setKeepPasseggero] = useState(false);
  const [selectedPasseggeroId, setSelectedPasseggeroId] = useState<string>("");

  const loadPasseggeri = async (cId: string) => {
    const { data } = await supabase
      .from("passeggeri_rubrica")
      .select("id, nome, cognome, telefono, email")
      .eq("client_id", cId)
      .order("nome");
    setPasseggeri(data ?? []);
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

  const handlePasseggeroSelect = (pid: string) => {
    setSelectedPasseggeroId(pid);
    if (pid === "__new__") {
      setForm(p => ({ ...p, contatto: "", telefono_contatto: "", email_contatto: "" }));
      return;
    }
    const p = passeggeri.find(x => x.id === pid);
    if (p) {
      setForm(prev => ({
        ...prev,
        contatto: `${p.nome}${p.cognome ? " " + p.cognome : ""}`,
        telefono_contatto: p.telefono ?? "",
        email_contatto: p.email ?? "",
      }));
    }
  };

  // Mappa tipologia UI -> enum DB
  const getTipologiaDB = (): string => {
    if (form.tipologia_servizio === "tour") return "tour";
    if (form.tipologia_servizio === "transfer_interno" || form.tipologia_servizio === "transfer_regionale") return "transfer";
    return "altro";
  };

  const luogoInizioSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio),
    [form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio]
  );
  const luogoFineSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_fine, form.citta, form.luogo_fine_dettaglio),
    [form.luogo_fine, form.citta, form.luogo_fine_dettaglio]
  );

  // Reset dettagli se non più rilevanti
  useEffect(() => {
    if (!luogoInizioSpeciale && form.luogo_inizio_dettaglio) set("luogo_inizio_dettaglio", "");
  }, [luogoInizioSpeciale]);
  useEffect(() => {
    if (!luogoFineSpeciale && form.luogo_fine_dettaglio) set("luogo_fine_dettaglio", "");
  }, [luogoFineSpeciale]);

  const upsertPasseggero = async () => {
    if (!clientId || !orgId || !form.contatto.trim()) return;
    // Match per nome+telefono+email (semplice)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data_servizio || !form.contatto || !form.veicolo_tipo) {
      toast.error("Data, passeggero e veicolo sono obbligatori");
      return;
    }
    if (!form.tipologia_servizio) {
      toast.error("Seleziona la tipologia di servizio");
      return;
    }
    // Forza scelta terminal/aeroporto/stazione quando rilevato
    if (luogoInizioSpeciale && !form.luogo_inizio_dettaglio) {
      toast.error(
        luogoInizioSpeciale.tipo === "aeroporto_generico"
          ? "Specifica quale aeroporto per il luogo di inizio"
          : luogoInizioSpeciale.tipo === "stazione"
          ? "Specifica quale stazione per il luogo di inizio"
          : "Specifica il terminal per il luogo di inizio"
      );
      return;
    }
    if (luogoFineSpeciale && !form.luogo_fine_dettaglio) {
      toast.error(
        luogoFineSpeciale.tipo === "aeroporto_generico"
          ? "Specifica quale aeroporto per il luogo di fine"
          : luogoFineSpeciale.tipo === "stazione"
          ? "Specifica quale stazione per il luogo di fine"
          : "Specifica il terminal per il luogo di fine"
      );
      return;
    }
    if (!clientId || !orgId) return;

    setLoading(true);

    // Componi luoghi con dettaglio (terminal/stazione)
    const luogoInizioFinale = form.luogo_inizio_dettaglio
      ? `${form.luogo_inizio} - ${form.luogo_inizio_dettaglio}`
      : form.luogo_inizio;
    const luogoFineFinale = form.luogo_fine_dettaglio
      ? `${form.luogo_fine} - ${form.luogo_fine_dettaglio}`
      : form.luogo_fine;

    // Per il transfer_tipo salviamo un'etichetta leggibile
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
      luogo_inizio: luogoInizioFinale || null,
      luogo_fine: luogoFineFinale || null,
      itinerario: form.itinerario || null,
      info_autista: form.info_autista || null,
      citta: form.citta || null,
      note: form.note || null,
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

    // Salva il passeggero in rubrica se nuovo
    await upsertPasseggero();

    // Upload allegato
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

    // Reset: se vuole prenotare ancora per stesso passeggero, mantieni i dati contatto
    if (keepPasseggero) {
      setForm({
        ...empty,
        contatto: form.contatto,
        telefono_contatto: form.telefono_contatto,
        email_contatto: form.email_contatto,
      });
    } else {
      setForm(empty);
      setSelectedPasseggeroId("");
    }
    setAllegato(null);
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

                {/* Passeggero: rubrica + utenze + manuale */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground">Passeggero <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {passeggeri.length > 0 && (
                      <Select value={selectedPasseggeroId} onValueChange={handlePasseggeroSelect}>
                        <SelectTrigger className="rounded-lg h-10">
                          <SelectValue placeholder="Seleziona da rubrica..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__new__">
                            <span className="flex items-center gap-2"><Plus className="h-3.5 w-3.5" /> Nuovo passeggero</span>
                          </SelectItem>
                          {passeggeri.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}{p.cognome ? " " + p.cognome : ""}{p.telefono ? ` · ${p.telefono}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {utenze.length > 0 && (
                      <Select onValueChange={handleUtenzaSelect}>
                        <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="...oppure utenza" /></SelectTrigger>
                        <SelectContent>
                          {utenze.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Input
                    value={form.contatto}
                    onChange={(e) => set("contatto", e.target.value)}
                    placeholder="Nome e cognome passeggero"
                    className="rounded-lg h-10 mt-2"
                  />
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
                <div className="space-y-1.5 sm:col-span-2">
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

              {/* Mantieni passeggero */}
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer pt-2 border-t border-border/40">
                <input
                  type="checkbox"
                  checked={keepPasseggero}
                  onChange={(e) => setKeepPasseggero(e.target.checked)}
                  className="rounded accent-primary"
                />
                Mantieni nome, telefono ed email per la prossima prenotazione
              </label>
            </CardContent>
          </Card>

          {/* Tipologia servizio (UNICO select) */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Scegli tipologia di servizio <span className="text-destructive">*</span></Label>
                <Select
                  value={form.tipologia_servizio}
                  onValueChange={(v) => setForm(p => ({ ...p, tipologia_servizio: v, tour_tipo: v === "tour" ? p.tour_tipo : "" }))}
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
                  <Label className="text-xs font-medium text-muted-foreground">Tipo di Tour</Label>
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
            </CardContent>
          </Card>

          {/* Percorso */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Itinerario</Label>
                <Textarea
                  value={form.itinerario}
                  onChange={(e) => set("itinerario", e.target.value)}
                  placeholder="Descrivi il percorso, le tappe, gli orari..."
                  className="rounded-lg min-h-[80px] resize-y"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Info autista</Label>
                <Textarea
                  value={form.info_autista}
                  onChange={(e) => set("info_autista", e.target.value)}
                  placeholder="Informazioni utili per l'autista"
                  className="rounded-lg min-h-[60px] resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pagamento + Note */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Note aggiuntive..." className="rounded-lg min-h-[80px] resize-y" />
              </div>
            </CardContent>
          </Card>

          {/* Allegato per identificazione autista */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Allegato per l'autista
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Carica una foto del passeggero o un documento (PDF, Word, Excel, immagini). L'autista lo userà per identificare la persona da prendere in carico. Max {ALLEGATO_MAX_MB}MB.
                </p>
              </div>
              {allegato ? (
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/60 bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{allegato.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({(allegato.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setAllegato(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="allegato-input"
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/30 transition-colors cursor-pointer group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Plus className="h-5 w-5" />
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
