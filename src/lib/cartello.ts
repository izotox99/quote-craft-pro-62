import { supabase } from "@/integrations/supabase/client";

export const CARTELLO_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
export const CARTELLO_MAX_MB = 10;

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export function validateCartelloFile(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return "Formato non supportato (PNG, JPG, WEBP, PDF)";
  if (file.size > CARTELLO_MAX_MB * 1024 * 1024) return `File troppo grande (max ${CARTELLO_MAX_MB} MB)`;
  return null;
}

/** Carica il file cartello nel bucket privato, cartella dedicata org/servizio/cartello. */
export async function uploadCartelloFile(orgId: string, servizioId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${orgId}/${servizioId}/cartello/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("servizi-allegati")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeCartelloFile(path: string) {
  await supabase.storage.from("servizi-allegati").remove([path]);
}

export async function getCartelloUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("servizi-allegati")
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function openCartello(path: string) {
  const url = await getCartelloUrl(path, 300);
  if (url) window.open(url, "_blank");
  return url;
}
