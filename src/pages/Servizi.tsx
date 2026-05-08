import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { AssignDriverPopover, BulkAssignBar, type DriverOption } from "@/components/AssignDriverPopover";
import {
  VEICOLI_DISPONIBILI,
  TIPOLOGIA_OPZIONI,
  TOUR_OPZIONI,
  PAGAMENTO_OPZIONI,
  CITTA_OPZIONI,
  detectLuogoSpeciale,
  LuogoField,
  tipologiaToDB,
  transferTipoForDB,
} from "@/lib/booking-shared";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Search, SlidersHorizontal, ChevronDown, ChevronRight, X, MapPin, Phone, Users, Car, Route, CreditCard, Info, Luggage, AlertTriangle, Bell } from "lucide-react";
import { useHorizontalWheel } from "@/hooks/use-horizontal-wheel";
import { ModificheClientePopover } from "@/components/ModificheClientePopover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  codice: string | null;
  foglio: string | null;
  incasso: number | null;
  costo_cs: number | null;
  costo_autista: number | null;
  costo_commissione: number | null;
  note: string | null;
  autista_id: string | null;
  autista_esterno_id: string | null;
  modificato_da_cliente: boolean | null;
  modificato_at: string | null;
  clients: { name: string; company: string | null } | null;
  autisti: { nome: string; cognome: string } | null;
  autisti_esterni: { nome: string } | null;
  veicoli: { targa: string; tipo_macchina: string | null } | null;
  fornitori_cs: { nome: string } | null;
};

type Client = { id: string; name: string; company: string | null };
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

