import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  User,
  Phone,
  Mail,
  Users,
  Briefcase,
  Car,
  MapPin,
  CreditCard,
  Euro,
  FileText,
  BookOpen,
  Plus,
  Search,
  UserPlus,
  X,
  CheckCircle2,
} from "lucide-react";
import {
  VEICOLI_DISPONIBILI,
  TOUR_OPZIONI,
  DISPOSIZIONE_OPZIONI,
  PAGAMENTO_OPZIONI,
  CITTA_OPZIONI,
  detectLuogoSpeciale,
  LuogoField,
  splitLuogo,
  TRANSFER_TIPO_OPZIONI,
  normalizeTransferTipo,

} from "@/lib/booking-shared";
import type { AccessorioRow } from "@/components/servizi/AccessoriEditor";

export type BookingFormState = {
  citta: string;
  data_servizio: string;
  ora_inizio: string;
  contatto: string;
  telefono_contatto: string;
  email_contatto: string;
  n_passeggeri: string;
  n_bagagli: string;
  veicolo_tipo: string;
  transfer_tipo: string; // "" | transfer_interno | transfer_regionale
  disposizione_oraria: string;
  tour_tipo: string;
  luogo_inizio: string;
  luogo_inizio_dettaglio: string;
  luogo_fine: string;
  luogo_fine_dettaglio: string;
  itinerario: string;
  info_autista: string;
  centro_costo: string;
  tipo_pagamento: string;
  prezzo: string;
  note: string;
};

export const emptyBookingForm: BookingFormState = {
  citta: "",
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
  luogo_inizio_dettaglio: "",
  luogo_fine: "",
  luogo_fine_dettaglio: "",
  itinerario: "",
  info_autista: "",
  centro_costo: "",
  tipo_pagamento: "",
  prezzo: "",
  note: "",
};

export type DerivedTipologia = {
  tipologia: "transfer" | "disposizione" | "tour" | "altro";
  transfer_tipo: string | null;
  disposizione_oraria: string | null;
  tour_tipo: string | null;
};

export function deriveTipologia(f: BookingFormState): DerivedTipologia {
  if (f.tour_tipo) {
    return { tipologia: "tour", transfer_tipo: null, disposizione_oraria: null, tour_tipo: f.tour_tipo };
  }
  if (f.disposizione_oraria) {
    return { tipologia: "disposizione", transfer_tipo: null, disposizione_oraria: f.disposizione_oraria, tour_tipo: null };
  }
  if (f.transfer_tipo) {
    return {
      tipologia: "transfer",
      transfer_tipo: normalizeTransferTipo(f.transfer_tipo),
      disposizione_oraria: null,
      tour_tipo: null,
    };
  }

  return { tipologia: "altro", transfer_tipo: null, disposizione_oraria: null, tour_tipo: null };
}

export function servizioToBookingForm(s: {
  citta: string | null;
  data_servizio: string;
  ora_inizio: string | null;
  contatto: string | null;
  telefono_contatto: string | null;
  email_contatto: string | null;
  n_passeggeri: number | null;
  n_bagagli: number | null;
  veicolo_tipo: string | null;
  tipologia: string | null;
  transfer_tipo: string | null;
  disposizione_oraria: string | null;
  tour_tipo: string | null;
  luogo_inizio: string | null;
  luogo_fine: string | null;
  itinerario: string | null;
  info_autista: string | null;
  centro_costo: string | null;
  tipo_pagamento: string | null;
  prezzo: number | null;
  note: string | null;
}): BookingFormState {
  // splitLuogo imported from booking-shared
  const inizio = splitLuogo(s.luogo_inizio);
  const fine = splitLuogo(s.luogo_fine);
  const transfer_tipo = normalizeTransferTipo(s.transfer_tipo);

  return {
    citta: s.citta ?? "",
    data_servizio: s.data_servizio ?? "",
    ora_inizio: s.ora_inizio ?? "",
    contatto: s.contatto ?? "",
    telefono_contatto: s.telefono_contatto ?? "",
    email_contatto: s.email_contatto ?? "",
    n_passeggeri: String(s.n_passeggeri ?? 1),
    n_bagagli: String(s.n_bagagli ?? 0),
    veicolo_tipo: s.veicolo_tipo ?? "",
    transfer_tipo,
    disposizione_oraria: s.disposizione_oraria ?? "",
    tour_tipo: s.tour_tipo ?? "",
    luogo_inizio: inizio.base,
    luogo_inizio_dettaglio: inizio.dettaglio,
    luogo_fine: fine.base,
    luogo_fine_dettaglio: fine.dettaglio,
    itinerario: s.itinerario ?? "",
    info_autista: s.info_autista ?? "",
    centro_costo: s.centro_costo ?? "",
    tipo_pagamento: s.tipo_pagamento ?? "",
    prezzo: s.prezzo != null ? String(s.prezzo) : "",
    note: s.note ?? "",
  };
}

