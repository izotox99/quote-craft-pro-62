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
  | "azioni"
  | "foglio"
  | "network_stato";

/** Colonne sempre visibili, non nascondibili dall'utente. */
export const PINNED_COLUMNS: ReadonlySet<ColumnKey> = new Set<ColumnKey>(["azioni"]);


export type ColumnDef = {
  key: ColumnKey;
  label: string;
  short?: string;
  description: string;
  weight: number;
  align?: "left" | "right" | "center";
};

export const COLUMNS: ColumnDef[] = [
  { key: "citta", label: "Città", short: "Città", description: "Città in cui si svolge il servizio.", weight: 2.5 },
  { key: "data", label: "Data servizio", short: "Data\nservizio", description: "Data e ora di inizio del servizio.", weight: 4 },
  { key: "societa", label: "Società", short: "Società", description: "Società cliente per cui viene svolto il servizio.", weight: 5.5 },
  { key: "contatti", label: "Contatti", short: "Contatti", description: "Nome del passeggero o referente da contattare.", weight: 5.5 },
  { key: "telefono", label: "Telefono", short: "Telefono", description: "Numero di telefono del passeggero/referente.", weight: 5 },
  { key: "np", label: "N.P", short: "N.P", description: "Numero di passeggeri.", weight: 1.5, align: "center" },
  { key: "nb", label: "N.B", short: "N.B", description: "Numero di bagagli.", weight: 1.5, align: "center" },
  { key: "tserv", label: "T.Serv", short: "T.Serv", description: "Tipo di servizio: transfer (interno/regionale), disposizione oraria o tour.", weight: 5.5 },
  { key: "luogo_inizio", label: "Luogo inizio", short: "Luogo inizio", description: "Punto di partenza del servizio (indirizzo, aeroporto, hotel).", weight: 8 },
  { key: "itinerario", label: "Itinerario", short: "Itinerario", description: "Tappe intermedie o percorso descritto del servizio.", weight: 7 },
  { key: "luogo_fine", label: "Luogo fine", short: "Luogo fine", description: "Punto di arrivo del servizio.", weight: 8 },
  { key: "info_autista", label: "Info autista", short: "Info autista", description: "Note operative per l'autista (cartello, sala VIP, gate…).", weight: 4.5 },
  { key: "accessori", label: "Accessori", short: "Accessori", description: "Accessori richiesti (seggiolino, wifi, acqua, ecc.).", weight: 4 },
  { key: "veicolo", label: "Veicolo", short: "Veicolo", description: "Veicolo assegnato al servizio (tipo e targa).", weight: 5 },
  { key: "tp", label: "T.P", short: "T.P", description: "Tipo di pagamento (fattura, contanti, carta di credito, bonifico…).", weight: 2.5, align: "center" },
  { key: "non_incassato", label: "No Inc €", short: "N°\nInc\n€", description: "Importo del servizio non ancora incassato dal cliente.", weight: 2.5, align: "center" },
  { key: "incasso", label: "Inc €", short: "Inc\n€", description: "Importo effettivamente incassato dal cliente.", weight: 2.5, align: "center" },
  { key: "cs", label: "CS", short: "CS", description: "Fornitore/partner (Corriere Speciale) a cui è affidato il servizio in conto terzi.", weight: 4.5 },
  { key: "costo_cs", label: "CS €", short: "CS\n€", description: "Costo pattuito col fornitore/partner a cui è affidato il servizio.", weight: 2.5, align: "center" },
  { key: "autista", label: "Aut", short: "Aut", description: "Autista assegnato (interno o esterno) con telefono e targa.", weight: 5.5 },
  { key: "costo_autista", label: "Aut €", short: "Aut\n€", description: "Costo dell'autista per questo servizio.", weight: 2.5, align: "center" },
  { key: "costo_centro", label: "C.C €", short: "C.C\n€", description: "Costo imputato a un centro di costo aziendale (spesa interna).", weight: 2, align: "center" },
  { key: "commissione", label: "Com €", short: "Com\n€", description: "Commissione applicata al servizio.", weight: 2, align: "center" },
  { key: "codice", label: "Codice", short: "Codice", description: "Codice interno identificativo del servizio.", weight: 4 },
  { key: "azioni", label: "Azioni", short: "Azioni", description: "Azioni contestuali sul servizio: assegna autista, conferma, stato.", weight: 5, align: "center" },
  { key: "foglio", label: "Foglio", short: "Foglio", description: "Pulsante di stampa del foglio di servizio in PDF.", weight: 2, align: "center" },

  { key: "network_stato", label: "Network", short: "Network", description: "Stato del passaggio al partner del network (inviato, accettato, ritirato).", weight: 4.2 },
];

