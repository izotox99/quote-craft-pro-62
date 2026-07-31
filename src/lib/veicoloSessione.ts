import { supabase } from "@/integrations/supabase/client";

export type VeicoloSessione = {
  id: string;
  veicolo_id: string;
  aperta_at: string;
  veicolo: { id: string; targa: string; marca: string | null; modello: string | null; km_attuale: number | null } | null;
};

/** Unica fonte di verità del veicolo in uso dall'autista. */
export async function getSessioneVeicoloAttiva(): Promise<VeicoloSessione | null> {
  const { data, error } = await supabase
    .from("autisti_veicolo_sessioni" as any)
    .select("id, veicolo_id, aperta_at, veicolo:veicoli(id, targa, marca, modello, km_attuale)")
    .is("chiusa_at", null)
    .order("aperta_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as VeicoloSessione;
}

export async function apriSessioneVeicolo(veicoloId: string) {
  const { error } = await supabase.rpc("autista_apri_sessione_veicolo" as any, { _veicolo_id: veicoloId });
  if (error) throw error;
}

export async function chiudiSessioneVeicolo() {
  const { error } = await supabase.rpc("autista_chiudi_sessione_veicolo" as any);
  if (error) throw error;
}

export const labelVeicolo = (v: VeicoloSessione["veicolo"]) =>
  v ? `${v.targa}${[v.marca, v.modello].filter(Boolean).length ? " — " + [v.marca, v.modello].filter(Boolean).join(" ") : ""}` : "";
