
-- 1) Enum confezione: aggiungo "latta"
ALTER TYPE public.magazzino_tipo_confezione ADD VALUE IF NOT EXISTS 'latta';

-- 2) Articoli: unita_base, categorie, mostra_in_ordini, rinomina quantita per confezione
ALTER TABLE public.articoli RENAME COLUMN pezzi_per_confezione TO quantita_per_confezione;

ALTER TABLE public.articoli
  ADD COLUMN IF NOT EXISTS unita_base text NOT NULL DEFAULT 'pezzo',
  ADD COLUMN IF NOT EXISTS categorie text[] NOT NULL DEFAULT ARRAY['ordinaria','straordinaria','uso_interno']::text[],
  ADD COLUMN IF NOT EXISTS mostra_in_ordini boolean NOT NULL DEFAULT true;

ALTER TABLE public.articoli
  ADD CONSTRAINT articoli_unita_base_chk CHECK (unita_base IN ('pezzo','litro'));

ALTER TABLE public.articoli
  ADD CONSTRAINT articoli_categorie_chk
  CHECK (categorie <@ ARRAY['ordinaria','straordinaria','uso_interno']::text[] AND array_length(categorie,1) >= 1);

UPDATE public.articoli SET unita_base = CASE WHEN unita_misura IN ('litri','l') THEN 'litro' ELSE 'pezzo' END;

