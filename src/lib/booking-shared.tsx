import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const VEICOLI_DISPONIBILI = [
  "Autovettura 3 posti",
  "Luxury Car Serie S",
  "Minivan 7/8 posti",
  "Minivan 7 posti classe V",
  "Minibus 8 posti",
  "Minibus 16 Posti",
  "Bus 52 posti",
  "Veicolo disabili",
  "Servizio guida",
];

export const TIPOLOGIA_OPZIONI = [
  { value: "transfer_interno", label: "Transfer interno città" },
  { value: "transfer_regionale", label: "Transfer regionale" },
  { value: "tour", label: "Tour" },
];

export const TOUR_OPZIONI = [
  "Da Civitavecchia Full Day",
  "Full Day Fuori Roma",
  "Full Day Roma",
  "Half Day Fuori Roma",
  "Half Day Roma",
];

export const PAGAMENTO_OPZIONI = [
  { value: "fattura", label: "Fattura" },
  { value: "contante", label: "Contante" },
  { value: "carta_credito", label: "C. Credito" },
];

export const CITTA_OPZIONI = ["Roma", "Napoli"];

export const TERMINAL_FIUMICINO = ["Terminal 1", "Terminal 3", "Arrivi", "Partenze"];
export const TERMINAL_CIAMPINO = ["Arrivi", "Partenze"];
export const STAZIONI_ROMA = ["Roma Termini", "Roma Tiburtina", "Roma Ostiense", "Roma Trastevere", "Roma Tuscolana"];
export const AEROPORTI_ROMA = [
  { value: "Aeroporto Fiumicino", label: "Aeroporto di Fiumicino (FCO)" },
  { value: "Aeroporto Ciampino", label: "Aeroporto di Ciampino (CIA)" },
];

export type LuogoSpeciale =
  | null
  | { tipo: "aeroporto_generico"; opzioni: { value: string; label: string }[] }
  | { tipo: "fiumicino" | "ciampino"; opzioni: string[] }
  | { tipo: "stazione"; opzioni: string[] };

export function detectLuogoSpeciale(testo: string, citta: string, dettaglio: string): LuogoSpeciale {
  const t = (testo ?? "").toLowerCase().trim();
  if (!t) return null;
  const isRoma = citta === "Roma";

  if (/fiumicino|fco/.test(t)) return { tipo: "fiumicino", opzioni: TERMINAL_FIUMICINO };
  if (/ciampino|cia\b/.test(t)) return { tipo: "ciampino", opzioni: TERMINAL_CIAMPINO };

  const aeroportoGenericoMatch =
    t.includes("aer") || t.includes("airport");

  if (isRoma && aeroportoGenericoMatch) {
    if (dettaglio === "Aeroporto Fiumicino") return { tipo: "fiumicino", opzioni: TERMINAL_FIUMICINO };
    if (dettaglio === "Aeroporto Ciampino") return { tipo: "ciampino", opzioni: TERMINAL_CIAMPINO };
    return { tipo: "aeroporto_generico", opzioni: AEROPORTI_ROMA };
  }

  if (/stazione|termini|tiburtina|ostiense|trastevere|tuscolana/.test(t)) {
    return { tipo: "stazione", opzioni: STAZIONI_ROMA };
  }

  return null;
}

/** Splits a stored luogo like "Aeroporto di Ciampino (CIA) - Arrivi" into base + dettaglio (terminal). */
export function splitLuogo(stored: string | null | undefined): { base: string; dettaglio: string } {
  if (!stored) return { base: "", dettaglio: "" };
  const allTerminals = [...TERMINAL_FIUMICINO, ...TERMINAL_CIAMPINO];
  const idx = stored.lastIndexOf(" - ");
  if (idx > 0) {
    const tail = stored.slice(idx + 3).trim();
    if (allTerminals.includes(tail)) {
      return { base: stored.slice(0, idx).trim(), dettaglio: tail };
    }
  }
  return { base: stored, dettaglio: "" };
}

export function joinLuogo(base: string, dettaglio: string): string {
  return dettaglio ? `${base} - ${dettaglio}` : base;
}

export function LuogoField({
  label,
  value,
  onChange,
  dettaglio,
  onDettaglioChange,
  speciale,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dettaglio: string;
  onDettaglioChange: (v: string) => void;
  speciale: LuogoSpeciale;
  required?: boolean;
}) {
  const terminalValido =
    !!dettaglio &&
    (speciale?.tipo === "fiumicino"
      ? TERMINAL_FIUMICINO.includes(dettaglio)
      : speciale?.tipo === "ciampino"
      ? TERMINAL_CIAMPINO.includes(dettaglio)
      : false);

  const stazioneConfermata =
    speciale?.tipo === "stazione" && STAZIONI_ROMA.includes(value.trim());

  const handlePick = (val: string, lbl: string) => {
    if (!speciale) return;
    if (speciale.tipo === "aeroporto_generico") {
      onChange(lbl);
      onDettaglioChange(val);
    } else if (speciale.tipo === "stazione") {
      onChange(lbl);
      onDettaglioChange("");
    } else {
      onDettaglioChange(val);
    }
  };

  const showSuggestions =
    !!speciale &&
    ((speciale.tipo === "aeroporto_generico") ||
      (speciale.tipo === "stazione" && !stazioneConfermata) ||
      ((speciale.tipo === "fiumicino" || speciale.tipo === "ciampino") && !terminalValido));

  const headerText =
    !speciale
      ? ""
      : speciale.tipo === "aeroporto_generico"
      ? "Quale aeroporto?"
      : speciale.tipo === "stazione"
      ? "Quale stazione?"
      : "A quale terminal?";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Inserire Hotel, via, n. volo o aeroporto/stazione"
          className="rounded-lg min-h-[60px] resize-y"
        />
        {showSuggestions && (
          <div className="mt-1.5 rounded-xl border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-150">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary bg-accent/40 border-b border-border">
              {headerText}
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
              {speciale!.opzioni.map((o: any) => {
                const val = typeof o === "string" ? o : o.value;
                const lbl = typeof o === "string" ? o : o.label;
                return (
                  <li key={val}>
                    <button
                      type="button"
                      onClick={() => handlePick(val, lbl)}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      {lbl}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {terminalValido && (
        <div className="flex items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-accent text-accent-foreground">
            {dettaglio}
            <button
              type="button"
              onClick={() => onDettaglioChange("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cambia terminal"
            >
              ×
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/** Map booking tipologia (transfer_interno/transfer_regionale/tour) to DB enum. */
export function tipologiaToDB(tipologia: string): string {
  if (tipologia === "tour") return "tour";
  if (tipologia === "transfer_interno" || tipologia === "transfer_regionale") return "transfer";
  return "altro";
}

/** Reverse mapping: from DB record (tipologia + transfer_tipo) to booking tipologia value. */
export function tipologiaFromDB(tipologia: string | null, transferTipo: string | null): string {
  if (tipologia === "tour") return "tour";
  if (tipologia === "transfer") {
    if (transferTipo === "Transfer regionale") return "transfer_regionale";
    return "transfer_interno";
  }
  return "";
}

export function transferTipoForDB(tipologia: string): string | null {
  if (tipologia === "transfer_interno") return "Transfer interno città";
  if (tipologia === "transfer_regionale") return "Transfer regionale";
  return null;
}
