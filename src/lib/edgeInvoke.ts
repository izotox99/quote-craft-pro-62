import { supabase } from "@/integrations/supabase/client";

export type EdgeError = { message: string; code?: string; status?: number };

/**
 * Invoca una edge function restituendo SEMPRE il messaggio strutturato
 * ({ error, code }) prodotto dalla funzione, invece del generico
 * "Edge Function returned a non-2xx status code".
 */
export async function invokeEdge<T = any>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message || "Errore imprevisto";
    let code: string | undefined;
    let status: number | undefined;

    const ctx = (error as unknown as { context?: Response })?.context;
    if (ctx) {
      status = ctx.status;
      try {
        const raw = await ctx.text();
        const parsed = JSON.parse(raw);
        if (parsed?.error) message = parsed.error;
        if (parsed?.code) code = parsed.code;
      } catch {
        /* corpo non leggibile: si tiene il messaggio originale */
      }
    }

    if ((data as any)?.error) message = (data as any).error;

    const err = new Error(message) as Error & EdgeError;
    err.code = code;
    err.status = status;
    throw err;
  }

  if ((data as any)?.error) {
    const err = new Error((data as any).error) as Error & EdgeError;
    err.code = (data as any).code;
    throw err;
  }

  return data as T;
}
