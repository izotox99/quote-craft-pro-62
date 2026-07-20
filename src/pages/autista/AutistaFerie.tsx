import { useEffect, useMemo, useState } from "react";
import { AutistaLayout } from "@/components/autista/AutistaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TIPI: Array<{ v: "ferie"|"riposo"|"permesso"|"malattia"; label: string; color: string }> = [
  { v: "ferie",    label: "Ferie",    color: "#2563eb" },
  { v: "riposo",   label: "Riposo",   color: "#059669" },
  { v: "permesso", label: "Permesso", color: "#d97706" },
  { v: "malattia", label: "Malattia", color: "#dc2626" },
];
const tipoColor = (t: string) => TIPI.find(x => x.v === t)?.color ?? "#64748b";

type CalRow = { giorno: string; autista_nome: string; tipo: string; stato: string };

export default function AutistaFerie() {
  const [cursor, setCursor] = useState(new Date());
  const [cal, setCal] = useState<CalRow[]>([]);
  const [attivi, setAttivi] = useState(0);
  const [minCfg, setMinCfg] = useState(1);
  const [limits, setLimits] = useState<{ max_ferie: number; max_riposi: number; max_permessi: number } | null>(null);
  const [counters, setCounters] = useState<{ ferie: number; riposi: number; permessi: number }>({ ferie: 0, riposi: 0, permessi: 0 });
  const [myReqs, setMyReqs] = useState<any[]>([]);
  const [autistaId, setAutistaId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [detailDay, setDetailDay] = useState<Date | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState<"ferie"|"riposo"|"permesso"|"malattia">("ferie");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [motivo, setMotivo] = useState("");

  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const grid = useMemo(() => {
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [start, end]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: aInt } = await supabase.from("autisti").select("id,org_id").eq("auth_user_id", user.id).maybeSingle();
    if (!aInt) return;
    setAutistaId(aInt.id); setOrgId(aInt.org_id);

    const anno = cursor.getFullYear(), mese = cursor.getMonth() + 1;
    const [{ data: rows }, { data: lim }, { count }, { data: cfg }, { data: mine }] = await Promise.all([
      supabase.rpc("assenze_calendario_mese" as any, { _anno: anno, _mese: mese }),
      supabase.rpc("assenze_get_effective_limits" as any, { _autista_id: aInt.id }),
      supabase.from("autisti").select("id", { count: "exact", head: true }).eq("org_id", aInt.org_id).eq("attivo", true),
      supabase.from("config_assenze" as any).select("min_autisti_disponibili_giorno").eq("org_id", aInt.org_id).maybeSingle(),
      supabase.from("autisti_assenze" as any).select("*").eq("autista_id", aInt.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setCal((rows as any) ?? []);
    setAttivi(count ?? 0);
    setMinCfg((cfg as any)?.min_autisti_disponibili_giorno ?? 1);
    const L = lim as any;
    if (L) setLimits({ max_ferie: L.max_ferie, max_riposi: L.max_riposi, max_permessi: L.max_permessi });
    setMyReqs((mine as any) ?? []);

    // contatori mese corrente (this calendar month)
    const [f, r, p] = await Promise.all([
      supabase.rpc("assenze_conteggia_mese" as any, { _autista_id: aInt.id, _tipo: "ferie", _anno: anno, _mese: mese }),
      supabase.rpc("assenze_conteggia_mese" as any, { _autista_id: aInt.id, _tipo: "riposo", _anno: anno, _mese: mese }),
      supabase.rpc("assenze_conteggia_mese" as any, { _autista_id: aInt.id, _tipo: "permesso", _anno: anno, _mese: mese }),
    ]);
    setCounters({ ferie: (f.data as any) ?? 0, riposi: (r.data as any) ?? 0, permessi: (p.data as any) ?? 0 });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor.getMonth(), cursor.getFullYear()]);

  const byDay = useMemo(() => {
    const m: Record<string, CalRow[]> = {};
    cal.forEach(r => {
      const k = r.giorno.slice(0, 10);
      (m[k] ??= []).push(r);
    });
    return m;
  }, [cal]);

  const submitRequest = async () => {
    if (!dal || !al) return toast.error("Seleziona le date");
    const { error } = await supabase.rpc("richiedi_assenza" as any, {
      _tipo: tipo, _data_inizio: dal, _data_fine: al, _motivazione: motivo || null,
    });
    if (error) return toast.error(error.message);
    toast.success(tipo === "malattia" ? "Malattia registrata" : "Richiesta inviata");
    setFormOpen(false); setMotivo("");
    load();
  };

  const openForm = (d?: Date) => {
    const s = d ? format(d, "yyyy-MM-dd") : "";
    setDal(s); setAl(s); setTipo("ferie"); setMotivo("");
    setFormOpen(true);
  };

  const annulla = async (id: string) => {
    const { error } = await supabase.rpc("annulla_assenza" as any, { _id: id });
    if (error) return toast.error(error.message);
    toast.success("Richiesta annullata");
    load();
  };

  return (
    <AutistaLayout>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-display font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: it })}</div>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor,-1))}><ChevronLeft className="h-4 w-4"/></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Oggi</Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor,1))}><ChevronRight className="h-4 w-4"/></Button>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground">Autisti attivi: {attivi} — copertura minima: {minCfg}</div>

        <div className="grid grid-cols-7 gap-0.5">
          {["L","M","M","G","V","S","D"].map((w,i) => (
            <div key={i} className="text-[10px] text-muted-foreground text-center font-semibold py-0.5">{w}</div>
          ))}
          {grid.map(d => {
            const k = format(d, "yyyy-MM-dd");
            const items = byDay[k] ?? [];
            const approv = items.filter(x => x.stato === "approvata").length;
            const disponibili = Math.max(attivi - approv, 0);
            const pieno = disponibili <= minCfg;
            const quasi = disponibili === minCfg + 1;
            const past = d < startOfMonth(new Date()) || d < new Date(new Date().setHours(0,0,0,0));
            const inMonth = isSameMonth(d, cursor);
            return (
              <button
                key={k}
                onClick={() => setDetailDay(d)}
                className={cn(
                  "min-h-[54px] rounded border p-1 text-left transition",
                  !inMonth && "opacity-40",
                  past && "bg-muted/40 text-muted-foreground",
                  !past && !pieno && "bg-emerald-50 border-emerald-200",
                  !past && !pieno && quasi && "bg-amber-50 border-amber-300",
                  !past && pieno && "bg-red-50 border-red-300",
                  isSameDay(d, new Date()) && "ring-2 ring-primary",
                )}
              >
                <div className="text-[11px] font-semibold">{format(d,"d")}</div>
                <div className="text-[9px] leading-tight">{approv}/{attivi}</div>
                {pieno && !past && <div className="text-[9px] font-semibold text-red-600">pieno</div>}
              </button>
            );
          })}
        </div>

        {limits && (
          <Card>
            <CardContent className="p-3 text-sm">
              <div className="font-semibold mb-1">Contatori mese</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[11px] text-muted-foreground">Ferie</div><div className="font-semibold">{counters.ferie} / {limits.max_ferie}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Riposi</div><div className="font-semibold">{counters.riposi} / {limits.max_riposi}</div></div>
                <div><div className="text-[11px] text-muted-foreground">Permessi</div><div className="font-semibold">{counters.permessi} / {limits.max_permessi}</div></div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button className="w-full" onClick={() => openForm()}>Nuova richiesta</Button>

        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="font-semibold text-sm">Le mie richieste</div>
            {myReqs.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nessuna richiesta.</div>
            ) : myReqs.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-xs border rounded p-2">
                <Badge variant="outline" style={{ borderColor: tipoColor(r.tipo), color: tipoColor(r.tipo) }}>{r.tipo}</Badge>
                <span>{format(new Date(r.data_inizio),"dd/MM")} → {format(new Date(r.data_fine),"dd/MM/yyyy")}</span>
                <Badge className="ml-auto" variant={r.stato==="approvata"?"default":r.stato==="rifiutata"?"destructive":"secondary"}>{r.stato}</Badge>
                {r.stato === "richiesta" && (
                  <Button size="sm" variant="ghost" onClick={() => annulla(r.id)}>Annulla</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Day detail sheet */}
      <Sheet open={!!detailDay} onOpenChange={(o) => !o && setDetailDay(null)}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader><SheetTitle className="text-left capitalize">
            {detailDay && format(detailDay, "EEEE d MMMM yyyy", { locale: it })}
          </SheetTitle></SheetHeader>
          <div className="space-y-1 pt-3 text-sm">
            {(byDay[detailDay ? format(detailDay,"yyyy-MM-dd") : ""] ?? []).length === 0 ? (
              <div className="text-muted-foreground">Nessuna assenza in questo giorno.</div>
            ) : (
              (byDay[detailDay ? format(detailDay,"yyyy-MM-dd") : ""] ?? []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 border rounded p-2">
                  <Badge variant="outline" style={{ borderColor: tipoColor(r.tipo), color: tipoColor(r.tipo) }}>{r.tipo}</Badge>
                  <span>{r.autista_nome}</span>
                  <Badge className="ml-auto text-[10px]" variant="secondary">{r.stato}</Badge>
                </div>
              ))
            )}
            {detailDay && detailDay >= new Date(new Date().setHours(0,0,0,0)) && (
              <Button className="w-full mt-3" onClick={() => { openForm(detailDay); setDetailDay(null); }}>
                Richiedi assenza da questo giorno
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Form request */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader><SheetTitle className="text-left">Nuova richiesta</SheetTitle></SheetHeader>
          <div className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{TIPI.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {tipo === "malattia" && (
                <div className="text-[11px] text-muted-foreground">La malattia viene registrata subito e notificata all'ufficio, senza limiti.</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Da</Label><Input type="date" value={dal} onChange={e=>setDal(e.target.value)}/></div>
              <div className="space-y-1"><Label>A</Label><Input type="date" value={al} onChange={e=>setAl(e.target.value)}/></div>
            </div>
            <div className="space-y-1"><Label>Motivazione (facoltativa)</Label><Textarea rows={3} value={motivo} onChange={e=>setMotivo(e.target.value)}/></div>
            <Button className="w-full" onClick={submitRequest}>Invia</Button>
          </div>
        </SheetContent>
      </Sheet>
    </AutistaLayout>
  );
}
