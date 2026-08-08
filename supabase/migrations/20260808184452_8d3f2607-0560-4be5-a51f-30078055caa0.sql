CREATE OR REPLACE FUNCTION public.autista_update_servizio(_servizio_id uuid, _action text, _km integer DEFAULT NULL::integer, _ora_fine timestamp with time zone DEFAULT NULL::timestamp with time zone, _nota text DEFAULT NULL::text, _veicolo_id uuid DEFAULT NULL::uuid)
 RETURNS servizi
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_autista_id uuid;
  v_org_id uuid;
  v_srv public.servizi%ROWTYPE;
  v_has_transfer boolean;
  v_has_dispo boolean;
  v_transfer_done boolean;
  v_dispo_done boolean;
  v_all_done boolean;
  v_veicolo uuid;
  v_busy text;
  v_sess uuid;
BEGIN
  v_autista_id := public.get_autista_id(v_uid);
  v_org_id := public.get_autista_org_id(v_uid);
  IF v_autista_id IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_srv FROM public.servizi WHERE id = _servizio_id;
  IF v_srv.id IS NULL THEN
    RAISE EXCEPTION 'Servizio non trovato' USING ERRCODE='22023';
  END IF;
  IF v_srv.autista_id <> v_autista_id OR v_srv.org_id <> v_org_id THEN
    RAISE EXCEPTION 'Servizio non assegnato a te' USING ERRCODE='42501';
  END IF;
  IF v_srv.stato = 'annullato' THEN
    RAISE EXCEPTION 'Servizio annullato' USING ERRCODE='22023';
  END IF;

  v_has_transfer := (v_srv.tipologia::text = 'transfer' OR v_srv.transfer_tipo IS NOT NULL);
  v_has_dispo := (v_srv.tipologia::text = 'disposizione' OR NULLIF(v_srv.disposizione_oraria,'') IS NOT NULL);
  IF NOT v_has_transfer AND NOT v_has_dispo THEN
    v_has_transfer := true;
  END IF;

  IF _action = 'start' THEN
    IF v_srv.stato_autista <> 'da_effettuare' THEN
      RAISE EXCEPTION 'Servizio già iniziato' USING ERRCODE='22023';
    END IF;

    v_veicolo := COALESCE(v_srv.veicolo_id, _veicolo_id);
    IF v_veicolo IS NULL THEN
      RAISE EXCEPTION 'Indica il mezzo con cui svolgi il servizio' USING ERRCODE='22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.veicoli v WHERE v.id = v_veicolo AND v.org_id = v_org_id AND v.attivo) THEN
      RAISE EXCEPTION 'Veicolo non valido o non attivo' USING ERRCODE='22023';
    END IF;

    SELECT trim(coalesce(a.nome,'') || ' ' || coalesce(a.cognome,'')) INTO v_busy
    FROM public.autisti_veicolo_sessioni s
    JOIN public.autisti a ON a.id = s.autista_id
    WHERE s.veicolo_id = v_veicolo AND s.chiusa_at IS NULL AND s.autista_id <> v_autista_id
    LIMIT 1;
    IF v_busy IS NOT NULL THEN
      RAISE EXCEPTION 'Veicolo già in uso da %', v_busy USING ERRCODE='22023';
    END IF;

    UPDATE public.servizi SET
      veicolo_id = v_veicolo,
      stato_autista = 'in_corso',
      stato = CASE WHEN stato IN ('completato','annullato') THEN stato ELSE 'in_corso' END,
      km_inizio_servizio = COALESCE(_km, km_inizio_servizio)
    WHERE id = _servizio_id
    RETURNING * INTO v_srv;

    -- sessione veicolo dell'autista
    SELECT s.id INTO v_sess
    FROM public.autisti_veicolo_sessioni s
    WHERE s.autista_id = v_autista_id AND s.chiusa_at IS NULL AND s.veicolo_id = v_veicolo
    LIMIT 1;

    IF v_sess IS NULL THEN
      UPDATE public.autisti_veicolo_sessioni SET chiusa_at = now()
        WHERE autista_id = v_autista_id AND chiusa_at IS NULL;
      INSERT INTO public.autisti_veicolo_sessioni (org_id, autista_id, veicolo_id, km_inizio)
        VALUES (v_org_id, v_autista_id, v_veicolo, _km);
    END IF;

    IF _km IS NOT NULL THEN
      UPDATE public.veicoli SET km_attuale = _km
        WHERE id = v_veicolo AND (km_attuale IS NULL OR _km > km_attuale);
    END IF;

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_srv.org_id, 'autista_inizio_servizio',
      'Servizio iniziato',
      'L''autista ha iniziato il servizio del ' || to_char(v_srv.data_servizio,'DD/MM/YYYY') ||
        COALESCE(' km ' || _km::text, ''),
      v_srv.id);

  ELSIF _action IN ('close_transfer','close_dispo') THEN
    IF v_srv.stato_autista = 'concluso' THEN
      RAISE EXCEPTION 'Servizio già concluso' USING ERRCODE='22023';
    END IF;

    IF _action = 'close_transfer' THEN
      IF NOT v_has_transfer THEN
        RAISE EXCEPTION 'Servizio senza componente transfer' USING ERRCODE='22023';
      END IF;
      UPDATE public.servizi SET
        transfer_concluso_at = COALESCE(_ora_fine, now()),
        transfer_nota_chiusura = _nota,
        km_fine_servizio = COALESCE(_km, km_fine_servizio)
      WHERE id = _servizio_id
      RETURNING * INTO v_srv;
    ELSE
      IF NOT v_has_dispo THEN
        RAISE EXCEPTION 'Servizio senza componente disposizione' USING ERRCODE='22023';
      END IF;
      UPDATE public.servizi SET
        dispo_conclusa_at = COALESCE(_ora_fine, now()),
        dispo_nota_chiusura = _nota,
        km_fine_servizio = COALESCE(_km, km_fine_servizio)
      WHERE id = _servizio_id
      RETURNING * INTO v_srv;
    END IF;

    v_transfer_done := (NOT v_has_transfer) OR v_srv.transfer_concluso_at IS NOT NULL;
    v_dispo_done := (NOT v_has_dispo) OR v_srv.dispo_conclusa_at IS NOT NULL;
    v_all_done := v_transfer_done AND v_dispo_done;

    IF v_all_done THEN
      UPDATE public.servizi SET
        stato_autista = 'concluso',
        stato = 'completato'
      WHERE id = _servizio_id
      RETURNING * INTO v_srv;

      IF v_srv.veicolo_id IS NOT NULL AND v_srv.km_fine_servizio IS NOT NULL THEN
        UPDATE public.veicoli
        SET km_attuale = v_srv.km_fine_servizio
        WHERE id = v_srv.veicolo_id
          AND (km_attuale IS NULL OR km_attuale < v_srv.km_fine_servizio);
      END IF;

      INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
      VALUES (v_srv.org_id, 'autista_fine_servizio',
        'Servizio concluso',
        'Servizio del ' || to_char(v_srv.data_servizio,'DD/MM/YYYY') || ' concluso' ||
          COALESCE(' — km fine ' || v_srv.km_fine_servizio::text, ''),
        v_srv.id);
    END IF;
  ELSE
    RAISE EXCEPTION 'Azione non valida' USING ERRCODE='22023';
  END IF;

  RETURN v_srv;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.autista_update_servizio(uuid, text, integer, timestamp with time zone, text, uuid) TO authenticated;