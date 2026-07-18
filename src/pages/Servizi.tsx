import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AssignDriverPopover, BulkAssignBar, type DriverOption } from "@/components/AssignDriverPopover";
import { ServizioFormDialog, type ServizioFormInitial } from "@/components/servizi/ServizioFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Search, SlidersHorizontal, ChevronDown, ChevronRight, X, MapPin, Phone, Users, Car, Route, CreditCard, Info, Luggage, Bell, Printer, Pencil, Network, Columns3, CheckCircle2 } from "lucide-react";
import { ModificheClientePopover } from "@/components/ModificheClientePopover";
import { NetworkDispatchDialog } from "@/components/servizi/NetworkDispatchDialog";
import { ViewSelector } from "@/components/servizi/ViewSelector";
import { ColumnCustomizer } from "@/components/servizi/ColumnCustomizer";
import { useServiziViste } from "@/hooks/use-servizi-viste";
import { COLUMNS_MAP, computeEffectiveWidths, type ColumnKey, type ViewColumnState } from "@/lib/servizi-columns";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { format, addDays } from "date-fns";
import { it as itLocale } from "date-fns/locale";

const NETWORK_STATO_LABEL: Record<string, string> = {
  inviato: "Inviato",
  accettato: "Accettato",
  rifiutato: "Rifiutato",
  annullato: "Annullato",
  completato: "Completato",
};
const NETWORK_STATO_COLOR: Record<string, string> = {
  inviato: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accettato: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rifiutato: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  annullato: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  completato: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

type Servizio = {
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
  email_contatto: string | null;
  n_passeggeri: number | null;
  n_bagagli: number | null;
  accessori: string | null;
  info_autista: string | null;
  veicolo_tipo: string | null;
  tipo_pagamento: string | null;
  prezzo: number | null;
  centro_costo: string | null;
  costo_centro: number | null;
  non_incassato: number | null;
  codice: string | null;
  foglio: string | null;
  incasso: number | null;
  costo_cs: number | null;
  costo_autista: number | null;
  costo_commissione: number | null;
  note: string | null;
  autista_id: string | null;
  autista_esterno_id: string | null;
  veicolo_id: string | null;
  fornitore_cs_id: string | null;
  modificato_da_cliente: boolean | null;
  modificato_at: string | null;
  network_autista_nome: string | null;
  network_autista_telefono: string | null;
  network_autista_targa: string | null;
  clients: { name: string; company: string | null } | null;
  autisti: { nome: string; cognome: string; cellulare: string | null } | null;
  autisti_esterni: { nome: string; cellulare: string | null; targa: string | null } | null;
  veicoli: { targa: string; tipo_macchina: string | null } | null;
  fornitori_cs: { nome: string; telefono: string | null } | null;
};

type Client = { id: string; name: string; company: string | null; phone: string | null };
type Autista = { id: string; nome: string; cognome: string };
type Veicolo = { id: string; targa: string; tipo_macchina: string | null };
type Fornitore = { id: string; nome: string };

const statusColors: Record<string, string> = {
  nuovo: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  da_confermare: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  confermato: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_corso: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completato: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  annullato: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusLabels: Record<string, string> = {
  nuovo: "Nuovo",
  da_confermare: "Da confermare",
  confermato: "Confermato",
  in_corso: "In Corso",
  completato: "Completato",
  annullato: "Annullato",
};

const tipologiaLabels: Record<string, string> = {
  transfer: "Transfer",
  disposizione: "Disposizione",
  tour: "Tour",
  evento: "Evento",
  altro: "Altro",
};

function buildTServ(s: Servizio): string {
  const parts: string[] = [];
  if (s.transfer_tipo) parts.push(`Transfer: ${s.transfer_tipo}`);
  if (s.disposizione_oraria) parts.push(`Disp: ${s.disposizione_oraria}`);
  if (s.tour_tipo) parts.push(`Tour: ${s.tour_tipo}`);
  if (parts.length === 0 && s.tipologia) parts.push(tipologiaLabels[s.tipologia] || s.tipologia);
  return parts.join(" · ") || "—";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function printFoglioServizio(s: Servizio, org: { name: string; logo_url: string | null; address: string | null; phone: string | null; website: string | null } | null) {
  const row = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return "";
    return `<tr><td class="lbl">${escapeHtml(label)}</td><td>${escapeHtml(String(value))}</td></tr>`;
  };
  const hasLocalDriver = !!(s.autista_id || s.autista_esterno_id);
  const partnerDriver = !hasLocalDriver && s.network_autista_nome ? s.network_autista_nome : "";
  const driverLabel = s.autisti ? `${s.autisti.nome} ${s.autisti.cognome}` : (s.autisti_esterni?.nome || partnerDriver);
  const driverTel = s.autisti?.cellulare || s.autisti_esterni?.cellulare || (partnerDriver ? (s.network_autista_telefono || "") : "");
  const targa = s.autisti_esterni?.targa || s.veicoli?.targa || (partnerDriver ? (s.network_autista_targa || "") : "");
  const veicolo = s.veicoli ? `${s.veicoli.tipo_macchina || ""} ${s.veicoli.targa}` : (s.veicolo_tipo || "");
  const dataStr = format(new Date(s.data_servizio), "dd/MM/yyyy");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Foglio Servizio ${escapeHtml(s.codice || s.id.slice(0, 8))}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #111; margin: 32px; }
    header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
    header img { max-height: 60px; }
    header .org { flex: 1; }
    header .org h1 { margin: 0; font-size: 20px; }
    header .org p { margin: 2px 0; font-size: 11px; color: #555; }
    header .meta { text-align: right; font-size: 11px; }
    h2 { font-size: 14px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    table.data { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.data td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    table.data td.lbl { color: #666; width: 30%; font-weight: 500; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    footer { margin-top: 40px; font-size: 10px; color: #888; text-align: center; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
  <header>
    ${org?.logo_url ? `<img src="${escapeHtml(org.logo_url)}" alt="logo" />` : ""}
    <div class="org">
      <h1>${escapeHtml(org?.name || "")}</h1>
      ${org?.address ? `<p>${escapeHtml(org.address)}</p>` : ""}
      ${org?.phone ? `<p>Tel: ${escapeHtml(org.phone)}</p>` : ""}
      ${org?.website ? `<p>${escapeHtml(org.website)}</p>` : ""}
    </div>
    <div class="meta">
      <div><strong>Foglio di servizio</strong></div>
      <div>Codice: ${escapeHtml(s.codice || "—")}</div>
      <div>${dataStr}${s.ora_inizio ? " · " + escapeHtml(s.ora_inizio) : ""}</div>
    </div>
  </header>

  <div class="grid">
    <div>
      <h2>Cliente</h2>
      <table class="data">
        ${row("Società", s.clients?.company || s.clients?.name)}
        ${row("Contatto", s.contatto)}
        ${row("Telefono", s.telefono_contatto)}
        ${row("Passeggeri", s.n_passeggeri)}
        ${row("Bagagli", s.n_bagagli)}
      </table>
      <h2>Servizio</h2>
      <table class="data">
        ${row("Città", s.citta)}
        ${row("Tipo", buildTServ(s))}
        ${row("Luogo inizio", s.luogo_inizio)}
        ${row("Itinerario", s.itinerario)}
        ${row("Luogo fine", s.luogo_fine)}
        ${row("Accessori", s.accessori)}
      </table>
    </div>
    <div>
      <h2>Veicolo & Autista</h2>
      <table class="data">
        ${row("Veicolo", veicolo)}
        ${row("Targa", targa)}
        ${row("Autista", driverLabel + (partnerDriver ? " (autista partner network)" : ""))}
        ${row("Telefono autista", driverTel)}
        ${row("Info autista", s.info_autista)}
      </table>
      <h2>Note</h2>
      <table class="data">
        ${row("Note", s.note)}
      </table>
    </div>
  </div>

  <footer>Documento generato il ${format(new Date(), "dd/MM/yyyy HH:mm")}</footer>
  <script>window.onload = () => window.print();</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (w) { w.document.write(html); w.document.close(); }
}


export default function Servizi() {
  const { user, role, organization } = useAuth();
  const isAdmin = role === "admin";
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [accessoriMap, setAccessoriMap] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editServizio, setEditServizio] = useState<ServizioFormInitial | null>(null);
  const [detailServizio, setDetailServizio] = useState<Servizio | null>(null);
  const [networkDialogId, setNetworkDialogId] = useState<string | null>(null);
  const [selectedServiziIds, setSelectedServiziIds] = useState<string[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");

  

  // Filters
  const [filterDal, setFilterDal] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [filterAl, setFilterAl] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd"));
  const [filterStato, setFilterStato] = useState("all");
  const [filterTipologia, setFilterTipologia] = useState("all");
  const [filterTarga, setFilterTarga] = useState("");
  const [filterContatto, setFilterContatto] = useState("");
  const [filterCliente, setFilterCliente] = useState("all");
  const [filterAutista, setFilterAutista] = useState("all");
  const [filterFornitore, setFilterFornitore] = useState("all");
  const [filterCodice, setFilterCodice] = useState("");
  const [filterArchiviati, setFilterArchiviati] = useState(false);
  const [filterOnlyModified, setFilterOnlyModified] = useState(false);


  // Form state is managed inside <ServizioFormDialog />

  // Viste personalizzate
  const viste = useServiziViste(user?.id);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [networkMap, setNetworkMap] = useState<Record<string, { stato: string; partnerName: string | null }>>({});

  // Ridimensionamento colonne (Excel-like)
  const tableRef = useRef<HTMLTableElement>(null);
  const MIN_COL_PX = 40;

  const beginColumnResize = useCallback((e: React.MouseEvent, key: ColumnKey) => {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    const tableWidthPx = table.getBoundingClientRect().width;
    if (tableWidthPx <= 0) return;

    const visible = viste.activeView.columns.filter((c) => c.visible);
    const idx = visible.findIndex((c) => c.key === key);
    if (idx < 0 || idx === visible.length - 1) return; // niente handle sull'ultima

    const effective = computeEffectiveWidths(visible);
    const startWidths: Record<string, number> = { ...effective };
    const startX = e.clientX;
    const minPct = (MIN_COL_PX / tableWidthPx) * 100;

    // Le colonne da cui sottraiamo lo spazio: tutte quelle a destra della draggata
    const rightKeys = visible.slice(idx + 1).map((c) => c.key);
    const rightStartSum = rightKeys.reduce((s, k) => s + startWidths[k], 0);
    const leftMax = 100 - rightKeys.length * minPct - visible.slice(0, idx).reduce((s, c) => s + startWidths[c.key], 0);
    const leftMin = minPct;

    const onMove = (ev: MouseEvent) => {
      const dxPx = ev.clientX - startX;
      const dxPct = (dxPx / tableWidthPx) * 100;
      let newLeft = startWidths[key] + dxPct;
      if (newLeft < leftMin) newLeft = leftMin;
      if (newLeft > leftMax) newLeft = leftMax;
      const delta = newLeft - startWidths[key];
      // Ridistribuisci -delta sulle colonne a destra proporzionalmente alla loro quota iniziale
      const next: Record<string, number> = { ...startWidths, [key]: newLeft };
      if (rightStartSum > 0) {
        for (const k of rightKeys) {
          const share = startWidths[k] / rightStartSum;
          const w = startWidths[k] - delta * share;
          next[k] = Math.max(minPct, w);
        }
      }
      // Applica direttamente al DOM per fluidità (evita re-render ad ogni pixel)
      const cols = table.querySelectorAll("colgroup > col");
      visible.forEach((c, i) => {
        const el = cols[i] as HTMLTableColElement | undefined;
        if (el) el.style.width = `${next[c.key]}%`;
      });
      (table as any)._pendingWidths = next;
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const pending = (table as any)._pendingWidths as Record<string, number> | undefined;
      if (pending) {
        // Salva la mappa completa (tutte le colonne visibili) per stabilità
        viste.updateColumnWidths(viste.activeView.id, pending as any);
        (table as any)._pendingWidths = undefined;
      }
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [viste]);

  const autofitColumn = useCallback((key: ColumnKey) => {
    const table = tableRef.current;
    if (!table) return;
    const tableWidthPx = table.getBoundingClientRect().width;
    if (tableWidthPx <= 0) return;
    const visible = viste.activeView.columns.filter((c) => c.visible);
    const idx = visible.findIndex((c) => c.key === key);
    if (idx < 0) return;

    // Misura il contenuto più largo nella colonna (header + celle)
    const cellSelector = `tr > *:nth-child(${idx + 1})`;
    const nodes = table.querySelectorAll<HTMLElement>(cellSelector);
    let maxPx = MIN_COL_PX;
    nodes.forEach((n) => {
      const inner = n.firstElementChild as HTMLElement | null;
      const w = (inner?.scrollWidth ?? n.scrollWidth) + 8; // +padding
      if (w > maxPx) maxPx = w;
    });

    const targetPct = Math.max((MIN_COL_PX / tableWidthPx) * 100, (maxPx / tableWidthPx) * 100);
    const effective = computeEffectiveWidths(visible);
    const startWidths = { ...effective };
    const minPct = (MIN_COL_PX / tableWidthPx) * 100;
    const otherKeys = visible.filter((c) => c.key !== key).map((c) => c.key);
    const otherStartSum = otherKeys.reduce((s, k) => s + startWidths[k], 0);
    const maxLeft = 100 - otherKeys.length * minPct;
    const newLeft = Math.min(targetPct, maxLeft);
    const delta = newLeft - startWidths[key];
    const next: Record<string, number> = { ...startWidths, [key]: newLeft };
    if (otherStartSum > 0) {
      for (const k of otherKeys) {
        const share = startWidths[k] / otherStartSum;
        next[k] = Math.max(minPct, startWidths[k] - delta * share);
      }
    }
    viste.updateColumnWidths(viste.activeView.id, next as any);
  }, [viste]);




  const loadLookups = async () => {
    const [c, a, v, f] = await Promise.all([
      supabase.from("clients").select("id, name, company, phone").order("name"),
      supabase.from("autisti").select("id, nome, cognome").order("cognome"),
      supabase.from("veicoli").select("id, targa, tipo_macchina").order("targa"),
      supabase.from("fornitori_cs").select("id, nome").order("nome"),
    ]);
    setClients(c.data ?? []);
    setAutisti(a.data ?? []);
    setVeicoli(v.data ?? []);
    setFornitori(f.data ?? []);
  };

  const loadServizi = async () => {
    setLoading(true);
    let query = supabase
      .from("servizi")
      .select("*, clients(name, company), autisti(nome, cognome, cellulare), autisti_esterni(nome, cellulare, targa), veicoli(targa, tipo_macchina), fornitori_cs(nome, telefono)")
      .gte("data_servizio", filterDal)
      .lte("data_servizio", filterAl)
      .order("data_servizio", { ascending: true });

    // Archiviati: mostra solo i servizi archiviati (sola lettura), altrimenti li nasconde
    if (filterArchiviati) query = query.eq("archiviato", true);
    else query = query.eq("archiviato", false);

    if (filterStato === "all") query = query.neq("stato", "annullato");
    else query = query.eq("stato", filterStato as any);
    if (filterTipologia !== "all") query = query.eq("tipologia", filterTipologia as any);
    if (filterTarga) query = query.ilike("veicoli.targa", `%${filterTarga}%`);
    if (filterContatto) query = query.ilike("contatto", `%${filterContatto}%`);
    if (filterCliente !== "all") query = query.eq("client_id", filterCliente);
    if (filterAutista !== "all") query = query.eq("autista_id", filterAutista);
    if (filterFornitore !== "all") query = query.eq("fornitore_cs_id", filterFornitore);
    if (filterCodice) query = query.ilike("codice", `%${filterCodice}%`);
    if (globalSearch.trim()) {
      const q = globalSearch.trim().replace(/,/g, " ");
      query = query.or(`contatto.ilike.%${q}%,codice.ilike.%${q}%,luogo_inizio.ilike.%${q}%,luogo_fine.ilike.%${q}%`);
    }

    const { data } = await query;
    const nextServizi = (data ?? []) as unknown as Servizio[];
    setServizi(nextServizi);
    setSelectedServiziIds(prev => prev.filter(id => nextServizi.some(servizio => servizio.id === id)));

    // Carica riepilogo accessori
    const ids = nextServizi.map(s => s.id);
    if (ids.length) {
      const { data: acc } = await supabase
        .from("servizi_accessori")
        .select("servizio_id, quantita, accessori_catalogo(nome)")
        .in("servizio_id", ids);
      const map: Record<string, string[]> = {};
      (acc ?? []).forEach((r: any) => {
        const nome = r.accessori_catalogo?.nome;
        if (!nome) return;
        (map[r.servizio_id] ||= []).push(`${r.quantita}× ${nome}`);
      });
      setAccessoriMap(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.join(", ")])));
    } else {
      setAccessoriMap({});
    }

    // Carica stato passaggi di rete (side A) per riga
    if (ids.length) {
      const { data: nets } = await supabase
        .from("servizi_network")
        .select("servizio_a_id, stato, org_b")
        .in("servizio_a_id", ids);
      const orgIds = Array.from(new Set((nets ?? []).map((r: any) => r.org_b).filter(Boolean)));
      let orgNames: Record<string, string> = {};
      if (orgIds.length) {
        const { data: orgs } = await supabase.rpc("network_visible_orgs" as any);
        (orgs ?? []).forEach((o: any) => { orgNames[o.id] = o.name; });
      }
      const nMap: Record<string, { stato: string; partnerName: string | null }> = {};
      (nets ?? []).forEach((r: any) => {
        const prev = nMap[r.servizio_a_id];
        const priority: Record<string, number> = { accettato: 4, inviato: 3, completato: 2, rifiutato: 1, annullato: 0 };
        if (!prev || (priority[r.stato] ?? 0) > (priority[prev.stato] ?? 0)) {
          nMap[r.servizio_a_id] = { stato: r.stato, partnerName: orgNames[r.org_b] || null };
        }
      });
      setNetworkMap(nMap);
    } else {
      setNetworkMap({});
    }

    setLoading(false);
  };


  useEffect(() => {
    if (user) {
      loadLookups();
      loadServizi();
    }
  }, [user]);

  // Realtime: aggiornamento istantaneo quando i clienti modificano i loro servizi
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("org-servizi-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servizi" },
        () => { loadServizi(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSearch = () => loadServizi();

  const openEditServizio = async (id: string) => {
    const { data, error } = await supabase.from("servizi").select("*").eq("id", id).single();
    if (error) { toast.error(error.message); return; }
    setEditServizio(data as any);
    setDetailServizio(null);
  };


  const handleToggleServizioSelection = (servizioId: string) => {
    setSelectedServiziIds(prev => prev.includes(servizioId)
      ? prev.filter(id => id !== servizioId)
      : [...prev, servizioId],
    );
  };

  const handleToggleAllVisible = () => {
    const visibleIds = servizi.map(s => s.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedServiziIds.includes(id));

    if (allVisibleSelected) {
      setSelectedServiziIds(prev => prev.filter(id => !visibleIds.includes(id)));
      return;
    }

    setSelectedServiziIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  };

  const selectedVisibleCount = useMemo(
    () => servizi.filter(s => selectedServiziIds.includes(s.id)).length,
    [servizi, selectedServiziIds],
  );

  const handleAssignDriver = async (servizioId: string, driver: DriverOption | null) => {
    // Il flag modificato_da_cliente NON viene azzerato dal cambio autista:
    // resta attivo finché l'operatore non preme esplicitamente "Conferma".
    const payload = driver === null
      ? { autista_id: null, autista_esterno_id: null }
      : driver.kind === "interno"
        ? { autista_id: driver.id, autista_esterno_id: null }
        : { autista_id: null, autista_esterno_id: driver.id };

    const { error } = await supabase.from("servizi").update(payload as any).eq("id", servizioId);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(driver ? "Autista assegnato" : "Assegnazione rimossa");
    await loadServizi();
  };

  const handleBulkAssignDriver = async (driver: DriverOption) => {
    if (selectedServiziIds.length === 0) return;

    const payload = driver.kind === "interno"
      ? { autista_id: driver.id, autista_esterno_id: null }
      : { autista_id: null, autista_esterno_id: driver.id };

    const { error } = await supabase.from("servizi").update(payload as any).in("id", selectedServiziIds);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Autista assegnato a ${selectedServiziIds.length} servizi`);
    setSelectedServiziIds([]);
    await loadServizi();
  };


  const nuoviCount = servizi.filter(s => s.stato === "nuovo").length;
  const daConfermareCount = servizi.filter(s => s.stato === "da_confermare").length;

  const handleConfirmServizio = async (servizioId: string) => {
    const { error } = await supabase
      .from("servizi")
      .update({ stato: "confermato" as any, modificato_da_cliente: false, modificato_at: null })
      .eq("id", servizioId);
    if (error) { toast.error(error.message); return; }
    toast.success("Servizio confermato");
    await loadServizi();
  };

  const handleBulkConfirm = async () => {
    const ids = servizi
      .filter(s => selectedServiziIds.includes(s.id) && s.stato === "da_confermare" && (s.autista_id || s.autista_esterno_id))
      .map(s => s.id);
    if (ids.length === 0) { toast.info("Nessun servizio da confermare tra i selezionati"); return; }
    const { error } = await supabase
      .from("servizi")
      .update({ stato: "confermato" as any, modificato_da_cliente: false, modificato_at: null })
      .in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} servizi confermati`);
    setSelectedServiziIds([]);
    await loadServizi();
  };

  const [confermaTuttiOpen, setConfermaTuttiOpen] = useState(false);
  const idsDaConfermareVisibili = useMemo(
    () => servizi.filter(s => s.stato === "da_confermare" && (s.autista_id || s.autista_esterno_id)).map(s => s.id),
    [servizi],
  );
  const handleConfermaTutti = async () => {
    const ids = idsDaConfermareVisibili;
    if (ids.length === 0) { setConfermaTuttiOpen(false); return; }
    const { error } = await supabase
      .from("servizi")
      .update({ stato: "confermato" as any, modificato_da_cliente: false, modificato_at: null })
      .in("id", ids);
    setConfermaTuttiOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} servizi confermati`);
    await loadServizi();
  };

  const modificatiCount = useMemo(() => servizi.filter(s => s.modificato_da_cliente).length, [servizi]);
  const displayServizi = useMemo(
    () => filterOnlyModified ? servizi.filter(s => s.modificato_da_cliente) : servizi,
    [servizi, filterOnlyModified],
  );






  // Quick day filters for "Nuovi" services
  const [quickDay, setQuickDay] = useState<string | null>(null);
  const quickDayOptions = useMemo(() => {
    const today = new Date();
    return [
      { key: "oggi", label: "Nuovi Oggi", date: format(today, "yyyy-MM-dd") },
      { key: "domani", label: "Nuovi Domani", date: format(addDays(today, 1), "yyyy-MM-dd") },
      { key: "day2", label: format(addDays(today, 2), "EEE dd/MM", { locale: itLocale }), date: format(addDays(today, 2), "yyyy-MM-dd") },
      { key: "day3", label: format(addDays(today, 3), "EEE dd/MM", { locale: itLocale }), date: format(addDays(today, 3), "yyyy-MM-dd") },
    ];
  }, []);

  const quickDayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opt of quickDayOptions) {
      counts[opt.key] = servizi.filter(s => s.stato === "nuovo" && s.data_servizio === opt.date).length;
    }
    return counts;
  }, [servizi, quickDayOptions]);

  const handleQuickDay = (key: string) => {
    const opt = quickDayOptions.find(o => o.key === key);
    if (!opt) return;
    if (quickDay === key) {
      setQuickDay(null);
      return;
    }
    setQuickDay(key);
    setFilterDal(opt.date);
    setFilterAl(opt.date);
    setFilterStato("nuovo");
    setFilterTipologia("all");
    setFilterTarga("");
    setFilterContatto("");
    setFilterCliente("all");
    setFilterAutista("all");
    setFilterFornitore("all");
    setFilterCodice("");
  };

  // Auto-search when quickDay changes
  useEffect(() => {
    if (quickDay !== null && user) {
      loadServizi();
    }
  }, [quickDay]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasActiveFilters = filterTipologia !== "all" || filterTarga || filterContatto || filterCliente !== "all" || filterAutista !== "all" || filterFornitore !== "all" || filterCodice;

  const resetAllFilters = () => {
    setQuickDay(null);
    setFilterDal(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
    setFilterAl(format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd"));
    setFilterStato("all");
    setFilterTipologia("all");
    setFilterTarga("");
    setFilterContatto("");
    setFilterCliente("all");
    setFilterAutista("all");
    setFilterFornitore("all");
    setFilterCodice("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-2 overflow-x-clip">
        {/* Header row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-base font-semibold text-foreground">Servizi</h1>
            <p className="text-xs text-muted-foreground">{nuoviCount} nuovi · {daConfermareCount} da confermare · {servizi.length} totali</p>
          </div>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") loadServizi(); }}
                placeholder="Cerca (codice, contatto, luogo)…"
                className="h-9 pl-7 text-xs"
              />
            </div>
            <div className="hidden md:flex items-center gap-2">
              <ViewSelector
                viste={viste.viste}
                activeId={viste.activeView.id}
                onSelect={viste.selectView}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setCustomizerOpen(true)}
                title="Personalizza colonne"
              >
                <Columns3 className="h-3.5 w-3.5" /> Colonne
              </Button>
            </div>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <PlusCircle className="h-4 w-4" /> Nuovo Servizio
            </Button>
          </div>

        </div>

        {/* Quick day chips + collapsible filters */}
        <Card>
          <CardContent className="py-2 px-3 space-y-2">
            {/* Day chips row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Nuovi:</span>
              {quickDayOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleQuickDay(opt.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                    ${quickDay === opt.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }
                  `}
                >
                  {opt.label}
                  {quickDayCounts[opt.key] > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${
                      quickDay === opt.key ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
                    }`}>
                      {quickDayCounts[opt.key]}
                    </span>
                )}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                {(quickDay || hasActiveFilters) && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => { resetAllFilters(); setTimeout(() => loadServizi(), 0); }}>
                    <X className="h-3 w-3" /> Reset
                  </Button>
                )}
                {idsDaConfermareVisibili.length > 0 && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => setConfermaTuttiOpen(true)}
                    title="Conferma tutti i servizi da confermare nella vista corrente"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conferma tutti ({idsDaConfermareVisibili.length})
                  </Button>
                )}
                <Button
                  variant={filterArchiviati ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => { setFilterArchiviati(v => !v); setTimeout(() => loadServizi(), 0); }}
                  title="Mostra i servizi archiviati (sola lettura)"
                >
                  {filterArchiviati ? "Nascondi archiviati" : "Archiviati"}
                </Button>
                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Filtri avanzati
                      <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
            </div>

            {/* Collapsible advanced filters */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleContent>
                <div className="pt-3 border-t border-border/50 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Dal</Label>
                      <DatePicker value={filterDal} onChange={setFilterDal} placeholder="Data inizio" className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Al</Label>
                      <DatePicker value={filterAl} onChange={setFilterAl} placeholder="Data fine" className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Stato</Label>
                      <Select value={filterStato} onValueChange={setFilterStato}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti</SelectItem>
                          {Object.entries(statusLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipologia</Label>
                      <Select value={filterTipologia} onValueChange={setFilterTipologia}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutte</SelectItem>
                          {Object.entries(tipologiaLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Targa</Label>
                      <Input value={filterTarga} onChange={e => setFilterTarga(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Contatto</Label>
                      <Input value={filterContatto} onChange={e => setFilterContatto(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Società Cliente</Label>
                      <Select value={filterCliente} onValueChange={setFilterCliente}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutte</SelectItem>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Autista</Label>
                      <Select value={filterAutista} onValueChange={setFilterAutista}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti</SelectItem>
                          {autisti.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.cognome} {a.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Fornitore CS</Label>
                      <Select value={filterFornitore} onValueChange={setFilterFornitore}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti</SelectItem>
                          {fornitori.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Codice</Label>
                      <Input value={filterCodice} onChange={e => setFilterCodice(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <Button onClick={handleSearch} size="sm" className="gap-2">
                    <Search className="h-3.5 w-3.5" /> Cerca
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Notifica modifiche cliente */}
        {servizi.some(s => s.modificato_da_cliente) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
              {servizi.filter(s => s.modificato_da_cliente).length} servizi modificati dal cliente — da rivedere
            </span>
          </div>
        )}

        {selectedVisibleCount > 0 && (
          <div className="hidden md:block">
            <BulkAssignBar
              count={selectedVisibleCount}
              onAssign={handleBulkAssignDriver}
              onClear={() => setSelectedServiziIds([])}
            />
          </div>
        )}

        {(() => {
          const selectedDaConfermare = servizi.filter(s => selectedServiziIds.includes(s.id) && s.stato === "da_confermare" && (s.autista_id || s.autista_esterno_id)).length;
          if (selectedDaConfermare === 0) return null;
          return (
            <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-orange-700 dark:text-orange-300" />
              <span className="text-xs font-medium text-orange-900 dark:text-orange-100">
                {selectedDaConfermare} da confermare tra i selezionati
              </span>
              <Button
                size="sm"
                className="ml-auto h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                onClick={handleBulkConfirm}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Conferma selezionati ({selectedDaConfermare})
              </Button>
            </div>
          );
        })()}

        {/* MOBILE: card list */}
        <div className="space-y-2 md:hidden">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : servizi.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">Nessun servizio trovato</p>
              </CardContent>
            </Card>
          ) : (
            servizi.map((s) => {
              const senzaAutista = !s.autista_id && !s.autista_esterno_id;
              const modificato = s.modificato_da_cliente;
              const isNuovoRosso = s.stato === "nuovo" && senzaAutista;
              const isDaConfermare = s.stato === "da_confermare";
              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group ${
                    isNuovoRosso ? "bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900" :
                    isDaConfermare ? "bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900" : ""
                  } ${modificato ? "border-l-4 border-l-orange-700 dark:border-l-orange-500" : ""}`}
                  onClick={() => setDetailServizio(s)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center w-12 shrink-0">
                      <span className="text-[10px] text-muted-foreground uppercase">{format(new Date(s.data_servizio), "MMM", { locale: itLocale })}</span>
                      <span className="text-lg font-bold text-foreground leading-none">{format(new Date(s.data_servizio), "dd")}</span>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {modificato && <ModificheClientePopover servizioId={s.id} />}
                        <p className="font-semibold text-sm text-card-foreground truncate">{s.clients?.company || s.clients?.name || "—"}</p>
                        {s.citta && <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{s.citta}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {s.contatto || "—"} · {s.telefono_contatto || ""} · {buildTServ(s)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> {s.n_passeggeri ?? 0}
                      </div>
                      <Badge variant="outline" className={isNuovoRosso ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : (statusColors[s.stato] || "")}>
                        {isNuovoRosso ? "Senza autista" : (statusLabels[s.stato] || s.stato)}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* DESKTOP/TABLET: tabella dinamica basata sulla vista attiva — full-bleed senza scroll orizzontale */}
        {(() => {
          const visibleCols = viste.activeView.columns.filter((c) => c.visible);
          const widthMap = computeEffectiveWidths(visibleCols);
          const colWidth = (key: ColumnKey) => `${widthMap[key] ?? 0}%`;

          const alignClass = (_key: ColumnKey) => "text-center";

          const renderCell = (key: ColumnKey, s: Servizio): React.ReactNode => {
            switch (key) {
              case "citta": return <span className="font-medium">{s.citta || "—"}</span>;
              case "data": return (
                <div className="text-center">
                  <div className={(!s.autista_id && !s.autista_esterno_id) ? "text-red-700 dark:text-red-400 font-semibold" : "font-medium"}>
                    {format(new Date(s.data_servizio), "dd/MM/yy")}
                  </div>
                  {s.ora_inizio && <div className="text-muted-foreground">{s.ora_inizio}</div>}
                </div>
              );
              case "societa": return <span className="font-semibold italic">{s.clients?.company || s.clients?.name || "—"}</span>;
              case "contatti": return s.contatto || "—";
              case "telefono": return s.telefono_contatto || "—";
              case "np": return s.n_passeggeri ?? 0;
              case "nb": return s.n_bagagli ?? 0;
              case "tserv": return buildTServ(s);
              case "luogo_inizio": return s.luogo_inizio || "—";
              case "itinerario": return s.itinerario || "—";
              case "luogo_fine": return s.luogo_fine || "—";
              case "info_autista": return s.info_autista || "—";
              case "accessori": return accessoriMap[s.id] || s.accessori || "—";
              case "veicolo": return s.veicoli ? `${s.veicoli.tipo_macchina || ""} ${s.veicoli.targa}` : (s.veicolo_tipo || "—");
              case "tp": return s.tipo_pagamento || "—";
              case "non_incassato": return s.non_incassato != null ? s.non_incassato : "—";
              case "incasso": return s.incasso ?? 0;
              case "cs": {
                const csNome = s.fornitori_cs?.nome;
                const csTel = s.fornitori_cs?.telefono;
                return csNome ? (
                <div className="flex flex-col items-center text-center leading-[1.05]">
                    <span className="font-medium">{csNome}</span>
                  {csTel && <span className="text-muted-foreground text-[7.5px]">{csTel}</span>}
                  </div>
                ) : "—";
              }
              case "costo_cs": return s.costo_cs ?? 0;
              case "autista": {
                const driverLabel = s.autisti ? `${s.autisti.nome} ${s.autisti.cognome}` : s.autisti_esterni?.nome || null;
                const driverTel = s.autisti?.cellulare || s.autisti_esterni?.cellulare || null;
                const driverTarga = s.autisti_esterni?.targa || s.veicoli?.targa || null;
                const hasLocal = !!(s.autista_id || s.autista_esterno_id);
                const partnerNome = s.network_autista_nome;
                const partnerName = networkMap[s.id]?.partnerName;
                if (!hasLocal && partnerNome) {
                  return (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex max-w-full flex-col items-center text-center overflow-hidden leading-[1.05] rounded-sm px-0.5 py-0 border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-900"
                      title="Autista assegnato dal partner del network"
                    >
                      <span className="flex max-w-full items-center gap-0.5 overflow-hidden font-medium text-indigo-900 dark:text-indigo-200">
                        <span className="truncate">{partnerNome}</span>
                        <Badge variant="outline" className="h-3 px-0.5 py-0 text-[7px] border-indigo-400 text-indigo-700 dark:text-indigo-300">N</Badge>
                      </span>
                      {s.network_autista_telefono && <span className="truncate text-indigo-800/80 dark:text-indigo-300/80 text-[7.5px]">{s.network_autista_telefono}</span>}
                      {s.network_autista_targa && <span className="truncate text-indigo-800/80 dark:text-indigo-300/80 text-[7.5px] font-mono">{s.network_autista_targa}</span>}
                      {partnerName && <span className="truncate text-[7px] italic text-indigo-700/70 dark:text-indigo-300/70">via {partnerName}</span>}
                    </div>
                  );
                }
                const isDaConf = s.stato === "da_confermare" && hasLocal;
                if (isDaConf) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleConfirmServizio(s.id); }}
                      title="Conferma servizio"
                      className="inline-flex w-full min-w-0 max-w-full flex-col items-center text-center gap-0 overflow-hidden rounded-sm px-0.5 py-0.5 leading-[1.05] bg-orange-500 text-white hover:bg-orange-600 font-semibold"
                    >
                      <span className="flex items-center gap-0.5 font-semibold">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        <span className="truncate">Conferma</span>
                      </span>
                      {driverLabel && <span className="truncate text-white/90 text-[7.5px] font-normal">{driverLabel}</span>}
                    </button>
                  );
                }
                return (
                  <AssignDriverPopover
                    currentInternoId={s.autista_id}
                    currentEsternoId={s.autista_esterno_id}
                    currentLabel={driverLabel}
                    onAssign={(driver) => handleAssignDriver(s.id, driver)}
                    trigger={
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className={`inline-flex w-full min-w-0 max-w-full flex-col items-center text-center gap-0 overflow-hidden rounded-sm px-0.5 py-0 transition-colors leading-[1.05] ${
                          driverLabel ? "hover:bg-accent" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                        }`}
                      >
                        <span className="flex max-w-full items-center gap-0.5 overflow-hidden font-medium">
                          <span className="truncate">{driverLabel || "Assegna"}</span>
                          {s.autisti_esterni && <Badge variant="outline" className="h-3 px-0.5 py-0 text-[7px]">E</Badge>}
                        </span>
                        {driverTel && <span className="truncate text-muted-foreground text-[7.5px]">{driverTel}</span>}
                        {driverTarga && <span className="truncate text-muted-foreground text-[7.5px] font-mono">{driverTarga}</span>}
                      </button>
                    }
                  />
                );
              }
              case "costo_autista": return s.costo_autista ?? 0;
              case "costo_centro": return (
                <>
                  {s.costo_centro != null ? s.costo_centro : "—"}
                  {s.centro_costo && <div className="truncate text-center text-[7px] text-muted-foreground font-normal">{s.centro_costo}</div>}
                </>
              );
              case "commissione": return s.costo_commissione ?? 0;
              case "codice": return <span className="block truncate text-center font-mono text-[8px]">{s.codice || "—"}</span>;
              case "foglio": return (
                <div className="flex items-center justify-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4"
                    title="Stampa foglio di servizio"
                    onClick={(e) => { e.stopPropagation(); printFoglioServizio(s, organization); }}
                  >
                    <Printer className="h-2.5 w-2.5" />
                  </Button>
                </div>
              );
              case "network_stato": {
                const n = networkMap[s.id];
                if (!n) return <span className="text-muted-foreground">—</span>;
                return (
                  <div className="flex max-w-full flex-col items-center text-center overflow-hidden leading-[1.05]">
                    <Badge variant="outline" className={`w-fit max-w-full text-[7px] px-0.5 py-0 ${NETWORK_STATO_COLOR[n.stato] || ""}`}>
                      {NETWORK_STATO_LABEL[n.stato] || n.stato}
                    </Badge>
                    {n.partnerName && <span className="truncate text-muted-foreground text-[7.5px] mt-0.5">{n.partnerName}</span>}
                  </div>
                );
              }
              default: return null;
            }
          };

          // Le celle che gestiscono un'interazione propria non devono aprire il dettaglio.
          const INTERACTIVE_COLS: ColumnKey[] = ["autista", "foglio"];

          return (
            <div className="hidden md:block -mx-3 lg:-mx-4 overflow-x-hidden border-y bg-card">
              <TooltipProvider delayDuration={200}>
                <table ref={tableRef} className="w-full table-fixed border-collapse text-[8px] font-semibold italic leading-[1.15] text-foreground xl:text-[8.5px]" style={{ borderSpacing: 0 }}>
                      <colgroup>
                        {visibleCols.map((c) => <col key={c.key} style={{ width: colWidth(c.key) }} />)}
                      </colgroup>
                      <thead className="border-b border-border bg-muted/70">
                        <tr className="text-[7.5px] font-bold not-italic leading-[1.05] text-foreground xl:text-[8px]">
                          {visibleCols.map((c, idx) => {
                            const def = COLUMNS_MAP[c.key];
                            const edgePad = idx === 0 ? "pl-[7px] pr-0" : idx === visibleCols.length - 1 ? "pl-0 pr-[7px]" : "px-0";
                            const isLast = idx === visibleCols.length - 1;
                            return (
                              <th key={c.key} className={`relative border-r border-border ${edgePad} py-0.5 overflow-hidden ${alignClass(c.key)}`}>
                                <div className="flex items-center justify-center gap-1">
                                  {idx === 0 && (
                                    <Checkbox
                                      className="h-2 w-2 rounded-[2px] shrink-0"
                                      checked={servizi.length > 0 && selectedVisibleCount === servizi.length ? true : selectedVisibleCount > 0 ? "indeterminate" : false}
                                      onCheckedChange={handleToggleAllVisible}
                                      aria-label="Seleziona tutti i servizi visibili"
                                    />
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help block whitespace-pre-line break-normal px-0" title={def.label}>{def.short || def.label}</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                                      <p><span className="font-semibold">{def.label}</span> — {def.description}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                {!isLast && (
                                  <div
                                    role="separator"
                                    aria-label={`Ridimensiona colonna ${def.label}`}
                                    title="Trascina per ridimensionare · doppio click: auto-fit"
                                    onMouseDown={(e) => beginColumnResize(e, c.key)}
                                    onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); autofitColumn(c.key); }}
                                    className="absolute top-0 right-0 h-full w-[6px] -mr-[3px] z-10 cursor-col-resize select-none hover:bg-primary/30 active:bg-primary/60"
                                  />
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={visibleCols.length} className="text-center py-12 text-muted-foreground text-sm">Caricamento…</td></tr>
                        ) : servizi.length === 0 ? (
                          <tr><td colSpan={visibleCols.length} className="text-center py-12 text-muted-foreground text-sm">Nessun servizio trovato</td></tr>
                        ) : (
                          servizi.map(s => {
                            const senzaAutista = !s.autista_id && !s.autista_esterno_id;
                            const modificato = !!s.modificato_da_cliente;
                            const isNuovoRosso = s.stato === "nuovo" && senzaAutista;
                            const isDaConfermare = s.stato === "da_confermare";
                            const isSelected = selectedServiziIds.includes(s.id);
                            const networkInfo = networkMap[s.id];
                            return (
                              <tr
                                key={s.id}
                                onClick={() => setDetailServizio(s)}
                                className={`border-b cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-primary/5 hover:bg-primary/10"
                                    : isNuovoRosso
                                      ? "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                                      : isDaConfermare
                                        ? "bg-orange-50/70 hover:bg-orange-50 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
                                        : "hover:bg-muted/40"
                                } ${modificato ? "border-l-4 border-l-orange-700 dark:border-l-orange-500" : ""}`}
                              >

                                {visibleCols.map((c, idx) => {
                                  const isInteractive = INTERACTIVE_COLS.includes(c.key);
                                  const isFirst = idx === 0;
                                  const isLast = idx === visibleCols.length - 1;
                                  const edgePad = isFirst ? "pl-[7px] pr-0" : isLast ? "pl-0 pr-[7px]" : "px-0";
                                  return (
                                    <td
                                      key={c.key}
                                      className={`border-r border-border ${edgePad} py-0.5 align-middle overflow-hidden break-normal whitespace-normal min-w-0 ${alignClass(c.key)} [&>*]:max-w-full`}
                                      onClick={isInteractive ? (e) => e.stopPropagation() : undefined}
                                    >
                                      {isFirst && (
                                        <div className="flex items-center justify-center gap-1 mb-0.5" onClick={(e) => e.stopPropagation()}>
                                          <Checkbox
                                            className="h-2.5 w-2.5 rounded-[2px] shrink-0"
                                            checked={isSelected}
                                            onCheckedChange={() => handleToggleServizioSelection(s.id)}
                                            aria-label="Seleziona servizio"
                                          />
                                          {modificato && <ModificheClientePopover servizioId={s.id} />}
                                          {networkInfo && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className={`inline-flex items-center gap-0.5 rounded-sm px-1 py-0 text-[9px] font-medium ${NETWORK_STATO_COLOR[networkInfo.stato] || ""}`}>
                                                  <Network className="h-2.5 w-2.5" />
                                                  {NETWORK_STATO_LABEL[networkInfo.stato] || networkInfo.stato}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent side="right" className="text-xs">
                                                Passato a {networkInfo.partnerName || "partner"} · {NETWORK_STATO_LABEL[networkInfo.stato] || networkInfo.stato}
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </div>
                                      )}
                                      {renderCell(c.key, s)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                  </tbody>
                </table>
              </TooltipProvider>
            </div>
          );
        })()}



        {/* Legenda (solo desktop/tablet) */}
        <div className="hidden md:flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
            Rosso = nuovo senza autista (da assegnare)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" />
            Arancione = autista assegnato, da confermare
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-background border border-border" />
            Bianco = confermato
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-orange-700 rounded" />
            Bordo arancione scuro = modificato dal cliente
          </div>
        </div>

        {/* Detail dialog */}
        <Dialog open={!!detailServizio} onOpenChange={o => !o && setDetailServizio(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {detailServizio && (() => {
              const s = detailServizio;
              const DetailRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => {
                if (!value) return null;
                return (
                  <div className="flex items-start gap-3 py-1.5">
                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium text-foreground">{value}</p>
                    </div>
                  </div>
                );
              };
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-base">
                      {format(new Date(s.data_servizio), "EEEE dd MMMM yyyy", { locale: itLocale })}
                      {s.ora_inizio && ` · ${s.ora_inizio}`}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-wrap gap-2 mt-1 items-center">
                    <Badge variant="outline" className={statusColors[s.stato] || ""}>{statusLabels[s.stato] || s.stato}</Badge>
                    {s.citta && <Badge variant="outline">{s.citta}</Badge>}
                    {s.stato === "da_confermare" && (s.autista_id || s.autista_esterno_id) && (
                      <Button
                        size="sm"
                        className="gap-1.5 h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => handleConfirmServizio(s.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Conferma
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto gap-1.5 h-7 text-xs"
                      onClick={() => setNetworkDialogId(s.id)}
                    >
                      <Network className="h-3.5 w-3.5" /> Network
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() => openEditServizio(s.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Modifica
                    </Button>
                  </div>

                  <Separator className="my-2" />

                  {/* T.Serv - combined service type */}
                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo Servizio</p>
                    <p className="font-medium">{buildTServ(s)}</p>
                  </div>

                  <Separator className="my-2" />

                  {/* Contact & Passenger info */}
                  <div className="space-y-0">
                    <DetailRow icon={Users} label="Società" value={s.clients?.company || s.clients?.name} />
                    <DetailRow icon={Phone} label="Contatto" value={s.contatto} />
                    <DetailRow icon={Phone} label="Telefono" value={s.telefono_contatto} />
                    <DetailRow icon={Info} label="Email Contatto" value={s.email_contatto} />
                    <DetailRow icon={Users} label="Passeggeri / Bagagli" value={`${s.n_passeggeri ?? 0} pax · ${s.n_bagagli ?? 0} bag`} />
                  </div>

                  <Separator className="my-2" />

                  {/* Route info */}
                  <div className="space-y-0">
                    <DetailRow icon={MapPin} label="Luogo Inizio" value={s.luogo_inizio} />
                    <DetailRow icon={Route} label="Itinerario" value={s.itinerario} />
                    <DetailRow icon={MapPin} label="Luogo Fine" value={s.luogo_fine} />
                  </div>

                  <Separator className="my-2" />

                  {/* Vehicle & Driver */}
                  <div className="space-y-0">
                    <DetailRow icon={Info} label="Info Autista" value={s.info_autista} />
                    <DetailRow icon={Luggage} label="Accessori" value={s.accessori} />
                    <DetailRow icon={Car} label="Veicolo" value={
                      s.veicoli ? `${s.veicoli.tipo_macchina || ""} — ${s.veicoli.targa}` : (s.veicolo_tipo || null)
                    } />
                    <DetailRow icon={Users} label="Autista" value={s.autisti ? `${s.autisti.nome} ${s.autisti.cognome}` : (s.autisti_esterni?.nome || null)} />
                    <DetailRow icon={Users} label="Fornitore CS" value={s.fornitori_cs?.nome} />
                  </div>

                  <Separator className="my-2" />

                  {/* Financial */}
                  <div className="space-y-0">
                    <DetailRow icon={CreditCard} label="Tipo Pagamento" value={s.tipo_pagamento} />
                    <DetailRow icon={CreditCard} label="Prezzo" value={s.prezzo != null ? `€ ${s.prezzo}` : null} />
                    <DetailRow icon={CreditCard} label="Incasso" value={s.incasso != null ? `€ ${s.incasso}` : null} />
                    <DetailRow icon={CreditCard} label="Costo CS" value={s.costo_cs != null ? `€ ${s.costo_cs}` : null} />
                    <DetailRow icon={CreditCard} label="Costo Autista" value={s.costo_autista != null ? `€ ${s.costo_autista}` : null} />
                    <DetailRow icon={CreditCard} label="Commissione" value={s.costo_commissione != null ? `€ ${s.costo_commissione}` : null} />
                    <DetailRow icon={Info} label="Centro Costo" value={s.centro_costo} />
                  </div>

                  {(s.codice || s.foglio || s.note) && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-0">
                        <DetailRow icon={Info} label="Codice" value={s.codice} />
                        <DetailRow icon={Info} label="Foglio" value={s.foglio} />
                        <DetailRow icon={Info} label="Note" value={s.note} />
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Nuovo servizio */}
        <ServizioFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode="create"
          clients={clients}
          autisti={autisti}
          veicoli={veicoli}
          fornitori={fornitori}
          isAdmin={isAdmin}
          userId={user?.id}
          onSaved={loadServizi}
        />

        {/* Modifica servizio */}
        <ServizioFormDialog
          open={!!editServizio}
          onOpenChange={o => { if (!o) setEditServizio(null); }}
          mode="edit"
          initialData={editServizio}
          clients={clients}
          autisti={autisti}
          veicoli={veicoli}
          fornitori={fornitori}
          isAdmin={isAdmin}
          userId={user?.id}
          onSaved={loadServizi}
        />

        <NetworkDispatchDialog
          open={!!networkDialogId}
          onOpenChange={(o) => { if (!o) setNetworkDialogId(null); }}
          servizioId={networkDialogId}
          onChanged={loadServizi}
        />

        <ColumnCustomizer
          open={customizerOpen}
          onOpenChange={setCustomizerOpen}
          activeView={viste.activeView}
          onUpdateColumns={(cols) => viste.updateViewColumns(viste.activeView.id, cols)}
          onSaveAs={(nome, cols) => viste.saveNewView(nome, cols)}
          onRename={(nome) => viste.renameView(viste.activeView.id, nome)}
          onDelete={() => viste.deleteView(viste.activeView.id)}
          onSetDefault={() => viste.setAsDefault(viste.activeView.id)}
          onResetWidths={() => viste.resetColumnWidths(viste.activeView.id)}
        />

        <AlertDialog open={confermaTuttiOpen} onOpenChange={setConfermaTuttiOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma tutti i servizi</AlertDialogTitle>
              <AlertDialogDescription>
                Stai per confermare {idsDaConfermareVisibili.length} servizi. Procedere?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfermaTutti} className="bg-orange-600 hover:bg-orange-700 text-white">
                Conferma
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
