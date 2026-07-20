
-- 1. Config: sostituisci min_autisti_disponibili_giorno con mezzi_totali + mezzi_richiesti_giorno
ALTER TABLE public.config_assenze
  ADD COLUMN IF NOT EXISTS mezzi_totali int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mezzi_richiesti_giorno int NOT NULL DEFAULT 1;

-- Seed: prova a stimare dai driver attivi
UPDATE public.config_assenze c
   SET mezzi_totali = GREATEST(
         mezzi_totali,
         COALESCE((SELECT COUNT(*) FROM public.autisti a WHERE a.org_id=c.org_id AND a.attivo=true)::int, 1)
       ),
       mezzi_richiesti_giorno = GREATEST(
         mezzi_richiesti_giorno,
         COALESCE((SELECT COUNT(*) FROM public.autisti a WHERE a.org_id=c.org_id AND a.attivo=true)::int - COALESCE(min_autisti_disponibili_giorno,1), 1)
       );

ALTER TABLE public.config_assenze
  DROP COLUMN IF EXISTS min_autisti_disponibili_giorno;

ALTER TABLE public.config_assenze
  ADD CONSTRAINT config_assenze_mezzi_coerenti
    CHECK (mezzi_totali >= mezzi_richiesti_giorno AND mezzi_totali >= 0 AND mezzi_richiesti_giorno >= 0);

