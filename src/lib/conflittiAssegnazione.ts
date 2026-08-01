import { supabase } from "@/integrations/supabase/client";

/**
 * Stima della durata di un servizio (in minuti):
 * - se `disposizione_oraria` contiene un numero di ore (es. "8 Ore") si usa quello
 * - altrimenti default per tipologia: transfer 2h, disposizione 4h, tour 8h, evento/altro 2h
 */
export const DURATA_DEFAULT_ORE: Record<string, number> = {
  transfer: 2,
  disposizione: 4,
  tour: 8,
  evento: 2,
  altro: 2,
};

export const DURATA_FALLBACK_ORE = 2;

export function stimaDurataMinuti(s: {
  disposizione_oraria?: string | null;
  tipologia?: string | null;
}): number {
  const m = (s.disposizione_oraria ?? "").match(/(\d+(?:[.,]\d+)?)/);
  if (m) {
    const ore = parseFloat(m[1].replace(",", "."));
    if (!isNaN(ore) && ore > 0) return Math.round(ore * 60);
  }
  const ore = DURATA_DEFAULT_ORE[(s.tipologia ?? "").toLowerCase()] ?? DURATA_FALLBACK_ORE;
  return ore * 60;
}

function oraToMinuti(ora?: string | null): number | null {
  if (!ora) return null;
  const m = ora.match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Istante di inizio in minuti assoluti rispetto alla data di riferimento */
function inizioAssoluto(dataServizio: string, ora: string | null | undefined, ref: string): number | null {
  const min = oraToMinuti(ora);
  if (min === null) return null;
  const diffDays = Math.round(
    (new Date(`${dataServizio}T00:00:00`).getTime() - new Date(`${ref}T00:00:00`).getTime()) / 86400000,
  );
  return diffDays * 1440 + min;
}

export type ConflittoServizio = {
  id: string;
  ora_inizio: string | null;
  data_servizio: string;
  cliente: string;
  luogo_inizio: string | null;
};

type Target = {
  id: string;
  data_servizio: string;
  ora_inizio: string | null;
  disposizione_oraria?: string | null;
  tipologia?: string | null;
};

/**
 * Cerca i servizi (non annullati/archiviati) che si sovrappongono nell'orario
 * e che hanno già assegnata la stessa risorsa (autista o veicolo).
 */
export async function trovaConflitti(
  target: Target,
  risorsa:
    | { tipo: "veicolo"; id: string }
    | { tipo: "autista_interno"; id: string }
    | { tipo: "autista_esterno"; id: string },
): Promise<ConflittoServizio[]> {
  if (!target.data_servizio) return [];

  let query = supabase
    .from("servizi")
    .select("id, data_servizio, ora_inizio, disposizione_oraria, tipologia, contatto, luogo_inizio, clients(name, company)")
    .neq("id", target.id)
    .eq("archiviato", false)
    .neq("stato", "annullato")
    .gte("data_servizio", addDays(target.data_servizio, -1))
    .lte("data_servizio", addDays(target.data_servizio, 1));

  if (risorsa.tipo === "veicolo") query = query.eq("veicolo_id", risorsa.id);
  else if (risorsa.tipo === "autista_interno") query = query.eq("autista_id", risorsa.id);
  else query = query.eq("autista_esterno_id", risorsa.id);

  const { data, error } = await query;
  if (error || !data) return [];

  const ref = target.data_servizio;
  const startA = inizioAssoluto(target.data_servizio, target.ora_inizio, ref);
  if (startA === null) return [];
  const endA = startA + stimaDurataMinuti(target);

  return (data as any[])
    .filter((s) => {
      const startB = inizioAssoluto(s.data_servizio, s.ora_inizio, ref);
      if (startB === null) return false;
      const endB = startB + stimaDurataMinuti(s);
      return startA < endB && startB < endA;
    })
    .map((s) => ({
      id: s.id,
      data_servizio: s.data_servizio,
      ora_inizio: s.ora_inizio,
      luogo_inizio: s.luogo_inizio,
      cliente: s.clients?.company || s.clients?.name || s.contatto || "cliente n.d.",
    }));
}
