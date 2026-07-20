import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SYSTEM_VIEWS,
  SYSTEM_VIEW_IDS,
  reconcileColumns,
  makeCompletaState,
  type ColumnKey,
  type ViewColumnState,
  type SystemView,
} from "@/lib/servizi-columns";

export type ViewRef = {
  id: string;
  nome: string;
  system: boolean;
  predefinita: boolean;
  descrizione?: string;
  columns: ViewColumnState[];
  fontLevel?: number | null;
};

const LS_VERSION = "v2";
const LS_ACTIVE_KEY = `servizi_vista_attiva_id_${LS_VERSION}`;
const LS_LEGACY_KEYS = ["servizi_vista_attiva_id"];
const LS_WIDTHS_PREFIX = `servizi_col_widths_${LS_VERSION}:`;
const LS_FONT_PREFIX = `servizi_font_level_${LS_VERSION}:`;

type WidthMap = Partial<Record<ColumnKey, number>>;

function lsWidthsKey(viewId: string) { return `${LS_WIDTHS_PREFIX}${viewId}`; }
function lsFontKey(viewId: string) { return `${LS_FONT_PREFIX}${viewId}`; }

export function readFontLevelCache(viewId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lsFontKey(viewId));
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
function writeFontLevelCache(viewId: string, level: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(lsFontKey(viewId), String(level)); } catch {}
}

export function readWidthsCache(viewId: string): WidthMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(lsWidthsKey(viewId));
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    const out: WidthMap = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number" && isFinite(v) && v > 0) out[k as ColumnKey] = v;
    }
    return out;
  } catch { return {}; }
}

function writeWidthsCache(viewId: string, widths: WidthMap) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(lsWidthsKey(viewId), JSON.stringify(widths)); } catch {}
}

function clearWidthsCache(viewId: string) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(lsWidthsKey(viewId)); } catch {}
}

/** Sovrappone la WidthMap allo stato colonne (LS ha priorità sul valore DB per reattività). */
export function applyWidthsToColumns(cols: ViewColumnState[], widths: WidthMap): ViewColumnState[] {
  return cols.map((c) => {
    const w = widths[c.key];
    if (typeof w === "number" && w > 0) return { ...c, width: w };
    return c;
  });
}

