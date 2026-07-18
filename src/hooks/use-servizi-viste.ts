import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SYSTEM_VIEWS,
  SYSTEM_VIEW_IDS,
  reconcileColumns,
  makeCompletaState,
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
};

const LS_ACTIVE_KEY = "servizi_vista_attiva_id";

/** Carica le viste dell'utente + i preset di sistema, gestisce la selezione attiva. */
export function useServiziViste(userId: string | undefined) {
  const [personal, setPersonal] = useState<ViewRef[]>([]);
  const [activeId, setActiveId] = useState<string>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(LS_ACTIVE_KEY) || "sys:completa"
      : "sys:completa",
  );
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
      .select("id, nome, colonne, predefinita")
      .order("nome");
    if (error) return;
    setPersonal(
      (data ?? []).map((r: any) => ({
        id: r.id,
        nome: r.nome,
        system: false,
        predefinita: !!r.predefinita,
        columns: reconcileColumns(r.colonne),
      })),
    );
    setLoaded(true);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  // Al primo caricamento: se c'è una vista predefinita personale e l'utente non ha già
  // scelto qualcos'altro in questa sessione, la applichiamo.
  useEffect(() => {
    if (!loaded) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_ACTIVE_KEY) : null;
    if (stored) return;
    const def = personal.find((v) => v.predefinita);
    if (def) setActiveId(def.id);
  }, [loaded, personal]);

  const viste: ViewRef[] = useMemo(() => [...systemRefs, ...personal], [systemRefs, personal]);

  const activeView: ViewRef = useMemo(() => {
    const found = viste.find((v) => v.id === activeId);
    if (found) return found;
    return systemRefs[0];
  }, [viste, activeId, systemRefs]);

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

  return {
    viste,
    activeView,
    selectView,
    saveNewView,
    updateViewColumns,
    renameView,
    deleteView,
    setAsDefault,
    cloneSystemView,
    reload,
    loaded,
  };
}
