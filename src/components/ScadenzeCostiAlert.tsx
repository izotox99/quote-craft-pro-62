import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock } from "lucide-react";
import { dataIt } from "@/lib/costi";

export type ScadenzaCosto = {
  origine: string; riga_id: string; riferimento: string; tipo: string;
  data_scadenza: string; giorni_mancanti: number; stato: string;
};

export async function fetchScadenzeCosti(): Promise<ScadenzaCosto[]> {
  const { data } = await supabase
    .from("scadenze_costi" as never)
    .select("*")
    .in("stato", ["avviso", "scaduto"])
    .order("data_scadenza");
  return (data ?? []) as unknown as ScadenzaCosto[];
}

/** Alert scadenze costi (autisti, mezzi, costi generali) da mostrare in dashboard. */
export function ScadenzeCostiAlert() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScadenzaCosto[]>([]);

  useEffect(() => { fetchScadenzeCosti().then(setRows); }, []);
  if (rows.length === 0) return null;

  const target = (r: ScadenzaCosto) =>
    r.origine === "autista" ? "/amministrazione/costi?tab=autisti"
    : r.origine === "veicolo" ? "/amministrazione/costi?tab=macchine"
    : "/amministrazione/costi?tab=altri";

  return (
    <div className="space-y-2">
      {rows.slice(0, 6).map((r) => {
        const scaduto = r.stato === "scaduto";
        return (
          <button
            key={`${r.origine}-${r.riga_id}`}
            onClick={() => navigate(target(r))}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left ${
              scaduto
                ? "border-destructive/40 bg-destructive/10"
                : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            }`}
          >
            <CalendarClock className={`h-4 w-4 shrink-0 ${scaduto ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`} />
            <span className="text-xs font-medium">
              {scaduto ? "Scadenza superata" : "Scadenza in arrivo"} — {r.riferimento} · {r.tipo}
              <span className="ml-2 font-normal text-muted-foreground">
                {dataIt(r.data_scadenza)} ({scaduto ? `da ${Math.abs(r.giorni_mancanti)} gg` : `tra ${r.giorni_mancanti} gg`})
              </span>
            </span>
          </button>
        );
      })}
      {rows.length > 6 && (
        <button onClick={() => navigate("/amministrazione/costi")} className="text-xs text-primary hover:underline">
          +{rows.length - 6} altre scadenze
        </button>
      )}
    </div>
  );
}