export const COLUMNS_MAP: Record<ColumnKey, ColumnDef> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c]),
) as Record<ColumnKey, ColumnDef>;

export type ViewColumnState = { key: ColumnKey; visible: boolean; width?: number };

/** Le colonne legacy (25) — ordine e visibilità della vista "Completa" di default. */
export const LEGACY_ORDER: ColumnKey[] = [
  "citta", "data", "societa", "contatti", "telefono",
  "np", "nb", "tserv", "luogo_inizio", "itinerario",
  "luogo_fine", "info_autista", "accessori", "veicolo", "tp",
  "non_incassato", "incasso", "cs", "costo_cs", "autista",
  "costo_autista", "costo_centro", "commissione", "codice", "azioni", "foglio",
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
    const rawW = (item as any).width;
    const width = typeof rawW === "number" && isFinite(rawW) && rawW > 0 ? rawW : undefined;
    const visible = PINNED_COLUMNS.has(key) ? true : Boolean((item as any).visible);
    result.push({ key, visible, width });
  }
  for (const c of COLUMNS) {
    if (!seen.has(c.key)) result.push({ key: c.key, visible: PINNED_COLUMNS.has(c.key) });
  }
  // Le colonne "pinned" (es. Azioni) vanno sempre inserite se assenti dallo stato:
  // se erano rimaste orfane sopra vengono forzate visibili qui.
  for (const key of PINNED_COLUMNS) {
    const idx = result.findIndex((c) => c.key === key);
    if (idx >= 0 && !result[idx].visible) result[idx] = { ...result[idx], visible: true };
  }
  return result;
}


/** Larghezze effettive (in %) per le colonne visibili date le width esplicite + i pesi.
 *  Le colonne con width fissa sono rispettate; le altre si dividono lo spazio residuo
 *  in proporzione ai loro weight. Se la somma esplicita supera 100, tutto viene scalato. */
export function computeEffectiveWidths(
  visibleCols: ViewColumnState[],
): Record<string, number> {
  const out: Record<string, number> = {};
  let explicitSum = 0;
  const implicitKeys: ColumnKey[] = [];
  let implicitWeightSum = 0;
  for (const c of visibleCols) {
    if (typeof c.width === "number" && c.width > 0) {
      out[c.key] = c.width;
      explicitSum += c.width;
    } else {
      implicitKeys.push(c.key);
      implicitWeightSum += COLUMNS_MAP[c.key]?.weight ?? 3;
    }
  }
  const remaining = Math.max(0, 100 - explicitSum);
  if (implicitKeys.length > 0 && remaining > 0) {
    for (const k of implicitKeys) {
      const w = COLUMNS_MAP[k]?.weight ?? 3;
      out[k] = (w / (implicitWeightSum || 1)) * remaining;
    }
  } else if (implicitKeys.length > 0) {
    // nessuno spazio residuo: dai comunque una fetta minima (verrà clampata dopo)
    for (const k of implicitKeys) out[k] = 0.1;
  }
  // Normalizza a 100 esatto (evita drift da somma esplicita > 100 o arrotondamenti)
  const total = Object.values(out).reduce((s, v) => s + v, 0);
  if (total > 0 && Math.abs(total - 100) > 0.001) {
    const k = 100 / total;
    for (const key of Object.keys(out)) out[key] = out[key] * k;
  }
  return out;
}