export default function Servizi() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailServizio, setDetailServizio] = useState<Servizio | null>(null);
  const [selectedServiziIds, setSelectedServiziIds] = useState<string[]>([]);
  const tableScrollRef = useHorizontalWheel<HTMLDivElement>();

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

  // New service form
  const [form, setForm] = useState({
    data_servizio: format(new Date(), "yyyy-MM-dd"),
    ora_inizio: "",
    citta: "",
    luogo_inizio: "",
    luogo_inizio_dettaglio: "",
    luogo_fine: "",
    luogo_fine_dettaglio: "",
    itinerario: "",
    stato: "nuovo" as string,
    tipologia_servizio: "" as string, // transfer_interno | transfer_regionale | tour
    tour_tipo: "",
    veicolo_tipo: "", // tipo veicolo (catalogo booking)
    tipo_pagamento: "",
    prezzo: "",
    client_id: "",
    contatto: "",
    telefono_contatto: "",
    email_contatto: "",
    autista_id: "",
    veicolo_id: "",
    fornitore_cs_id: "",
    n_passeggeri: 1,
    n_bagagli: 0,
    accessori: "",
    info_autista: "",
    codice: "",
    foglio: "",
    incasso: 0,
    costo_cs: 0,
    costo_autista: 0,
    costo_commissione: 0,
    note: "",
  });

  const luogoInizioSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio),
    [form.luogo_inizio, form.citta, form.luogo_inizio_dettaglio]
  );
  const luogoFineSpeciale = useMemo(
    () => detectLuogoSpeciale(form.luogo_fine, form.citta, form.luogo_fine_dettaglio),
    [form.luogo_fine, form.citta, form.luogo_fine_dettaglio]
  );

  const loadLookups = async () => {
    const [c, a, v, f] = await Promise.all([
      supabase.from("clients").select("id, name, company").order("name"),
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
      .select("*, clients(name, company), autisti(nome, cognome), autisti_esterni(nome), veicoli(targa, tipo_macchina), fornitori_cs(nome)")
      .gte("data_servizio", filterDal)
      .lte("data_servizio", filterAl)
      .order("data_servizio", { ascending: true });

    if (filterStato === "all") query = query.neq("stato", "annullato");
    else query = query.eq("stato", filterStato as any);
    if (filterTipologia !== "all") query = query.eq("tipologia", filterTipologia as any);
    if (filterTarga) query = query.ilike("veicoli.targa", `%${filterTarga}%`);
    if (filterContatto) query = query.ilike("contatto", `%${filterContatto}%`);
    if (filterCliente !== "all") query = query.eq("client_id", filterCliente);
    if (filterAutista !== "all") query = query.eq("autista_id", filterAutista);
    if (filterFornitore !== "all") query = query.eq("fornitore_cs_id", filterFornitore);
    if (filterCodice) query = query.ilike("codice", `%${filterCodice}%`);

    const { data } = await query;
    const nextServizi = (data ?? []) as unknown as Servizio[];
    setServizi(nextServizi);
    setSelectedServiziIds(prev => prev.filter(id => nextServizi.some(servizio => servizio.id === id)));
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

  const handleCreate = async () => {
    const insertData: Record<string, unknown> = {
      data_servizio: form.data_servizio,
      citta: form.citta || null,
      luogo_inizio: form.luogo_inizio || null,
      luogo_fine: form.luogo_fine || null,
      itinerario: form.itinerario || null,
      stato: form.stato,
      tipologia: form.tipologia,
      contatto: form.contatto || null,
      telefono_contatto: form.telefono_contatto || null,
      n_passeggeri: form.n_passeggeri,
      n_bagagli: form.n_bagagli,
      accessori: form.accessori || null,
      info_autista: form.info_autista || null,
      codice: form.codice || null,
      foglio: form.foglio || null,
      incasso: form.incasso,
      costo_cs: form.costo_cs,
      costo_autista: form.costo_autista,
      costo_commissione: form.costo_commissione,
      note: form.note || null,
      created_by: user?.id,
    };
    if (form.client_id) insertData.client_id = form.client_id;
    if (form.autista_id) insertData.autista_id = form.autista_id;
    if (form.veicolo_id) insertData.veicolo_id = form.veicolo_id;
    if (form.fornitore_cs_id) insertData.fornitore_cs_id = form.fornitore_cs_id;

    const { error } = await supabase.from("servizi").insert(insertData as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Servizio creato!");
      setDialogOpen(false);
      loadServizi();
    }
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
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Servizi</h1>
            <p className="text-sm text-muted-foreground">{nuoviCount} nuovi · {servizi.length} totali</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <PlusCircle className="h-4 w-4" /> Nuovo Servizio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuovo Servizio</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Data Servizio</Label>
                  <DatePicker value={form.data_servizio} onChange={(v) => setForm({ ...form, data_servizio: v })} />
                </div>
                <div className="space-y-1">
                  <Label>Città</Label>
                  <Input value={form.citta} onChange={e => setForm({ ...form, citta: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Luogo Inizio</Label>
                  <Input value={form.luogo_inizio} onChange={e => setForm({ ...form, luogo_inizio: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Luogo Fine</Label>
                  <Input value={form.luogo_fine} onChange={e => setForm({ ...form, luogo_fine: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Itinerario</Label>
                  <Input value={form.itinerario} onChange={e => setForm({ ...form, itinerario: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Stato</Label>
                  <Select value={form.stato} onValueChange={v => setForm({ ...form, stato: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipologia</Label>
                  <Select value={form.tipologia} onValueChange={v => setForm({ ...form, tipologia: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(tipologiaLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Società Cliente</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Contatto</Label>
                  <Input value={form.contatto} onChange={e => setForm({ ...form, contatto: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Telefono Contatto</Label>
                  <Input value={form.telefono_contatto} onChange={e => setForm({ ...form, telefono_contatto: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Autista</Label>
                  <Select value={form.autista_id} onValueChange={v => setForm({ ...form, autista_id: v })}>
                    <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      {autisti.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.cognome} {a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Veicolo</Label>
                  <Select value={form.veicolo_id} onValueChange={v => setForm({ ...form, veicolo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      {veicoli.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.targa} - {v.tipo_macchina || ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Fornitore CS</Label>
                  <Select value={form.fornitore_cs_id} onValueChange={v => setForm({ ...form, fornitore_cs_id: v })}>
                    <SelectTrigger><SelectValue placeholder="---" /></SelectTrigger>
                    <SelectContent>
                      {fornitori.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>N. Passeggeri</Label>
                  <Input type="number" value={form.n_passeggeri} onChange={e => setForm({ ...form, n_passeggeri: +e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>N. Bagagli</Label>
                  <Input type="number" value={form.n_bagagli} onChange={e => setForm({ ...form, n_bagagli: +e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Accessori</Label>
                  <Input value={form.accessori} onChange={e => setForm({ ...form, accessori: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Info Autista</Label>
                  <Input value={form.info_autista} onChange={e => setForm({ ...form, info_autista: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Codice</Label>
                  <Input value={form.codice} onChange={e => setForm({ ...form, codice: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Foglio</Label>
                  <Input value={form.foglio} onChange={e => setForm({ ...form, foglio: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Incasso €</Label>
                  <Input type="number" step="0.01" value={form.incasso} onChange={e => setForm({ ...form, incasso: +e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Costo CS €</Label>
                  <Input type="number" step="0.01" value={form.costo_cs} onChange={e => setForm({ ...form, costo_cs: +e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Costo Autista €</Label>
                  <Input type="number" step="0.01" value={form.costo_autista} onChange={e => setForm({ ...form, costo_autista: +e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Costo Commissione €</Label>
                  <Input type="number" step="0.01" value={form.costo_commissione} onChange={e => setForm({ ...form, costo_commissione: +e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Note</Label>
                  <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleCreate}>Crea Servizio</Button>
              </div>
            </DialogContent>
          </Dialog>
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

        {/* DESKTOP/TABLET: schema completo */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div ref={tableScrollRef} className="h-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="h-9 w-10 px-2">
                      <Checkbox
                        checked={servizi.length > 0 && selectedVisibleCount === servizi.length ? true : selectedVisibleCount > 0 ? "indeterminate" : false}
                        onCheckedChange={handleToggleAllVisible}
                        aria-label="Seleziona tutti i servizi visibili"
                      />
                    </TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Città</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Data</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Società</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Contatti</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Telefono</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-center">N.P</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-center">N.B</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">T.Serv</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Luogo inizio</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Itinerario</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Luogo fine</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Info autista</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Accessori</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Veicolo</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">T.P</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-right">Inc €</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">CS</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-right">CS €</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Aut</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-right">Aut €</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-right">C.C</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-right">Com €</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Codice</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Foglio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={25} className="text-center py-12 text-muted-foreground text-sm">Caricamento…</TableCell></TableRow>
                  ) : servizi.length === 0 ? (
                    <TableRow><TableCell colSpan={25} className="text-center py-12 text-muted-foreground text-sm">Nessun servizio trovato</TableCell></TableRow>
                  ) : (
                    servizi.map(s => {
                      const senzaAutista = !s.autista_id && !s.autista_esterno_id;
                      const modificato = s.modificato_da_cliente;
                      const isSelected = selectedServiziIds.includes(s.id);
                      const driverLabel = s.autisti
                        ? `${s.autisti.nome} ${s.autisti.cognome}`
                        : s.autisti_esterni?.nome || null;
                      return (
                        <TableRow
                          key={s.id}
                          onClick={() => setDetailServizio(s)}
                          className={`text-xs cursor-pointer ${
                            isSelected
                              ? "bg-primary/5 hover:bg-primary/10"
                              : senzaAutista
                                ? "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                                : ""
                          } ${modificato ? "border-l-4 border-l-amber-500" : ""}`}
                        >
                          <TableCell className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleServizioSelection(s.id)}
                              aria-label="Seleziona servizio"
                            />
                          </TableCell>
                          <TableCell className="py-2 font-medium">{s.citta || "—"}</TableCell>
                          <TableCell className="py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {modificato && (
                                <ModificheClientePopover servizioId={s.id} />
                              )}
                              <div>
                                <div className={senzaAutista ? "text-red-700 dark:text-red-400 font-semibold" : ""}>
                                  {format(new Date(s.data_servizio), "dd/MM/yyyy")}
                                </div>
                                {s.ora_inizio && <div className="text-muted-foreground">{s.ora_inizio}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 font-semibold italic">{s.clients?.company || s.clients?.name || "—"}</TableCell>
                          <TableCell className="py-2">{s.contatto || "—"}</TableCell>
                          <TableCell className="py-2 whitespace-nowrap">{s.telefono_contatto || "—"}</TableCell>
                          <TableCell className="py-2 text-center">{s.n_passeggeri ?? 0}</TableCell>
                          <TableCell className="py-2 text-center">{s.n_bagagli ?? 0}</TableCell>
                          <TableCell className="py-2">{buildTServ(s)}</TableCell>
                          <TableCell className="py-2 max-w-[200px] truncate" title={s.luogo_inizio || ""}>{s.luogo_inizio || "—"}</TableCell>
                          <TableCell className="py-2 max-w-[200px] truncate" title={s.itinerario || ""}>{s.itinerario || "—"}</TableCell>
                          <TableCell className="py-2 max-w-[200px] truncate" title={s.luogo_fine || ""}>{s.luogo_fine || "—"}</TableCell>
                          <TableCell className="py-2 max-w-[180px] truncate" title={s.info_autista || ""}>{s.info_autista || "—"}</TableCell>
                          <TableCell className="py-2">{s.accessori || "—"}</TableCell>
                          <TableCell className="py-2">{s.veicoli ? `${s.veicoli.tipo_macchina || ""} ${s.veicoli.targa}` : (s.veicolo_tipo || "—")}</TableCell>
                          <TableCell className="py-2">{s.tipo_pagamento || "—"}</TableCell>
                          <TableCell className="py-2 text-right tabular-nums">{s.incasso ?? 0}</TableCell>
                          <TableCell className="py-2">{s.fornitori_cs?.nome || "—"}</TableCell>
                          <TableCell className="py-2 text-right tabular-nums">{s.costo_cs ?? 0}</TableCell>
                          <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                            <AssignDriverPopover
                              currentInternoId={s.autista_id}
                              currentEsternoId={s.autista_esterno_id}
                              currentLabel={driverLabel}
                              onAssign={(driver) => handleAssignDriver(s.id, driver)}
                              trigger={
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`inline-flex max-w-[150px] items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors ${
                                    driverLabel
                                      ? "hover:bg-accent"
                                      : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  }`}
                                >
                                  <span className="truncate text-[11px] font-medium">{driverLabel || "Assegna"}</span>
                                  {s.autisti_esterni && (
                                    <Badge variant="outline" className="h-4 px-1 py-0 text-[9px]">EXT</Badge>
                                  )}
                                </button>
                              }
                            />
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">{s.costo_autista ?? 0}</TableCell>
                          <TableCell className="py-2 text-right tabular-nums">{s.centro_costo || "—"}</TableCell>
                          <TableCell className="py-2 text-right tabular-nums">{s.costo_commissione ?? 0}</TableCell>
                          <TableCell className="py-2 font-mono text-[11px]">{s.codice || "—"}</TableCell>
                          <TableCell className="py-2 font-mono text-[11px]">{s.foglio || "—"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

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
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge variant="outline" className={statusColors[s.stato] || ""}>{statusLabels[s.stato] || s.stato}</Badge>
                    {s.citta && <Badge variant="outline">{s.citta}</Badge>}
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
      </div>
    </DashboardLayout>
  );
}
