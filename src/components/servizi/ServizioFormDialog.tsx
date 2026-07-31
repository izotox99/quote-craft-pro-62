import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  VEICOLI_DISPONIBILI,
  TOUR_OPZIONI,
  PAGAMENTO_OPZIONI,
  CITTA_OPZIONI,
  DISPOSIZIONE_OPZIONI,
} from "@/lib/booking-shared";
import { AccessoriEditor, type AccessorioRow, loadServizioAccessori, saveServizioAccessori } from "./AccessoriEditor";
import { romeToday } from "@/lib/romeDate";


const TRANSFER_OPZIONI = [
  { value: "Transfer interno città", label: "Transfer interno città" },
  { value: "Transfer regionale", label: "Transfer regionale" },
];

const TRANSFER_SOTTO = [
  "Da Aeroporto",
  "Per Aeroporto",
  "Da Stazione",
  "Per Stazione",
  "Da Porto",
  "Per Porto",
  "Da Hotel",
  "Per Hotel",
  "Punto a punto",
];

const STATO_OPZIONI = [
  { value: "nuovo", label: "Nuovo" },
  { value: "da_confermare", label: "Da confermare" },
  { value: "confermato", label: "Confermato" },
  { value: "in_corso", label: "In corso" },
  { value: "completato", label: "Completato" },
  { value: "annullato", label: "Annullato" },
];

type Client = { id: string; name: string; company: string | null; phone?: string | null };
type Autista = { id: string; nome: string; cognome: string };
type Veicolo = { id: string; targa: string; tipo_macchina: string | null };
type Fornitore = { id: string; nome: string };

export type ServizioFormInitial = Partial<{
  id: string;
  data_servizio: string;
  ora_inizio: string | null;
  citta: string | null;
  luogo_inizio: string | null;
  luogo_fine: string | null;
  itinerario: string | null;
  stato: string;
  tipologia: string | null;
  transfer_tipo: string | null;
  tour_tipo: string | null;
  disposizione_oraria: string | null;
  contatto: string | null;
  telefono_contatto: string | null;
  telefono_d: string | null;
  email_contatto: string | null;
  n_passeggeri: number | null;
  n_bagagli: number | null;
  accessori: string | null;
  info_autista: string | null;
  cartello: string | null;
  stato_autista?: string | null;
  transfer_concluso_at?: string | null;
  transfer_nota_chiusura?: string | null;
  dispo_conclusa_at?: string | null;
  dispo_nota_chiusura?: string | null;
  km_inizio_servizio?: number | null;
  km_fine_servizio?: number | null;
  info_interne: string | null;
  info_cliente_autista: string | null;
  info_cliente: string | null;
  ritirare_voucher: boolean | null;
  con_guida: boolean | null;
  con_assistente: boolean | null;
  permesso_effettuato: boolean | null;
  veicolo_tipo: string | null;
  veicolo_id: string | null;
  autista_id: string | null;
  fornitore_cs_id: string | null;
  client_id: string | null;
  tipo_pagamento: string | null;
  codice: string | null;
  prezzo_fattura: number | null;
  prezzo_ccredito: number | null;
  prezzo_contante: number | null;
  com_cliente: number | null;
  costo_commissione: number | null;
  non_incassato: number | null;
  costo_cs: number | null;
  costo_autista: number | null;
  costo_centro: number | null;
  centro_costo: string | null;
  incasso: number | null;
  note: string | null;
}>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  initialData?: ServizioFormInitial | null;
  clients: Client[];
  autisti: Autista[];
  veicoli: Veicolo[];
  fornitori: Fornitore[];
  isAdmin: boolean;
  userId?: string;
  onSaved: (info?: { data_servizio?: string | null }) => void;
};