-- 2. assenze_copertura_giorno: nuova semantica su MEZZI
CREATE OR REPLACE FUNCTION public.assenze_copertura_giorno(_org uuid, _giorno date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $fn$
DECLARE
  v_mt int; v_mr int; v_max int; v_appr int; v_pend int;
BEGIN
  SELECT mezzi_totali, mezzi_richiesti_giorno INTO v_mt, v_mr
    FROM public.config_assenze WHERE org_id=_org;
  v_mt := COALESCE(v_mt, 1);
  v_mr := COALESCE(v_mr, 1);
  v_max := GREATEST(v_mt - v_mr, 0);

  SELECT COUNT(DISTINCT autista_id) INTO v_appr
    FROM public.autisti_assenze
   WHERE org_id=_org AND stato='approvata'
     AND _giorno BETWEEN data_inizio AND data_fine;
  SELECT COUNT(DISTINCT autista_id) INTO v_pend
    FROM public.autisti_assenze
   WHERE org_id=_org AND stato='richiesta'
     AND _giorno BETWEEN data_inizio AND data_fine;

  RETURN jsonb_build_object(
    'mezzi_totali', v_mt,
    'mezzi_richiesti', v_mr,
    'max_assenze', v_max,
    'assenti_approvati', v_appr,
    'assenti_in_attesa', v_pend,
    'posti_liberi', GREATEST(v_max - v_appr, 0),
    'pieno', v_appr >= v_max
  );
END $fn$;

-- 3. richiedi_assenza: usa max derivato
CREATE OR REPLACE FUNCTION public.richiedi_assenza(_tipo assenza_tipo, _data_inizio date, _data_fine date, _motivazione text DEFAULT NULL)
RETURNS autisti_assenze
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_aut uuid;
  v_org uuid;
  v_limits jsonb;
  v_max int;
  v_giorno date;
  v_cop jsonb;
  v_row public.autisti_assenze%ROWTYPE;
  v_names text;
  v_stato_iniziale public.assenza_stato := 'richiesta';
BEGIN
  v_aut := public.get_autista_id(v_uid);
  v_org := public.get_autista_org_id(v_uid);
  IF v_aut IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  IF _data_fine < _data_inizio THEN
    RAISE EXCEPTION 'Intervallo non valido' USING ERRCODE='22023';
  END IF;
  IF _data_inizio < (now() AT TIME ZONE 'Europe/Rome')::date AND _tipo <> 'malattia' THEN
    RAISE EXCEPTION 'Non puoi richiedere assenze nel passato' USING ERRCODE='22023';
  END IF;

  v_limits := public.assenze_get_effective_limits(v_aut);

  IF _tipo = 'malattia' THEN
    v_stato_iniziale := 'approvata';
  ELSE
    -- Plafond mensile
    v_max := CASE _tipo
      WHEN 'ferie' THEN (v_limits->>'max_ferie')::int
      WHEN 'riposo' THEN (v_limits->>'max_riposi')::int
      WHEN 'permesso' THEN (v_limits->>'max_permessi')::int
    END;
    DECLARE
      v_m date := date_trunc('month', _data_inizio)::date;
      v_last_m date := date_trunc('month', _data_fine)::date;
      v_from date; v_to date;
      v_new_days int;
      v_used int;
    BEGIN
      WHILE v_m <= v_last_m LOOP
        v_from := v_m;
        v_to := (v_m + interval '1 month - 1 day')::date;
        v_new_days := LEAST(_data_fine, v_to)::date - GREATEST(_data_inizio, v_from)::date + 1;
        v_used := public.assenze_conteggia_mese(v_aut, _tipo, extract(year from v_m)::int, extract(month from v_m)::int);
        IF v_used + v_new_days > v_max THEN
          RAISE EXCEPTION 'Superi il limite mensile di % per % (usati %, richiesti %, max %)',
            _tipo, to_char(v_m,'MM/YYYY'), v_used, v_new_days, v_max
            USING ERRCODE='22023';
        END IF;
        v_m := (v_m + interval '1 month')::date;
      END LOOP;
    END;

    -- Copertura mezzi giorno per giorno
    v_giorno := _data_inizio;
    WHILE v_giorno <= _data_fine LOOP
      v_cop := public.assenze_copertura_giorno(v_org, v_giorno);
      -- distinti assenti (approvati + in_attesa) + questa nuova (se autista non già presente)
      DECLARE
        v_gia_presente boolean;
        v_dopo int;
      BEGIN
        SELECT EXISTS(
          SELECT 1 FROM public.autisti_assenze
           WHERE org_id=v_org AND autista_id=v_aut
             AND stato IN ('approvata','richiesta')
             AND v_giorno BETWEEN data_inizio AND data_fine
        ) INTO v_gia_presente;
        v_dopo := (v_cop->>'assenti_approvati')::int + (v_cop->>'assenti_in_attesa')::int + CASE WHEN v_gia_presente THEN 0 ELSE 1 END;
        IF v_dopo > (v_cop->>'max_assenze')::int THEN
          SELECT string_agg(
                   trim(coalesce(a.nome,'')||' '||coalesce(a.cognome,''))||' ('||az.tipo::text||')',
                   ', ')
            INTO v_names
            FROM public.autisti_assenze az
            JOIN public.autisti a ON a.id = az.autista_id
           WHERE az.org_id=v_org
             AND az.stato IN ('approvata','richiesta')
             AND v_giorno BETWEEN az.data_inizio AND az.data_fine;
          RAISE EXCEPTION 'Giorno % completo: massimo % assenze (% mezzi, % richiesti operativi). Assenti: %',
            to_char(v_giorno,'DD/MM/YYYY'),
            (v_cop->>'max_assenze')::int,
            (v_cop->>'mezzi_totali')::int,
            (v_cop->>'mezzi_richiesti')::int,
            COALESCE(v_names,'nessuno')
            USING ERRCODE='22023';
        END IF;
      END;
      v_giorno := v_giorno + 1;
    END LOOP;
  END IF;

  INSERT INTO public.autisti_assenze(
    org_id, autista_id, tipo, data_inizio, data_fine, motivazione,
    stato, origine, richiesta_da, deciso_da, deciso_at
  ) VALUES (
    v_org, v_aut, _tipo, _data_inizio, _data_fine, _motivazione,
    v_stato_iniziale, 'autista', v_uid,
    CASE WHEN v_stato_iniziale='approvata' THEN v_uid ELSE NULL END,
    CASE WHEN v_stato_iniziale='approvata' THEN now() ELSE NULL END
  ) RETURNING * INTO v_row;

  IF _tipo = 'malattia' THEN
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
    VALUES (v_org, 'assenza_malattia',
      'Malattia registrata',
      'Autista ha registrato malattia dal ' || to_char(_data_inizio,'DD/MM/YYYY') || ' al ' || to_char(_data_fine,'DD/MM/YYYY'));
  ELSE
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
    VALUES (v_org, 'assenza_richiesta',
      'Nuova richiesta di assenza',
      'Richiesta di ' || _tipo::text || ' dal ' || to_char(_data_inizio,'DD/MM/YYYY') || ' al ' || to_char(_data_fine,'DD/MM/YYYY'));
  END IF;

  RETURN v_row;
END $fn$;

-- 4. approva_assenza: ricontrolla contro max_assenze
CREATE OR REPLACE FUNCTION public.approva_assenza(_id uuid, _note text DEFAULT NULL)
RETURNS autisti_assenze
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid := public.get_user_org_id(v_uid);
  v_row public.autisti_assenze%ROWTYPE;
  v_giorno date;
  v_cop jsonb;
  v_names text;
BEGIN
  IF v_org IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_row FROM public.autisti_assenze WHERE id=_id AND org_id=v_org FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Richiesta non trovata' USING ERRCODE='22023';
  END IF;
  IF v_row.stato <> 'richiesta' THEN
    RAISE EXCEPTION 'Richiesta non più modificabile' USING ERRCODE='22023';
  END IF;

  v_giorno := v_row.data_inizio;
  WHILE v_giorno <= v_row.data_fine LOOP
    v_cop := public.assenze_copertura_giorno(v_org, v_giorno);
    -- dopo l'approvazione: assenti_approvati + 1 (l'autista sta passando da pending a approvato)
    IF ((v_cop->>'assenti_approvati')::int + 1) > (v_cop->>'max_assenze')::int THEN
      SELECT string_agg(
               trim(coalesce(a.nome,'')||' '||coalesce(a.cognome,''))||' ('||az.tipo::text||')',
               ', ')
        INTO v_names
        FROM public.autisti_assenze az
        JOIN public.autisti a ON a.id=az.autista_id
       WHERE az.org_id=v_org AND az.stato='approvata' AND az.id<>_id
         AND v_giorno BETWEEN az.data_inizio AND az.data_fine;
      RAISE EXCEPTION 'Impossibile approvare: giorno % completo (massimo % assenze — % mezzi, % richiesti operativi). Già approvati: %',
        to_char(v_giorno,'DD/MM/YYYY'),
        (v_cop->>'max_assenze')::int,
        (v_cop->>'mezzi_totali')::int,
        (v_cop->>'mezzi_richiesti')::int,
        COALESCE(v_names,'nessuno')
        USING ERRCODE='22023';
    END IF;
    v_giorno := v_giorno + 1;
  END LOOP;

  UPDATE public.autisti_assenze
     SET stato='approvata', note_ufficio=COALESCE(_note, note_ufficio),
         deciso_da=v_uid, deciso_at=now()
   WHERE id=_id RETURNING * INTO v_row;

  INSERT INTO public.notifiche(org_id, autista_id, tipo, titolo, messaggio)
  VALUES (v_org, v_row.autista_id, 'assenza_approvata',
    'Assenza approvata',
    'La tua richiesta di ' || v_row.tipo::text || ' dal ' || to_char(v_row.data_inizio,'DD/MM/YYYY') || ' al ' || to_char(v_row.data_fine,'DD/MM/YYYY') || ' è stata approvata.');

  v_giorno := v_row.data_inizio;
  WHILE v_giorno <= v_row.data_fine LOOP
    IF (public.assenze_copertura_giorno(v_org, v_giorno)->>'pieno')::boolean THEN
      INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
      VALUES (v_org, 'assenza_giorno_pieno',
        'Giorno assenze al completo',
        'Il giorno ' || to_char(v_giorno,'DD/MM/YYYY') || ' ha esaurito i posti per le assenze.');
    END IF;
    v_giorno := v_giorno + 1;
  END LOOP;

  RETURN v_row;
