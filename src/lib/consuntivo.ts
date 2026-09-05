export const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const annoCorrente = new Date().getFullYear();
export const ANNI = Array.from({ length: 7 }, (_, i) => annoCorrente - 5 + i);

export const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

export const eur2 = (v: unknown) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(num(v));

export const pct = (v: unknown) => `${num(v).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;

/** Primo e ultimo giorno del mese, in formato YYYY-MM-DD */
export function periodoRange(anno: number, mese: number) {
  const p = (n: number) => String(n).padStart(2, "0");
  const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  return { from: `${anno}-${p(mese)}-01`, to: `${anno}-${p(mese)}-${p(ultimo)}` };
}

export type ServizioRiga = {
  id: string;
  data_servizio: string;
  ora_inizio: string | null;
  contatto: string | null;
  codice: string | null;
  client_id: string | null;
  autista_esterno_id?: string | null;
  prezzo: number | null;
  prezzo_fattura: number | null;
  prezzo_ccredito: number | null;
  prezzo_contante: number | null;
  non_incassato: number | null;
  com_cliente: number | null;
  costo_commissione: number | null;
  fatturato: boolean | null;
  last_minute?: boolean | null;
};

export function servizioLabel(s: ServizioRiga) {
  const data = s.data_servizio ? new Date(`${s.data_servizio}T12:00:00`).toLocaleDateString("it-IT") : "—";
  const passeggero = [s.contatto, s.codice ? `(${s.codice})` : null].filter(Boolean).join(" ");
  return `${data} · ${s.ora_inizio ?? "—"} · ${passeggero || "—"}`;
}

/** Percentuale applicata al collaboratore: la last minute sostituisce la normale solo sui servizi last minute. */
export function percentualeApplicata(
  s: { last_minute?: boolean | null },
  autista: { percentuale_network: number | null; percentuale_last_minute: number | null },
) {
  if (s.last_minute && autista.percentuale_last_minute != null) return num(autista.percentuale_last_minute);
  return num(autista.percentuale_network);
}
