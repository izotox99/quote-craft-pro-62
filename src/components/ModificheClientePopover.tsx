import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const FIELD_LABELS: Record<string, string> = {
  data_servizio: "Data",
  ora_inizio: "Ora",
  citta: "Città",
  tipologia: "Tipologia",
  transfer_tipo: "Tipo transfer",
  disposizione_oraria: "Disposizione",
  tour_tipo: "Tipo tour",
  luogo_inizio: "Luogo inizio",
  luogo_fine: "Luogo fine",
  itinerario: "Itinerario",
  veicolo_tipo: "Veicolo",
  n_passeggeri: "Passeggeri",
  n_bagagli: "Bagagli",
  info_autista: "Info autista",
  tipo_pagamento: "Pagamento",
  centro_costo: "Centro di costo",
  accessori: "Accessori",
  note: "Note",
};

type Modifica = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

interface Props {
  servizioId: string;
  iconClassName?: string;
}

export function ModificheClientePopover({ servizioId, iconClassName = "h-3.5 w-3.5 text-amber-500" }: Props) {
  const [open, setOpen] = useState(false);
  const [modifiche, setModifiche] = useState<Modifica[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("servizi_modifiche")
      .select("id, field_name, old_value, new_value, created_at")
      .eq("servizio_id", servizioId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setModifiche((data ?? []) as Modifica[]);
        setLoading(false);
      });
  }, [open, servizioId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); }}
          title="Modificato dal cliente — clicca per dettagli"
          className="inline-flex items-center justify-center rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 p-0.5 transition-colors"
        >
          <AlertTriangle className={iconClassName} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b bg-amber-50 dark:bg-amber-950/40">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Modifiche del cliente
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Caricamento…</div>
          ) : modifiche.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">Nessuna modifica registrata.</div>
          ) : (
            <ul className="divide-y">
              {modifiche.map((m) => (
                <li key={m.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {FIELD_LABELS[m.field_name] ?? m.field_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(m.created_at), "d MMM HH:mm", { locale: it })}
                    </span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="flex gap-1.5">
                      <span className="text-muted-foreground shrink-0">Da:</span>
                      <span className="line-through text-muted-foreground break-words">
                        {m.old_value || "—"}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-muted-foreground shrink-0">A:</span>
                      <span className="font-medium text-foreground break-words">
                        {m.new_value || "—"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
