CREATE TYPE public.magazzino_tipo_confezione AS ENUM ('singolo','scatola','set','fusto');

ALTER TABLE public.articoli
  ADD COLUMN tipo_confezione public.magazzino_tipo_confezione NOT NULL DEFAULT 'singolo',
  ADD COLUMN pezzi_per_confezione integer NOT NULL DEFAULT 1;
ALTER TABLE public.articoli ADD CONSTRAINT articoli_pezzi_positivi CHECK (pezzi_per_confezione > 0);

ALTER TABLE public.ordini_righe
  ADD COLUMN tipo_confezione public.magazzino_tipo_confezione NOT NULL DEFAULT 'singolo',
  ADD COLUMN pezzi_per_confezione integer NOT NULL DEFAULT 1;

ALTER TABLE public.movimenti_magazzino
  ADD COLUMN confezioni numeric,
  ADD COLUMN pezzi_per_confezione integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.magazzino_ricevi_ordine(_ordine_id uuid)
 RETURNS ordini
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ord public.ordini;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  SELECT * INTO v_ord FROM public.ordini WHERE id = _ordine_id;
  IF v_ord.id IS NULL OR v_ord.org_id <> public.get_user_org_id(auth.uid()) THEN RAISE EXCEPTION 'Ordine non trovato'; END IF;
  IF v_ord.stato <> 'convalidato' THEN RAISE EXCEPTION 'Solo gli ordini convalidati possono essere ricevuti'; END IF;

  INSERT INTO public.movimenti_magazzino (org_id, articolo_id, tipo, quantita, confezioni, pezzi_per_confezione, data, ordine_riga_id, veicolo_id, consumo_interno, motivo, note, created_by)
  SELECT r.org_id, r.articolo_id, 'carico', r.quantita * GREATEST(r.pezzi_per_confezione, 1), r.quantita, GREATEST(r.pezzi_per_confezione, 1), CURRENT_DATE, r.id, r.veicolo_id,
         r.tipo_consumo = 'consumo_interno', 'ordine', r.note, auth.uid()
  FROM public.ordini_righe r
  WHERE r.ordine_id = _ordine_id
  ON CONFLICT DO NOTHING;

  UPDATE public.ordini SET stato = 'ricevuto', ricevuto_at = now() WHERE id = _ordine_id RETURNING * INTO v_ord;
  RETURN v_ord;
END $function$;