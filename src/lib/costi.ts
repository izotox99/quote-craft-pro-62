import { supabase } from "@/integrations/supabase/client";

export type AmbitoCosto = "autista" | "veicolo" | "riparazione";

export type TipoCosto = {
  id: string;
  ambito: AmbitoCosto;
  valore: string;
  ricorrente: boolean;
  ordine: number;
  attivo: boolean;
};

export const TIPI_PAGAMENTO = [
  "Bonifico",
  "Carta di credito",
  "Contanti",
  "RID / Addebito",
  "Assegno",
  "Altro",
];

export const RICORRENZE = [
  { value: "3m", label: "3 mesi", mesi: 3 },
  { value: "6m", label: "6 mesi", mesi: 6 },
  { value: "12m", label: "12 mesi", mesi: 12 },
  { value: "nessuno", label: "Nessuno", mesi: 0 },
];

export async function fetchTipiCosto(ambito: AmbitoCosto): Promise<TipoCosto[]> {
  const { data } = await supabase
    .from("config_tipi_costo" as never)
    .select("*")
    .eq("ambito", ambito)
    .order("ordine")
    .order("valore");
  return ((data ?? []) as unknown as TipoCosto[]).filter((t) => t.attivo);
}

/** Aggiunge N mesi a una data ISO (yyyy-MM-dd) e restituisce ISO. */
export function addMesi(dataIso: string, mesi: number): string {
  const d = new Date(`${dataIso}T12:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + mesi);
  if (d.getDate() < day) d.setDate(0); // fine mese
  return d.toISOString().slice(0, 10);
}

export type StatoScadenza = "ok" | "avviso" | "scaduto" | null;

export function statoScadenza(dataScadenza?: string | null, giorniPreavviso = 30): StatoScadenza {
  if (!dataScadenza) return null;
  const g = giorniMancanti(dataScadenza);
  if (g < 0) return "scaduto";
  if (g <= giorniPreavviso) return "avviso";
  return "ok";
}

export function giorniMancanti(dataScadenza: string): number {
  const oggi = new Date();
  oggi.setHours(12, 0, 0, 0);
  const d = new Date(`${dataScadenza}T12:00:00`);
  return Math.round((d.getTime() - oggi.getTime()) / 86400000);
}

export function classeScadenza(stato: StatoScadenza): string {
  if (stato === "scaduto") return "text-destructive font-semibold";
  if (stato === "avviso") return "text-amber-600 dark:text-amber-400 font-medium";
  return "";
}

export const eur = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n));

export const dataIt = (d?: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT") : "—";