-- 3) Manutenzione straordinaria: stesso modello dell'ordinaria
ALTER TABLE public.veicoli_manutenzione_straord
  ADD COLUMN IF NOT EXISTS intervento_tipo text NOT NULL DEFAULT 'esterno',
  ADD COLUMN IF NOT EXISTS operaio_id uuid REFERENCES public.operai(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ora_inizio time,
  ADD COLUMN IF NOT EXISTS ora_fine time,
  ADD COLUMN IF NOT EXISTS costo_materiale numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_manodopera numeric NOT NULL DEFAULT 0;

ALTER TABLE public.veicoli_manutenzione_straord
  ADD CONSTRAINT man_straord_intervento_tipo_chk CHECK (intervento_tipo IN ('interno','esterno'));

ALTER TABLE public.movimenti_magazzino
  ADD COLUMN IF NOT EXISTS manutenzione_straord_id uuid REFERENCES public.veicoli_manutenzione_straord(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mov_manutenzione_straord ON public.movimenti_magazzino(manutenzione_straord_id);

-- 4) Notifiche tagliando/manutenzione con modello e targa
CREATE OR REPLACE FUNCTION public.veicolo_valuta_tagliando(_veicolo_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v public.veicoli%ROWTYPE;
  v_diff integer;
  v_nuovo text;
  v_label text;
BEGIN
  SELECT * INTO v FROM public.veicoli WHERE id = _veicolo_id;
  IF v.id IS NULL THEN RETURN NULL; END IF;

  v_label := trim(both ' ' FROM COALESCE(v.modello, v.tipo_macchina, v.marca, '') || ' ' || COALESCE(v.targa,''));

  IF v.km_prima_scadenza IS NULL OR v.km_attuale IS NULL OR v.attivo = false THEN
    v_nuovo := 'ok';
  ELSE
    v_diff := v.km_prima_scadenza - v.km_attuale;
    v_nuovo := CASE
      WHEN v_diff <= 0 THEN 'scaduto'
      WHEN v_diff <= 5000 THEN 'avviso'
      ELSE 'ok'
    END;
  END IF;

  IF v_nuovo IS DISTINCT FROM COALESCE(v.tagliando_alert_stato,'ok') THEN
    UPDATE public.veicoli
       SET tagliando_alert_stato = v_nuovo,
           tagliando_alert_at = now()
     WHERE id = _veicolo_id;

    IF v_nuovo = 'avviso' THEN
      INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
      VALUES (v.org_id, 'tagliando_avviso',
        'Manutenzione ordinaria in avvicinamento — ' || v_label,
        'Mancano ' || v_diff || ' km alla manutenzione ordinaria (soglia ' ||
        v.km_prima_scadenza || ' km, attuali ' || v.km_attuale || ' km).');
    ELSIF v_nuovo = 'scaduto' THEN
      INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
      VALUES (v.org_id, 'tagliando_scaduto',
        'Manutenzione ordinaria da eseguire — ' || v_label,
        'Soglia superata di ' || abs(v_diff) || ' km (soglia ' ||
        v.km_prima_scadenza || ' km, attuali ' || v.km_attuale || ' km).');
    END IF;
  END IF;

  RETURN v_nuovo;
END $function$;

-- 5) Manutenzione ordinaria: sposta la soglia in avanti dell'intervallo
CREATE OR REPLACE FUNCTION public.manutenzione_ord_salva(
  _id uuid,
  _veicolo_id uuid,
  _data date,
  _km integer,
  _intervento_tipo text,
  _tipo text,
  _note text,
  _ricambi text,
  _fornitore text,
  _operaio_id uuid,
  _ora_inizio time,
  _ora_fine time,
  _righe jsonb DEFAULT '[]'::jsonb,
  _totale_esterno numeric DEFAULT NULL,
  _forza boolean DEFAULT false
) RETURNS public.veicoli_manutenzione_ord
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_man public.veicoli_manutenzione_ord;
  r jsonb;
  v_art uuid;
  v_qta numeric;
  v_prezzo numeric;
  v_giac numeric;
  v_materiale numeric := 0;
  v_manodopera numeric := 0;
  v_ore numeric := 0;
  v_costo_orario numeric;
  v_ppc integer;
  v_int integer;
  v_kmv integer;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN
    RAISE EXCEPTION 'Permesso negato: sola lettura';
  END IF;
  v_org := public.get_user_org_id(auth.uid());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organizzazione non trovata'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.veicoli WHERE id = _veicolo_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'Veicolo non trovato';
  END IF;
  IF _intervento_tipo IS NULL OR _intervento_tipo NOT IN ('interno','esterno') THEN
    RAISE EXCEPTION 'Tipo intervento non valido';
  END IF;
  IF _operaio_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.operai WHERE id = _operaio_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'Operaio non trovato';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.veicoli_manutenzione_ord
      (org_id, veicolo_id, data, km, tipo, note, ricambi, fornitore,
       intervento_tipo, operaio_id, ora_inizio, ora_fine, totale)
    VALUES (v_org, _veicolo_id, COALESCE(_data, CURRENT_DATE), _km, _tipo, _note, _ricambi, _fornitore,
       _intervento_tipo, _operaio_id, _ora_inizio, _ora_fine, 0)
    RETURNING * INTO v_man;
  ELSE
    UPDATE public.veicoli_manutenzione_ord SET
      veicolo_id = _veicolo_id,
      data = COALESCE(_data, CURRENT_DATE),
      km = _km,
      tipo = _tipo,
      note = _note,
      ricambi = _ricambi,
      fornitore = _fornitore,
      intervento_tipo = _intervento_tipo,
      operaio_id = _operaio_id,
      ora_inizio = _ora_inizio,
      ora_fine = _ora_fine
    WHERE id = _id AND org_id = v_org
    RETURNING * INTO v_man;
    IF v_man.id IS NULL THEN RAISE EXCEPTION 'Manutenzione non trovata'; END IF;
  END IF;

  DELETE FROM public.movimenti_magazzino WHERE manutenzione_ord_id = v_man.id;

  IF _intervento_tipo = 'interno' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(_righe, '[]'::jsonb))
    LOOP
      v_art := NULLIF(r->>'articolo_id','')::uuid;
      v_qta := COALESCE((r->>'quantita')::numeric, 0);
      v_prezzo := NULLIF(r->>'prezzo_unitario','')::numeric;
      CONTINUE WHEN v_art IS NULL OR v_qta <= 0;

      SELECT quantita_per_confezione, COALESCE(v_prezzo, prezzo_unitario)
        INTO v_ppc, v_prezzo
      FROM public.articoli WHERE id = v_art AND org_id = v_org;
      IF v_ppc IS NULL THEN RAISE EXCEPTION 'Articolo non trovato'; END IF;

      SELECT COALESCE(SUM(CASE WHEN tipo = 'carico' THEN quantita ELSE -quantita END), 0)
        INTO v_giac
      FROM public.movimenti_magazzino WHERE articolo_id = v_art;

      IF v_qta > v_giac AND NOT COALESCE(_forza, false) THEN
        RAISE EXCEPTION 'Giacenza insufficiente (disponibili %)', v_giac;
      END IF;

      INSERT INTO public.movimenti_magazzino
        (org_id, articolo_id, tipo, quantita, data, veicolo_id, consumo_interno,
         note, anomalia, created_by, manutenzione_ord_id, prezzo_unitario,
         confezioni, pezzi_per_confezione)
      VALUES (v_org, v_art, 'scarico', v_qta, v_man.data, _veicolo_id, false,
         'Manutenzione ordinaria', v_qta > v_giac, auth.uid(), v_man.id, v_prezzo,
         CASE WHEN v_ppc > 0 THEN v_qta / v_ppc ELSE NULL END, GREATEST(v_ppc, 1));

      v_materiale := v_materiale + v_qta * COALESCE(v_prezzo, 0);
    END LOOP;

    IF _ora_inizio IS NOT NULL AND _ora_fine IS NOT NULL THEN
      v_ore := EXTRACT(EPOCH FROM (_ora_fine - _ora_inizio)) / 3600.0;
      IF v_ore < 0 THEN v_ore := v_ore + 24; END IF;
    END IF;
    SELECT costo_orario INTO v_costo_orario FROM public.operai WHERE id = _operaio_id;
    v_manodopera := ROUND(COALESCE(v_costo_orario, 0) * v_ore, 2);
  END IF;

  UPDATE public.veicoli_manutenzione_ord SET
    costo_materiale = ROUND(v_materiale, 2),
    costo_manodopera = v_manodopera,
    totale = CASE WHEN _intervento_tipo = 'interno'
                  THEN ROUND(v_materiale, 2) + v_manodopera
                  ELSE COALESCE(_totale_esterno, 0) END
  WHERE id = v_man.id
  RETURNING * INTO v_man;

  -- aggiorna km veicolo e sposta la soglia manutenzione in avanti
  IF _km IS NOT NULL THEN
    UPDATE public.veicoli
       SET km_attuale = GREATEST(COALESCE(km_attuale, 0), _km)
     WHERE id = _veicolo_id AND org_id = v_org;
  END IF;

  SELECT GREATEST(COALESCE(intervallo_tagliando_km, 20000), 1), COALESCE(_km, km_attuale)
    INTO v_int, v_kmv
  FROM public.veicoli WHERE id = _veicolo_id;

  IF v_kmv IS NOT NULL THEN
    UPDATE public.veicoli
       SET km_prima_scadenza = v_kmv + v_int,
           tagliando_ultimo_km = v_kmv,
           tagliando_ultimo_at = v_man.data,
           tagliando_alert_stato = 'ok',
           updated_at = now()
     WHERE id = _veicolo_id AND org_id = v_org;
  END IF;

  PERFORM public.veicolo_valuta_tagliando(_veicolo_id);

  RETURN v_man;
