
ALTER TABLE public.veicoli_gasolio
  ADD COLUMN IF NOT EXISTS distributore text,
  ADD COLUMN IF NOT EXISTS tipo_carburante text,
  ADD COLUMN IF NOT EXISTS foto_path text,
  ADD COLUMN IF NOT EXISTS consumo_calcolato numeric,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS raw_ocr jsonb,
  ADD COLUMN IF NOT EXISTS registrato_da uuid,
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'manuale';

-- autisti: vedono i veicoli della propria org
DROP POLICY IF EXISTS "Autisti view veicoli org" ON public.veicoli;
CREATE POLICY "Autisti view veicoli org" ON public.veicoli
FOR SELECT TO authenticated
USING (org_id = public.get_autista_org_id(auth.uid()));

-- autisti: vedono i rifornimenti che hanno registrato
DROP POLICY IF EXISTS "Autisti view own gasolio" ON public.veicoli_gasolio;
CREATE POLICY "Autisti view own gasolio" ON public.veicoli_gasolio
FOR SELECT TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.autista_registra_rifornimento(
  _veicolo_id uuid,
  _data date,
  _km integer,
  _litri numeric,
  _prezzo_unitario numeric,
  _prezzo_totale numeric,
  _distributore text,
  _tipo_carburante text,
  _foto_path text,
  _confidence numeric,
  _raw_ocr jsonb
) RETURNS public.veicoli_gasolio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _autista_id uuid;
  _nome text;
  _km_prec integer;
  _consumo numeric;
  _row public.veicoli_gasolio;
BEGIN
  SELECT a.id, a.org_id, trim(coalesce(a.nome,'') || ' ' || coalesce(a.cognome,''))
    INTO _autista_id, _org, _nome
  FROM public.autisti a
  WHERE a.auth_user_id = auth.uid() AND a.attivo = true;

  IF _autista_id IS NULL THEN
    RAISE EXCEPTION 'Accesso riservato agli autisti attivi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.veicoli v WHERE v.id = _veicolo_id AND v.org_id = _org) THEN
    RAISE EXCEPTION 'Veicolo non valido per la tua azienda';
  END IF;

  IF _km IS NULL OR _km < 0 OR _km > 999999 THEN
    RAISE EXCEPTION 'Km non validi';
  END IF;

  SELECT g.km INTO _km_prec
  FROM public.veicoli_gasolio g
  WHERE g.veicolo_id = _veicolo_id AND g.km IS NOT NULL AND g.km < _km
  ORDER BY g.km DESC LIMIT 1;

  IF _km_prec IS NOT NULL AND _litri IS NOT NULL AND _litri > 0 THEN
    _consumo := round(((_km - _km_prec)::numeric / _litri), 2);
  END IF;

  INSERT INTO public.veicoli_gasolio (
    org_id, veicolo_id, data, autista_id, autista_nome, km, quantita,
    prezzo_unitario, prezzo_totale, luogo, distributore, tipo_carburante,
    foto_path, consumo_calcolato, confidence, raw_ocr, registrato_da, origine
  ) VALUES (
    _org, _veicolo_id, coalesce(_data, current_date), _autista_id, _nome, _km, _litri,
    _prezzo_unitario, coalesce(_prezzo_totale, 0), _distributore, _distributore, _tipo_carburante,
    _foto_path, _consumo, _confidence, _raw_ocr, auth.uid(), 'scanner'
  ) RETURNING * INTO _row;

  UPDATE public.veicoli SET km_attuale = _km, updated_at = now()
  WHERE id = _veicolo_id AND (km_attuale IS NULL OR km_attuale < _km);

  INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio, autista_id)
  VALUES (_org, 'rifornimento',
          'Nuovo rifornimento registrato da ' || coalesce(_nome, 'autista'),
          coalesce(_distributore, 'Rifornimento') || ' — ' ||
          coalesce(_litri::text, '?') || ' L, ' || coalesce(_prezzo_totale::text, '?') || ' €, km ' || _km,
          _autista_id);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.autista_registra_rifornimento(uuid,date,integer,numeric,numeric,numeric,text,text,text,numeric,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.autista_registra_rifornimento(uuid,date,integer,numeric,numeric,numeric,text,text,text,numeric,jsonb) TO authenticated;