const emptyForm = (): Required<Omit<ServizioFormInitial, "id">> => ({
  data_servizio: romeToday(),
  ora_inizio: "",
  citta: "",
  luogo_inizio: "",
  luogo_fine: "",
  itinerario: "",
  stato: "nuovo",
  tipologia: null,
  transfer_tipo: "",
  tour_tipo: "",
  disposizione_oraria: "",
  contatto: "",
  telefono_contatto: "",
  telefono_d: "",
  email_contatto: "",
  n_passeggeri: 1,
  n_bagagli: 0,
  accessori: "",
  info_autista: "",
  cartello: "",
  info_interne: "",
  info_cliente_autista: "",
  info_cliente: "",
  ritirare_voucher: false,
  con_guida: false,
  con_assistente: false,
  permesso_effettuato: false,
  veicolo_tipo: "",
  veicolo_id: "",
  autista_id: "",
  fornitore_cs_id: "",
  client_id: "",
  tipo_pagamento: "",
  codice: "",
  prezzo_fattura: null,
  prezzo_ccredito: null,
  prezzo_contante: null,
  com_cliente: null,
  costo_commissione: null,
  non_incassato: null,
  costo_cs: null,
  costo_autista: null,
  costo_centro: null,
  centro_costo: "",
  incasso: null,
  note: "",
}) as any;

