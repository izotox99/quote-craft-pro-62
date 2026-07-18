import { useEffect, useState, useMemo } from "react";
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
import { AssignDriverPopover, BulkAssignBar, type DriverOption } from "@/components/AssignDriverPopover";
import { ServizioFormDialog, type ServizioFormInitial } from "@/components/servizi/ServizioFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Search, SlidersHorizontal, ChevronDown, ChevronRight, X, MapPin, Phone, Users, Car, Route, CreditCard, Info, Luggage, Bell, Printer, Pencil } from "lucide-react";
import { ModificheClientePopover } from "@/components/ModificheClientePopover";
import { format, addDays } from "date-fns";
import { it as itLocale } from "date-fns/locale";

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
  confermato: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_corso: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completato: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  annullato: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusLabels: Record<string, string> = {
  nuovo: "Nuovo",
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
  const driverLabel = s.autisti ? `${s.autisti.nome} ${s.autisti.cognome}` : (s.autisti_esterni?.nome || "");
  const driverTel = s.autisti?.cellulare || s.autisti_esterni?.cellulare || "";
  const targa = s.autisti_esterni?.targa || s.veicoli?.targa || "";
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
        ${row("Autista", driverLabel)}
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

  // Form state is managed inside <ServizioFormDialog />


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
    const payload = driver === null
      ? { autista_id: null, autista_esterno_id: null }
      : driver.kind === "interno"
        ? { autista_id: driver.id, autista_esterno_id: null, modificato_da_cliente: false, modificato_at: null }
        : { autista_id: null, autista_esterno_id: driver.id, modificato_da_cliente: false, modificato_at: null };

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
      ? { autista_id: driver.id, autista_esterno_id: null, modificato_da_cliente: false, modificato_at: null }
      : { autista_id: null, autista_esterno_id: driver.id, modificato_da_cliente: false, modificato_at: null };

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
      <div className="space-y-4 overflow-x-clip">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Servizi</h1>
            <p className="text-sm text-muted-foreground">{nuoviCount} nuovi · {servizi.length} totali</p>
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
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <PlusCircle className="h-4 w-4" /> Nuovo Servizio
            </Button>
          </div>

        </div>

        {/* Quick day chips + collapsible filters */}
        <Card>
          <CardContent className="py-4 space-y-3">
            {/* Day chips row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Nuovi:</span>
              {quickDayOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleQuickDay(opt.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
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
              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group ${
                    senzaAutista ? "bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900" : ""
                  } ${modificato ? "border-l-4 border-l-amber-500" : ""}`}
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
                      <Badge variant="outline" className={senzaAutista ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : (statusColors[s.stato] || "")}>
                        {senzaAutista ? "Senza autista" : (statusLabels[s.stato] || s.stato)}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* DESKTOP/TABLET: schema completo — full-bleed, 25 colonne senza scroll orizzontale */}
        <div className="hidden md:block relative left-1/2 -translate-x-1/2 w-screen">
          <Card className="rounded-none border-x-0">
            <CardContent className="p-0">
              <table className="w-full table-fixed text-[11px] leading-tight">
                <colgroup>
                  <col style={{ width: "2%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "2%" }} />
                  <col style={{ width: "2%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "2%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "2%" }} />
                </colgroup>
                <thead className="bg-muted/40 border-b">
                  <tr className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                    <th className="px-1 py-1.5">
                      <Checkbox
                        checked={servizi.length > 0 && selectedVisibleCount === servizi.length ? true : selectedVisibleCount > 0 ? "indeterminate" : false}
                        onCheckedChange={handleToggleAllVisible}
                        aria-label="Seleziona tutti i servizi visibili"
                      />
                    </th>
                    <th className="px-1 py-1.5 text-left" title="Città">Città</th>
                    <th className="px-1 py-1.5 text-left" title="Data servizio">Data</th>
                    <th className="px-1 py-1.5 text-left" title="Società cliente">Società</th>
                    <th className="px-1 py-1.5 text-left" title="Contatti (referente/passeggero)">Contatti</th>
                    <th className="px-1 py-1.5 text-left" title="Telefono">Telefono</th>
                    <th className="px-1 py-1.5 text-center" title="Numero passeggeri">N.P</th>
                    <th className="px-1 py-1.5 text-center" title="Numero bagagli">N.B</th>
                    <th className="px-1 py-1.5 text-left" title="Tipo servizio">T.Serv</th>
                    <th className="px-1 py-1.5 text-left" title="Luogo inizio">Luogo inizio</th>
                    <th className="px-1 py-1.5 text-left" title="Itinerario">Itinerario</th>
                    <th className="px-1 py-1.5 text-left" title="Luogo fine">Luogo fine</th>
                    <th className="px-1 py-1.5 text-left" title="Info autista">Info autista</th>
                    <th className="px-1 py-1.5 text-left" title="Accessori">Access.</th>
                    <th className="px-1 py-1.5 text-left" title="Veicolo">Veicolo</th>
                    <th className="px-1 py-1.5 text-left" title="Tipo pagamento">T.P</th>
                    <th className="px-1 py-1.5 text-right" title="Non incassato €">No Inc €</th>
                    <th className="px-1 py-1.5 text-right" title="Incassato €">Inc €</th>
                    <th className="px-1 py-1.5 text-left" title="Fornitore Corriere Speciale (nome + telefono)">CS</th>
                    <th className="px-1 py-1.5 text-right" title="Costo CS €">CS €</th>
                    <th className="px-1 py-1.5 text-left" title="Autista (nome + telefono + targa)">Aut</th>
                    <th className="px-1 py-1.5 text-right" title="Costo autista €">Aut €</th>
                    <th className="px-1 py-1.5 text-right" title="Costo centro di costo €">C.C €</th>
                    <th className="px-1 py-1.5 text-right" title="Commissione €">Com €</th>
                    <th className="px-1 py-1.5 text-left" title="Codice">Codice</th>
                    <th className="px-1 py-1.5 text-center" title="Stampa foglio di servizio">Foglio</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={26} className="text-center py-12 text-muted-foreground text-sm">Caricamento…</td></tr>
                  ) : servizi.length === 0 ? (
                    <tr><td colSpan={26} className="text-center py-12 text-muted-foreground text-sm">Nessun servizio trovato</td></tr>
                  ) : (
                    servizi.map(s => {
                      const senzaAutista = !s.autista_id && !s.autista_esterno_id;
                      const modificato = s.modificato_da_cliente;
                      const isSelected = selectedServiziIds.includes(s.id);
                      const driverLabel = s.autisti
                        ? `${s.autisti.nome} ${s.autisti.cognome}`
                        : s.autisti_esterni?.nome || null;
                      const driverTel = s.autisti?.cellulare || s.autisti_esterni?.cellulare || null;
                      const driverTarga = s.autisti_esterni?.targa || s.veicoli?.targa || null;
                      const csNome = s.fornitori_cs?.nome || null;
                      const csTel = s.fornitori_cs?.telefono || null;
                      const cellCls = "px-1 py-1 align-top break-words";
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setDetailServizio(s)}
                          className={`border-b cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/5 hover:bg-primary/10"
                              : senzaAutista
                                ? "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                                : "hover:bg-muted/40"
                          } ${modificato ? "border-l-4 border-l-amber-500" : ""}`}
                        >
                          <td className={cellCls} onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleServizioSelection(s.id)}
                              aria-label="Seleziona servizio"
                            />
                          </td>
                          <td className={`${cellCls} font-medium`}>{s.citta || "—"}</td>
                          <td className={cellCls}>
                            <div className="flex items-start gap-1">
                              {modificato && <ModificheClientePopover servizioId={s.id} />}
                              <div>
                                <div className={senzaAutista ? "text-red-700 dark:text-red-400 font-semibold" : "font-medium"}>
                                  {format(new Date(s.data_servizio), "dd/MM/yy")}
                                </div>
                                {s.ora_inizio && <div className="text-muted-foreground">{s.ora_inizio}</div>}
                              </div>
                            </div>
                          </td>
                          <td className={`${cellCls} font-semibold italic`}>{s.clients?.company || s.clients?.name || "—"}</td>
                          <td className={cellCls}>{s.contatto || "—"}</td>
                          <td className={cellCls}>{s.telefono_contatto || "—"}</td>
                          <td className={`${cellCls} text-center`}>{s.n_passeggeri ?? 0}</td>
                          <td className={`${cellCls} text-center`}>{s.n_bagagli ?? 0}</td>
                          <td className={cellCls}>{buildTServ(s)}</td>
                          <td className={cellCls}>{s.luogo_inizio || "—"}</td>
                          <td className={cellCls}>{s.itinerario || "—"}</td>
                          <td className={cellCls}>{s.luogo_fine || "—"}</td>
                          <td className={cellCls}>{s.info_autista || "—"}</td>
                          <td className={cellCls}>{s.accessori || "—"}</td>
                          <td className={cellCls}>{s.veicoli ? `${s.veicoli.tipo_macchina || ""} ${s.veicoli.targa}` : (s.veicolo_tipo || "—")}</td>
                          <td className={cellCls}>{s.tipo_pagamento || "—"}</td>
                          <td className={`${cellCls} text-right tabular-nums`}>{s.non_incassato != null ? s.non_incassato : "—"}</td>
                          <td className={`${cellCls} text-right tabular-nums`}>{s.incasso ?? 0}</td>
                          <td className={cellCls}>
                            {csNome ? (
                              <div className="flex flex-col leading-tight">
                                <span className="font-medium">{csNome}</span>
                                {csTel && <span className="text-muted-foreground text-[10px]">{csTel}</span>}
                              </div>
                            ) : "—"}
                          </td>
                          <td className={`${cellCls} text-right tabular-nums`}>{s.costo_cs ?? 0}</td>
                          <td className={cellCls} onClick={(e) => e.stopPropagation()}>
                            <AssignDriverPopover
                              currentInternoId={s.autista_id}
                              currentEsternoId={s.autista_esterno_id}
                              currentLabel={driverLabel}
                              onAssign={(driver) => handleAssignDriver(s.id, driver)}
                              trigger={
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`inline-flex w-full flex-col items-start gap-0 rounded-md px-1 py-0.5 text-left transition-colors leading-tight ${
                                    driverLabel ? "hover:bg-accent" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  }`}
                                >
                                  <span className="flex items-center gap-1 font-medium">
                                    <span className="break-words">{driverLabel || "Assegna"}</span>
                                    {s.autisti_esterni && <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">EXT</Badge>}
                                  </span>
                                  {driverTel && <span className="text-muted-foreground text-[10px]">{driverTel}</span>}
                                  {driverTarga && <span className="text-muted-foreground text-[10px] font-mono">{driverTarga}</span>}
                                </button>
                              }
                            />
                          </td>
                          <td className={`${cellCls} text-right tabular-nums`}>{s.costo_autista ?? 0}</td>
                          <td className={`${cellCls} text-right tabular-nums`}>
                            {s.costo_centro != null ? s.costo_centro : "—"}
                            {s.centro_costo && <div className="text-[9px] text-muted-foreground font-normal">{s.centro_costo}</div>}
                          </td>
                          <td className={`${cellCls} text-right tabular-nums`}>{s.costo_commissione ?? 0}</td>
                          <td className={`${cellCls} font-mono text-[10px]`}>{s.codice || "—"}</td>
                          <td className={`${cellCls} text-center`} onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Stampa foglio di servizio"
                              onClick={() => printFoglioServizio(s, organization)}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>


        {/* Legenda (solo desktop/tablet) */}
        <div className="hidden md:flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
            Riga rossa = senza autista (da assegnare per confermare)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-amber-500 rounded" />
            Bordo giallo = modificato dal cliente
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto gap-1.5 h-7 text-xs"
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
      </div>
    </DashboardLayout>
  );
}
