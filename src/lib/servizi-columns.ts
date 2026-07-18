/**
 * Registro colonne della tabella Servizi (/dashboard).
 *
 * `key` = identificatore stabile persistito nel DB (dashboard_viste.colonne).
 * `weight` = peso relativo per la larghezza (table-fixed → % ricalcolate solo
 * sulle colonne visibili così la tabella resta full-width senza scroll orizzontale).
 * `align` guida solo l'allineamento della cella, non i dati.
 */
export type ColumnKey =
  | "citta"
  | "data"
  | "societa"
  | "contatti"
  | "telefono"
  | "np"
  | "nb"
  | "tserv"
  | "luogo_inizio"
  | "itinerario"
  | "luogo_fine"
  | "info_autista"
  | "accessori"
  | "veicolo"
  | "tp"
  | "non_incassato"
  | "incasso"
  | "cs"
  | "costo_cs"
  | "autista"
  | "costo_autista"
  | "costo_centro"
  | "commissione"
  | "codice"
  | "foglio"
  | "network_stato";

export type ColumnDef = {
  key: ColumnKey;
  label: string;
  short?: string;
  description: string;
  weight: number;
  align?: "left" | "right" | "center";
};

export const COLUMNS: ColumnDef[] = [
  { key: "citta", label: "Città", short: "Città", description: "Città in cui si svolge il servizio.", weight: 3 },
  { key: "data", label: "Data", short: "Data", description: "Data e ora di inizio del servizio.", weight: 4 },
  { key: "societa", label: "Società", short: "Società", description: "Società cliente per cui viene svolto il servizio.", weight: 6 },
  { key: "contatti", label: "Contatti", short: "Cont.", description: "Nome del passeggero o referente da contattare.", weight: 4 },
  { key: "telefono", label: "Telefono", short: "Tel.", description: "Numero di telefono del passeggero/referente.", weight: 5 },
  { key: "np", label: "N.P", short: "N.P", description: "Numero di passeggeri.", weight: 2, align: "center" },
  { key: "nb", label: "N.B", short: "N.B", description: "Numero di bagagli.", weight: 2, align: "center" },
  { key: "tserv", label: "T.Serv", short: "T.Serv", description: "Tipo di servizio: transfer (interno/regionale), disposizione oraria o tour.", weight: 5 },
  { key: "luogo_inizio", label: "Luogo inizio", short: "L.Inizio", description: "Punto di partenza del servizio (indirizzo, aeroporto, hotel).", weight: 7 },
  { key: "itinerario", label: "Itinerario", short: "Itiner.", description: "Tappe intermedie o percorso descritto del servizio.", weight: 7 },
  { key: "luogo_fine", label: "Luogo fine", short: "L.Fine", description: "Punto di arrivo del servizio.", weight: 7 },
  { key: "info_autista", label: "Info autista", short: "Info Aut.", description: "Note operative per l'autista (cartello, sala VIP, gate…).", weight: 5 },
  { key: "accessori", label: "Access.", short: "Acc.", description: "Accessori richiesti (seggiolino, wifi, acqua, ecc.).", weight: 3 },
  { key: "veicolo", label: "Veicolo", short: "Veic.", description: "Veicolo assegnato al servizio (tipo e targa).", weight: 4 },
  { key: "tp", label: "T.P", short: "T.P", description: "Tipo di pagamento (fattura, contanti, carta di credito, bonifico…).", weight: 3, align: "left" },
  { key: "non_incassato", label: "No Inc €", short: "NoInc€", description: "Importo del servizio non ancora incassato dal cliente.", weight: 3, align: "right" },
  { key: "incasso", label: "Inc €", short: "Inc€", description: "Importo effettivamente incassato dal cliente.", weight: 3, align: "right" },
  { key: "cs", label: "CS", short: "CS", description: "Fornitore/partner (Corriere Speciale) a cui è affidato il servizio in conto terzi.", weight: 4 },
  { key: "costo_cs", label: "CS €", short: "CS€", description: "Costo pattuito col fornitore/partner a cui è affidato il servizio.", weight: 3, align: "right" },
  { key: "autista", label: "Aut", short: "Aut", description: "Autista assegnato (interno o esterno) con telefono e targa.", weight: 5 },
  { key: "costo_autista", label: "Aut €", short: "Aut€", description: "Costo dell'autista per questo servizio.", weight: 3, align: "right" },
  { key: "costo_centro", label: "C.C €", short: "CC€", description: "Costo imputato a un centro di costo aziendale (spesa interna).", weight: 3, align: "right" },
  { key: "commissione", label: "Com €", short: "Com€", description: "Commissione applicata al servizio.", weight: 3, align: "right" },
  { key: "codice", label: "Codice", short: "Cod.", description: "Codice interno identificativo del servizio.", weight: 3 },
  { key: "foglio", label: "Foglio", short: "Fog.", description: "Pulsante di stampa del foglio di servizio in PDF.", weight: 2, align: "center" },
  { key: "network_stato", label: "Network", short: "Net", description: "Stato del passaggio al partner del network (inviato, accettato, ritirato).", weight: 4 },
];