function n(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function ServizioFormDialog({
  open, onOpenChange, mode, initialData, clients, autisti, veicoli, fornitori, isAdmin, userId, onSaved,
}: Props) {
  const [f, setF] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [telefonoDTouched, setTelefonoDTouched] = useState(false);
  const [accessoriRows, setAccessoriRows] = useState<AccessorioRow[]>([]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialData) {
      setF({ ...emptyForm(), ...initialData, stato: initialData.stato || "nuovo" });
      setTelefonoDTouched(true);
      if (initialData.id) {
        loadServizioAccessori(initialData.id).then(setAccessoriRows);
      } else {
        setAccessoriRows([]);
      }
    } else {
      setF({ ...emptyForm(), stato: "nuovo" });
      setTelefonoDTouched(false);
      setAccessoriRows([]);
    }
  }, [open, mode, initialData]);


  const set = (patch: any) => setF((prev: any) => ({ ...prev, ...patch }));

  // Auto-copia Telefono D dal Telefono finché l'utente non tocca il campo
  useEffect(() => {
    if (!telefonoDTouched) {
      setF((prev: any) => ({ ...prev, telefono_d: prev.telefono_contatto || "" }));
    }
  }, [f.telefono_contatto, telefonoDTouched]);

  const selectedClient = useMemo(
    () => clients.find(c => c.id === f.client_id) || null,
    [clients, f.client_id]
  );

  const handleSubmit = async () => {
    if (!f.citta) { toast.error("Seleziona la città"); return; }
    if (!f.data_servizio) { toast.error("Data obbligatoria"); return; }
    if (!f.ora_inizio) { toast.error("Ora inizio obbligatoria"); return; }
    if (!f.luogo_inizio) { toast.error("Luogo inizio obbligatorio"); return; }
    if (!f.luogo_fine) { toast.error("Luogo fine obbligatorio"); return; }
    if (!f.tipo_pagamento) { toast.error("Tipo pagamento obbligatorio"); return; }
    if (!f.transfer_tipo && !f.disposizione_oraria && !f.tour_tipo) {
      toast.error("Seleziona Trasfert, Disposizione oraria o Tour");
      return;
    }

    // Deriva tipologia enum
    let tipologia: "transfer" | "disposizione" | "tour" = "transfer";
    if (f.tour_tipo) tipologia = "tour";
    else if (f.disposizione_oraria) tipologia = "disposizione";
    else if (f.transfer_tipo) tipologia = "transfer";

    const payload: Record<string, any> = {
      data_servizio: f.data_servizio,
      ora_inizio: f.ora_inizio || null,
      citta: f.citta || null,
      luogo_inizio: f.luogo_inizio || null,
      luogo_fine: f.luogo_fine || null,
      itinerario: f.itinerario || null,
      stato: f.stato || "nuovo",
      tipologia,
      transfer_tipo: f.transfer_tipo || null,
      disposizione_oraria: f.disposizione_oraria || null,
      tour_tipo: f.tour_tipo || null,
      veicolo_tipo: f.veicolo_tipo || null,
      veicolo_id: f.veicolo_id || null,
      autista_id: f.autista_id || null,
      fornitore_cs_id: f.fornitore_cs_id || null,
      client_id: f.client_id || null,
      contatto: f.contatto || null,
      telefono_contatto: f.telefono_contatto || null,
      telefono_d: f.telefono_d || null,
      email_contatto: f.email_contatto || null,
      n_passeggeri: f.n_passeggeri ?? 1,
      n_bagagli: f.n_bagagli ?? 0,
      info_autista: f.info_autista || null,
      cartello: (f as any).cartello || null,
      info_interne: f.info_interne || null,
      info_cliente_autista: f.info_cliente_autista || null,
      info_cliente: f.info_cliente || null,
      ritirare_voucher: !!f.ritirare_voucher,
      con_guida: !!f.con_guida,
      con_assistente: !!f.con_assistente,
      permesso_effettuato: !!f.permesso_effettuato,
      tipo_pagamento: f.tipo_pagamento || null,
      codice: f.codice || null,
      note: f.note || null,
    };

    // Se l'operatore ha cliccato "Conferma servizio" nel dialog, azzera
    // esplicitamente il flag modificato_da_cliente (viene rilevato dal trigger).
    if (mode === "edit" && (f as any).modificato_da_cliente === false) {
      payload.modificato_da_cliente = false;
      payload.modificato_at = null;
    }


    if (isAdmin) {
      Object.assign(payload, {
        prezzo_fattura: n(f.prezzo_fattura),
        prezzo_ccredito: n(f.prezzo_ccredito),
        prezzo_contante: n(f.prezzo_contante),
        com_cliente: n(f.com_cliente),
        costo_commissione: n(f.costo_commissione),
        non_incassato: n(f.non_incassato),
        costo_cs: n(f.costo_cs),
        costo_autista: n(f.costo_autista),
        costo_centro: n(f.costo_centro),
        centro_costo: f.centro_costo || null,
        incasso: n(f.incasso),
      });
    }

    setSaving(true);
    let error;
    let servizioId: string | undefined = initialData?.id;
    if (mode === "edit" && initialData?.id) {
      ({ error } = await supabase.from("servizi").update(payload).eq("id", initialData.id));
    } else {
      payload.created_by = userId;
      const res = await supabase.from("servizi").insert(payload as any).select("id").single();
      error = res.error;
      servizioId = (res.data as any)?.id;
    }
    if (!error && servizioId) {
      try { await saveServizioAccessori(servizioId, accessoriRows); } catch (e: any) {
        console.error("[accessori] save error", e);
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(mode === "edit" ? "Servizio aggiornato" : "Servizio creato");
    onOpenChange(false);
    onSaved({ data_servizio: (payload as any).data_servizio ?? null });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg underline decoration-1 underline-offset-4">
            {mode === "edit" ? "Modifica Servizio" : "Nuovo Servizio"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* 1. Città */}
          <section className="bg-muted/40 rounded-md p-3">
            <div className="grid grid-cols-12 items-center gap-3">
              <Label className="col-span-3 md:col-span-2 text-right font-semibold">Città di Servizio:</Label>
              <div className="col-span-9 md:col-span-4">
                <Select value={f.citta} onValueChange={v => set({ citta: v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {CITTA_OPZIONI.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* 2. Per Conto di + Telefono + Codice */}
          <section className="bg-muted/40 rounded-md p-3">
            <div className="grid grid-cols-12 items-center gap-3">
              <Label className="col-span-3 md:col-span-2 text-right font-semibold">Per Conto di: <span className="text-destructive">*</span></Label>
              <div className="col-span-9 md:col-span-4">
                <Select value={f.client_id} onValueChange={v => set({ client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Label className="col-span-3 md:col-span-1 text-right font-semibold">Telefono:</Label>
              <div className="col-span-3 md:col-span-2">
                <Input value={selectedClient?.phone || ""} readOnly className="bg-background" />
              </div>
              <Label className="col-span-3 md:col-span-1 text-right font-semibold">Codice:</Label>
              <div className="col-span-3 md:col-span-2">
                <Input value={f.codice} onChange={e => set({ codice: e.target.value })} />
              </div>
            </div>
          </section>

          {/* 3. Anagrafica passeggero */}
          <section className="bg-muted/40 rounded-md p-3 space-y-2">
            <Row label="Cliente:">
              <Input value={f.contatto} onChange={e => set({ contatto: e.target.value })} />
            </Row>
            <Row label="Email:">
              <Input type="email" value={f.email_contatto} onChange={e => set({ email_contatto: e.target.value })} />
            </Row>
            <Row label="Telefono:">
              <Input
                value={f.telefono_contatto}
                onChange={e => set({ telefono_contatto: e.target.value })}
              />
            </Row>
            <Row label="Telefono D:">
              <Input
                value={f.telefono_d}
                onChange={e => { setTelefonoDTouched(true); set({ telefono_d: e.target.value }); }}
              />
            </Row>
            <Row label={<>N. Persone: <span className="text-destructive">*</span></>}>
              <Input type="number" min={1} className="w-24" value={f.n_passeggeri ?? 1} onChange={e => set({ n_passeggeri: +e.target.value })} />
            </Row>
            <Row label={<>N. Bagagli: <span className="text-destructive">*</span></>}>
              <Input type="number" min={0} className="w-24" value={f.n_bagagli ?? 0} onChange={e => set({ n_bagagli: +e.target.value })} />
            </Row>
          </section>

          {/* 4. Data / Ora / Veicolo */}
          <section className="bg-muted/40 rounded-md p-3 space-y-2">
            <Row label={<>Data: <span className="text-destructive">*</span></>}>
              <DatePicker value={f.data_servizio} onChange={v => set({ data_servizio: v })} />
            </Row>
            <Row label={<>Ora inizio: <span className="text-destructive">*</span></>}>
              <TimePicker value={f.ora_inizio || ""} onChange={v => set({ ora_inizio: v })} />
            </Row>
            <Row label={<>Veicolo: <span className="text-destructive">*</span></>}>
              <Select value={f.veicolo_tipo} onValueChange={v => set({ veicolo_tipo: v })}>
                <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                <SelectContent>
                  {VEICOLI_DISPONIBILI.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Row>
          </section>

          {/* 5. Trasfert / Disposizione / Tour */}
          <section className="bg-primary/10 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-12 items-center gap-3">
              <Label className="col-span-3 md:col-span-2 text-right font-semibold italic">Trasfert:</Label>
              <div className="col-span-5 md:col-span-4">
                <Select
                  value={f.transfer_tipo}
                  onValueChange={v => set({ transfer_tipo: v, disposizione_oraria: "", tour_tipo: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {TRANSFER_OPZIONI.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 md:col-span-3">
                <Select
                  value={f.accessori || ""}
                  onValueChange={v => set({ accessori: v })}
                >
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {TRANSFER_SOTTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Row label={<span className="italic">Disposizione Oraria:</span>}>
              <Select
                value={f.disposizione_oraria}
                onValueChange={v => set({ disposizione_oraria: v, transfer_tipo: "", tour_tipo: "" })}
              >
                <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                <SelectContent>
                  {DISPOSIZIONE_OPZIONI.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </Row>
            <Row label={<span className="italic">Tour:</span>}>
              <Select
                value={f.tour_tipo}
                onValueChange={v => set({ tour_tipo: v, transfer_tipo: "", disposizione_oraria: "" })}
              >
                <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                <SelectContent>
                  {TOUR_OPZIONI.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Row>
          </section>

          {/* 6. Luoghi + info */}
          <section className="bg-primary/10 rounded-md p-3 space-y-2">
            <Row label={<>Luogo inizio: <span className="text-destructive">*</span></>}>
              <Input placeholder="Inserire Hotel, via, o n. volo" value={f.luogo_inizio} onChange={e => set({ luogo_inizio: e.target.value })} />
            </Row>
            <Row label="Itinerario:">
              <Input value={f.itinerario} onChange={e => set({ itinerario: e.target.value })} />
            </Row>
            <Row label={<>Luogo fine: <span className="text-destructive">*</span></>}>
              <Input placeholder="Inserire Hotel, via, o n. volo" value={f.luogo_fine} onChange={e => set({ luogo_fine: e.target.value })} />
            </Row>
            <Row label="Info autista:">
              <Input value={f.info_autista} onChange={e => set({ info_autista: e.target.value })} />
            </Row>
            <Row label="Cartello:">
              <Input
                placeholder="Nome da mostrare all'aeroporto (es. Sig. Rossi)"
                value={f.cartello ?? ""}
                onChange={e => set({ cartello: e.target.value })}
              />
            </Row>
            <Row label="Info interne:">
              <Input value={f.info_interne} onChange={e => set({ info_interne: e.target.value })} />
            </Row>

            {/* 7. Quattro checkbox */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
              <CheckboxRow label="Ritirare voucher clienti" checked={!!f.ritirare_voucher} onChange={v => set({ ritirare_voucher: v })} />
              <CheckboxRow label="Con Guida" checked={!!f.con_guida} onChange={v => set({ con_guida: v })} />
              <CheckboxRow label="Con Assistente" checked={!!f.con_assistente} onChange={v => set({ con_assistente: v })} />
              <CheckboxRow label="Permesso effettuato" checked={!!f.permesso_effettuato} onChange={v => set({ permesso_effettuato: v })} />
            </div>

            {/* 8. Info cliente autista / Info cliente */}
            <Row label="Info cliente autista:">
              <Input value={f.info_cliente_autista} onChange={e => set({ info_cliente_autista: e.target.value })} />
            </Row>
            <Row label="Info cliente:">
              <Input value={f.info_cliente} onChange={e => set({ info_cliente: e.target.value })} />
            </Row>
          </section>

          {/* Assegnazione (interna) */}
          <section className="bg-muted/40 rounded-md p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assegnazione interna</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Autista</Label>
                <Select value={f.autista_id} onValueChange={v => set({ autista_id: v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {autisti.map(a => <SelectItem key={a.id} value={a.id}>{a.cognome} {a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Veicolo (mezzo)</Label>
                <Select value={f.veicolo_id} onValueChange={v => set({ veicolo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {veicoli.map(v => <SelectItem key={v.id} value={v.id}>{v.targa} — {v.tipo_macchina || ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fornitore CS</Label>
                <Select value={f.fornitore_cs_id} onValueChange={v => set({ fornitore_cs_id: v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {fornitori.map(fr => <SelectItem key={fr.id} value={fr.id}>{fr.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stato</Label>
                <Select value={f.stato} onValueChange={v => set({ stato: v })} disabled={mode === "create"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATO_OPZIONI.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {mode === "edit" && f.stato === "da_confermare" && (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 w-full h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                    onClick={() => set({ stato: "confermato", modificato_da_cliente: false, modificato_at: null } as any)}
                  >
                    ✓ Conferma servizio
                  </Button>
                )}
                {mode === "create" && (
                  <p className="text-[10px] text-muted-foreground mt-1">Alla creazione lo stato è sempre "Nuovo".</p>
                )}
              </div>
            </div>
          </section>

          {/* 9. Pagamento */}
          <section className="bg-muted/40 rounded-md p-3 space-y-3">
            <Row label={<>Tipo pagamento: <span className="text-destructive">*</span></>}>
              <Select value={f.tipo_pagamento} onValueChange={v => set({ tipo_pagamento: v })}>
                <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                <SelectContent>
                  {PAGAMENTO_OPZIONI.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Row>

            {isAdmin && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2 border-t">
                  <MoneyField label="Prezzo fattura" value={f.prezzo_fattura} onChange={v => set({ prezzo_fattura: v })} />
                  <MoneyField label="Prezzo C.Credito" value={f.prezzo_ccredito} onChange={v => set({ prezzo_ccredito: v })} />
                  <MoneyField label="Prezzo contante" value={f.prezzo_contante} onChange={v => set({ prezzo_contante: v })} />
                  <MoneyField label="Com. Cliente" value={f.com_cliente} onChange={v => set({ com_cliente: v })} />
                  <MoneyField label="Commessione" value={f.costo_commissione} onChange={v => set({ costo_commissione: v })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <MoneyField label="Prezzo C non inc" value={f.non_incassato} onChange={v => set({ non_incassato: v })} />
                  <MoneyField label="Incasso €" value={f.incasso} onChange={v => set({ incasso: v })} />
                  <MoneyField label="Costo CS €" value={f.costo_cs} onChange={v => set({ costo_cs: v })} />
                  <MoneyField label="Costo Autista €" value={f.costo_autista} onChange={v => set({ costo_autista: v })} />
                  <MoneyField label="Costo centro €" value={f.costo_centro} onChange={v => set({ costo_centro: v })} />
                </div>
                <div>
                  <Label>Centro di costo (etichetta)</Label>
                  <Input value={f.centro_costo} onChange={e => set({ centro_costo: e.target.value })} placeholder="es. Marketing" />
                </div>
              </>
            )}
          </section>

          <section className="bg-muted/40 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accessori</p>
            </div>
            <AccessoriEditor value={accessoriRows} onChange={setAccessoriRows} />
          </section>

          <section className="bg-muted/40 rounded-md p-3">
            <Label>Note</Label>
            <Textarea value={f.note} onChange={e => set({ note: e.target.value })} className="min-h-[60px]" />
          </section>

          {mode === "edit" && (initialData?.stato_autista || initialData?.km_inizio_servizio != null) && (
            <section className="rounded-md border p-3 space-y-2 bg-background">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Stato autista: {initialData?.stato_autista ?? "—"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">Km inizio:</span> <b>{initialData?.km_inizio_servizio ?? "—"}</b></div>
                <div><span className="text-muted-foreground">Km fine:</span> <b>{initialData?.km_fine_servizio ?? "—"}</b></div>
                <div><span className="text-muted-foreground">Fine transfer:</span> <b>{initialData?.transfer_concluso_at ? new Date(initialData.transfer_concluso_at).toLocaleString("it-IT") : "—"}</b></div>
                <div><span className="text-muted-foreground">Fine disposizione:</span> <b>{initialData?.dispo_conclusa_at ? new Date(initialData.dispo_conclusa_at).toLocaleString("it-IT") : "—"}</b></div>
              </div>
              {(initialData?.transfer_nota_chiusura || initialData?.dispo_nota_chiusura) && (
                <div className="space-y-1 text-xs">
                  {initialData?.transfer_nota_chiusura && <div><b>Nota transfer:</b> {initialData.transfer_nota_chiusura}</div>}
                  {initialData?.dispo_nota_chiusura && <div><b>Nota disposizione:</b> {initialData.dispo_nota_chiusura}</div>}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvataggio…" : mode === "edit" ? "Salva modifiche" : "Crea Servizio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 items-center gap-3">
      <Label className="col-span-4 md:col-span-2 text-right font-semibold italic">{label}</Label>
      <div className="col-span-8 md:col-span-10">{children}</div>
    </div>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={v => onChange(!!v)} />
      <span className="italic font-medium">{label}</span>
    </label>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : +e.target.value)}
      />
    </div>
  );
}
