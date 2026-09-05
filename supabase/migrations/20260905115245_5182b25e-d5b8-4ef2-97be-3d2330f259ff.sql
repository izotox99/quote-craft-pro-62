CREATE OR REPLACE FUNCTION public.magazzino_aggiorna_stato_ordine(_ordine_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tot int; v_pend int; v_conf int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE stato_ricezione = 'in_attesa'),
         count(*) FILTER (WHERE stato_ricezione = 'confermata')
    INTO v_tot, v_pend, v_conf
  FROM public.ordini_righe WHERE ordine_id = _ordine_id;

  IF v_tot = 0 THEN RETURN; END IF;

  IF v_pend = 0 THEN
    UPDATE public.ordini SET stato = 'ricevuto', ricevuto_at = COALESCE(ricevuto_at, now())
     WHERE id = _ordine_id AND stato NOT IN ('annullato','bozza');
  ELSIF v_tot > v_pend THEN
    UPDATE public.ordini SET stato = 'parzialmente_ricevuto'
     WHERE id = _ordine_id AND stato NOT IN ('annullato','bozza');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.magazzino_aggiorna_stato_ordine(uuid) FROM public, anon;

CREATE OR REPLACE FUNCTION public.magazzino_conferma_riga(
  _riga_id uuid, _quantita numeric, _prezzo_unitario numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; r public.ordini_righe; v_stato text; v_ppc int;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  v_org := public.get_user_org_id(auth.uid());
  SELECT * INTO r FROM public.ordini_righe WHERE id = _riga_id AND org_id = v_org;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Riga non trovata'; END IF;
  IF _quantita IS NULL OR _quantita <= 0 THEN RAISE EXCEPTION 'Quantità non valida'; END IF;

  SELECT stato::text INTO v_stato FROM public.ordini WHERE id = r.ordine_id;
  IF v_stato NOT IN ('convalidato','parzialmente_ricevuto') THEN
    RAISE EXCEPTION 'Solo gli ordini convalidati possono essere ricevuti';
  END IF;

  v_ppc := GREATEST(COALESCE(r.pezzi_per_confezione, 1), 1);

  UPDATE public.ordini_righe
     SET stato_ricezione = 'confermata',
         quantita_ricevuta = _quantita,
         prezzo_unitario = COALESCE(_prezzo_unitario, prezzo_unitario),
         ricevuta_at = now()
   WHERE id = _riga_id;

  DELETE FROM public.movimenti_magazzino WHERE ordine_riga_id = _riga_id;

  INSERT INTO public.movimenti_magazzino
    (org_id, articolo_id, tipo, quantita, confezioni, pezzi_per_confezione, data, ordine_riga_id,
     veicolo_id, consumo_interno, motivo, note, prezzo_unitario, created_by)
  VALUES (r.org_id, r.articolo_id, 'carico', _quantita * v_ppc, _quantita, v_ppc, CURRENT_DATE, r.id,
     CASE WHEN r.tipo_consumo = 'consumo_interno' THEN NULL ELSE r.veicolo_id END,
     r.tipo_consumo = 'consumo_interno', 'ordine', r.note, _prezzo_unitario, auth.uid());

  IF _prezzo_unitario IS NOT NULL THEN
    UPDATE public.articoli SET prezzo_unitario = _prezzo_unitario, updated_at = now()
     WHERE id = r.articolo_id AND org_id = v_org;

    INSERT INTO public.articoli_prezzi_storico
      (org_id, articolo_id, fornitore_id, ordine_riga_id, prezzo_unitario, quantita, data, created_by)
    VALUES (r.org_id, r.articolo_id, r.fornitore_id, r.id, _prezzo_unitario, _quantita, CURRENT_DATE, auth.uid());
  END IF;

  PERFORM public.magazzino_aggiorna_stato_ordine(r.ordine_id);
END $$;
REVOKE ALL ON FUNCTION public.magazzino_conferma_riga(uuid, numeric, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.magazzino_conferma_riga(uuid, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.magazzino_rimuovi_riga(_riga_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_ordine uuid;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  v_org := public.get_user_org_id(auth.uid());
  SELECT ordine_id INTO v_ordine FROM public.ordini_righe WHERE id = _riga_id AND org_id = v_org;
  IF v_ordine IS NULL THEN RAISE EXCEPTION 'Riga non trovata'; END IF;

  DELETE FROM public.movimenti_magazzino WHERE ordine_riga_id = _riga_id;
  UPDATE public.ordini_righe
     SET stato_ricezione = 'rimossa', quantita_ricevuta = 0, ricevuta_at = now()
   WHERE id = _riga_id;

  PERFORM public.magazzino_aggiorna_stato_ordine(v_ordine);
END $$;
REVOKE ALL ON FUNCTION public.magazzino_rimuovi_riga(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.magazzino_rimuovi_riga(uuid) TO authenticated;

-- ricezione totale: marca tutte le righe in attesa come confermate
CREATE OR REPLACE FUNCTION public.magazzino_ricevi_ordine(_ordine_id uuid)
RETURNS ordini LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ord public.ordini; r public.ordini_righe;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
  SELECT * INTO v_ord FROM public.ordini WHERE id = _ordine_id;
  IF v_ord.id IS NULL OR v_ord.org_id <> public.get_user_org_id(auth.uid()) THEN RAISE EXCEPTION 'Ordine non trovato'; END IF;
  IF v_ord.stato::text NOT IN ('convalidato','parzialmente_ricevuto') THEN
    RAISE EXCEPTION 'Solo gli ordini convalidati possono essere ricevuti';
  END IF;

  FOR r IN SELECT * FROM public.ordini_righe WHERE ordine_id = _ordine_id AND stato_ricezione = 'in_attesa'
  LOOP
    PERFORM public.magazzino_conferma_riga(r.id, r.quantita, r.prezzo_unitario);
  END LOOP;

  SELECT * INTO v_ord FROM public.ordini WHERE id = _ordine_id;
  RETURN v_ord;
END $$;

-- manutenzione straordinaria: km manutenzione + fornitore anagrafica
CREATE OR REPLACE FUNCTION public.manutenzione_straord_salva(
  _id uuid, _veicolo_id uuid, _data date, _km integer, _intervento_tipo text, _tipo text,
  _tipo_riparazione text, _note text, _ricambi text, _fornitore text, _ordine text,
  _operaio_id uuid, _ora_inizio time without time zone, _ora_fine time without time zone,
  _righe jsonb DEFAULT '[]'::jsonb, _totale_esterno numeric DEFAULT NULL::numeric,
  _forza boolean DEFAULT false, _km_manutenzione integer DEFAULT NULL, _fornitore_id uuid DEFAULT NULL)
RETURNS veicoli_manutenzione_straord LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_man public.veicoli_manutenzione_straord; r jsonb;
  v_art uuid; v_qta numeric; v_prezzo numeric; v_giac numeric;
  v_materiale numeric := 0; v_manodopera numeric := 0; v_ore numeric := 0;
  v_costo_orario numeric; v_ppc integer; v_forn_nome text;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Permesso negato: sola lettura'; END IF;
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
  IF _fornitore_id IS NOT NULL THEN
    SELECT nome INTO v_forn_nome FROM public.fornitori_magazzino WHERE id = _fornitore_id AND org_id = v_org;
    IF v_forn_nome IS NULL THEN RAISE EXCEPTION 'Fornitore non trovato'; END IF;
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.veicoli_manutenzione_straord
      (org_id, veicolo_id, data, km_attuale, km_manutenzione, tipo, tipo_riparazione, note, ricambi,
       fornitore, fornitore_id, ordine, intervento_tipo, operaio_id, ora_inizio, ora_fine, totale)
    VALUES (v_org, _veicolo_id, COALESCE(_data, CURRENT_DATE), _km, _km_manutenzione, _tipo, _tipo_riparazione,
       _note, _ricambi, COALESCE(v_forn_nome, _fornitore), _fornitore_id, _ordine,
       _intervento_tipo, _operaio_id, _ora_inizio, _ora_fine, 0)
    RETURNING * INTO v_man;
  ELSE
    UPDATE public.veicoli_manutenzione_straord SET
      veicolo_id = _veicolo_id, data = COALESCE(_data, CURRENT_DATE), km_attuale = _km,
      km_manutenzione = _km_manutenzione, tipo = _tipo, tipo_riparazione = _tipo_riparazione,
      note = _note, ricambi = _ricambi, fornitore = COALESCE(v_forn_nome, _fornitore),
      fornitore_id = _fornitore_id, ordine = _ordine, intervento_tipo = _intervento_tipo,
      operaio_id = _operaio_id, ora_inizio = _ora_inizio, ora_fine = _ora_fine
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

      SELECT quantita_per_confezione, COALESCE(v_prezzo, prezzo_unitario) INTO v_ppc, v_prezzo
      FROM public.articoli WHERE id = v_art AND org_id = v_org;
      IF v_ppc IS NULL THEN RAISE EXCEPTION 'Articolo non trovato'; END IF;

      SELECT COALESCE(SUM(CASE WHEN tipo = 'carico' THEN quantita ELSE -quantita END), 0) INTO v_giac
      FROM public.movimenti_magazzino WHERE articolo_id = v_art;

      IF v_qta > v_giac AND NOT COALESCE(_forza, false) THEN
        RAISE EXCEPTION 'Giacenza insufficiente (disponibili %)', v_giac;
      END IF;

      INSERT INTO public.movimenti_magazzino
        (org_id, articolo_id, tipo, quantita, data, veicolo_id, consumo_interno, note, anomalia,
         created_by, manutenzione_straord_id, prezzo_unitario, confezioni, pezzi_per_confezione)
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
    totale = CASE WHEN _intervento_tipo = 'interno' THEN ROUND(v_materiale, 2) + v_manodopera
                  ELSE COALESCE(_totale_esterno, 0) END
  WHERE id = v_man.id
  RETURNING * INTO v_man;

  IF _km IS NOT NULL THEN
    UPDATE public.veicoli SET km_attuale = GREATEST(COALESCE(km_attuale, 0), _km)
     WHERE id = _veicolo_id AND org_id = v_org;
    PERFORM public.veicolo_valuta_tagliando(_veicolo_id);
  END IF;

  RETURN v_man;
END $function$;
REVOKE ALL ON FUNCTION public.manutenzione_straord_salva(uuid,uuid,date,integer,text,text,text,text,text,text,text,uuid,time,time,jsonb,numeric,boolean,integer,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manutenzione_straord_salva(uuid,uuid,date,integer,text,text,text,text,text,text,text,uuid,time,time,jsonb,numeric,boolean,integer,uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.manutenzione_straord_salva(uuid,uuid,date,integer,text,text,text,text,text,text,text,uuid,time,time,jsonb,numeric,boolean);
