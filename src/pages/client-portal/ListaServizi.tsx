import { useEffect, useState } from "react";
import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { supabase } from "@/integrations/supabase/client";
import CartelloUpload from "@/components/servizi/CartelloUpload";
import { uploadCartelloFile, removeCartelloFile, validateCartelloFile } from "@/lib/cartello";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { Search, Download, CalendarDays, Pencil, XCircle, Info, ChevronRight, MapPin, Clock, Users, Car, Lock, Paperclip, Upload, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import {
  VEICOLI_DISPONIBILI,
  TIPOLOGIA_OPZIONI,
  TOUR_OPZIONI,
  PAGAMENTO_OPZIONI,
  CITTA_OPZIONI,
  detectLuogoSpeciale,
  LuogoField,
  splitLuogo,
  joinLuogo,
  tipologiaFromDB,
  tipologiaToDB,
  transferTipoForDB,
} from "@/lib/booking-shared";
import { AccessoriEditor, type AccessorioRow, loadServizioAccessori, saveServizioAccessori } from "@/components/servizi/AccessoriEditor";
import {
  BookingFormFields,
  emptyBookingForm,
  deriveTipologia,
  servizioToBookingForm,
  type BookingFormState,
} from "@/components/booking/BookingFormFields";

type Servizio = {
  id: string;
  data_servizio: string;
  ora_inizio: string | null;
  citta: string | null;
  contatto: string | null;
  telefono_contatto: string | null;
  email_contatto: string | null;
  n_passeggeri: number | null;
  n_bagagli: number | null;
  tipologia: string | null;
  transfer_tipo: string | null;
  disposizione_oraria: string | null;
  tour_tipo: string | null;
  luogo_inizio: string | null;
  itinerario: string | null;
  luogo_fine: string | null;
  info_autista: string | null;
  veicolo_tipo: string | null;
  tipo_pagamento: string | null;
  prezzo: number | null;
  centro_costo: string | null;
  stato: string;
  codice: string | null;
  note: string | null;
  accessori: string | null;
  modificato_da_cliente?: boolean | null;
  autista_id?: string | null;
  autista_esterno_id?: string | null;
  utenza_id?: string | null;
  org_id?: string | null;
  allegato_path?: string | null;
  allegato_nome?: string | null;
  cartello_path?: string | null;
  cartello_nome?: string | null;
};

const ALLOWED_FILE_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function computeClientStato(s: Servizio): { label: string; className: string } {
  if (s.modificato_da_cliente) {
    return { label: "In attesa", className: "bg-amber-100 text-amber-700 border-amber-200" };
  }
  // L'autista è visibile al cliente solo da CONFERMATO in poi.
  const driverVisible =
    !!(s.autista_id || s.autista_esterno_id) &&
    (s.stato === "confermato" || s.stato === "in_corso" || s.stato === "completato");
  if (!driverVisible && (s.stato === "nuovo" || s.stato === "da_confermare" || s.stato === "confermato")) {
    return { label: "In attesa", className: "bg-amber-100 text-amber-700 border-amber-200" };
  }
  return statoConfig[s.stato] ?? { label: s.stato, className: "bg-muted" };
}

function canModify(s: Servizio): boolean {
  if (s.stato === "annullato" || s.stato === "completato") return false;
  if (!s.ora_inizio || !s.data_servizio) return true;
  const serviceDate = new Date(`${s.data_servizio}T${s.ora_inizio}`);
  const now = new Date();
  return (serviceDate.getTime() - now.getTime()) / (1000 * 60 * 60) > 12;
}

function buildTipoServizio(s: Servizio): string {
  const parts: string[] = [];
  if (s.transfer_tipo) parts.push(`Transfer: ${s.transfer_tipo}`);
  if (s.disposizione_oraria) parts.push(`Disp.: ${s.disposizione_oraria}`);
  if (s.tour_tipo) parts.push(`Tour: ${s.tour_tipo}`);
  if (parts.length === 0 && s.tipologia) return s.tipologia;
  return parts.join(" / ") || "—";
}

function buildTipoShort(s: Servizio): string {
  if (s.tour_tipo) return "Tour";
  if (s.transfer_tipo && s.disposizione_oraria) return "Transfer + Disp.";
  if (s.transfer_tipo) return "Transfer";
  if (s.disposizione_oraria) return "Disposizione";
  return s.tipologia ?? "—";
}

const pagamentoLabel: Record<string, string> = {
  fattura: "Fattura",
  contante: "Contante",
  carta_credito: "C. Credito",
};

const statoConfig: Record<string, { label: string; className: string }> = {
  nuovo: { label: "Nuovo", className: "bg-blue-100 text-blue-700 border-blue-200" },
  da_confermare: { label: "In lavorazione", className: "bg-orange-100 text-orange-700 border-orange-200" },
  confermato: { label: "Confermato", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  in_corso: { label: "In corso", className: "bg-amber-100 text-amber-700 border-amber-200" },
  completato: { label: "Completato", className: "bg-green-100 text-green-700 border-green-200" },
  annullato: { label: "Annullato", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-2">
      <span className="text-xs text-muted-foreground font-medium shrink-0">{label}</span>
      <span className="text-sm text-right ml-4">{value}</span>
    </div>
  );
}

export default function ListaServizi() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [utenzaFilter, setUtenzaFilter] = useState<string>("all");
  const [utenze, setUtenze] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [isParentClient, setIsParentClient] = useState(false);

  // Detail sheet
  const [selected, setSelected] = useState<Servizio | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<BookingFormState>(emptyBookingForm);
  const [editAccessori, setEditAccessori] = useState<AccessorioRow[]>([]);
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editPasseggeri, setEditPasseggeri] = useState<{ id: string; nome: string; cognome: string | null; telefono: string | null; email: string | null }[]>([]);
  const [autoreName, setAutoreName] = useState<string>("");

  const loadServizi = async () => {
    if (!user) return;
    // Resolve client_id whether user is parent or utenza
    const { data: parentClient } = await supabase
      .from("clients")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    let clientIdResolved: string | null = parentClient?.id ?? null;
    let utenzaSingoloId: string | null = null;
    if (parentClient) {
      setIsParentClient(true);
    } else {
      const { data: utenza } = await supabase
        .from("client_utenze")
        .select("id, parent_client_id, tipo")
        .eq("auth_user_id", user.id)
        .eq("attivo", true)
        .maybeSingle();
      clientIdResolved = utenza?.parent_client_id ?? null;
      if (utenza?.tipo === "singolo") utenzaSingoloId = utenza.id;
      setIsParentClient(false);
    }
    if (!clientIdResolved) { setLoading(false); return; }

    // Load utenze list (only the parent client uses the filter)
    if (parentClient) {
      const { data: utenzeData } = await supabase
        .from("client_utenze")
        .select("id, nome, cognome")
        .eq("parent_client_id", clientIdResolved)
        .order("nome");
      setUtenze(utenzeData ?? []);
    }

    let query = supabase
      .from("servizi")
      .select("*")
      .eq("client_id", clientIdResolved)
      .eq("archiviato", false)
      .order("data_servizio", { ascending: false });

    if (dateFrom) query = query.gte("data_servizio", dateFrom);
    if (dateTo) query = query.lte("data_servizio", dateTo);
    if (parentClient && utenzaFilter !== "all") {
      if (utenzaFilter === "__direct__") {
        query = query.is("utenza_id", null);
      } else {
        query = query.eq("utenza_id", utenzaFilter);
      }
    }
    // Utenza "singolo": vede SOLO i propri servizi, mai quelli del parent o di altre utenze
    if (utenzaSingoloId) {
      query = query.eq("utenza_id", utenzaSingoloId);
    }

    const { data } = await query;
    setServizi((data ?? []) as Servizio[]);
    setLoading(false);
  };

  useEffect(() => { loadServizi(); }, [user, dateFrom, dateTo, utenzaFilter]);

  // Realtime: aggiorna la lista quando il proprietario riassegna/conferma l'autista
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("client-servizi-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servizi" },
        () => { loadServizi(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = servizi.filter((s) =>
    (s.contatto ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.citta ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.codice ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openDetail = (s: Servizio) => {
    setSelected(s);
    setDetailOpen(true);
  };

  const openEdit = async (s: Servizio) => {
    setSelected(s);
    setEditForm(servizioToBookingForm(s));
    loadServizioAccessori(s.id).then(setEditAccessori);
    setEditClientId(null);
    setEditOrgId(s.org_id ?? null);
    setEditPasseggeri([]);
    // Resolve client_id, passeggeri and autore for the shared form
    if (user) {
      const { data: parent } = await supabase
        .from("clients")
        .select("id, org_id, name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      let cid: string | null = null;
      let oid: string | null = null;
      let autore = "";
      if (parent) {
        cid = parent.id; oid = parent.org_id; autore = parent.name ?? user.email ?? "";
      } else {
        const { data: utenza } = await supabase
          .from("client_utenze")
          .select("nome, cognome, parent_client_id, clients:parent_client_id(id, org_id)")
          .eq("auth_user_id", user.id)
          .eq("attivo", true)
          .maybeSingle();
        if (utenza) {
          cid = (utenza as any).parent_client_id;
          oid = (utenza as any).clients?.org_id ?? null;
          autore = `${utenza.nome ?? ""} ${utenza.cognome ?? ""}`.trim() || (user.email ?? "");
        }
      }
      setEditClientId(cid);
      setEditOrgId(oid ?? s.org_id ?? null);
      setAutoreName(autore);
      if (cid) {
        const { data: pass } = await supabase
          .from("passeggeri_rubrica")
          .select("id, nome, cognome, telefono, email")
          .eq("client_id", cid)
          .order("nome");
        setEditPasseggeri(pass ?? []);
      }
    }
    setDetailOpen(false);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;

    const luogoInizioFinale = joinLuogo(editForm.luogo_inizio, editForm.luogo_inizio_dettaglio);
    const luogoFineFinale = joinLuogo(editForm.luogo_fine, editForm.luogo_fine_dettaglio);
    const t = deriveTipologia(editForm);

    const { error } = await supabase.rpc("client_portal_update_servizio", {
      _servizio_id: selected.id,
      _data_servizio: editForm.data_servizio || null,
      _ora_inizio: editForm.ora_inizio || null,
      _citta: editForm.citta || null,
      _n_passeggeri: editForm.n_passeggeri ? parseInt(editForm.n_passeggeri) : null,
      _n_bagagli: editForm.n_bagagli ? parseInt(editForm.n_bagagli) : null,
      _tipologia: t.tipologia as any,
      _transfer_tipo: t.transfer_tipo,
      _disposizione_oraria: t.disposizione_oraria,
      _tour_tipo: t.tour_tipo,
      _veicolo_tipo: editForm.veicolo_tipo || null,
      _luogo_inizio: luogoInizioFinale || null,
      _luogo_fine: luogoFineFinale || null,
      _itinerario: editForm.itinerario || null,
      _info_autista: editForm.info_autista || null,
      _tipo_pagamento: editForm.tipo_pagamento || null,
      _centro_costo: editForm.centro_costo || null,
      _accessori: null,
      _note: editForm.note || null,
      _allegato_nome: selected.allegato_nome ?? null,
    });

    if (error) {
      console.error("[handleSaveEdit] RPC error:", error);
      toast.error(`Errore: ${error.message}`);
      return;
    }
    try {
      await saveServizioAccessori(selected.id, editAccessori);
    } catch (e) { console.error(e); }
    toast.success("Servizio aggiornato");
    setEditOpen(false);
    loadServizi();
  };


  const handleCancel = async (s: Servizio) => {
    if (!canModify(s)) {
      toast.error("Non è possibile annullare: mancano meno di 12 ore al servizio");
      return;
    }
    if (!window.confirm("Sei sicuro di voler annullare questo servizio?")) return;

    const { error } = await supabase.rpc("client_portal_update_servizio", {
      _servizio_id: s.id,
      _data_servizio: s.data_servizio,
      _ora_inizio: s.ora_inizio,
      _citta: s.citta,
      _n_passeggeri: s.n_passeggeri,
      _n_bagagli: s.n_bagagli,
      _tipologia: s.tipologia as any,
      _transfer_tipo: s.transfer_tipo,
      _disposizione_oraria: s.disposizione_oraria,
      _tour_tipo: s.tour_tipo,
      _veicolo_tipo: s.veicolo_tipo,
      _luogo_inizio: s.luogo_inizio,
      _luogo_fine: s.luogo_fine,
      _itinerario: s.itinerario,
      _info_autista: s.info_autista,
      _tipo_pagamento: s.tipo_pagamento,
      _centro_costo: s.centro_costo,
      _accessori: s.accessori,
      _note: s.note,
      _allegato_nome: s.allegato_nome ?? null,
      _cancel: true,
    });

    if (error) {
      toast.error("Errore nell'annullamento");
    } else {
      toast.success("Servizio annullato");
      setDetailOpen(false);
      loadServizi();
    }
  };

  const downloadAllegato = async (s: Servizio) => {
    if (!s.allegato_path) return;
    const { data, error } = await supabase.storage
      .from("servizi-allegati")
      .createSignedUrl(s.allegato_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Impossibile scaricare l'allegato");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const uploadAllegato = async (s: Servizio, file: File) => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("Formato non supportato (PNG, JPG, PDF, Word, Excel)");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File troppo grande (max 10MB)");
      return;
    }
    let orgId = s.org_id;
    if (!orgId) {
      const { data: srv } = await supabase.from("servizi").select("org_id").eq("id", s.id).maybeSingle();
      orgId = srv?.org_id ?? null;
    }
    if (!orgId) { toast.error("Errore: organizzazione non trovata"); return; }

    if (s.allegato_path) {
      await supabase.storage.from("servizi-allegati").remove([s.allegato_path]);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${orgId}/${s.id}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("servizi-allegati")
      .upload(path, file, { upsert: false });
    if (upErr) {
      toast.error("Errore caricamento file");
      return;
    }

    const { error: updErr } = await supabase.rpc("client_portal_update_servizio", {
      _servizio_id: s.id,
      _data_servizio: s.data_servizio,
      _ora_inizio: s.ora_inizio,
      _citta: s.citta,
      _n_passeggeri: s.n_passeggeri,
      _n_bagagli: s.n_bagagli,
      _tipologia: s.tipologia as any,
      _transfer_tipo: s.transfer_tipo,
      _disposizione_oraria: s.disposizione_oraria,
      _tour_tipo: s.tour_tipo,
      _veicolo_tipo: s.veicolo_tipo,
      _luogo_inizio: s.luogo_inizio,
      _luogo_fine: s.luogo_fine,
      _itinerario: s.itinerario,
      _info_autista: s.info_autista,
      _tipo_pagamento: s.tipo_pagamento,
      _centro_costo: s.centro_costo,
      _accessori: s.accessori,
      _note: s.note,
      _allegato_path: path,
      _allegato_nome: file.name,
    });
    if (updErr) {
      toast.error("Errore aggiornamento servizio");
      return;
    }

    toast.success("Allegato caricato");
    loadServizi();
  };

  const rpcBaseArgs = (s: Servizio) => ({
    _servizio_id: s.id,
    _data_servizio: s.data_servizio,
    _ora_inizio: s.ora_inizio,
    _citta: s.citta,
    _n_passeggeri: s.n_passeggeri,
    _n_bagagli: s.n_bagagli,
    _tipologia: s.tipologia as any,
    _transfer_tipo: s.transfer_tipo,
    _disposizione_oraria: s.disposizione_oraria,
    _tour_tipo: s.tour_tipo,
    _veicolo_tipo: s.veicolo_tipo,
    _luogo_inizio: s.luogo_inizio,
    _luogo_fine: s.luogo_fine,
    _itinerario: s.itinerario,
    _info_autista: s.info_autista,
    _tipo_pagamento: s.tipo_pagamento,
    _centro_costo: s.centro_costo,
    _accessori: s.accessori,
    _note: s.note,
    _allegato_path: s.allegato_path ?? null,
    _allegato_nome: s.allegato_nome ?? null,
  });

  const uploadCartello = async (s: Servizio, file: File) => {
    const err = validateCartelloFile(file);
    if (err) { toast.error(err); return; }
    let orgId = s.org_id;
    if (!orgId) {
      const { data: srv } = await supabase.from("servizi").select("org_id").eq("id", s.id).maybeSingle();
      orgId = (srv as any)?.org_id ?? null;
    }
    if (!orgId) { toast.error("Errore: organizzazione non trovata"); return; }
    if (s.cartello_path) await removeCartelloFile(s.cartello_path);
    let path: string;
    try {
      path = await uploadCartelloFile(orgId, s.id, file);
    } catch (e: any) {
      toast.error("Errore caricamento cartello");
      return;
    }
    const { error } = await supabase.rpc("client_portal_update_servizio" as any, {
      ...rpcBaseArgs(s),
      _cartello_path: path,
      _cartello_nome: file.name,
    });
    if (error) { toast.error("Errore aggiornamento servizio"); return; }
    toast.success("Cartello caricato");
    loadServizi();
  };

  const deleteCartello = async (s: Servizio) => {
    if (!s.cartello_path) return;
    if (!window.confirm("Eliminare il cartello?")) return;
    await removeCartelloFile(s.cartello_path);
    const { error } = await supabase.rpc("client_portal_update_servizio" as any, {
      ...rpcBaseArgs(s),
      _remove_cartello: true,
    });
    if (error) { toast.error("Errore aggiornamento servizio"); return; }
    toast.success("Cartello rimosso");
    loadServizi();
  };

  const deleteAllegato = async (s: Servizio) => {
    if (!s.allegato_path) return;
    if (!window.confirm("Eliminare l'allegato?")) return;

    await supabase.storage.from("servizi-allegati").remove([s.allegato_path]);
    const { error } = await supabase.rpc("client_portal_update_servizio", {
      _servizio_id: s.id,
      _data_servizio: s.data_servizio,
      _ora_inizio: s.ora_inizio,
      _citta: s.citta,
      _n_passeggeri: s.n_passeggeri,
      _n_bagagli: s.n_bagagli,
      _tipologia: s.tipologia as any,
      _transfer_tipo: s.transfer_tipo,
      _disposizione_oraria: s.disposizione_oraria,
      _tour_tipo: s.tour_tipo,
      _veicolo_tipo: s.veicolo_tipo,
      _luogo_inizio: s.luogo_inizio,
      _luogo_fine: s.luogo_fine,
      _itinerario: s.itinerario,
      _info_autista: s.info_autista,
      _tipo_pagamento: s.tipo_pagamento,
      _centro_costo: s.centro_costo,
      _accessori: s.accessori,
      _note: s.note,
      _remove_allegato: true,
    });
    if (error) {
      toast.error("Errore eliminazione");
      return;
    }

    toast.success("Allegato eliminato");
    loadServizi();
  };

  const exportExcel = () => {
    const headers = ["Città", "Data", "Ora", "Passeggero", "N.P", "N.bg", "T.serv", "Luogo inizio", "Itinerario", "Luogo fine", "Veicolo", "T.P", "Centro Costo", "Stato"];
    const rows = filtered.map(s => [
      s.citta ?? "", s.data_servizio, s.ora_inizio ?? "", s.contatto ?? "", s.n_passeggeri ?? "",
      s.n_bagagli ?? "", buildTipoServizio(s), s.luogo_inizio ?? "", s.itinerario ?? "",
      s.luogo_fine ?? "", s.veicolo_tipo ?? "", pagamentoLabel[s.tipo_pagamento ?? ""] ?? "",
      s.centro_costo ?? "", statoConfig[s.stato]?.label ?? s.stato
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "servizi.csv";
    a.click();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <ClientPortalLayout>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">Lista Servizi</h1>

        {/* Info */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Modifica e annulla:</strong> fino a 12 ore prima dell'orario del servizio. Clicca su un servizio per i dettagli.
          </p>
        </div>

        {/* Filtri */}
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Da</label>
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data inizio" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">A</label>
                <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data fine" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cerca</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Passeggero, città..." className="pl-8 rounded-lg h-9 text-sm" />
                </div>
              </div>
              {isParentClient && utenze.length > 0 && (
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Utenza</label>
                  <Select value={utenzaFilter} onValueChange={setUtenzaFilter}>
                    <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le utenze</SelectItem>
                      <SelectItem value="__direct__">Solo miei (cliente)</SelectItem>
                      {utenze.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome} {u.cognome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isParentClient && utenze.length === 0 && (
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Utenza</label>
                  <Button asChild variant="outline" size="sm" className="rounded-lg h-9 text-xs w-full gap-1.5">
                    <Link to="/client-portal/utenze">
                      <Users className="h-3.5 w-3.5" />
                      Crea utenza
                    </Link>
                  </Button>
                </div>
              )}
              <div className="flex items-end">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-lg w-full h-9 text-xs" onClick={exportExcel}>
                  <Download className="h-3.5 w-3.5" /> Esporta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          (() => {
            const hasFilters = !!(search || dateFrom || dateTo || utenzaFilter !== "all");
            const hasAnyServizi = servizi.length > 0;

            if (hasFilters && hasAnyServizi) {
              return (
                <div className="py-16 text-center">
                  <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm font-medium">Nessun servizio corrisponde ai filtri</p>
                  <p className="mt-1 text-xs text-muted-foreground">Prova a modificare data, ricerca o utenza selezionata.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-lg text-xs"
                    onClick={() => {
                      setSearch("");
                      setDateFrom("");
                      setDateTo("");
                      setUtenzaFilter("all");
                    }}
                  >
                    Azzera filtri
                  </Button>
                </div>
              );
            }

            return (
              <div className="py-16 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium">Nessun servizio prenotato</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  {isParentClient && utenze.length === 0
                    ? "Non hai ancora creato utenze. Crea utenze per permettere ai tuoi collaboratori di prenotare e gestire i propri servizi."
                    : "Quando verrà prenotato un servizio comparirà in questa lista."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button asChild size="sm" className="rounded-lg text-xs">
                    <Link to="/client-portal/prenota">Prenota ora</Link>
                  </Button>
                  {isParentClient && utenze.length === 0 && (
                    <Button asChild size="sm" variant="outline" className="rounded-lg text-xs gap-1.5">
                      <Link to="/client-portal/utenze">
                        <Users className="h-3.5 w-3.5" /> Gestisci utenze
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const stato = computeClientStato(s);
              return (
                <Card
                  key={s.id}
                  className="rounded-xl border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                  onClick={() => openDetail(s)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Date block */}
                      <div className="shrink-0 text-center min-w-[56px]">
                        <div className="text-lg font-bold leading-tight">{new Date(s.data_servizio).getDate()}</div>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase">
                          {new Date(s.data_servizio).toLocaleDateString("it-IT", { month: "short" })}
                        </div>
                        {s.ora_inizio && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{s.ora_inizio}</div>
                        )}
                      </div>

                      <Separator orientation="vertical" className="h-12" />

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm truncate">{s.contatto ?? "—"}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${stato.className}`}>
                            {stato.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {s.citta && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{s.citta}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Car className="h-3 w-3" />{buildTipoShort(s)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />{s.n_passeggeri ?? 1}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg rounded-xl p-0 gap-0 overflow-hidden">
            {selected && (() => {
              const stato = computeClientStato(selected);
              const editable = canModify(selected);
              return (
                <>
                  {/* Header */}
                  <div className="p-5 pb-3">
                    <DialogHeader>
                      <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">{selected.contatto ?? "Servizio"}</DialogTitle>
                        <Badge variant="outline" className={`text-xs ${stato.className}`}>{stato.label}</Badge>
                      </div>
                    </DialogHeader>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(selected.data_servizio)}</span>
                      {selected.ora_inizio && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {selected.ora_inizio}</span>}
                      {selected.citta && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {selected.citta}</span>}
                    </div>
                  </div>

                  <Separator />

                  {/* Details */}
                  <div className="p-5 space-y-1 max-h-[50vh] overflow-y-auto">
                    <DetailRow label="Tipo servizio" value={buildTipoServizio(selected)} />
                    <DetailRow label="Veicolo" value={selected.veicolo_tipo} />
                    <DetailRow label="N. passeggeri" value={String(selected.n_passeggeri ?? 1)} />
                    <DetailRow label="N. bagagli" value={String(selected.n_bagagli ?? 0)} />
                    <DetailRow label="Telefono" value={selected.telefono_contatto} />
                    <DetailRow label="Email" value={selected.email_contatto} />

                    <Separator className="my-2" />

                    <DetailRow label="Luogo inizio" value={selected.luogo_inizio} />
                    <DetailRow label="Luogo fine" value={selected.luogo_fine} />
                    <DetailRow label="Itinerario" value={selected.itinerario} />
                    <DetailRow label="Info autista" value={selected.info_autista} />

                    <Separator className="my-2" />

                    <DetailRow label="Tipo pagamento" value={pagamentoLabel[selected.tipo_pagamento ?? ""] ?? selected.tipo_pagamento} />
                    <DetailRow label="Prezzo" value={selected.prezzo != null ? `€ ${selected.prezzo.toFixed(2)}` : null} />
                    <DetailRow label="Centro di costo" value={selected.centro_costo} />
                    <DetailRow label="Accessori" value={selected.accessori} />
                    <DetailRow label="Note" value={selected.note} />
                    <DetailRow label="Codice" value={selected.codice} />

                    <Separator className="my-2" />

                    {/* Allegato */}
                    <div className="py-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                          <Paperclip className="h-3.5 w-3.5" /> Allegato per autista
                        </span>
                      </div>
                      {selected.allegato_path ? (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/30">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <button
                            onClick={() => downloadAllegato(selected)}
                            className="flex-1 min-w-0 text-left text-sm font-medium truncate hover:underline"
                          >
                            {selected.allegato_nome ?? "Allegato"}
                          </button>
                          {editable && (
                            <>
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".png,.jpg,.jpeg,.webp,.gif,.heic,.pdf,.doc,.docx,.xls,.xlsx"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadAllegato(selected, f);
                                    e.target.value = "";
                                  }}
                                />
                                <span className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                  <Upload className="h-3.5 w-3.5" />
                                </span>
                              </label>
                              <button
                                onClick={() => deleteAllegato(selected)}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      ) : editable ? (
                        <label className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-colors">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Carica file (PNG, JPG, PDF, Word, Excel · max 10MB)</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".png,.jpg,.jpeg,.webp,.gif,.heic,.pdf,.doc,.docx,.xls,.xlsx"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadAllegato(selected, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nessun allegato</p>
                      )}
                    </div>

                    {/* Cartello di accoglienza */}
                    <div className="py-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> Cartello di accoglienza
                        </span>
                      </div>
                      <CartelloUpload
                        path={selected.cartello_path}
                        nome={selected.cartello_nome}
                        onFile={(f) => { if (f) uploadCartello(selected, f); }}
                        onRemoveExisting={() => deleteCartello(selected)}
                        disabled={!editable}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  {editable && (
                    <>
                      <Separator />
                      <div className="p-4 flex gap-2">
                        <Button variant="outline" className="flex-1 rounded-lg h-10 gap-2 text-sm" onClick={() => openEdit(selected)}>
                          <Pencil className="h-3.5 w-3.5" /> Modifica
                        </Button>
                        <Button variant="outline" className="flex-1 rounded-lg h-10 gap-2 text-sm text-destructive hover:text-destructive hover:bg-destructive/5" onClick={() => handleCancel(selected)}>
                          <XCircle className="h-3.5 w-3.5" /> Annulla servizio
                        </Button>
                      </div>
                    </>
                  )}
                  {!editable && selected.stato !== "annullato" && (
                    <>
                      <Separator />
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Non più modificabile (meno di 12 ore al servizio)
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-2xl rounded-xl p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-5 pb-3">
              <DialogTitle className="text-lg">Modifica servizio</DialogTitle>
              {selected && (
                <p className="text-xs text-muted-foreground mt-1">
                  Passeggero: <span className="font-medium text-foreground">{selected.contatto ?? "—"}</span> · Le info di contatto non sono modificabili
                </p>
              )}
            </DialogHeader>
            <Separator />
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <BookingFormFields
                form={editForm}
                setForm={setEditForm}
                mode="edit"
                orgId={editOrgId}
                clientId={editClientId}
                passeggeri={editPasseggeri}
                accessoriRows={editAccessori}
                setAccessoriRows={setEditAccessori}
                autoreName={autoreName}
              />
            </div>

            <Separator />
            <div className="p-4 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-lg h-10" onClick={() => setEditOpen(false)}>Annulla</Button>
              <Button className="flex-1 rounded-lg h-10" onClick={handleSaveEdit}>Salva modifiche</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ClientPortalLayout>
  );
}
