import { useEffect, useMemo, useRef, useState } from "react";
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
  TRANSFER_TIPO_OPZIONI,
  normalizeTransferTipo,
} from "@/lib/booking-shared";
import { AccessoriEditor, type AccessorioRow, loadServizioAccessori, saveServizioAccessori } from "./AccessoriEditor";
import { romeToday } from "@/lib/romeDate";
import { trovaConflitti } from "@/lib/conflittiAssegnazione";
import { useConflittoAssegnazione } from "@/components/ConflittoAssegnazioneDialog";
import { NetworkDispatchDialog } from "./NetworkDispatchDialog";
import { Send } from "lucide-react";
import { validaServizio, type ServizioErrors } from "@/lib/servizioValidation";
import CartelloUpload from "./CartelloUpload";
import { uploadCartelloFile, removeCartelloFile } from "@/lib/cartello";



const STATO_RADIO = [
  { value: "nuovo", label: "Nuovo" },
  { value: "da_confermare", label: "Da confermare" },
  { value: "confermato", label: "Confermato" },
  { value: "annullato", label: "Rifiutato" },
];

type Client = { id: string; name: string; company: string | null; phone?: string | null; sede_legale?: string | null; citta?: string | null };
type Autista = { id: string; nome: string; cognome: string };
type AutistaEsterno = { id: string; nome: string };
type Veicolo = { id: string; targa: string; tipo_macchina: string | null; marca?: string | null; modello?: string | null };
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
  veicolo_tipo: string | null;
  veicolo_id: string | null;
  autista_id: string | null;
  autista_esterno_id: string | null;
  fornitore_cs_id: string | null;
  client_id: string | null;
  utenza_id: string | null;
  created_by: string | null;
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
  autistiEsterni?: AutistaEsterno[];
  veicoli: Veicolo[];
  fornitori: Fornitore[];
  isAdmin: boolean;
  readOnly?: boolean;
  userId?: string;
  onSaved: (info?: { data_servizio?: string | null }) => void;
};

const emptyForm = (): any => ({
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
  info_interne: "",
  info_cliente_autista: "",
  info_cliente: "",
  veicolo_tipo: "",
  veicolo_id: "",
  autista_id: "",
  autista_esterno_id: "",
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
});

