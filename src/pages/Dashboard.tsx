import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Bell, Sparkles, UserPlus, XCircle } from "lucide-react";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { AssignDriverPopover, BulkAssignBar, type DriverOption } from "@/components/AssignDriverPopover";
import { toast } from "sonner";

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
  n_passeggeri: number | null;
  n_bagagli: number | null;
  accessori: string | null;
  info_autista: string | null;
  veicolo_tipo: string | null;
  tipo_pagamento: string | null;
  prezzo: number | null;
  note: string | null;
  codice: string | null;
  foglio: string | null;
  incasso: number | null;
  costo_cs: number | null;
  costo_autista: number | null;
  costo_commissione: number | null;
  centro_costo: string | null;
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

const tipologiaLabels: Record<string, string> = {
  transfer: "Transfer", disposizione: "Disposizione", tour: "Tour", evento: "Evento", altro: "Altro",
};

function buildTipoServ(s: Servizio) {
  const parts: string[] = [];
  if (s.tipologia) parts.push(tipologiaLabels[s.tipologia] || s.tipologia);
  if (s.transfer_tipo) parts.push(s.transfer_tipo);
  if (s.tour_tipo) parts.push(s.tour_tipo);
  if (s.disposizione_oraria) parts.push(s.disposizione_oraria);
  return parts.join(" · ") || "—";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dal, setDal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [al, setAl] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [statoFilter, setStatoFilter] = useState<string>("tutti");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("servizi")
      .select("*, clients(name, company), autisti(nome, cognome), autisti_esterni(nome), veicoli(targa, tipo_macchina), fornitori_cs(nome)")
      .gte("data_servizio", dal)
      .lte("data_servizio", al)
      .order("data_servizio", { ascending: true })
      .order("ora_inizio", { ascending: true });
    setServizi((data ?? []) as unknown as Servizio[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    setSelected(new Set());
  }, [user, dal, al]);

  const filtered = useMemo(() => {
    let list = servizi;
    if (statoFilter === "senza_autista") list = list.filter(s => !s.autista_id && !s.autista_esterno_id);
    else if (statoFilter === "modificati") list = list.filter(s => s.modificato_da_cliente);
    else if (statoFilter !== "tutti") list = list.filter(s => s.stato === statoFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(s =>
        (s.clients?.company || s.clients?.name || "").toLowerCase().includes(q) ||
        (s.contatto || "").toLowerCase().includes(q) ||
        (s.codice || "").toLowerCase().includes(q) ||
        (s.citta || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [servizi, statoFilter, search]);

  const counts = useMemo(() => ({
    totale: servizi.length,
    senzaAutista: servizi.filter(s => !s.autista_id && !s.autista_esterno_id).length,
    modificati: servizi.filter(s => s.modificato_da_cliente).length,
    nuovi: servizi.filter(s => s.stato === "nuovo").length,
    confermati: servizi.filter(s => s.stato === "confermato").length,
  }), [servizi]);

  const assignSingle = async (servizioId: string, driver: DriverOption | null) => {
    const payload: any = driver === null
      ? { autista_id: null, autista_esterno_id: null }
      : driver.kind === "interno"
        ? { autista_id: driver.id, autista_esterno_id: null }
        : { autista_esterno_id: driver.id, autista_id: null };

    const { error } = await supabase.from("servizi").update(payload).eq("id", servizioId);
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    toast.success(driver === null ? "Assegnazione rimossa" : `Assegnato a ${driver.nome} ${driver.cognome ?? ""}`.trim());
    await load();
  };

  const assignBulk = async (driver: DriverOption) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const payload: any = driver.kind === "interno"
      ? { autista_id: driver.id, autista_esterno_id: null }
      : { autista_esterno_id: driver.id, autista_id: null };

    const { error } = await supabase.from("servizi").update(payload).in("id", ids);
    if (error) {
      toast.error("Errore assegnazione massiva: " + error.message);
      return;
    }
    toast.success(`${ids.length} servizi assegnati a ${driver.nome} ${driver.cognome ?? ""}`.trim());
    setSelected(new Set());
    await load();
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  };

  const allChecked = filtered.length > 0 && selected.size === filtered.length;
  const someChecked = selected.size > 0 && selected.size < filtered.length;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Servizi</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {counts.totale} servizi nel periodo selezionato
            </p>
          </div>
          {counts.modificati > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                {counts.modificati} servizi modificati dal cliente
              </span>
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <BulkAssignBar
            count={selected.size}
            onAssign={assignBulk}
            onClear={() => setSelected(new Set())}
          />
        )}

        {/* Stat chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "tutti", label: "Tutti", count: counts.totale, color: "bg-muted text-foreground" },
            { key: "senza_autista", label: "Senza autista", count: counts.senzaAutista, color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
            { key: "modificati", label: "Modificati", count: counts.modificati, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
            { key: "nuovo", label: "Nuovi", count: counts.nuovi, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
            { key: "confermato", label: "Confermati", count: counts.confermati, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
          ].map(c => (
            <button
              key={c.key}
              onClick={() => setStatoFilter(c.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statoFilter === c.key ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
              } ${c.color}`}
            >
              {c.label}
              <span className="bg-background/60 px-1.5 rounded-full font-bold min-w-[20px] text-center">{c.count}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dal</Label>
              <DatePicker value={dal} onChange={setDal} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Al</Label>
              <DatePicker value={al} onChange={setAl} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stato</Label>
              <Select value={statoFilter} onValueChange={setStatoFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti</SelectItem>
                  <SelectItem value="senza_autista">Senza autista</SelectItem>
                  <SelectItem value="modificati">Modificati dal cliente</SelectItem>
                  <SelectItem value="nuovo">Nuovi</SelectItem>
                  <SelectItem value="confermato">Confermati</SelectItem>
                  <SelectItem value="in_corso">In corso</SelectItem>
                  <SelectItem value="completato">Completati</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cerca</Label>
              <Input
                placeholder="Società, contatto, codice, città…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="h-9 w-8 px-2">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="Seleziona tutti"
                      />
                    </TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Città</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Data servizio</TableHead>
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
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-right">C.C €</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide text-right">Com €</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Codice</TableHead>
                    <TableHead className="h-9 text-[11px] uppercase tracking-wide">Foglio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={25} className="text-center py-12 text-muted-foreground text-sm">Caricamento…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={25} className="text-center py-16">
                        <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/30" />
                        <p className="mt-2 text-sm text-muted-foreground">Nessun servizio per i filtri selezionati</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(s => {
                      const senzaAutista = !s.autista_id && !s.autista_esterno_id;
                      const modificato = s.modificato_da_cliente;
                      const isSelected = selected.has(s.id);
                      const driverLabel = s.autisti
                        ? `${s.autisti.nome} ${s.autisti.cognome}`
                        : s.autisti_esterni
                          ? s.autisti_esterni.nome
                          : null;
                      return (
                        <TableRow
                          key={s.id}
                          className={`text-xs ${
                            isSelected ? "bg-primary/5" :
                            senzaAutista ? "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30" : ""
                          } ${modificato ? "border-l-4 border-l-amber-500" : ""}`}
                        >
                          <TableCell className="py-2 px-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(s.id)}
                              aria-label="Seleziona riga"
                            />
                          </TableCell>
                          <TableCell className="py-2 font-medium">{s.citta || "—"}</TableCell>
                          <TableCell className="py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {modificato && (
                                <span title="Modificato dal cliente">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                </span>
                              )}
                              <div>
                                <div className={senzaAutista ? "text-red-700 dark:text-red-400 font-semibold" : ""}>
                                  {format(new Date(s.data_servizio), "dd/MM/yyyy")}
                                </div>
                                {s.ora_inizio && <div className="text-muted-foreground">{s.ora_inizio}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 font-semibold italic">
                            {s.clients?.company || s.clients?.name || "—"}
                          </TableCell>
                          <TableCell className="py-2">{s.contatto || "—"}</TableCell>
                          <TableCell className="py-2 whitespace-nowrap">{s.telefono_contatto || "—"}</TableCell>
                          <TableCell className="py-2 text-center">{s.n_passeggeri ?? 0}</TableCell>
                          <TableCell className="py-2 text-center">{s.n_bagagli ?? 0}</TableCell>
                          <TableCell className="py-2">{buildTipoServ(s)}</TableCell>
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
                          <TableCell className="py-2 p-1">
                            <AssignDriverPopover
                              currentInternoId={s.autista_id}
                              currentEsternoId={s.autista_esterno_id}
                              currentLabel={driverLabel}
                              onAssign={(d) => assignSingle(s.id, d)}
                              trigger={
                                driverLabel ? (
                                  <button className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors text-left max-w-[140px] truncate">
                                    <span className="truncate">{driverLabel}</span>
                                    {s.autisti_esterni && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">EXT</Badge>
                                    )}
                                  </button>
                                ) : (
                                  <button className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                    <UserPlus className="h-3 w-3" />
                                    Assegna
                                  </button>
                                )
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

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
            Riga rossa = servizio senza autista (da assegnare per confermare)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-amber-500 rounded" />
            Bordo giallo = modificato dal cliente
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">EXT</Badge>
            Autista esterno (collaboratore)
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
