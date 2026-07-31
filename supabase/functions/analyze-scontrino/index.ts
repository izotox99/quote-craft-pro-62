import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SYSTEM_PROMPT = `Sei un assistente OCR specializzato nella lettura di scontrini di rifornimento carburante italiani.
Rispondi SOLO con un JSON valido, senza code fence, senza testo aggiuntivo.
Campi richiesti:
{
  "data": "GG/MM/AAAA" | null,
  "prezzo_litro": number | null,
  "litri": number | null,
  "totale": number | null,
  "km": number | null,
  "tipo_carburante": "diesel" | "benzina" | "gpl" | "metano" | null,
  "distributore": string | null,
  "confidence": number
}
Regole:
- I numeri devono usare il punto come separatore decimale.
- I campi non leggibili devono essere null. Non inventare mai valori.
- confidence è un numero tra 0 e 1 che indica quanto sei sicuro della lettura complessiva.
- Se l'immagine non è uno scontrino di carburante, restituisci tutti i campi null e confidence 0.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'OPENAI_API_KEY non configurata' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Non autorizzato' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: 'Non autorizzato' }, 401);
    const userId = claimsData.claims.sub as string;

    const { data: autista } = await supabase
      .from('autisti')
      .select('id, org_id, attivo')
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (!autista || autista.attivo === false) {
      return json({ error: 'Accesso riservato agli autisti attivi' }, 403);
    }

    const body = await req.json().catch(() => null);
    const imageDataUrl: unknown = body?.imageDataUrl;
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return json({ error: 'Immagine non valida' }, 400);
    }
    if (imageDataUrl.length > 8_000_000) {
      return json({ error: 'Immagine troppo grande' }, 400);
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        max_tokens: 500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Estrai i dati da questo scontrino di carburante.' },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`OpenAI error [${res.status}]: ${details}`);
      return json({ error: 'Analisi non riuscita', status: res.status, details }, 502);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? null;
    return json({ content });
  } catch (e) {
    console.error('analyze-scontrino error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
