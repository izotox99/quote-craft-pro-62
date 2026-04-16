import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PlusCircle, Search, Download, FileText } from "lucide-react";
import { format, addDays } from "date-fns";
import { it as itLocale } from "date-fns/locale";

type Servizio = {
  id: string;
  data_servizio: string;
  citta: string | null;
  luogo_inizio: string | null;
  luogo_fine: string | null;
  itinerario: string | null;
  stato: string;
  tipologia: string | null;
  contatto: string | null;
  telefono_contatto: string | null;
  n_passeggeri: number | null;
  n_bagagli: number | null;
  accessori: string | null;
  info_autista: string | null;
  codice: string | null;
  foglio: string | null;
  incasso: number | null;
  costo_cs: number | null;
  costo_autista: number | null;
  costo_commissione: number | null;
  note: string | null;
  clients: { name: string; company: string | null } | null;
  autisti: { nome: string; cognome: string } | null;
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

export default function Servizi() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    citta: "",
    luogo_inizio: "",
    luogo_fine: "",
    itinerario: "",
    stato: "nuovo" as string,
    tipologia: "transfer" as string,
    client_id: "",
    contatto: "",
    telefono_contatto: "",
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
      .select("*, clients(name, company), autisti(nome, cognome), veicoli(targa, tipo_macchina), fornitori_cs(nome)")
      .gte("data_servizio", filterDal)
      .lte("data_servizio", filterAl)
      .order("data_servizio", { ascending: true });

    if (filterStato !== "all") query = query.eq("stato", filterStato as any);
    if (filterTipologia !== "all") query = query.eq("tipologia", filterTipologia as any);
    if (filterTarga) query = query.ilike("veicoli.targa", `%${filterTarga}%`);
    if (filterContatto) query = query.ilike("contatto", `%${filterContatto}%`);
    if (filterCliente !== "all") query = query.eq("client_id", filterCliente);
    if (filterAutista !== "all") query = query.eq("autista_id", filterAutista);
    if (filterFornitore !== "all") query = query.eq("fornitore_cs_id", filterFornitore);
    if (filterCodice) query = query.ilike("codice", `%${filterCodice}%`);

    const { data } = await query;
    setServizi((data ?? []) as unknown as Servizio[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadLookups();
      loadServizi();
    }
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

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Quick day filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground mr-1">Nuovi Servizi:</span>
          {quickDayOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleQuickDay(opt.key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${quickDay === opt.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }
              `}
            >
              {opt.label}
              {quickDayCounts[opt.key] > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  quickDay === opt.key ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
                }`}>
                  {quickDayCounts[opt.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Dal</Label>
                <Input type="date" value={filterDal} onChange={e => setFilterDal(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Al</Label>
                <Input type="date" value={filterAl} onChange={e => setFilterAl(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Stato</Label>
                <Select value={filterStato} onValueChange={setFilterStato}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">---</SelectItem>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Tipologia</Label>
                <Select value={filterTipologia} onValueChange={setFilterTipologia}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">---</SelectItem>
                    {Object.entries(tipologiaLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Targa</Label>
                <Input value={filterTarga} onChange={e => setFilterTarga(e.target.value)} placeholder="" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Contatto</Label>
                <Input value={filterContatto} onChange={e => setFilterContatto(e.target.value)} placeholder="" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Società Cliente</Label>
                <Select value={filterCliente} onValueChange={setFilterCliente}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">---</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Autista</Label>
                <Select value={filterAutista} onValueChange={setFilterAutista}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">---</SelectItem>
                    {autisti.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.cognome} {a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Fornitore CS</Label>
                <Select value={filterFornitore} onValueChange={setFilterFornitore}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">---</SelectItem>
                    {fornitori.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold italic">Codice</Label>
                <Input value={filterCodice} onChange={e => setFilterCodice(e.target.value)} placeholder="" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={handleSearch} className="gap-2" variant="destructive">
                <Search className="h-4 w-4" /> Ricerca!
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Home</h2>
          <span className="text-sm text-muted-foreground">{nuoviCount} Servizi Nuovi</span>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
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
                  <Input type="date" value={form.data_servizio} onChange={e => setForm({ ...form, data_servizio: e.target.value })} />
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

        {/* Services Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Città</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Società</TableHead>
                    <TableHead>Contatto</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>N.P</TableHead>
                    <TableHead>N.B</TableHead>
                    <TableHead>Luogo Inizio</TableHead>
                    <TableHead>Itinerario</TableHead>
                    <TableHead>Luogo Fine</TableHead>
                    <TableHead>Info Autista</TableHead>
                    <TableHead>Accessori</TableHead>
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Targa</TableHead>
                    <TableHead>Inc €</TableHead>
                    <TableHead>CS €</TableHead>
                    <TableHead>Aut €</TableHead>
                    <TableHead>Com €</TableHead>
                    <TableHead>Codice</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center py-8 text-muted-foreground">
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  ) : servizi.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center py-8 text-muted-foreground">
                        Nessun servizio trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    servizi.map((s) => (
                      <TableRow key={s.id} className="text-xs">
                        <TableCell>{s.citta || ""}</TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(s.data_servizio), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{s.clients?.company || s.clients?.name || ""}</TableCell>
                        <TableCell>{s.contatto || ""}</TableCell>
                        <TableCell>{s.telefono_contatto || ""}</TableCell>
                        <TableCell>{s.n_passeggeri}</TableCell>
                        <TableCell>{s.n_bagagli}</TableCell>
                        <TableCell>{s.luogo_inizio || ""}</TableCell>
                        <TableCell>{s.itinerario || ""}</TableCell>
                        <TableCell>{s.luogo_fine || ""}</TableCell>
                        <TableCell>{s.info_autista || ""}</TableCell>
                        <TableCell>{s.accessori || ""}</TableCell>
                        <TableCell>{s.veicoli?.tipo_macchina || ""}</TableCell>
                        <TableCell>{s.veicoli?.targa || ""}</TableCell>
                        <TableCell>{Number(s.incasso || 0).toFixed(0)}</TableCell>
                        <TableCell>{Number(s.costo_cs || 0).toFixed(0)}</TableCell>
                        <TableCell>{Number(s.costo_autista || 0).toFixed(0)}</TableCell>
                        <TableCell>{Number(s.costo_commissione || 0).toFixed(0)}</TableCell>
                        <TableCell>{s.codice || ""}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[s.stato] || ""}>
                            {statusLabels[s.stato] || s.stato}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