function n(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

export function ServizioFormDialog({
  open, onOpenChange, mode, initialData, clients, autisti, autistiEsterni = [], veicoli, fornitori, isAdmin, readOnly = false, userId, onSaved,
}: Props) {
  const [f, setF] = useState<any>(emptyForm());
  const [saving, setSaving] = useState<false | "crea" | "ripeti">(false);
  const savingRef = useRef(false);
  const [errors, setErrors] = useState<ServizioErrors>({});

  const [telefonoDTouched, setTelefonoDTouched] = useState(false);
  const [accessoriRows, setAccessoriRows] = useState<AccessorioRow[]>([]);
  const [autore, setAutore] = useState<string>("—");
  const [altriOpzioni, setAltriOpzioni] = useState<"network_cs" | "network_collaboratori" | "null">("null");
  const [fornitoriPartner, setFornitoriPartner] = useState<Record<string, string | null>>({});
  const [networkOpen, setNetworkOpen] = useState(false);
  const [stessoAutista, setStessoAutista] = useState(false);
  const { chiediConferma, dialog: conflittoDialog } = useConflittoAssegnazione();
  const [cartelloFile, setCartelloFile] = useState<File | null>(null);
  const [cartelloPath, setCartelloPath] = useState<string | null>(null);
  const [cartelloNome, setCartelloNome] = useState<string | null>(null);
  const [cartelloRimosso, setCartelloRimosso] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialData) {
      setF({ ...emptyForm(), ...initialData, stato: initialData.stato || "nuovo" });
      setTelefonoDTouched(true);
      setAltriOpzioni(initialData.fornitore_cs_id ? "network_cs" : "null");
      if (initialData.id) {
        loadServizioAccessori(initialData.id).then(setAccessoriRows);
      } else {
        setAccessoriRows([]);
      }
    } else {
      setF({ ...emptyForm(), stato: "nuovo" });
      setTelefonoDTouched(false);
      setAccessoriRows([]);
      setAltriOpzioni("null");
    }
    setStessoAutista(false);
    setCartelloFile(null);
    setCartelloRimosso(false);
    setCartelloPath((initialData as any)?.cartello_path ?? null);
    setCartelloNome((initialData as any)?.cartello_nome ?? null);
  }, [open, mode, initialData]);

  // Fornitori CS collegati a un partner del network
  useEffect(() => {
    if (!open) return;
    supabase.from("fornitori_cs").select("id, partner_org_id").then(({ data }) => {
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((r: any) => { map[r.id] = r.partner_org_id ?? null; });
      setFornitoriPartner(map);
    });
  }, [open]);

  // Autore (origine del servizio), sola lettura
  useEffect(() => {
    if (!open || mode !== "edit" || !initialData) { setAutore("—"); return; }
    let alive = true;
    (async () => {
      const d: any = initialData;
      if (d.fornitore_cs_id) { if (alive) setAutore("Da C.S"); return; }
      if (d.utenza_id) {
        const { data } = await supabase.from("client_utenze").select("nome, cognome").eq("id", d.utenza_id).maybeSingle();
        if (alive) setAutore(data ? `${data.nome} ${data.cognome ?? ""}`.trim() + " (portale cliente)" : "Portale cliente");
        return;
      }
      if (d.created_by) {
        const { data } = await supabase.from("profiles").select("full_name").eq("user_id", d.created_by).maybeSingle();
        if (alive) setAutore(data?.full_name ? `${data.full_name} (dashboard)` : "Operatore dashboard");
        return;
      }
      if (alive) setAutore("Portale cliente");
    })();
    return () => { alive = false; };
  }, [open, mode, initialData]);

  const set = (patch: any) => {
    setErrors(prev => {
      if (!Object.keys(prev).length) return prev;
      const next = { ...prev };
      Object.keys(patch).forEach(k => { delete next[k]; });
      if ("transfer_tipo" in patch || "disposizione_oraria" in patch || "tour_tipo" in patch) {
        delete next.transfer_tipo;
      }
      return next;
    });
    setF((prev: any) => ({ ...prev, ...patch }));
  };


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

  // Autista combinato interni + esterni
  const autistaValue = f.autista_id ? `int:${f.autista_id}` : f.autista_esterno_id ? `est:${f.autista_esterno_id}` : "";
  const setAutistaValue = (v: string) => {
    if (v === "none") { set({ autista_id: "", autista_esterno_id: "" }); return; }
    const [kind, id] = v.split(":");
    set(kind === "int" ? { autista_id: id, autista_esterno_id: "" } : { autista_id: "", autista_esterno_id: id });
  };

  // Veicoli: quelli del tipo richiesto in evidenza
  const [veicoliMatch, veicoliAltri] = useMemo(() => {
    const tipo = norm(f.veicolo_tipo);
    if (!tipo) return [[], veicoli] as [Veicolo[], Veicolo[]];
    const match = veicoli.filter(v =>
      norm(v.tipo_macchina) === tipo ||
      norm(v.tipo_macchina).includes(tipo) ||
      (!!v.tipo_macchina && tipo.includes(norm(v.tipo_macchina))) ||
      norm(v.modello).includes(tipo)
    );
    const ids = new Set(match.map(v => v.id));
    return [match, veicoli.filter(v => !ids.has(v.id))] as [Veicolo[], Veicolo[]];
  }, [veicoli, f.veicolo_tipo]);

  // "Utilizza stesso autista": riprende l'autista dell'ultimo servizio dello stesso cliente
  const applicaStessoAutista = async (checked: boolean) => {
    setStessoAutista(checked);
    if (!checked || !f.client_id) return;
    const { data } = await supabase
      .from("servizi")
      .select("autista_id, autista_esterno_id, veicolo_id, data_servizio")
      .eq("client_id", f.client_id)
      .neq("id", initialData?.id ?? "00000000-0000-0000-0000-000000000000")
      .or("autista_id.not.is.null,autista_esterno_id.not.is.null")
      .order("data_servizio", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) { toast.info("Nessun servizio precedente con autista per questo cliente"); return; }
    set({
      autista_id: (data as any).autista_id || "",
      autista_esterno_id: (data as any).autista_esterno_id || "",
      veicolo_id: (data as any).veicolo_id || f.veicolo_id,
    });
    toast.success("Autista dell'ultimo servizio del cliente applicato");
  };

  const verificaConflitti = async (): Promise<boolean> => {
    const target = {
      id: initialData?.id ?? "00000000-0000-0000-0000-000000000000",
      data_servizio: f.data_servizio,
      ora_inizio: f.ora_inizio,
      disposizione_oraria: f.disposizione_oraria,
      tipologia: f.tour_tipo ? "tour" : f.disposizione_oraria ? "disposizione" : "transfer",
    };
    // In modifica la finestra temporale può cambiare pur restando la stessa risorsa:
    // in quel caso il controllo va rifatto comunque.
    const finestraCambiata =
      !initialData ||
      f.data_servizio !== (initialData.data_servizio ?? "") ||
      (f.ora_inizio || "") !== (initialData.ora_inizio ?? "") ||
      (f.disposizione_oraria || "") !== (initialData.disposizione_oraria ?? "") ||
      (f.tour_tipo || "") !== (initialData.tour_tipo ?? "");

    if (f.autista_id && (finestraCambiata || f.autista_id !== initialData?.autista_id)) {
      const a = autisti.find(x => x.id === f.autista_id);
      const c = await trovaConflitti(target, { tipo: "autista_interno", id: f.autista_id });
      if (c.length && !(await chiediConferma({ risorsa: `l'autista ${a ? `${a.nome} ${a.cognome}` : ""}`.trim(), conflitti: c }))) return false;
    }
    if (f.autista_esterno_id && (finestraCambiata || f.autista_esterno_id !== initialData?.autista_esterno_id)) {
      const a = autistiEsterni.find(x => x.id === f.autista_esterno_id);
      const c = await trovaConflitti(target, { tipo: "autista_esterno", id: f.autista_esterno_id });
      if (c.length && !(await chiediConferma({ risorsa: `l'autista ${a?.nome ?? "esterno"}`, conflitti: c }))) return false;
    }
    if (f.veicolo_id && (finestraCambiata || f.veicolo_id !== initialData?.veicolo_id)) {
      const v = veicoli.find(x => x.id === f.veicolo_id);
      const c = await trovaConflitti(target, { tipo: "veicolo", id: f.veicolo_id });
      if (c.length && !(await chiediConferma({ risorsa: `il veicolo ${v?.targa ?? ""}`.trim(), conflitti: c }))) return false;
    }
    return true;
  };


  const handleSubmit = async (opts?: { ripeti?: boolean }) => {
    if (savingRef.current) return; // guardia anti doppio click (immediata, non attende il render)
    savingRef.current = true;
    setSaving(opts?.ripeti ? "ripeti" : "crea");
    const rilascia = () => { savingRef.current = false; setSaving(false); };
    const errs = validaServizio(f as any);
    setErrors(errs);
    const lista = Object.values(errs).filter((m): m is string => !!m);
    if (lista.length) {
      toast.error(lista[0], {
        description: lista.length > 1 ? `Altri ${lista.length - 1} campi da correggere` : undefined,
      });
      rilascia();
      return;
    }

    if (!(await verificaConflitti())) { rilascia(); return; }

    // Possibile doppio invio: avvisa (non blocca) se esiste un servizio identico creato da poco.
    if (mode !== "edit") {
      const daQuando = new Date(Date.now() - 60_000).toISOString();
      let q = supabase
        .from("servizi")
        .select("id")
        .gte("created_at", daQuando)
        .eq("data_servizio", f.data_servizio as any)
        .eq("ora_inizio", (f.ora_inizio || "") as any)
        .eq("contatto", (f.contatto || "") as any)
        .eq("luogo_inizio", (f.luogo_inizio || "") as any)
        .eq("luogo_fine", (f.luogo_fine || "") as any)
        .limit(1);
      q = f.client_id ? q.eq("client_id", f.client_id) : q.is("client_id", null);
      const { data: simili } = await q;
      if (simili?.length && !window.confirm("Esiste già un servizio identico creato pochi secondi fa. Vuoi crearlo comunque?")) {
        rilascia();
        return;
      }
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
      autista_esterno_id: f.autista_esterno_id || null,
      fornitore_cs_id: altriOpzioni === "network_cs" ? (f.fornitore_cs_id || null) : null,
      client_id: f.client_id || null,
      contatto: f.contatto || null,
      telefono_contatto: f.telefono_contatto || null,
      telefono_d: f.telefono_d || null,
      email_contatto: f.email_contatto || null,
      n_passeggeri: f.n_passeggeri ?? 1,
      n_bagagli: f.n_bagagli ?? 0,
      info_autista: f.info_autista || null,
      info_interne: f.info_interne || null,
      info_cliente_autista: f.info_cliente_autista || null,
      info_cliente: f.info_cliente || null,
      tipo_pagamento: f.tipo_pagamento || null,
      codice: f.codice || null,
      centro_costo: f.centro_costo || null,
      note: f.note || null,
    };

    // Conferma esplicita dello stato: azzera il flag modificato_da_cliente
    // (stessa logica delle azioni "Conferma" nella tabella servizi).
    if (mode === "edit" && f.stato === "confermato" && initialData?.stato !== "confermato") {
      payload.modificato_da_cliente = false;
      payload.modificato_at = null;
    }
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
        incasso: n(f.incasso),
      });
    }

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
      try {
        const oldPath = (initialData as any)?.cartello_path ?? null;
        if ((cartelloRimosso || cartelloFile) && oldPath) {
          await removeCartelloFile(oldPath);
        }
        if (cartelloFile) {
          let orgId = (initialData as any)?.org_id ?? null;
          if (!orgId) {
            const { data: row } = await supabase.from("servizi").select("org_id").eq("id", servizioId).maybeSingle();
            orgId = (row as any)?.org_id ?? null;
          }
          if (orgId) {
            const path = await uploadCartelloFile(orgId, servizioId, cartelloFile);
            await supabase.from("servizi").update({ cartello_path: path, cartello_nome: cartelloFile.name } as any).eq("id", servizioId);
          }
        } else if (cartelloRimosso) {
          await supabase.from("servizi").update({ cartello_path: null, cartello_nome: null } as any).eq("id", servizioId);
        }
      } catch (e: any) {
        console.error("[cartello] save error", e);
        toast.error("Servizio salvato ma caricamento cartello fallito");
      }
      try { await saveServizioAccessori(servizioId, accessoriRows); } catch (e: any) {
        console.error("[accessori] save error", e);
      }
    }
    setSaving(false);
    savingRef.current = false;
    if (error) {
      // Il database applica le stesse regole sui campi obbligatori: mostra il messaggio così com'è.
      setErrors({ form: error.message });
      toast.error(error.message);
      return;
    }
    setErrors({});

    if (opts?.ripeti) {
      // Mantiene i dati del cliente dall'intestazione fino a N. Bagagli, svuota il resto.
      setF({
        ...emptyForm(),
        citta: f.citta,
        client_id: f.client_id,
        codice: f.codice,
        contatto: f.contatto,
        email_contatto: f.email_contatto,
        telefono_contatto: f.telefono_contatto,
        telefono_d: f.telefono_d,
        n_passeggeri: f.n_passeggeri,
        n_bagagli: f.n_bagagli,
      });
      setAccessoriRows([]);
      setCartelloFile(null);
      setCartelloPath(null);
      setCartelloNome(null);
      setCartelloRimosso(false);
      setStessoAutista(false);
      setAltriOpzioni("null");
      toast.success("Servizio creato — puoi inserirne un altro");
      onSaved({ data_servizio: (payload as any).data_servizio ?? null });
      return;
    }

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

        {Object.keys(errors).length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold mb-1">Correggi i campi obbligatori:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {Object.entries(errors).map(([k, msg]) => <li key={k}>{msg}</li>)}
            </ul>
          </div>
        )}



        {readOnly && (
          <div className="rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground text-center">
            Sola lettura: il tuo ruolo non consente di modificare i servizi.
          </div>
        )}

        <fieldset disabled={readOnly} className="space-y-4 text-sm disabled:opacity-100">
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

          {/* 2. Per Conto di + indirizzo/telefono società + Telefono + Codice */}
          <section className="bg-muted/40 rounded-md p-3 space-y-2">
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
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-start-3 md:col-span-10 text-xs italic text-muted-foreground">
                {selectedClient
                  ? [selectedClient.sede_legale, selectedClient.citta].filter(Boolean).join(" — ") || "Indirizzo società non impostato"
                  : "Seleziona la società per vedere indirizzo e telefono"}
              </div>
            </div>
          </section>

          {/* 3. Autore + anagrafica passeggero */}
          <section className="bg-muted/40 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-12 items-center gap-3">
              <Label className="col-span-4 md:col-span-2 text-right font-semibold italic">Autore:</Label>
              <div className="col-span-8 md:col-span-10 text-xs font-medium">{mode === "edit" ? autore : "Nuovo inserimento (dashboard)"}</div>
            </div>
            <Row label="Cliente:">
              <div className="space-y-1.5">
                <Input value={f.contatto} onChange={e => set({ contatto: e.target.value })} />
                <CartelloUpload
                  path={cartelloPath}
                  nome={cartelloNome}
                  file={cartelloFile}
                  onFile={setCartelloFile}
                  onRemoveExisting={() => { setCartelloRimosso(true); setCartelloPath(null); setCartelloNome(null); setCartelloFile(null); }}
                  disabled={readOnly}
                />
              </div>
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
                  value={normalizeTransferTipo(f.transfer_tipo)}
                  onValueChange={v => set({ transfer_tipo: v, disposizione_oraria: "", tour_tipo: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    {TRANSFER_TIPO_OPZIONI.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}

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
            <Row label="Info interne:">
              <Input value={f.info_interne} onChange={e => set({ info_interne: e.target.value })} />
            </Row>



            <Row label="Info cliente autista:">
              <Input value={f.info_cliente_autista} onChange={e => set({ info_cliente_autista: e.target.value })} />
            </Row>
            <Row label="Info cliente:">
              <Input value={f.info_cliente} onChange={e => set({ info_cliente: e.target.value })} />
            </Row>
          </section>

          {/* 7. Accessori */}
          <section className="bg-primary/5 rounded-md p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accessori</p>
            <AccessoriEditor value={accessoriRows} onChange={setAccessoriRows} />
          </section>

          {/* 8. Pagamento */}
          <section className="bg-primary/5 rounded-md p-3 space-y-3">
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
              </>
            )}
          </section>

          {/* 9. Assegnazione (autista + macchina) */}
          <section className="rounded-md p-3 space-y-2 bg-[hsl(60_45%_60%/0.25)] border border-[hsl(60_45%_45%/0.4)]">
            <div className="grid grid-cols-12 items-center gap-3">
              <Label className="col-span-4 md:col-span-2 text-right font-semibold italic">Autista:</Label>
              <div className="col-span-8 md:col-span-5">
                <Select value={autistaValue || "none"} onValueChange={setAutistaValue}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">--- Nessun autista ---</SelectItem>
                    {autisti.map(a => (
                      <SelectItem key={a.id} value={`int:${a.id}`}>{a.cognome} {a.nome} ( Interno )</SelectItem>
                    ))}
                    {autistiEsterni.map(a => (
                      <SelectItem key={a.id} value={`est:${a.id}`}>{a.nome} ( Esterno )</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-3">
              <Label className="col-span-4 md:col-span-2 text-right font-semibold italic">Macchina:</Label>
              <div className="col-span-8 md:col-span-5">
                <Select value={f.veicolo_id || "none"} onValueChange={v => set({ veicolo_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">--- Nessun veicolo ---</SelectItem>
                    {veicoliMatch.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Tipo richiesto: {f.veicolo_tipo}</div>
                        {veicoliMatch.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {(v.tipo_macchina || [v.marca, v.modello].filter(Boolean).join(" ")) + " : " + v.targa}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Altri veicoli</div>
                      </>
                    )}
                    {veicoliAltri.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {(v.tipo_macchina || [v.marca, v.modello].filter(Boolean).join(" ")) + " : " + v.targa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-center pt-1">
              <CheckboxRow label="Utilizza stesso autista" checked={stessoAutista} onChange={applicaStessoAutista} />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Le sovrapposizioni con altri servizi vengono verificate al salvataggio.
            </p>
          </section>

          {/* 10-11. Centro interno città + Altri opzioni */}
          <section className="rounded-md p-3 space-y-3 bg-[hsl(60_80%_75%/0.35)] border border-[hsl(60_60%_50%/0.35)]">
            <div className="grid grid-cols-12 items-center gap-3">
              <Label className="col-span-5 md:col-span-4 text-right font-semibold italic">Centro interno Città:</Label>
              <div className="col-span-7 md:col-span-4">
                <Select value={f.centro_costo || "none"} onValueChange={v => set({ centro_costo: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">---</SelectItem>
                    {CITTA_OPZIONI.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-12 items-start gap-3">
              <Label className="col-span-5 md:col-span-4 text-right font-semibold italic">Altri opzioni:</Label>
              <div className="col-span-7 md:col-span-8 space-y-2">
                <div className="flex flex-wrap gap-4">
                  {([
                    { v: "network_cs", l: "Network CS" },
                    { v: "network_collaboratori", l: "Network Collaboratori" },
                    { v: "null", l: "Null" },
                  ] as const).map(o => (
                    <label key={o.v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="altri-opzioni"
                        checked={altriOpzioni === o.v}
                        onChange={() => {
                          setAltriOpzioni(o.v);
                          if (o.v !== "network_cs") set({ fornitore_cs_id: "" });
                        }}
                      />
                      <span className="italic font-medium">{o.l}</span>
                    </label>
                  ))}
                </div>

                {altriOpzioni === "network_cs" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={f.fornitore_cs_id || "none"} onValueChange={v => set({ fornitore_cs_id: v === "none" ? "" : v })}>
                      <SelectTrigger className="w-64"><SelectValue placeholder="Fornitore CS…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">---</SelectItem>
                        {fornitori.map(fr => (
                          <SelectItem key={fr.id} value={fr.id}>
                            {fr.nome}{fornitoriPartner[fr.id] ? " · partner network" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mode === "edit" && initialData?.id && (
                      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setNetworkOpen(true)}>
                        <Send className="h-3.5 w-3.5" /> Passaggio al network
                      </Button>
                    )}
                  </div>
                )}
                {altriOpzioni === "network_collaboratori" && (
                  <p className="text-[11px] text-muted-foreground">
                    Assegna il servizio a un autista esterno (collaboratore) nella sezione Assegnazione.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 12. Stato */}
          <section className="rounded-md p-3 bg-muted/40">
            <div className="flex flex-wrap items-center justify-center gap-6">
              <span className="font-semibold italic">Stato :</span>
              {STATO_RADIO.map(s => (
                <label key={s.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <span className="font-medium">{s.label}</span>
                  <input
                    type="radio"
                    name="stato-servizio"
                    disabled={mode === "create"}
                    checked={f.stato === s.value}
                    onChange={() => set({ stato: s.value })}
                  />
                </label>
              ))}
            </div>
            {mode === "create" && (
              <p className="text-[10px] text-muted-foreground mt-1 text-center">Alla creazione lo stato è sempre "Nuovo".</p>
            )}
            {["in_corso", "completato"].includes(f.stato) && (
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                Stato corrente: <b>{f.stato}</b> (gestito dall'app autista)
              </p>
            )}
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
        </fieldset>

        <div className="flex justify-end gap-2 pt-2 border-t">
          {readOnly && <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>}
          {!readOnly && mode === "create" && (
            <Button variant="secondary" onClick={() => handleSubmit({ ripeti: true })} disabled={!!saving}>
              {saving === "ripeti" ? "Creazione…" : "Ripeti"}
            </Button>
          )}
          {!readOnly && (
            <Button onClick={() => handleSubmit()} disabled={!!saving}>
              {saving === "crea" ? (mode === "edit" ? "Salvataggio…" : "Creazione…") : mode === "edit" ? "Fine" : "Crea Servizio"}
            </Button>
          )}
        </div>

        {conflittoDialog}
        <NetworkDispatchDialog
          open={networkOpen}
          onOpenChange={setNetworkOpen}
          servizioId={initialData?.id ?? null}
        />
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
