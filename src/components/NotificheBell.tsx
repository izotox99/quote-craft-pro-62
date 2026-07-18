import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, XCircle, Pencil, FilePlus, Check, Inbox, CalendarClock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Notifica = {
  id: string;
  tipo: "servizio_annullato" | "servizio_modificato" | "servizio_creato" | string;
  titolo: string;
  messaggio: string | null;
  servizio_id: string | null;
  letta: boolean;
  created_at: string;
};

const tipoIcon: Record<string, { icon: typeof Bell; className: string }> = {
  servizio_annullato: { icon: XCircle, className: "text-destructive" },
  servizio_modificato: { icon: Pencil, className: "text-amber-600 dark:text-amber-400" },
  servizio_creato: { icon: FilePlus, className: "text-emerald-600 dark:text-emerald-400" },
};

export function NotificheBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifiche")
      .select("id, tipo, titolo, messaggio, servizio_id, letta, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifiche((data ?? []) as Notifica[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    // realtime: aggiorna alla creazione di nuove notifiche
    const ch = supabase
      .channel("notifiche-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifiche" }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const nonLette = notifiche.filter(n => !n.letta).length;

  const apri = async (n: Notifica) => {
    if (!n.letta) {
      await supabase.from("notifiche").update({ letta: true }).eq("id", n.id);
      setNotifiche(prev => prev.map(x => x.id === n.id ? { ...x, letta: true } : x));
    }
    setOpen(false);
    navigate("/dashboard");
  };

  const segnaTutteLette = async () => {
    const ids = notifiche.filter(n => !n.letta).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifiche").update({ letta: true }).in("id", ids);
    setNotifiche(prev => prev.map(n => ({ ...n, letta: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/50 relative">
          <Bell className="h-4 w-4" />
          {nonLette > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {nonLette > 9 ? "9+" : nonLette}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifiche</span>
            {nonLette > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                {nonLette} nuove
              </span>
            )}
          </div>
          {nonLette > 0 && (
            <button
              onClick={segnaTutteLette}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> Segna tutte
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {notifiche.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nessuna notifica</p>
            </div>
          ) : (
            notifiche.map(n => {
              const cfg = tipoIcon[n.tipo] ?? { icon: Bell, className: "text-muted-foreground" };
              const Icon = cfg.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => apri(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/30 last:border-0 hover:bg-accent/50 transition-colors flex gap-3",
                    !n.letta && "bg-primary/5"
                  )}
                >
                  <div className={cn("mt-0.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0", cfg.className)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-xs leading-tight", !n.letta ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                        {n.titolo}
                      </p>
                      {!n.letta && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                    </div>
                    {n.messaggio && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.messaggio}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: it })}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
