import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import {
  addDays, addMonths, addWeeks, endOfDay, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import { EventoDialog, AgendaEvento, CATEGORIA_COLOR } from "@/components/agenda/EventoDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type ViewMode = "giorno" | "settimana" | "mese";

type Assenza = { id: string; autista_id: string; tipo: string; data_inizio: string; data_fine: string; autisti?: { nome: string|null; cognome: string|null } };

const ASSENZA_COLOR: Record<string,string> = {
  ferie: "#2563eb", riposo: "#059669", permesso: "#d97706", malattia: "#dc2626",
};

export default function Agenda() {
  const { user, organization } = useAuth();
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewMode>(isMobile ? "giorno" : "settimana");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [eventi, setEventi] = useState<AgendaEvento[]>([]);
  const [assenze, setAssenze] = useState<Assenza[]>([]);
  const [showAssenze, setShowAssenze] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<AgendaEvento | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | null>(null);

  useEffect(() => { if (isMobile) setView("giorno"); }, [isMobile]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "giorno") return { rangeStart: startOfDay(cursor), rangeEnd: endOfDay(cursor) };
    if (view === "settimana") return {
      rangeStart: startOfWeek(cursor, { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(cursor, { weekStartsOn: 1 }),
    };
    return {
      rangeStart: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
    };
  }, [view, cursor]);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("agenda_eventi")
      .select("*")
      .gte("data_inizio", rangeStart.toISOString())
      .lte("data_inizio", rangeEnd.toISOString())
      .order("data_inizio", { ascending: true });
    if (!error && data) setEventi(data as AgendaEvento[]);
    if (organization?.id) {
      const { data: aRows } = await supabase
        .from("autisti_assenze" as any)
        .select("id,autista_id,tipo,data_inizio,data_fine,autisti(nome,cognome)")
        .eq("org_id", organization.id).eq("stato", "approvata")
        .lte("data_inizio", format(rangeEnd, "yyyy-MM-dd"))
        .gte("data_fine", format(rangeStart, "yyyy-MM-dd"));
      setAssenze((aRows as any) ?? []);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, organization?.id, rangeStart.getTime(), rangeEnd.getTime()]);

  const handleGoto = (dir: "prev" | "next" | "today") => {
    if (dir === "today") { setCursor(new Date()); return; }
    const delta = dir === "next" ? 1 : -1;
    if (view === "giorno") setCursor(addDays(cursor, delta));
    else if (view === "settimana") setCursor(addWeeks(cursor, delta));
    else setCursor(addMonths(cursor, delta));
  };

  const openNew = (start: Date) => {
    setSelectedEvento(null);
    setDefaultStart(start);
    setDialogOpen(true);
  };

  const openEvento = (e: AgendaEvento) => {
    setSelectedEvento(e);
    setDefaultStart(null);
    setDialogOpen(true);
  };

  const titolo = useMemo(() => {
    if (view === "giorno") return format(cursor, "EEEE d MMMM yyyy", { locale: it });
    if (view === "settimana") return `${format(rangeStart, "d MMM", { locale: it })} — ${format(rangeEnd, "d MMM yyyy", { locale: it })}`;
    return format(cursor, "MMMM yyyy", { locale: it });
  }, [view, cursor, rangeStart, rangeEnd]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" /> Agenda
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{titolo}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)}>
              <ToggleGroupItem value="giorno" size="sm">Giorno</ToggleGroupItem>
              <ToggleGroupItem value="settimana" size="sm">Settimana</ToggleGroupItem>
              <ToggleGroupItem value="mese" size="sm">Mese</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => handleGoto("prev")}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => handleGoto("today")}>Oggi</Button>
              <Button size="icon" variant="outline" onClick={() => handleGoto("next")}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Button size="sm" onClick={() => openNew(new Date())} className="gap-1"><Plus className="h-4 w-4" /> Nuovo</Button>
          </div>
        </div>

        {view === "giorno" && <DayView date={cursor} eventi={eventi} onNew={openNew} onOpen={openEvento} />}
        {view === "settimana" && <WeekView start={rangeStart} eventi={eventi} onNew={openNew} onOpen={openEvento} />}
        {view === "mese" && <MonthView cursor={cursor} start={rangeStart} end={rangeEnd} eventi={eventi} onNew={openNew} onOpen={openEvento} />}
      </div>

      <EventoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        evento={selectedEvento}
        defaultStart={defaultStart}
        onSaved={load}
      />
    </DashboardLayout>
  );
}

/* -------- Sub views -------- */

