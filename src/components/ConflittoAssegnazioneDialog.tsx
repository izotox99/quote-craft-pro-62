import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import type { ConflittoServizio } from "@/lib/conflittiAssegnazione";

type Payload = {
  risorsa: string;
  conflitti: ConflittoServizio[];
};

/**
 * Avviso NON bloccante di sovrapposizione: l'operatore può forzare l'assegnazione.
 */
export function useConflittoAssegnazione() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const chiediConferma = useCallback((p: Payload) => {
    setPayload(p);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPayload(null);
  };

  const dialog = (
    <AlertDialog open={!!payload} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sovrapposizione rilevata
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Attenzione: <span className="font-semibold text-foreground">{payload?.risorsa}</span>{" "}
                risulta già assegnat{payload?.conflitti.length === 1 ? "o" : "o"} a{" "}
                {payload?.conflitti.length === 1 ? "un servizio che si sovrappone" : "più servizi che si sovrappongono"}:
              </p>
              <ul className="space-y-1">
                {payload?.conflitti.map((c) => (
                  <li key={c.id} className="rounded border bg-muted/40 px-2 py-1 text-foreground">
                    servizio delle <span className="font-semibold">{c.ora_inizio || "orario n.d."}</span>
                    {" "}del {c.data_servizio.split("-").reverse().join("/")} ({c.cliente})
                    {c.luogo_inizio ? ` — ${c.luogo_inizio}` : ""}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                La durata è stimata dalla disposizione oraria quando presente, altrimenti dal tipo di servizio.
              </p>
              <p>Assegnare comunque?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={() => close(true)}>Assegna comunque</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { chiediConferma, dialog };
}
