import {
  Calendar, CalendarDays, CalendarClock, MessageSquare, CreditCard,
  Fuel, Clock, ListChecks, Link2, User, Umbrella, MessagesSquare,
} from "lucide-react";

export type TileDef = {
  key: string;
  label: string;
  icon: any;
  to: string;
  badgeKey?: "oggi" | "domani" | "dopodomani";
};

export const ALL_TILES: TileDef[] = [
  { key: "oggi", label: "Servizi OGGI", icon: Calendar, to: "/autista/servizi/oggi", badgeKey: "oggi" },
  { key: "domani", label: "Servizi DOMANI", icon: CalendarDays, to: "/autista/servizi/domani", badgeKey: "domani" },
  { key: "dopodomani", label: "Servizi D.DOMANI", icon: CalendarClock, to: "/autista/servizi/dopodomani", badgeKey: "dopodomani" },
  { key: "comunicazioni", label: "Comunicazioni", icon: MessageSquare, to: "/autista/comunicazioni" },
  { key: "carta", label: "Carta e spese", icon: CreditCard, to: "/autista/carta" },
  { key: "carburante", label: "Carburante", icon: Fuel, to: "/autista/carburante" },
  { key: "presenza", label: "Presenza", icon: Clock, to: "/autista/presenza" },
  { key: "ore", label: "Ore", icon: ListChecks, to: "/autista/ore" },
  { key: "feedback", label: "Feedback", icon: MessagesSquare, to: "/autista/feedback" },
  { key: "lista", label: "Lista servizi", icon: ListChecks, to: "/autista/lista" },
  { key: "ferie", label: "Ferie e riposi", icon: Umbrella, to: "/autista/ferie" },
  { key: "link", label: "Link utili", icon: Link2, to: "/autista/link" },
  { key: "profilo", label: "Profilo", icon: User, to: "/autista/profilo" },
];

export type TilePref = { key: string; visibile: boolean };

/** Ordina e filtra i tasti secondo le preferenze salvate dall'autista. */
export function applyTilePrefs(prefs: TilePref[] | null | undefined): TileDef[] {
  if (!prefs || prefs.length === 0) return ALL_TILES.slice(0, 9);
  const byKey = new Map(ALL_TILES.map((t) => [t.key, t]));
  const ordered: TileDef[] = [];
  for (const p of prefs) {
    const t = byKey.get(p.key);
    if (t && p.visibile) ordered.push(t);
    byKey.delete(p.key);
  }
  return ordered;
}

/** Preferenze complete (anche per i tasti nuovi non ancora salvati). */
export function mergePrefs(prefs: TilePref[] | null | undefined): TilePref[] {
  const saved = prefs ?? [];
  const known = new Set(saved.map((p) => p.key));
  const merged = saved.filter((p) => ALL_TILES.some((t) => t.key === p.key));
  for (const t of ALL_TILES) {
    if (!known.has(t.key)) merged.push({ key: t.key, visibile: merged.length < 9 });
  }
  return merged;
}
