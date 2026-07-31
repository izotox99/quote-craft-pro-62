// Date helpers ancorate al fuso Europe/Rome (il DB salva data_servizio come date locale IT)

export function romeToday(offset = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export function romeLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Primo giorno del mese corrente (Europe/Rome), formato YYYY-MM-DD */
export function romeMonthStart(): string {
  return romeToday().slice(0, 8) + "01";
}

/** Range primo/ultimo giorno di un mese "YYYY-MM", senza slittamenti di fuso */
export function romeMonthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to };
}

/** Mese corrente "YYYY-MM" in Europe/Rome */
export function romeYearMonth(): string {
  return romeToday().slice(0, 7);
}

/** Formatta un timestamp per l'utente sempre in orario italiano */
export function romeDateTimeLabel(iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) {
  return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", ...opts });
}

/** Formatta solo l'orario di un timestamp in orario italiano */
export function romeTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
}