function EventoChip({ e, onClick }: { e: AgendaEvento; onClick: () => void }) {
  const color = CATEGORIA_COLOR[e.categoria];
  return (
    <button
      onClick={(ev) => { ev.stopPropagation(); onClick(); }}
      className={cn(
        "block w-full text-left rounded px-1.5 py-0.5 text-[11px] font-medium truncate border-l-2 hover:opacity-80 transition",
        e.completato && "line-through opacity-50"
      )}
      style={{ backgroundColor: color + "22", borderLeftColor: color, color }}
      title={e.titolo}
    >
      {!e.tutto_il_giorno && (
        <span className="opacity-70 mr-1">{format(new Date(e.data_inizio), "HH:mm")}</span>
      )}
      {e.titolo}
    </button>
  );
}

function DayView({ date, eventi, onNew, onOpen }: { date: Date; eventi: AgendaEvento[]; onNew: (d: Date) => void; onOpen: (e: AgendaEvento) => void }) {
  const dayEventi = eventi.filter(e => isSameDay(new Date(e.data_inizio), date));
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
        {hours.map(h => {
          const slotDate = new Date(date); slotDate.setHours(h, 0, 0, 0);
          const slotEventi = dayEventi.filter(e => !e.tutto_il_giorno && new Date(e.data_inizio).getHours() === h);
          return (
            <div
              key={h}
              onClick={() => onNew(slotDate)}
              className="flex border-b border-border/50 hover:bg-accent/30 cursor-pointer min-h-[52px]"
            >
              <div className="w-14 shrink-0 text-xs text-muted-foreground p-2 border-r border-border/50">
                {String(h).padStart(2, "0")}:00
              </div>
              <div className="flex-1 p-1 space-y-1">
                {slotEventi.map(e => <EventoChip key={e.id} e={e} onClick={() => onOpen(e)} />)}
              </div>
            </div>
          );
        })}
      </div>
      {dayEventi.some(e => e.tutto_il_giorno) && (
        <div className="border-t p-2 bg-muted/30 space-y-1">
          <div className="text-[10px] uppercase text-muted-foreground font-semibold">Tutto il giorno</div>
          {dayEventi.filter(e => e.tutto_il_giorno).map(e => <EventoChip key={e.id} e={e} onClick={() => onOpen(e)} />)}
        </div>
      )}
    </div>
  );
}

function WeekView({ start, eventi, onNew, onOpen }: { start: Date; eventi: AgendaEvento[]; onNew: (d: Date) => void; onOpen: (e: AgendaEvento) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-1 rounded-lg border bg-card p-2">
      {days.map(d => {
        const isToday = isSameDay(d, new Date());
        const dayEventi = eventi.filter(e => isSameDay(new Date(e.data_inizio), d));
        return (
          <div
            key={d.toISOString()}
            onClick={() => onNew(d)}
            className={cn(
              "min-h-[180px] rounded-md border border-border/50 p-1.5 hover:bg-accent/30 cursor-pointer flex flex-col",
              isToday && "border-primary bg-primary/5"
            )}
          >
            <div className="text-[10px] uppercase text-muted-foreground font-semibold">
              {format(d, "EEE", { locale: it })}
            </div>
            <div className={cn("text-lg font-bold", isToday && "text-primary")}>
              {format(d, "d")}
            </div>
            <div className="mt-1 space-y-1 flex-1 overflow-hidden">
              {dayEventi.slice(0, 6).map(e => <EventoChip key={e.id} e={e} onClick={() => onOpen(e)} />)}
              {dayEventi.length > 6 && <div className="text-[10px] text-muted-foreground">+{dayEventi.length - 6} altri</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ cursor, start, end, eventi, onNew, onOpen }: {
  cursor: Date; start: Date; end: Date; eventi: AgendaEvento[];
  onNew: (d: Date) => void; onOpen: (e: AgendaEvento) => void;
}) {
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const weekdays = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/40 border-b">
        {weekdays.map(w => <div key={w} className="p-2 text-[11px] font-semibold text-muted-foreground uppercase text-center">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map(d => {
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, new Date());
          const dayEventi = eventi.filter(e => isSameDay(new Date(e.data_inizio), d));
          return (
            <div
              key={d.toISOString()}
              onClick={() => onNew(d)}
              className={cn(
                "min-h-[110px] border-r border-b border-border/40 p-1 hover:bg-accent/30 cursor-pointer",
                !inMonth && "bg-muted/20 text-muted-foreground",
                isToday && "bg-primary/5"
              )}
            >
              <div className={cn("text-xs font-semibold mb-1", isToday && "text-primary")}>
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEventi.slice(0, 3).map(e => <EventoChip key={e.id} e={e} onClick={() => onOpen(e)} />)}
                {dayEventi.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEventi.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
