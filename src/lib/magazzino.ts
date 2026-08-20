export type TipoConfezione = "singolo" | "scatola" | "set" | "fusto";

export const TIPI_CONFEZIONE: { value: TipoConfezione; label: string }[] = [
  { value: "singolo", label: "Singolo" },
  { value: "scatola", label: "Scatola" },
  { value: "set", label: "Set" },
  { value: "fusto", label: "Fusto" },
];

const LABEL: Record<TipoConfezione, string> = {
  singolo: "Singolo",
  scatola: "Scatola",
  set: "Set",
  fusto: "Fusto",
};

/** es. "Scatola da 4 pezzo" */
export function formatoConfezione(tipo?: string | null, pezzi?: number | null): string {
  const t = (tipo as TipoConfezione) ?? "singolo";
  const n = Math.max(1, Number(pezzi ?? 1));
  return `${LABEL[t] ?? LABEL.singolo} da ${n} pezzo`;
}

/** es. "12 pz · 3 scatole da 4" */
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
