export type TipoConfezione = "singolo" | "scatola" | "set" | "fusto" | "latta";
export type UnitaBase = "pezzo" | "litro";
export type CategoriaArticolo = "ordinaria" | "straordinaria" | "uso_interno";

export const TIPI_CONFEZIONE: { value: TipoConfezione; label: string }[] = [
  { value: "singolo", label: "Singolo" },
  { value: "scatola", label: "Scatola" },
  { value: "fusto", label: "Fusto" },
  { value: "latta", label: "Latta" },
  { value: "set", label: "Set" },
];

export const UNITA_BASE: { value: UnitaBase; label: string }[] = [
  { value: "pezzo", label: "Pezzo" },
  { value: "litro", label: "Litro" },
];

export const CATEGORIE_ARTICOLO: { value: CategoriaArticolo; label: string }[] = [
  { value: "ordinaria", label: "Manutenzione ordinaria" },
  { value: "straordinaria", label: "Manutenzione straordinaria" },
  { value: "uso_interno", label: "Uso interno" },
];

export const labelCategoria = (c: string) =>
  CATEGORIE_ARTICOLO.find((x) => x.value === c)?.label ?? c;

const LABEL: Record<TipoConfezione, string> = {
  singolo: "Singolo",
  scatola: "Scatola",
  set: "Set",
  fusto: "Fusto",
  latta: "Latta",
};

const LABEL_UNITA: Record<UnitaBase, string> = { pezzo: "Pezzo", litro: "Litro" };

/** es. "Scatola da 4 Pezzo", "Fusto da 200 Litro" */
export function formatoConfezione(
  tipo?: string | null,
  quantita?: number | null,
  unitaBase?: string | null
): string {
  const t = (tipo as TipoConfezione) ?? "singolo";
  const n = Math.max(1, Number(quantita ?? 1));
  const u = (unitaBase as UnitaBase) ?? "pezzo";
  return `${LABEL[t] ?? LABEL.singolo} da ${n} ${LABEL_UNITA[u] ?? LABEL_UNITA.pezzo}`;
}

/** es. "12 pz · 3 × 4" */
export function pezziEConfezioni(pezziTot: number, pezziPerConf?: number | null): string {
  const f = Math.max(1, Number(pezziPerConf ?? 1));
  if (f <= 1) return `${pezziTot} pz`;
  const conf = pezziTot / f;
  const confTxt = Number.isInteger(conf) ? String(conf) : conf.toFixed(2);
  return `${pezziTot} pz · ${confTxt} × ${f}`;
}

/** es. ORD-007 */
export function numeroOrdine(numero: number | null | undefined): string {
  return numero == null ? "—" : `ORD-${String(numero).padStart(3, "0")}`;
}
