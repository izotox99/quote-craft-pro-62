import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  /** true => parte automatico al mount (primo accesso). false => avvio manuale via ref */
  autoStart?: boolean;
  /** se utente è cliente padre mostriamo step Utenze */
  showUtenze?: boolean;
  /** callback per esporre la funzione "start" all'esterno */
  onReady?: (start: () => void) => void;
};

export function PortalTutorial({ autoStart = false, showUtenze = true, onReady }: Props) {
  const { user } = useAuth();
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    const steps = [
      {
        popover: {
          title: "Benvenuto nel tuo Portale 👋",
          description:
            "In meno di un minuto ti mostro come prenotare i tuoi servizi, gestire le utenze e consultare fatture e tariffario.",
          showButtons: ["next", "close"] as ("next" | "close")[],
          nextBtnText: "Inizia tour",
          closeBtnText: "Salta",
        },
      },
      {
        element: '[data-tour="prenota"]',
        popover: {
          title: "Prenota un servizio",
          description:
            "Da qui crei una nuova prenotazione: data, orario, indirizzi, passeggeri e puoi anche allegare un file (foto, PDF) per l'autista.",
          side: "right" as const,
          align: "start" as const,
        },
      },
      {
        element: '[data-tour="servizi"]',
        popover: {
          title: "Lista Servizi",
          description:
            "Qui trovi tutti i tuoi servizi prenotati. Puoi modificarli, annullarli o gestire l'allegato fino a 12 ore prima dell'orario di inizio.",
          side: "right" as const,
          align: "start" as const,
        },
      },
      ...(showUtenze
        ? [
            {
              element: '[data-tour="utenze"]',
              popover: {
                title: "Utenze",
                description:
                  "Crea sotto-utenze per i tuoi collaboratori: potranno prenotare servizi per conto della tua azienda con credenziali dedicate.",
                side: "right" as const,
                align: "start" as const,
              },
            },
          ]
        : []),
      {
        element: '[data-tour="tariffario"]',
        popover: {
          title: "Tariffario",
          description: "Consulta le tariffe concordate per i tuoi servizi in qualsiasi momento.",
          side: "right" as const,
          align: "start" as const,
        },
      },
      {
        element: '[data-tour="fatture"]',
        popover: {
          title: "Fatture",
          description: "Scarica e consulta tutte le fatture emesse per i tuoi servizi.",
          side: "right" as const,
          align: "start" as const,
        },
      },
      {
        popover: {
          title: "Tutto chiaro! 🎉",
          description:
            "Puoi rivedere questo tutorial in qualsiasi momento cliccando sull'icona ? in alto a destra. Buon lavoro!",
          showButtons: ["next"] as "next"[],
          nextBtnText: "Ho capito",
        },
      },
    ];

    const markCompleted = async () => {
      if (!user) return;
      const now = new Date().toISOString();
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (client) {
        await supabase.from("clients").update({ tutorial_completato_at: now }).eq("id", client.id);
        return;
      }
      await supabase
        .from("client_utenze")
        .update({ tutorial_completato_at: now })
        .eq("auth_user_id", user.id);
    };

    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 8,
      progressText: "{{current}} di {{total}}",
      nextBtnText: "Avanti →",
      prevBtnText: "← Indietro",
      doneBtnText: "Fine",
      steps,
      onDestroyed: () => {
        markCompleted();
      },
    });

    driverRef.current = d;

    const start = () => {
      // piccolo delay per assicurarsi che la sidebar sia montata
      setTimeout(() => d.drive(), 400);
    };

    if (onReady) onReady(start);
    if (autoStart) start();

    return () => {
      try {
        d.destroy();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, autoStart, showUtenze]);

  return null;
}