END $fn$;

-- 5. inserisci_assenza_ufficio: usa max derivato + force
CREATE OR REPLACE FUNCTION public.inserisci_assenza_ufficio(_autista_id uuid, _tipo assenza_tipo, _data_inizio date, _data_fine date, _note text DEFAULT NULL, _force boolean DEFAULT false)
RETURNS autisti_assenze
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid := public.get_user_org_id(v_uid);
  v_aut_org uuid;
  v_row public.autisti_assenze%ROWTYPE;
  v_giorno date;
  v_cop jsonb;
BEGIN
  IF v_org IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  SELECT org_id INTO v_aut_org FROM public.autisti WHERE id=_autista_id;
  IF v_aut_org <> v_org THEN
    RAISE EXCEPTION 'Autista non della tua organizzazione' USING ERRCODE='42501';
  END IF;
  IF _data_fine < _data_inizio THEN
    RAISE EXCEPTION 'Intervallo non valido' USING ERRCODE='22023';
  END IF;

  IF NOT _force AND _tipo <> 'malattia' THEN
    v_giorno := _data_inizio;
    WHILE v_giorno <= _data_fine LOOP
      v_cop := public.assenze_copertura_giorno(v_org, v_giorno);
      IF ((v_cop->>'assenti_approvati')::int + 1) > (v_cop->>'max_assenze')::int THEN
        RAISE EXCEPTION 'Giorno % completo: massimo % assenze (% mezzi, % richiesti operativi). Usa force per forzare.',
          to_char(v_giorno,'DD/MM/YYYY'),
          (v_cop->>'max_assenze')::int,
          (v_cop->>'mezzi_totali')::int,
          (v_cop->>'mezzi_richiesti')::int
          USING ERRCODE='22023';
      END IF;
      v_giorno := v_giorno + 1;
    END LOOP;
  END IF;

  INSERT INTO public.autisti_assenze(
    org_id, autista_id, tipo, data_inizio, data_fine, motivazione, note_ufficio,
    stato, origine, richiesta_da, deciso_da, deciso_at
  ) VALUES (
    v_org, _autista_id, _tipo, _data_inizio, _data_fine, NULL,
    CASE WHEN _force THEN COALESCE(_note,'') || ' [forzato ufficio]' ELSE _note END,
    'approvata', 'ufficio', v_uid, v_uid, now()
  ) RETURNING * INTO v_row;

  INSERT INTO public.notifiche(org_id, autista_id, tipo, titolo, messaggio)
  VALUES (v_org, _autista_id, 'assenza_approvata',
    'Assenza registrata dall''ufficio',
    'L''ufficio ha registrato per te ' || _tipo::text || ' dal ' || to_char(_data_inizio,'DD/MM/YYYY') || ' al ' || to_char(_data_fine,'DD/MM/YYYY') || '.');

  RETURN v_row;
END $fn$;