type Passeggero = {
  id: string;
  nome: string;
  cognome: string | null;
  telefono: string | null;
  email: string | null;
};

type CatalogoItem = { id: string; nome: string; prezzo: number };

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pb-1 border-b border-border/60">
      <Icon className="h-3.5 w-3.5 text-primary" /> {children}
    </h2>
  );
}

function AccessoriCatalogoList({
  orgId,
  value,
  onChange,
}: {
  orgId: string | null;
  value: AccessorioRow[];
  onChange: (rows: AccessorioRow[]) => void;
}) {
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!orgId) { setLoading(false); return; }
      const { data } = await supabase
        .from("accessori_catalogo")
        .select("id, nome, prezzo, attivo")
        .eq("org_id", orgId)
        .order("nome");
      setCatalogo((data ?? []) as CatalogoItem[]);
      setLoading(false);
    })();
  }, [orgId]);

  const usati = new Set(value.filter(r => (r.quantita || 0) > 0).map(r => r.accessorio_id));
  const visibili = catalogo.filter(c => (c as any).attivo !== false || usati.has(c.id));

  const getQty = (id: string) => value.find(r => r.accessorio_id === id)?.quantita ?? 0;


  const setQty = (item: CatalogoItem, raw: string) => {
    const qty = raw === "" ? 0 : Math.max(0, parseInt(raw) || 0);
    if (qty <= 0) {
      onChange(value.filter(r => r.accessorio_id !== item.id));
      return;
    }
    const existing = value.find(r => r.accessorio_id === item.id);
    if (existing) {
      onChange(value.map(r => (r.accessorio_id === item.id ? { ...r, quantita: qty } : r)));
    } else {
      onChange([...value, { accessorio_id: item.id, quantita: qty, prezzo_unitario: Number(item.prezzo) }]);
    }
  };

  const total = value.reduce((s, r) => s + (r.quantita || 0) * (Number(r.prezzo_unitario) || 0), 0);

  if (loading) return <p className="text-xs text-muted-foreground">Caricamento catalogo…</p>;
  if (!visibili.length) {
    return (
      <p className="text-xs text-muted-foreground italic">Nessun accessorio disponibile per questo cliente.</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {visibili.map(item => {
        const qty = getQty(item.id);
        const rowTotal = qty * Number(item.prezzo || 0);
        const disattivato = (item as any).attivo === false;
        return (
          <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {item.nome}
                {disattivato && (
                  <span className="ml-2 text-[10px] uppercase text-muted-foreground">non più disponibile</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">€ {Number(item.prezzo).toFixed(2)} cad.</div>
            </div>
            <div className="w-20 text-right text-xs font-medium tabular-nums">
              {qty > 0 ? `€ ${rowTotal.toFixed(2)}` : ""}
            </div>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              disabled={disattivato}
              value={qty === 0 ? "" : qty}
              onChange={e => setQty(item, e.target.value)}
              placeholder="0"
              className="w-16 h-9 text-center rounded-md"
            />
          </div>
        );
      })}
      <div className="flex justify-end text-xs font-semibold text-foreground pt-1">
        Totale accessori: € {total.toFixed(2)}
      </div>
    </div>
  );

}

export function BookingFormFields({
  form,
  setForm,
  mode,
  orgId,
  clientId,
  passeggeri,
  onPasseggeroCreated,
  accessoriRows,
  setAccessoriRows,
  autoreName,
}: {
  form: BookingFormState;
  setForm: (updater: (prev: BookingFormState) => BookingFormState) => void;
  mode: "create" | "edit";
  orgId: string | null;
  clientId: string | null;
  passeggeri: Passeggero[];
  onPasseggeroCreated?: (p: Passeggero) => void;
  accessoriRows: AccessorioRow[];
  setAccessoriRows: (rows: AccessorioRow[]) => void;
  autoreName: string;
}) {
  const set = (field: keyof BookingFormState, value: string) =>
    setForm(p => ({ ...p, [field]: value }));

  const luogoInizioSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio),
    [form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio]
  );
  const luogoFineSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_fine, form.citta, form.luogo_fine_dettaglio),
    [form.luogo_fine, form.citta, form.luogo_fine_dettaglio]
  );

  // Passeggero combobox
  const [passOpen, setPassOpen] = useState(false);
  const [newPassOpen, setNewPassOpen] = useState(false);
  const [newPass, setNewPass] = useState({ nome: "", cognome: "", telefono: "", email: "" });

  const passeggeriFiltrati = useMemo(() => {
    const q = form.contatto.toLowerCase().trim();
    if (!q) return passeggeri.slice(0, 8);
    return passeggeri
      .filter(p => `${p.nome} ${p.cognome ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [form.contatto, passeggeri]);

  const selectPasseggero = (p: Passeggero) => {
    setForm(prev => ({
      ...prev,
      contatto: `${p.nome}${p.cognome ? " " + p.cognome : ""}`,
      telefono_contatto: p.telefono ?? "",
      email_contatto: p.email ?? "",
    }));
    setPassOpen(false);
  };

  const createPasseggero = async () => {
    if (!clientId || !orgId) { toast.error("Cliente non configurato"); return; }
    if (!newPass.nome.trim()) { toast.error("Il nome è obbligatorio"); return; }
    const { data, error } = await supabase
      .from("passeggeri_rubrica")
      .insert({
        org_id: orgId,
        client_id: clientId,
        nome: newPass.nome.trim(),
        cognome: newPass.cognome.trim() || null,
        telefono: newPass.telefono.trim() || null,
        email: newPass.email.trim() || null,
      } as any)
      .select("id, nome, cognome, telefono, email")
      .single();
    if (error || !data) { toast.error(error?.message ?? "Errore"); return; }
    onPasseggeroCreated?.(data as Passeggero);
    selectPasseggero(data as Passeggero);
    setNewPassOpen(false);
    setNewPass({ nome: "", cognome: "", telefono: "", email: "" });
    toast.success("Passeggero salvato in rubrica");
  };

  // Tariffario
  const [tariffario, setTariffario] = useState<{ url: string; nome: string | null } | null>(null);
  useEffect(() => {
    (async () => {
      if (!clientId) return;
      const { data } = await supabase
        .from("clients")
        .select("tariffario_url, tariffario_nome")
        .eq("id", clientId)
        .maybeSingle();
      if (data?.tariffario_url) setTariffario({ url: data.tariffario_url, nome: data.tariffario_nome });
    })();
  }, [clientId]);

  const openTariffario = async () => {
    if (!tariffario) return;
    const { data, error } = await supabase.storage
      .from("tariffari-clienti")
      .createSignedUrl(tariffario.url, 300);
    if (error || !data?.signedUrl) { toast.error("Impossibile aprire il tariffario"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const passeggeroLocked = mode === "edit"; // edit portal doesn't touch contatto/tel/email

  return (
    <div className="space-y-6">
      {/* 1) CITTÀ */}
      <div className="flex flex-col items-center gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Città di servizio <span className="text-destructive">*</span>
        </Label>
        <Select value={form.citta} onValueChange={v => set("citta", v)}>
          <SelectTrigger className="w-full max-w-xs h-10 rounded-lg">
            <SelectValue placeholder="Seleziona città" />
          </SelectTrigger>
          <SelectContent>
            {CITTA_OPZIONI.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2) DATI PRINCIPALI */}
      <section className="space-y-3">
        <SectionTitle icon={CalendarDays}>Dati servizio</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data <span className="text-destructive">*</span></Label>
            <DatePicker value={form.data_servizio} onChange={v => set("data_servizio", v)} placeholder="Seleziona data" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Ora inizio <span className="text-destructive">*</span></Label>
            <TimePicker value={form.ora_inizio} onChange={v => set("ora_inizio", v)} placeholder="HH:MM" />
          </div>

          {/* PASSEGGERO */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Passeggero <span className="text-destructive">*</span>
            </Label>
            {passeggeroLocked ? (
              <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                {form.contatto || <span className="text-muted-foreground italic">—</span>}
                <span className="ml-2 text-[11px] text-muted-foreground">(non modificabile)</span>
              </div>
            ) : (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={form.contatto}
                      onChange={e => { set("contatto", e.target.value); setPassOpen(true); }}
                      onFocus={() => setPassOpen(true)}
                      placeholder="Cerca o digita il nome…"
                      className="rounded-lg h-10 pl-9 pr-8"
                      autoComplete="off"
                    />
                    {form.contatto && (
                      <button
                        type="button"
                        onClick={() => { set("contatto", ""); set("telefono_contatto", ""); set("email_contatto", ""); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg shrink-0"
                    title="Nuovo passeggero"
                    onClick={() => setNewPassOpen(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
                {passOpen && passeggeriFiltrati.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                    <ul className="max-h-56 overflow-y-auto divide-y divide-border/60">
                      {passeggeriFiltrati.map(p => {
                        const fullName = `${p.nome}${p.cognome ? " " + p.cognome : ""}`;
                        const selected = form.contatto.trim().toLowerCase() === fullName.toLowerCase().trim();
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => selectPasseggero(p)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                            >
                              <span className="truncate">
                                <span className="font-medium">{fullName}</span>
                                {(p.telefono || p.email) && (
                                  <span className="ml-2 text-[11px] text-muted-foreground">
                                    {[p.telefono, p.email].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </span>
                              {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="border-t border-border bg-muted/30 px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setPassOpen(false)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Chiudi
                      </button>
                    </div>
                  </div>
                )}

                {newPassOpen && (
                  <div className="mt-2 rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
                    <div className="text-xs font-semibold text-primary flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Nuovo passeggero
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input placeholder="Nome *" value={newPass.nome} onChange={e => setNewPass(p => ({ ...p, nome: e.target.value }))} className="h-9 rounded-md" />
                      <Input placeholder="Cognome" value={newPass.cognome} onChange={e => setNewPass(p => ({ ...p, cognome: e.target.value }))} className="h-9 rounded-md" />
                      <Input placeholder="Telefono" value={newPass.telefono} onChange={e => setNewPass(p => ({ ...p, telefono: e.target.value }))} className="h-9 rounded-md" />
                      <Input placeholder="Email" type="email" value={newPass.email} onChange={e => setNewPass(p => ({ ...p, email: e.target.value }))} className="h-9 rounded-md" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setNewPassOpen(false)}>Annulla</Button>
                      <Button type="button" size="sm" onClick={createPasseggero}>Salva</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Telefono</Label>
            <Input
              value={form.telefono_contatto}
              onChange={e => set("telefono_contatto", e.target.value)}
              placeholder="+39…"
              className="rounded-lg h-10"
              disabled={passeggeroLocked}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
            <Input
              type="email"
              value={form.email_contatto}
              onChange={e => set("email_contatto", e.target.value)}
              placeholder="email@esempio.com"
              className="rounded-lg h-10"
              disabled={passeggeroLocked}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> N. persone <span className="text-destructive">*</span></Label>
            <Input type="number" min="1" value={form.n_passeggeri} onChange={e => set("n_passeggeri", e.target.value)} className="rounded-lg h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> Numero bagagli</Label>
            <Input type="number" min="0" value={form.n_bagagli} onChange={e => set("n_bagagli", e.target.value)} className="rounded-lg h-10" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Car className="h-3 w-3" /> Veicolo <span className="text-destructive">*</span></Label>
            <Select value={form.veicolo_tipo} onValueChange={v => set("veicolo_tipo", v)}>
              <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona veicolo" /></SelectTrigger>
              <SelectContent>
                {VEICOLI_DISPONIBILI.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 3) TIPOLOGIA */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary" /> Tipologia servizio
          </h2>
          {tariffario && (
            <button
              type="button"
              onClick={openTariffario}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <BookOpen className="h-3 w-3" /> Tariffario
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Trasfert</Label>
            <Select
              value={form.transfer_tipo || "__none__"}
              onValueChange={v => setForm(p => ({
                ...p,
                transfer_tipo: v === "__none__" ? "" : v,
                disposizione_oraria: v === "__none__" ? p.disposizione_oraria : "",
                tour_tipo: v === "__none__" ? p.tour_tipo : "",
              }))}
            >
              <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {TRANSFER_TIPO_OPZIONI.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}

              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Disposizione oraria</Label>
            <Select
              value={form.disposizione_oraria || "__none__"}
              onValueChange={v => setForm(p => ({
                ...p,
                disposizione_oraria: v === "__none__" ? "" : v,
                transfer_tipo: v === "__none__" ? p.transfer_tipo : "",
                tour_tipo: v === "__none__" ? p.tour_tipo : "",
              }))}
            >
              <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {DISPOSIZIONE_OPZIONI.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tour</Label>
            <Select
              value={form.tour_tipo || "__none__"}
              onValueChange={v => setForm(p => ({
                ...p,
                tour_tipo: v === "__none__" ? "" : v,
                transfer_tipo: v === "__none__" ? p.transfer_tipo : "",
                disposizione_oraria: v === "__none__" ? p.disposizione_oraria : "",
              }))}
            >
              <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {TOUR_OPZIONI.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 4) LUOGHI */}
      <section className="space-y-3">
        <SectionTitle icon={MapPin}>Luoghi e itinerario</SectionTitle>
        <LuogoField
          label="Luogo inizio"
          value={form.luogo_inizio}
          onChange={v => set("luogo_inizio", v)}
          dettaglio={form.luogo_inizio_dettaglio}
          onDettaglioChange={v => set("luogo_inizio_dettaglio", v)}
          speciale={luogoInizioSpeciale}
        />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Itinerario</Label>
          <Textarea
            value={form.itinerario}
            onChange={e => set("itinerario", e.target.value)}
            placeholder="Descrivi il percorso, le tappe, gli orari…"
            className="rounded-lg min-h-[60px] resize-y"
          />
        </div>
        <LuogoField
          label="Luogo fine"
          value={form.luogo_fine}
          onChange={v => set("luogo_fine", v)}
          dettaglio={form.luogo_fine_dettaglio}
          onDettaglioChange={v => set("luogo_fine_dettaglio", v)}
          speciale={luogoFineSpeciale}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Info autista</Label>
            <Input value={form.info_autista} onChange={e => set("info_autista", e.target.value)} className="rounded-lg h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Centro di costo</Label>
            <Input value={form.centro_costo} onChange={e => set("centro_costo", e.target.value)} className="rounded-lg h-10" />
          </div>
        </div>
      </section>

      {/* 5) ACCESSORI */}
      <section className="space-y-3">
        <SectionTitle icon={Plus}>Accessori</SectionTitle>
        <AccessoriCatalogoList orgId={orgId} value={accessoriRows} onChange={setAccessoriRows} />
      </section>

      {/* 6) FINALE */}
      <section className="space-y-3">
        <SectionTitle icon={CreditCard}>Pagamento</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo pagamento <span className="text-destructive">*</span></Label>
            <Select value={form.tipo_pagamento} onValueChange={v => set("tipo_pagamento", v)}>
              <SelectTrigger className="rounded-lg h-10"><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                {PAGAMENTO_OPZIONI.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Euro className="h-3 w-3" /> Prezzo</Label>
            <Input
              value={form.prezzo ? `€ ${Number(form.prezzo).toFixed(2)}` : ""}
              readOnly
              placeholder="Sarà compilato dal NCC"
              className="rounded-lg h-10 bg-muted/40 cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Autore</Label>
            <Input value={autoreName} readOnly className="rounded-lg h-10 bg-muted/40 cursor-not-allowed" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Note</Label>
          <Textarea
            value={form.note}
            onChange={e => set("note", e.target.value)}
            placeholder="Note aggiuntive…"
            className="rounded-lg min-h-[60px] resize-y"
          />
        </div>
      </section>
    </div>
  );
}