END $$;

GRANT EXECUTE ON FUNCTION public.manutenzione_ord_salva(uuid, uuid, date, integer, text, text, text, text, text, uuid, time, time, jsonb, numeric, boolean) TO authenticated;

-- 6) Salvataggio manutenzione straordinaria con scarico magazzino
CREATE OR REPLACE FUNCTION public.manutenzione_straord_salva(
  _id uuid,
  _veicolo_id uuid,
  _data date,
  _km integer,
  _intervento_tipo text,
  _tipo text,
  _tipo_riparazione text,
  _note text,
  _ricambi text,
  _fornitore text,
  _ordine text,
  _operaio_id uuid,
  _ora_inizio time,
  _ora_fine time,
  _righe jsonb DEFAULT '[]'::jsonb,
  _totale_esterno numeric DEFAULT NULL,
  _forza boolean DEFAULT false
) RETURNS public.veicoli_manutenzione_straord
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_man public.veicoli_manutenzione_straord;
  r jsonb;
  v_art uuid;
  v_qta numeric;
  v_prezzo numeric;
  v_giac numeric;
  v_materiale numeric := 0;
  v_manodopera numeric := 0;
  v_ore numeric := 0;
  v_costo_orario numeric;
  v_ppc integer;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN
    RAISE EXCEPTION 'Permesso negato: sola lettura';
  END IF;
  v_org := public.get_user_org_id(auth.uid());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organizzazione non trovata'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.veicoli WHERE id = _veicolo_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'Veicolo non trovato';
  END IF;
  IF _intervento_tipo IS NULL OR _intervento_tipo NOT IN ('interno','esterno') THEN
    RAISE EXCEPTION 'Tipo intervento non valido';
  END IF;
  IF _operaio_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.operai WHERE id = _operaio_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'Operaio non trovato';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.veicoli_manutenzione_straord
      (org_id, veicolo_id, data, km_attuale, tipo, tipo_riparazione, note, ricambi, fornitore, ordine,
       intervento_tipo, operaio_id, ora_inizio, ora_fine, totale)
    VALUES (v_org, _veicolo_id, COALESCE(_data, CURRENT_DATE), _km, _tipo, _tipo_riparazione, _note, _ricambi, _fornitore, _ordine,
       _intervento_tipo, _operaio_id, _ora_inizio, _ora_fine, 0)
    RETURNING * INTO v_man;
  ELSE
    UPDATE public.veicoli_manutenzione_straord SET
      veicolo_id = _veicolo_id,
      data = COALESCE(_data, CURRENT_DATE),
      km_attuale = _km,
      tipo = _tipo,
      tipo_riparazione = _tipo_riparazione,
      note = _note,
      ricambi = _ricambi,
      fornitore = _fornitore,
      ordine = _ordine,
      intervento_tipo = _intervento_tipo,
      operaio_id = _operaio_id,
      ora_inizio = _ora_inizio,
      ora_fine = _ora_fine
    WHERE id = _id AND org_id = v_org
    RETURNING * INTO v_man;
    IF v_man.id IS NULL THEN RAISE EXCEPTION 'Manutenzione non trovata'; END IF;
  END IF;

  DELETE FROM public.movimenti_magazzino WHERE manutenzione_straord_id = v_man.id;

  IF _intervento_tipo = 'interno' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(_righe, '[]'::jsonb))
    LOOP
      v_art := NULLIF(r->>'articolo_id','')::uuid;
      v_qta := COALESCE((r->>'quantita')::numeric, 0);
      v_prezzo := NULLIF(r->>'prezzo_unitario','')::numeric;
      CONTINUE WHEN v_art IS NULL OR v_qta <= 0;

      SELECT quantita_per_confezione, COALESCE(v_prezzo, prezzo_unitario)
        INTO v_ppc, v_prezzo
      FROM public.articoli WHERE id = v_art AND org_id = v_org;
      IF v_ppc IS NULL THEN RAISE EXCEPTION 'Articolo non trovato'; END IF;

      SELECT COALESCE(SUM(CASE WHEN tipo = 'carico' THEN quantita ELSE -quantita END), 0)
        INTO v_giac
      FROM public.movimenti_magazzino WHERE articolo_id = v_art;

      IF v_qta > v_giac AND NOT COALESCE(_forza, false) THEN
        RAISE EXCEPTION 'Giacenza insufficiente (disponibili %)', v_giac;
      END IF;

      INSERT INTO public.movimenti_magazzino
        (org_id, articolo_id, tipo, quantita, data, veicolo_id, consumo_interno,
         note, anomalia, created_by, manutenzione_straord_id, prezzo_unitario,
         confezioni, pezzi_per_confezione)
      VALUES (v_org, v_art, 'scarico', v_qta, v_man.data, _veicolo_id, false,
         'Manutenzione straordinaria', v_qta > v_giac, auth.uid(), v_man.id, v_prezzo,
         CASE WHEN v_ppc > 0 THEN v_qta / v_ppc ELSE NULL END, GREATEST(v_ppc, 1));

      v_materiale := v_materiale + v_qta * COALESCE(v_prezzo, 0);
    END LOOP;

    IF _ora_inizio IS NOT NULL AND _ora_fine IS NOT NULL THEN
      v_ore := EXTRACT(EPOCH FROM (_ora_fine - _ora_inizio)) / 3600.0;
      IF v_ore < 0 THEN v_ore := v_ore + 24; END IF;
    END IF;
    SELECT costo_orario INTO v_costo_orario FROM public.operai WHERE id = _operaio_id;
    v_manodopera := ROUND(COALESCE(v_costo_orario, 0) * v_ore, 2);
  END IF;

  UPDATE public.veicoli_manutenzione_straord SET
    costo_materiale = ROUND(v_materiale, 2),
    costo_manodopera = v_manodopera,
    totale = CASE WHEN _intervento_tipo = 'interno'
                  THEN ROUND(v_materiale, 2) + v_manodopera
                  ELSE COALESCE(_totale_esterno, 0) END
  WHERE id = v_man.id
  RETURNING * INTO v_man;

  IF _km IS NOT NULL THEN
    UPDATE public.veicoli
       SET km_attuale = GREATEST(COALESCE(km_attuale, 0), _km)
     WHERE id = _veicolo_id AND org_id = v_org;
    PERFORM public.veicolo_valuta_tagliando(_veicolo_id);
  END IF;

  RETURN v_man;
END $$;

GRANT EXECUTE ON FUNCTION public.manutenzione_straord_salva(uuid, uuid, date, integer, text, text, text, text, text, text, text, uuid, time, time, jsonb, numeric, boolean) TO authenticated;
