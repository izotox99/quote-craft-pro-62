import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus } from "lucide-react";

type Assenza = any;
type Autista = { id: string; nome: string | null; cognome: string | null };

const TIPI: Array<{ v: "ferie"|"riposo"|"permesso"|"malattia"; label: string; color: string }> = [
  { v: "ferie",    label: "Ferie",    color: "#2563eb" },
  { v: "riposo",   label: "Riposo",   color: "#059669" },
  { v: "permesso", label: "Permesso", color: "#d97706" },
  { v: "malattia", label: "Malattia", color: "#dc2626" },
];
const tipoColor = (t: string) => TIPI.find(x => x.v === t)?.color ?? "#64748b";

export default function AutistiAssenze() {
  const { user, role, organization } = useAuth();
  const isOffice = role === "admin" || role === "manager";
  const [tab, setTab] = useState("richieste");
  const [cursor, setCursor] = useState(new Date());

  const [richieste, setRichieste] = useState<Assenza[]>([]);
  const [storico, setStorico] = useState<Assenza[]>([]);
  const [autisti, setAutisti] = useState<Autista[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Assenza | null>(null);
  const [note, setNote] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualAutista, setManualAutista] = useState("");
  const [manualTipo, setManualTipo] = useState<"ferie"|"riposo"|"permesso"|"malattia">("ferie");
  const [manualDa, setManualDa] = useState("");
  const [manualA, setManualA] = useState("");
  const [manualForce, setManualForce] = useState(false);
  const [manualNote, setManualNote] = useState("");

  const load = async () => {
    if (!organization?.id) return;
    const [{ data: r }, { data: s }, { data: a }] = await Promise.all([
      supabase.from("autisti_assenze" as any).select("*, autisti(nome,cognome)")
        .eq("org_id", organization.id).eq("stato", "richiesta").order("created_at", { ascending: false }),
      supabase.from("autisti_assenze" as any).select("*, autisti(nome,cognome)")
        .eq("org_id", organization.id).neq("stato", "richiesta").order("data_inizio", { ascending: false }).limit(200),
      supabase.from("autisti").select("id,nome,cognome").eq("org_id", organization.id).eq("attivo", true).order("cognome"),
    ]);
    setRichieste(r ?? []);
    setStorico(s ?? []);
    setAutisti((a as any) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organization?.id]);

  const openDecision = (a: Assenza) => { setSelected(a); setNote(""); setDialogOpen(true); };

  const decide = async (kind: "approva"|"rifiuta") => {
    if (!selected) return;
    const fn = kind === "approva" ? "approva_assenza" : "rifiuta_assenza";
    const { error } = await supabase.rpc(fn as any, { _id: selected.id, _note: note || null });
    if (error) return toast.error(error.message);
    toast.success(kind === "approva" ? "Assenza approvata" : "Assenza rifiutata");
    setDialogOpen(false);
    load();
  };

  const insertManual = async () => {
    if (!manualAutista || !manualDa || !manualA) return toast.error("Compila tutti i campi");
    const { error } = await supabase.rpc("inserisci_assenza_ufficio" as any, {
      _autista_id: manualAutista, _tipo: manualTipo, _data_inizio: manualDa,
      _data_fine: manualA, _note: manualNote || null, _force: manualForce,
    });
    if (error) return toast.error(error.message);
    toast.success("Assenza registrata");
    setManualOpen(false);
    setManualAutista(""); setManualDa(""); setManualA(""); setManualNote(""); setManualForce(false);
    load();
  };

  if (!isOffice) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Sezione riservata a admin/manager.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <CalendarCheck className="h-6 w-6 text-primary" /> Assenze autisti
            </h1>
            <p className="text-sm text-muted-foreground">Gestisci ferie, riposi, permessi e malattie</p>
          </div>
          <Button size="sm" onClick={() => setManualOpen(true)} className="gap-1"><Plus className="h-4 w-4"/> Inserisci manuale</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="richieste">In attesa ({richieste.length})</TabsTrigger>
            <TabsTrigger value="copertura">Calendario copertura</TabsTrigger>
            <TabsTrigger value="storico">Storico</TabsTrigger>
            <TabsTrigger value="config">Configurazione</TabsTrigger>
          </TabsList>

          <TabsContent value="richieste" className="mt-4">
            {richieste.length === 0 ? (
              <p className="text-sm text-muted-foreground p-8 text-center">Nessuna richiesta in attesa.</p>
            ) : (
              <div className="space-y-2">
                {richieste.map(a => (
                  <Card key={a.id}>
                    <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                      <div className="min-w-0">
                        <div className="font-medium">{a.autisti?.cognome} {a.autisti?.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          <Badge variant="outline" style={{ borderColor: tipoColor(a.tipo), color: tipoColor(a.tipo) }} className="mr-2">{a.tipo}</Badge>
                          dal {format(new Date(a.data_inizio), "dd/MM/yyyy")} al {format(new Date(a.data_fine), "dd/MM/yyyy")}
                          {a.motivazione && <> — {a.motivazione}</>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDecision(a)}>Rispondi</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="copertura" className="mt-4">
            <CoperturaMese cursor={cursor} setCursor={setCursor} orgId={organization?.id} />
          </TabsContent>

          <TabsContent value="storico" className="mt-4">
            {storico.length === 0 ? (
              <p className="text-sm text-muted-foreground p-8 text-center">Nessuna assenza registrata.</p>
            ) : (
              <div className="space-y-1">
                {storico.map(a => (
                  <div key={a.id} className="flex items-center gap-3 rounded border p-2 text-sm">
                    <Badge variant="outline" style={{ borderColor: tipoColor(a.tipo), color: tipoColor(a.tipo) }}>{a.tipo}</Badge>
                    <span className="font-medium">{a.autisti?.cognome} {a.autisti?.nome}</span>
                    <span className="text-muted-foreground">{format(new Date(a.data_inizio),"dd/MM/yyyy")} → {format(new Date(a.data_fine),"dd/MM/yyyy")}</span>
                    <Badge className="ml-auto" variant={a.stato==="approvata"?"default":a.stato==="rifiutata"?"destructive":"secondary"}>{a.stato}</Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Decision dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rispondi alla richiesta</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">{selected.autisti?.cognome} {selected.autisti?.nome}</div>
                <div className="text-muted-foreground">
                  {selected.tipo} — dal {format(new Date(selected.data_inizio),"dd/MM/yyyy")} al {format(new Date(selected.data_fine),"dd/MM/yyyy")}
                </div>
                {selected.motivazione && <div className="mt-1">Motivazione: {selected.motivazione}</div>}
              </div>
              <div className="space-y-1">
                <Label>Nota (facoltativa)</Label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3}/>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => decide("rifiuta")}>Rifiuta</Button>
            <Button onClick={() => decide("approva")}>Approva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual insert */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inserisci assenza manuale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Autista</Label>
              <Select value={manualAutista} onValueChange={setManualAutista}>
                <SelectTrigger><SelectValue placeholder="Seleziona…"/></SelectTrigger>
                <SelectContent>
                  {autisti.map(a => <SelectItem key={a.id} value={a.id}>{a.cognome} {a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={manualTipo} onValueChange={(v: any) => setManualTipo(v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {TIPI.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Da</Label><Input type="date" value={manualDa} onChange={e=>setManualDa(e.target.value)}/></div>
              <div className="space-y-1"><Label>A</Label><Input type="date" value={manualA} onChange={e=>setManualA(e.target.value)}/></div>
            </div>
            <div className="space-y-1"><Label>Nota ufficio</Label><Textarea value={manualNote} onChange={e=>setManualNote(e.target.value)} rows={2}/></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={manualForce} onChange={e=>setManualForce(e.target.checked)}/>
              Forza copertura minima (sotto la soglia)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setManualOpen(false)}>Annulla</Button>
            <Button onClick={insertManual}>Registra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CoperturaMese({ cursor, setCursor, orgId }: { cursor: Date; setCursor: (d: Date)=>void; orgId?: string }) {
  const [days, setDays] = useState<Record<string, any>>({});
  const [minCfg, setMinCfg] = useState<number>(1);
  const [attivi, setAttivi] = useState<number>(0);
  const [detail, setDetail] = useState<{ giorno: Date; items: any[] } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });

  const grid = useMemo(() => {
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [start, end]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: cfg }, { count }] = await Promise.all([
        supabase.from("config_assenze" as any).select("min_autisti_disponibili_giorno").eq("org_id", orgId).maybeSingle(),
        supabase.from("autisti").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("attivo", true),
      ]);
      setMinCfg((cfg as any)?.min_autisti_disponibili_giorno ?? 1);
      setAttivi(count ?? 0);

      const { data: assenze } = await supabase.from("autisti_assenze" as any)
        .select("data_inizio,data_fine,autista_id,stato,tipo,autisti(nome,cognome)")
        .eq("org_id", orgId).in("stato", ["richiesta","approvata"])
        .lte("data_inizio", format(end, "yyyy-MM-dd"))
        .gte("data_fine", format(start, "yyyy-MM-dd"));
      const map: Record<string, any> = {};
      grid.forEach(d => {
        map[format(d,"yyyy-MM-dd")] = { assenti: new Set(), items: [] };
      });
      (assenze ?? []).forEach((a: any) => {
        const di = new Date(a.data_inizio), df = new Date(a.data_fine);
        grid.forEach(d => {
          if (d >= di && d <= df) {
            const k = format(d, "yyyy-MM-dd");
            if (!map[k]) return;
            if (a.stato === "approvata") map[k].assenti.add(a.autista_id);
            map[k].items.push(a);
          }
        });
      });
      setDays(map);
    })();
    /* eslint-disable-next-line */
  }, [orgId, format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")]);

  const openDay = (d: Date) => {
    const k = format(d, "yyyy-MM-dd");
    setDetail({ giorno: d, items: days[k]?.items ?? [] });
    setDetailOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: it })}</div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor,-1))}><ChevronLeft className="h-4 w-4"/></Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Oggi</Button>
          <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor,1))}><ChevronRight className="h-4 w-4"/></Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">Autisti attivi: {attivi} — min copertura: {minCfg}</div>
      <div className="grid grid-cols-7 gap-1">
        {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(w => (
          <div key={w} className="text-[11px] text-muted-foreground text-center font-semibold py-1">{w}</div>
        ))}
        {grid.map(d => {
          const k = format(d, "yyyy-MM-dd");
          const info = days[k] ?? { assenti: new Set() };
          const nAss = (info.assenti as Set<string>)?.size ?? 0;
          const disponibili = Math.max(attivi - nAss, 0);
          const pieno = disponibili <= minCfg;
          const quasi = disponibili === minCfg + 1;
          const inMonth = isSameMonth(d, cursor);
          return (
            <button
              key={k}
              onClick={() => openDay(d)}
              className={cn(
                "min-h-[68px] rounded border p-1 text-left hover:bg-accent/40 transition",
                !inMonth && "opacity-40",
                pieno && "border-red-400 bg-red-50",
                !pieno && quasi && "border-amber-400 bg-amber-50",
                isSameDay(d, new Date()) && "ring-2 ring-primary",
              )}
            >
              <div className="text-xs font-semibold">{format(d, "d")}</div>
              <div className="text-[10px] text-muted-foreground">assenti {nAss}/{attivi}</div>
              {pieno && <div className="text-[10px] font-semibold text-red-600">al limite</div>}
            </button>
          );
        })}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{detail && format(detail.giorno, "EEEE d MMMM yyyy", { locale: it })}</DialogTitle></DialogHeader>
          <div className="space-y-1 text-sm">
            {detail?.items.length === 0 ? (
              <div className="text-muted-foreground">Nessuna assenza.</div>
            ) : (
              detail?.items.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="outline" style={{ borderColor: tipoColor(a.tipo), color: tipoColor(a.tipo) }}>{a.tipo}</Badge>
                  <span>{a.autisti?.cognome} {a.autisti?.nome}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">{a.stato}</Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