/** Legge la vista attiva salvata, scartando valori di versioni precedenti. */
function readStoredActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Pulisci eventuali chiavi legacy (versioni precedenti dello schema viste).
    for (const k of LS_LEGACY_KEYS) {
      if (localStorage.getItem(k) !== null) localStorage.removeItem(k);
    }
    const raw = localStorage.getItem(LS_ACTIVE_KEY);
    if (!raw) return null;
    // Valori accettati: id di sistema noto ("sys:...") oppure UUID.
    const isSystem = SYSTEM_VIEW_IDS.has(raw);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    if (!isSystem && !isUuid) {
      localStorage.removeItem(LS_ACTIVE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** Carica le viste dell'utente + i preset di sistema, gestisce la selezione attiva. */
export function useServiziViste(userId: string | undefined) {
  const [personal, setPersonal] = useState<ViewRef[]>([]);
  const [activeId, setActiveId] = useState<string>(() => readStoredActiveId() || "sys:completa");
  const [loaded, setLoaded] = useState(false);

  const systemRefs: ViewRef[] = useMemo(
    () =>
      SYSTEM_VIEWS.map((v: SystemView) => ({
        id: v.id,
        nome: v.nome,
        system: true,
        predefinita: false,
        descrizione: v.descrizione,
        columns: v.columns,
      })),
    [],
  );

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("dashboard_viste")
      .select("id, nome, colonne, predefinita, font_level")
      .order("nome");
    if (error) return;
    setPersonal(
      (data ?? []).map((r: any) => ({
        id: r.id,
        nome: r.nome,
        system: false,
        predefinita: !!r.predefinita,
        columns: reconcileColumns(r.colonne),
        fontLevel: typeof r.font_level === "number" ? r.font_level : null,
      })),
    );
    setLoaded(true);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  // Al primo caricamento: se c'è una vista predefinita personale e l'utente non ha già
  // scelto qualcos'altro in questa sessione, la applichiamo.
  useEffect(() => {
    if (!loaded) return;
    const stored = readStoredActiveId();
    if (stored) return;
    const def = personal.find((v) => v.predefinita);
    if (def) setActiveId(def.id);
  }, [loaded, personal]);

  const viste: ViewRef[] = useMemo(() => [...systemRefs, ...personal], [systemRefs, personal]);

  // Cache reattiva delle larghezze per-vista (localStorage-first).
  const [widthsById, setWidthsById] = useState<Record<string, WidthMap>>({});
  const dbDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const activeView: ViewRef = useMemo(() => {
    const found = viste.find((v) => v.id === activeId);
    const base = found ?? systemRefs[0];
    // Merge: LS cache (state) ha priorità sulle width del DB già presenti in base.columns.
    let cache = widthsById[base.id];
    if (cache === undefined) {
      cache = readWidthsCache(base.id);
    }
    if (Object.keys(cache).length === 0) return base;
    return { ...base, columns: applyWidthsToColumns(base.columns, cache) };
  }, [viste, activeId, systemRefs, widthsById]);

  const selectView = useCallback((id: string) => {
    setActiveId(id);
    try { localStorage.setItem(LS_ACTIVE_KEY, id); } catch {}
  }, []);

  const saveNewView = useCallback(async (nome: string, columns: ViewColumnState[]) => {
    const trimmed = nome.trim();
    if (!trimmed) throw new Error("Il nome della vista è obbligatorio");
    if (SYSTEM_VIEWS.some((s) => s.nome.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Nome riservato alle viste di sistema");
    }
    const { data, error } = await supabase
      .from("dashboard_viste")
      .insert({ nome: trimmed, colonne: columns as any, predefinita: false } as any)
      .select("id")
      .single();
    if (error) throw error;
    await reload();
    selectView(data!.id);
  }, [reload, selectView]);

  const updateViewColumns = useCallback(async (id: string, columns: ViewColumnState[]) => {
    if (SYSTEM_VIEW_IDS.has(id)) throw new Error("Le viste di sistema non sono modificabili");
    const { error } = await supabase
      .from("dashboard_viste")
      .update({ colonne: columns as any })
      .eq("id", id);
    if (error) throw error;
    await reload();
  }, [reload]);

  const renameView = useCallback(async (id: string, nome: string) => {
    if (SYSTEM_VIEW_IDS.has(id)) throw new Error("Le viste di sistema non sono rinominabili");
    const trimmed = nome.trim();
    if (!trimmed) throw new Error("Nome obbligatorio");
    const { error } = await supabase
      .from("dashboard_viste")
      .update({ nome: trimmed })
      .eq("id", id);
    if (error) throw error;
    await reload();
  }, [reload]);

  const deleteView = useCallback(async (id: string) => {
    if (SYSTEM_VIEW_IDS.has(id)) throw new Error("Le viste di sistema non sono eliminabili");
    const { error } = await supabase.from("dashboard_viste").delete().eq("id", id);
    if (error) throw error;
    if (activeId === id) selectView("sys:completa");
    await reload();
  }, [reload, activeId, selectView]);

  const setAsDefault = useCallback(async (id: string) => {
    if (SYSTEM_VIEW_IDS.has(id)) throw new Error("Le viste di sistema non possono essere impostate come predefinita — clonale prima");
    const { error } = await supabase
      .from("dashboard_viste")
      .update({ predefinita: true })
      .eq("id", id);
    if (error) throw error;
    await reload();
  }, [reload]);

  const cloneSystemView = useCallback(async (sys: SystemView, nome: string) => {
    await saveNewView(nome, sys.columns);
  }, [saveNewView]);

  /** Aggiorna le larghezze di una vista.
   *  - Applica subito la cache in localStorage + state (reattività).
   *  - Se la vista è personale, persiste il jsonb `colonne` sul DB (debounced 400ms). */
  const updateColumnWidths = useCallback((viewId: string, widths: WidthMap) => {
    writeWidthsCache(viewId, widths);
    setWidthsById((prev) => ({ ...prev, [viewId]: widths }));

    if (SYSTEM_VIEW_IDS.has(viewId)) return; // sistema → solo LS

    // Debounce salvataggio DB
    if (dbDebounce.current[viewId]) clearTimeout(dbDebounce.current[viewId]);
    dbDebounce.current[viewId] = setTimeout(async () => {
      const view = personal.find((v) => v.id === viewId);
      if (!view) return;
      const merged = applyWidthsToColumns(view.columns, widths);
      const { error } = await supabase
        .from("dashboard_viste")
        .update({ colonne: merged as any })
        .eq("id", viewId);
      if (!error) await reload();
    }, 400);
  }, [personal, reload]);

  /** Ripristina le larghezze predefinite: rimuove sia la cache LS sia i valori DB. */
  const resetColumnWidths = useCallback(async (viewId: string) => {
    clearWidthsCache(viewId);
    setWidthsById((prev) => ({ ...prev, [viewId]: {} }));
    if (SYSTEM_VIEW_IDS.has(viewId)) return;
    const view = personal.find((v) => v.id === viewId);
    if (!view) return;
    const stripped = view.columns.map(({ width, ...rest }) => rest);
    const { error } = await supabase
      .from("dashboard_viste")
      .update({ colonne: stripped as any })
      .eq("id", viewId);
    if (!error) await reload();
  }, [personal, reload]);


  return {
    viste,
    activeView,
    selectView,
    saveNewView,
    updateViewColumns,
    updateColumnWidths,
    resetColumnWidths,
    renameView,
    deleteView,
    setAsDefault,
    cloneSystemView,
    reload,
    loaded,
  };
}