export const COLUMNS_MAP: Record<ColumnKey, ColumnDef> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c]),
) as Record<ColumnKey, ColumnDef>;

export type ViewColumnState = { key: ColumnKey; visible: boolean };

/** Le colonne legacy (25) — ordine e visibilità della vista "Completa" di default. */
export const LEGACY_ORDER: ColumnKey[] = [
  "citta", "data", "societa", "contatti", "telefono",
  "np", "nb", "tserv", "luogo_inizio", "itinerario",
  "luogo_fine", "info_autista", "accessori", "veicolo", "tp",
  "non_incassato", "incasso", "cs", "costo_cs", "autista",
  "costo_autista", "costo_centro", "commissione", "codice", "foglio",
];

/**
 * Restituisce lo stato colonne "Completa": tutte le 25 legacy visibili + network_stato
 * presente ma nascosto (così può essere attivato manualmente senza perdere l'ordine legacy).
 */
export function makeCompletaState(): ViewColumnState[] {
  return [
    ...LEGACY_ORDER.map((k) => ({ key: k, visible: true })),
    { key: "network_stato" as ColumnKey, visible: false },
  ];
}

/** Costruisce uno stato colonne coerente: preserva l'ordine passato, nasconde le mancanti. */
function buildState(visibleOrdered: ColumnKey[]): ViewColumnState[] {
  const visibleSet = new Set(visibleOrdered);
  const trailing = COLUMNS
    .map((c) => c.key)
    .filter((k) => !visibleSet.has(k));
  return [
    ...visibleOrdered.map((k) => ({ key: k, visible: true })),
    ...trailing.map((k) => ({ key: k, visible: false })),
  ];
}

export type SystemView = {
  id: string;
  nome: string;
  columns: ViewColumnState[];
  descrizione: string;
};

export const SYSTEM_VIEWS: SystemView[] = [
  {
    id: "sys:completa",
    nome: "Completa",
    descrizione: "Tutte le colonne del gestionale (vista di default).",
    columns: makeCompletaState(),
  },
  {
    id: "sys:operativa",
    nome: "Operativa",
    descrizione: "Le voci essenziali per gestire le corse giornaliere.",
    columns: buildState([
      "data", "societa", "contatti", "telefono", "tserv",
      "luogo_inizio", "luogo_fine", "veicolo", "autista", "cs",
    ]),
  },
  {
    id: "sys:economica",
    nome: "Economica",
    descrizione: "Il quadro economico: incassi, costi e margini.",
    columns: buildState([
      "data", "societa", "tp",
      "non_incassato", "incasso", "costo_cs", "costo_autista", "costo_centro", "commissione",
    ]),
  },
  {
    id: "sys:network",
    nome: "Network",
    descrizione: "I servizi passati ai partner del network.",
    columns: buildState([
      "data", "societa", "cs", "costo_cs", "autista", "network_stato",
    ]),
  },
];

export const SYSTEM_VIEW_IDS = new Set(SYSTEM_VIEWS.map((v) => v.id));

/** Merge di uno stato salvato con il registro corrente: colonne nuove finiscono in coda nascoste,
 *  colonne rimosse dal registro vengono droppate. Serve alla migrazione forward-safe. */
export function reconcileColumns(saved: unknown): ViewColumnState[] {
  const registryKeys = new Set(COLUMNS.map((c) => c.key));
  const arr = Array.isArray(saved) ? saved : [];
  const seen = new Set<ColumnKey>();
  const result: ViewColumnState[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const key = (item as any).key as ColumnKey;
    if (!registryKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push({ key, visible: Boolean((item as any).visible) });
  }
  for (const c of COLUMNS) {
    if (!seen.has(c.key)) result.push({ key: c.key, visible: false });
  }
  return result;
}
