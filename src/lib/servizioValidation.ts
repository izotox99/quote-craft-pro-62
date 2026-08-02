import { z } from "zod";

/**
 * Validazione condivisa dei campi obbligatori di un servizio.
 * Gli stessi vincoli sono replicati lato server dal trigger
 * `servizi_valida_campi_obbligatori` sulla tabella `servizi`.
 */

export const STATI_SERVIZIO = [
  "nuovo",
  "da_confermare",
  "confermato",
  "in_corso",
  "completato",
  "annullato",
] as const;

const req = (msg: string) => z.string({ required_error: msg }).trim().min(1, msg);

export const servizioSchema = z
  .object({
    citta: req("Città di servizio obbligatoria"),
    client_id: req("Seleziona la società cliente (Per Conto di)"),
    data_servizio: req("Data del servizio obbligatoria"),
    ora_inizio: req("Ora di inizio obbligatoria").regex(
      /^([01]\d|2[0-3]):[0-5]\d$/,
      "Ora di inizio non valida (formato HH:MM)"
    ),
    veicolo_tipo: req("Tipo di veicolo obbligatorio"),
    luogo_inizio: req("Luogo di inizio obbligatorio"),
    luogo_fine: req("Luogo di fine obbligatorio"),
    tipo_pagamento: req("Tipo di pagamento obbligatorio"),
    stato: z.enum(STATI_SERVIZIO, {
      errorMap: () => ({ message: "Stato del servizio non valido" }),
    }),
    n_passeggeri: z
      .number({ invalid_type_error: "Numero passeggeri non valido" })
      .int("Numero passeggeri non valido")
      .min(1, "Deve esserci almeno 1 passeggero"),
    n_bagagli: z
      .number({ invalid_type_error: "Numero bagagli non valido" })
      .int("Numero bagagli non valido")
      .min(0, "Numero bagagli non valido"),
    transfer_tipo: z.string().nullish(),
    disposizione_oraria: z.string().nullish(),
    tour_tipo: z.string().nullish(),
  })
  .refine(
    (v) => !!(v.transfer_tipo || v.disposizione_oraria || v.tour_tipo),
    {
      path: ["transfer_tipo"],
      message: "Seleziona una tipologia: Transfer, Disposizione oraria o Tour",
    }
  );

export type ServizioInput = z.input<typeof servizioSchema>;

export type ServizioErrors = Partial<Record<string, string>>;

/** Ritorna una mappa campo -> messaggio (vuota se tutto valido). */
export function validaServizio(values: Record<string, unknown>): ServizioErrors {
  const parsed = servizioSchema.safeParse({
    citta: values.citta ?? "",
    client_id: values.client_id ?? "",
    data_servizio: values.data_servizio ?? "",
    ora_inizio: values.ora_inizio ?? "",
    veicolo_tipo: values.veicolo_tipo ?? "",
    luogo_inizio: values.luogo_inizio ?? "",
    luogo_fine: values.luogo_fine ?? "",
    tipo_pagamento: values.tipo_pagamento ?? "",
    stato: (values.stato as string) || "nuovo",
    n_passeggeri: Number(values.n_passeggeri ?? 1),
    n_bagagli: Number(values.n_bagagli ?? 0),
    transfer_tipo: (values.transfer_tipo as string) ?? null,
    disposizione_oraria: (values.disposizione_oraria as string) ?? null,
    tour_tipo: (values.tour_tipo as string) ?? null,
  });
  if (parsed.success) return {};
  const errors: ServizioErrors = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
