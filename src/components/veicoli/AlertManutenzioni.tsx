import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

type V = {
  id: string; targa: string; modello: string | null; marca: string | null; tipo_macchina: string | null;
  km_attuale: number | null; km_prima_scadenza: number | null; tagliando_alert_stato: string | null;
};

const nome = (v: V) => `${v.modello ?? v.tipo_macchina ?? v.marca ?? "Mezzo"} ${v.targa}`;

/** Alert manutenzione ordinaria in scadenza (stessa logica dell'alert tagliando). */
export function AlertManutenzioni() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<V[]>([]);

  useEffect(() => {
    supabase
      .from("veicoli")
      .select("id, targa, modello, marca, tipo_macchina, km_attuale, km_prima_scadenza, tagliando_alert_stato")
      .eq("attivo", true)
      .in("tagliando_alert_stato", ["avviso", "scaduto"])
      .then(({ data }) => setRows((data ?? []) as V[]));
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {rows.map((v) => {
        const scaduto = v.tagliando_alert_stato === "scaduto";
        const diff = (v.km_prima_scadenza ?? 0) - (v.km_attuale ?? 0);
        return (
          <button
            key={v.id}
            onClick={() => navigate(`/veicoli/${v.id}?tab=man-ord`)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left ${
              scaduto
                ? "border-destructive/40 bg-destructive/10"
                : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            }`}
          >
            <AlertTriangle className={`h-4 w-4 shrink-0 ${scaduto ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`} />
            <span className="text-xs font-medium">
              {scaduto
                ? `Manutenzione ordinaria da eseguire — ${nome(v)}`
                : `Manutenzione ordinaria in avvicinamento — ${nome(v)}`}
              <span className="ml-2 font-normal text-muted-foreground">
                {scaduto
                  ? `soglia superata di ${Math.abs(diff).toLocaleString("it-IT")} km`
                  : `mancano ${diff.toLocaleString("it-IT")} km`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
