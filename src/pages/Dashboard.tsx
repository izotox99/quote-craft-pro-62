import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CalendarDays, Users, Car, Clock, MapPin, Phone, User2, ChevronRight,
  Luggage, Route, Info, CreditCard, FileText, Sparkles,
} from "lucide-react";
import { format, addDays, isToday, isTomorrow, startOfDay } from "date-fns";
import { it } from "date-fns/locale";

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
  note: string | null;
  codice: string | null;
  foglio: string | null;
  incasso: number | null;
  costo_cs: number | null;
  costo_autista: number | null;
  costo_commissione: number | null;
  centro_costo: string | null;
  clients: { name: string; company: string | null } | null;
  autisti: { nome: string; cognome: string } | null;
  veicoli: { targa: string; tipo_macchina: string | null } | null;
  fornitori_cs: { nome: string } | null;
};

const statoConfig: Record<string, { label: string; className: string }> = {
  nuovo: { label: "Nuovo", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  confermato: { label: "Confermato", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  in_corso: { label: "In Corso", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  completato: { label: "Completato", className: "bg-muted text-muted-foreground" },
  annullato: { label: "Annullato", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const tipologiaLabels: Record<string, string> = {
  transfer: "Transfer",
  disposizione: "Disposizione",
  tour: "Tour",
  evento: "Evento",
  altro: "Altro",
};

function buildTipoShort(s: Servizio) {
  const parts: string[] = [];
  if (s.tipologia) parts.push(tipologiaLabels[s.tipologia] || s.tipologia);
  if (s.transfer_tipo) parts.push(s.transfer_tipo);
  if (s.tour_tipo) parts.push(s.tour_tipo);
  if (s.disposizione_oraria) parts.push(s.disposizione_oraria);
  return parts.join(" · ") || "—";
}

type DayFilter = "all" | "today" | "tomorrow" | "day2" | "day3";

export default function Dashboard() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [selected, setSelected] = useState<Servizio | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const endDate = format(addDays(new Date(), 3), "yyyy-MM-dd");
      const { data } = await supabase
        .from("servizi")
        .select("*, clients(name, company), autisti(nome, cognome), veicoli(targa, tipo_macchina), fornitori_cs(nome)")
        .eq("stato", "nuovo")
        .gte("data_servizio", today)
        .lte("data_servizio", endDate)
        .order("data_servizio", { ascending: true })
        .order("ora_inizio", { ascending: true });
      setServizi((data ?? []) as unknown as Servizio[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = useMemo(() => {
    if (dayFilter === "all") return servizi;
    const now = new Date();
    const targetDate = dayFilter === "today" ? now
      : dayFilter === "tomorrow" ? addDays(now, 1)
      : dayFilter === "day2" ? addDays(now, 2)
      : addDays(now, 3);
    const target = format(startOfDay(targetDate), "yyyy-MM-dd");
    return servizi.filter(s => s.data_servizio === target);
  }, [servizi, dayFilter]);

  const dayCounts = useMemo(() => {
    const now = new Date();
    const days = [now, addDays(now, 1), addDays(now, 2), addDays(now, 3)];
    return days.map(d => {
      const key = format(startOfDay(d), "yyyy-MM-dd");
      return servizi.filter(s => s.data_servizio === key).length;
    });
  }, [servizi]);

  const dayFilters: { key: DayFilter; label: string; count: number }[] = [
    { key: "all", label: "Tutti", count: servizi.length },
    { key: "today", label: "Oggi", count: dayCounts[0] },
    { key: "tomorrow", label: "Domani", count: dayCounts[1] },
    { key: "day2", label: format(addDays(new Date(), 2), "EEE dd", { locale: it }), count: dayCounts[2] },
    { key: "day3", label: format(addDays(new Date(), 3), "EEE dd", { locale: it }), count: dayCounts[3] },
  ];

  const DetailRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Nuovi Servizi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Servizi prenotati dai clienti in attesa di conferma
          </p>
        </div>

        {/* Day filter chips */}
        <div className="flex flex-wrap gap-2">
          {dayFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setDayFilter(f.key)}
              className={`
                inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all
                ${dayFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }
              `}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`
                  text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                  ${dayFilter === f.key ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}
                `}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Service cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">Nessun servizio nuovo per questo periodo</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => {
              const dateObj = new Date(s.data_servizio);
              const dayLabel = isToday(dateObj) ? "Oggi" : isTomorrow(dateObj) ? "Domani" : format(dateObj, "EEE dd MMM", { locale: it });
              return (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
                  onClick={() => setSelected(s)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Date block */}
                    <div className="flex flex-col items-center justify-center w-14 shrink-0">
                      <span className="text-xs text-muted-foreground uppercase">{format(dateObj, "MMM", { locale: it })}</span>
                      <span className="text-xl font-bold text-foreground leading-none">{format(dateObj, "dd")}</span>
                      {s.ora_inizio && <span className="text-xs text-primary font-semibold mt-0.5">{s.ora_inizio}</span>}
                    </div>

                    <Separator orientation="vertical" className="h-10" />

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-card-foreground truncate">
                          {s.clients?.company || s.clients?.name || "—"}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{s.citta || "—"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {s.contatto || "—"} · {buildTipoShort(s)}
                      </p>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{s.n_passeggeri ?? 0}</span>
                      </div>
                      <Badge className={`text-[10px] ${statoConfig[s.stato]?.className || ""}`}>
                        {statoConfig[s.stato]?.label || s.stato}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Quick link to full list */}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
            <Link to="/dashboard">Vai a tutti i servizi <ChevronRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {format(new Date(selected.data_servizio), "EEEE dd MMMM yyyy", { locale: it })}
                  {selected.ora_inizio && ` · ${selected.ora_inizio}`}
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-2 mt-1">
                <Badge className={statoConfig[selected.stato]?.className || ""}>{statoConfig[selected.stato]?.label || selected.stato}</Badge>
                <Badge variant="outline">{buildTipoShort(selected)}</Badge>
                {selected.citta && <Badge variant="outline">{selected.citta}</Badge>}
              </div>

              <Separator className="my-3" />

              <div className="space-y-0">
                <DetailRow icon={User2} label="Società" value={selected.clients?.company || selected.clients?.name} />
                <DetailRow icon={Phone} label="Contatto" value={selected.contatto} />
                <DetailRow icon={Phone} label="Telefono" value={selected.telefono_contatto} />
                <DetailRow icon={Users} label="Passeggeri / Bagagli" value={`${selected.n_passeggeri ?? 0} pax · ${selected.n_bagagli ?? 0} bag`} />
                <DetailRow icon={MapPin} label="Luogo Inizio" value={selected.luogo_inizio} />
                <DetailRow icon={MapPin} label="Luogo Fine" value={selected.luogo_fine} />
                <DetailRow icon={Route} label="Itinerario" value={selected.itinerario} />
                <DetailRow icon={Info} label="Info Autista" value={selected.info_autista} />
                <DetailRow icon={Luggage} label="Accessori" value={selected.accessori} />
                <DetailRow icon={Car} label="Veicolo" value={
                  selected.veicoli ? `${selected.veicoli.tipo_macchina || ""} — ${selected.veicoli.targa}` : selected.veicolo_tipo
                } />
                <DetailRow icon={User2} label="Autista" value={
                  selected.autisti ? `${selected.autisti.nome} ${selected.autisti.cognome}` : null
                } />
                <DetailRow icon={User2} label="Fornitore CS" value={selected.fornitori_cs?.nome} />
                <DetailRow icon={CreditCard} label="Pagamento" value={selected.tipo_pagamento} />
                <DetailRow icon={CreditCard} label="Prezzo" value={selected.prezzo ? `€ ${selected.prezzo}` : null} />
                <DetailRow icon={FileText} label="Centro Costo" value={selected.centro_costo} />
                <DetailRow icon={FileText} label="Note" value={selected.note} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
