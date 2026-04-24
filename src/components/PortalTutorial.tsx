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
    // Helper per popover ricche con elenchi puntati
    const richDesc = (intro: string, bullets: string[], outro?: string) => `
      <div class="ptt-body">
        <p class="ptt-intro">${intro}</p>
        <ul class="ptt-list">
          ${bullets.map((b) => `<li><span class="ptt-dot"></span><span>${b}</span></li>`).join("")}
        </ul>
        ${outro ? `<p class="ptt-outro">${outro}</p>` : ""}
      </div>
    `;

    const steps = [
      // 1. Benvenuto
      {
        popover: {
          title: "👋 Benvenuto nel tuo Portale",
          description: richDesc(
            "Ti guido in un tour di circa 90 secondi per scoprire tutto quello che puoi fare da qui.",
            [
              "<b>Prenotare</b> nuovi servizi in pochi click",
              "<b>Gestire</b> e modificare i servizi esistenti",
              "<b>Consultare</b> tariffario e fatture in autonomia",
              showUtenze ? "<b>Creare utenze</b> per i tuoi collaboratori" : "",
            ].filter(Boolean),
            "Puoi saltare il tour e riavviarlo in qualsiasi momento dall'icona <b>?</b> in alto a destra."
          ),
          showButtons: ["next", "close"] as ("next" | "close")[],
          nextBtnText: "Inizia il tour →",
          closeBtnText: "Salta",
        },
      },

      // 2. Prenota - voce menu
      {
        element: '[data-tour="prenota"]',
        popover: {
          title: "📅 Prenota un servizio",
          description: richDesc(
            "Da qui crei una nuova prenotazione in modo guidato. Il sistema ti aiuta passo passo.",
            [
              "Scegli <b>data, orario e città</b>",
              "Indica <b>luogo di partenza</b> e <b>destinazione</b>",
              "Per Roma riconosciamo automaticamente <b>aeroporti</b> (Fiumicino, Ciampino) e <b>stazioni</b> (Termini, Tiburtina, Ostiense) chiedendoti il terminal/binario",
              "Inserisci <b>passeggeri</b>, <b>bagagli</b> e <b>note per l'autista</b>",
              "Puoi <b>allegare un file</b> (foto, PDF) — utile per voli, biglietti o ID",
            ],
            "💡 I dati del passeggero (nome, telefono, email) restano salvati per prenotare velocemente più servizi consecutivi."
          ),
          side: "right" as const,
          align: "start" as const,
        },
      },

      // 3. Lista Servizi
      {
        element: '[data-tour="servizi"]',
        popover: {
          title: "📋 Lista Servizi",
          description: richDesc(
            "Qui trovi <b>tutti i servizi</b> che hai prenotato, ordinati per data.",
            [
              "Visualizzi <b>stato</b> (nuovo, confermato, in corso, completato)",
              "Puoi <b>modificare</b> o <b>annullare</b> un servizio fino a <b>12 ore prima</b> dell'inizio",
              "Aggiungi o sostituisci <b>allegati</b> in qualsiasi momento",
              "Vedi l'<b>autista assegnato</b> e i dettagli del veicolo",
            ],
            "⚠️ Trascorse le 12 ore dall'orario di inizio, le modifiche vanno richieste direttamente al nostro centralino."
          ),
          side: "right" as const,
          align: "start" as const,
        },
      },

      // 4. Utenze (solo cliente padre)
      ...(showUtenze
        ? [
            {
              element: '[data-tour="utenze"]',
              popover: {
                title: "👥 Utenze collaboratori",
                description: richDesc(
                  "Crea <b>account dedicati</b> per i tuoi collaboratori: potranno prenotare servizi a nome della tua azienda con credenziali proprie.",
                  [
                    "Tipologia <b>Singolo</b>: vede solo i servizi che ha prenotato lui",
                    "Tipologia <b>Gruppo</b>: vede tutti i servizi dell'azienda",
                    "Puoi <b>disattivare</b> o <b>eliminare</b> un'utenza in qualsiasi momento",
                    "Le <b>fatture</b> restano sempre intestate alla tua azienda",
                  ],
                  "🔐 Ogni utenza riceve email e password personali per accedere al portale."
                ),
                side: "right" as const,
                align: "start" as const,
              },
            },
          ]
        : []),

      // 5. Tariffario
      {
        element: '[data-tour="tariffario"]',
        popover: {
          title: "💶 Tariffario",
          description: richDesc(
            "Consulta in <b>totale trasparenza</b> i prezzi concordati per i tuoi servizi.",
            [
              "Tariffe per <b>tipologia</b> (transfer, tour, disposizione)",
              "Prezzi per <b>tipologia di veicolo</b> (auto, minivan, bus)",
              "Eventuali <b>supplementi</b> e accessori",
            ],
            "Le tariffe mostrate sono quelle riservate alla tua azienda."
          ),
          side: "right" as const,
          align: "start" as const,
        },
      },

      // 6. Fatture
      {
        element: '[data-tour="fatture"]',
        popover: {
          title: "🧾 Fatture",
          description: richDesc(
            "Tutte le fatture emesse, sempre a portata di click.",
            [
              "<b>Scarica</b> il PDF di ogni fattura",
              "Filtra per <b>periodo</b> o <b>stato pagamento</b>",
              "Visualizza <b>dettaglio servizi</b> inclusi in ogni fattura",
            ],
            "📥 Hai bisogno di una fattura specifica? Scrivici, te la inviamo subito."
          ),
          side: "right" as const,
          align: "start" as const,
        },
      },

      // 7. Header / Help
      {
        element: '[data-tour="help-button"]',
        popover: {
          title: "❓ Aiuto sempre disponibile",
          description: richDesc(
            "Da questa icona puoi <b>riavviare il tutorial</b> ogni volta che vuoi.",
            [
              "Nessuna informazione viene persa: il tour si chiude e riprendi da dove eri",
              "Utile quando aggiungiamo <b>nuove funzionalità</b>",
            ]
          ),
          side: "bottom" as const,
          align: "end" as const,
        },
      },

      // 8. Conclusione
      {
        popover: {
          title: "🎉 Tutto pronto!",
          description: richDesc(
            "Hai completato il tour. Ora sai esattamente come muoverti nel portale.",
            [
              "Inizia subito creando la <b>tua prima prenotazione</b>",
              "Per qualsiasi dubbio, siamo a disposizione",
              "Buon lavoro! 🚗",
            ]
          ),
          showButtons: ["next"] as "next"[],
          nextBtnText: "Inizia ad usare il portale",
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
      smoothScroll: true,
      allowClose: true,
      overlayOpacity: 0.7,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "ptt-popover",
      progressText: "Step {{current}} di {{total}}",
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
