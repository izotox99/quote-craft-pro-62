import { supabase } from "@/integrations/supabase/client";

export type VeicoloSessione = {
  id: string;
  veicolo_id: string;
  aperta_at: string;
  km_inizio: number | null;
  km_fine: number | null;
  veicolo: {
    id: string; targa: string; marca: string | null; modello: string | null; km_attuale: number | null;
    photo_url: string | null; telepass: string | null; viacard: string | null;
    autorizzazione_numero: string | null; autorizzazione_comune: string | null;
  } | null;
};

/** Unica fonte di verità del veicolo in uso dall'autista. */
export async function getSessioneVeicoloAttiva(): Promise<VeicoloSessione | null> {
  const { data, error } = await supabase
    .from("autisti_veicolo_sessioni" as any)
    .select(
      "id, veicolo_id, aperta_at, km_inizio, km_fine, veicolo:veicoli(id, targa, marca, modello, km_attuale, photo_url, telepass, viacard, autorizzazione_numero, autorizzazione_comune)"
    )
    .is("chiusa_at", null)
    .order("aperta_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as VeicoloSessione;
}

export type VeicoloOccupato = { veicolo_id: string; autista_id: string; autista_nome: string; aperta_at: string };

export async function getVeicoliOccupati(): Promise<VeicoloOccupato[]> {
  const { data, error } = await supabase.rpc("veicoli_occupati" as any);
  if (error || !data) return [];
  return data as unknown as VeicoloOccupato[];
}

export async function apriSessioneVeicolo(veicoloId: string, kmInizio?: number | null) {
  const { error } = await supabase.rpc("autista_apri_sessione_veicolo" as any, {
    _veicolo_id: veicoloId,
    _km_inizio: kmInizio ?? null,
  });
  if (error) throw error;
}

export async function chiudiSessioneVeicolo(kmFine?: number | null) {
  const { error } = await supabase.rpc("autista_chiudi_sessione_veicolo" as any, { _km_fine: kmFine ?? null });
  if (error) throw error;
}

export const labelVeicolo = (v: VeicoloSessione["veicolo"]) =>
  v ? `${v.targa}${[v.marca, v.modello].filter(Boolean).length ? " — " + [v.marca, v.modello].filter(Boolean).join(" ") : ""}` : "";
