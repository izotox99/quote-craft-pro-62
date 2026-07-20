
-- =========================================================
-- Fase 4 autisti: assenze / ferie / calendario condiviso
-- =========================================================

-- 1) Override limiti sulla scheda autista
ALTER TABLE public.autisti
  ADD COLUMN IF NOT EXISTS max_riposi_mese int,
  ADD COLUMN IF NOT EXISTS max_ferie_mese int,
  ADD COLUMN IF NOT EXISTS max_permessi_mese int;

-- 2) Campo autista_id su notifiche
ALTER TABLE public.notifiche
  ADD COLUMN IF NOT EXISTS autista_id uuid;
CREATE INDEX IF NOT EXISTS notifiche_autista_id_idx ON public.notifiche(autista_id);

-- 3) Enum
DO $$ BEGIN
  CREATE TYPE public.assenza_tipo AS ENUM ('ferie','riposo','permesso','malattia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.assenza_stato AS ENUM ('richiesta','approvata','rifiutata','annullata');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) config_assenze
CREATE TABLE IF NOT EXISTS public.config_assenze (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  max_riposi_mese int NOT NULL DEFAULT 4,
  max_ferie_mese int NOT NULL DEFAULT 10,
  max_permessi_mese int NOT NULL DEFAULT 2,
  min_autisti_disponibili_giorno int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.config_assenze TO authenticated;
GRANT ALL ON public.config_assenze TO service_role;

ALTER TABLE public.config_assenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_assenze select org or autista"
  ON public.config_assenze FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org_id(auth.uid())
    OR org_id = public.get_autista_org_id(auth.uid())
  );

CREATE POLICY "config_assenze insert admin"
  ON public.config_assenze FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.get_user_org_id(auth.uid())
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  );

CREATE POLICY "config_assenze update admin"
  ON public.config_assenze FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid())
         AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid())
              AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));

CREATE TRIGGER config_assenze_touch_updated_at
  BEFORE UPDATE ON public.config_assenze
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed per org esistenti
INSERT INTO public.config_assenze (org_id)
SELECT o.id FROM public.organizations o
LEFT JOIN public.config_assenze c ON c.org_id = o.id
WHERE c.org_id IS NULL;

-- 5) autisti_assenze
CREATE TABLE IF NOT EXISTS public.autisti_assenze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  tipo public.assenza_tipo NOT NULL,
  data_inizio date NOT NULL,
  data_fine date NOT NULL CHECK (data_fine >= data_inizio),
  motivazione text,
  note_ufficio text,
  stato public.assenza_stato NOT NULL DEFAULT 'richiesta',
  origine text NOT NULL DEFAULT 'autista',
  richiesta_da uuid,
  deciso_da uuid,
  deciso_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS autisti_assenze_org_range_idx
  ON public.autisti_assenze (org_id, data_inizio, data_fine);
CREATE INDEX IF NOT EXISTS autisti_assenze_autista_stato_idx
  ON public.autisti_assenze (autista_id, stato);

GRANT SELECT ON public.autisti_assenze TO authenticated;
GRANT ALL ON public.autisti_assenze TO service_role;

ALTER TABLE public.autisti_assenze ENABLE ROW LEVEL SECURITY;

-- Ufficio: SELECT su tutta l'org
CREATE POLICY "assenze select office"
  ON public.autisti_assenze FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Autista: SELECT solo le proprie righe
CREATE POLICY "assenze select self autista"
  ON public.autisti_assenze FOR SELECT TO authenticated
  USING (autista_id = public.get_autista_id(auth.uid()));

-- Nessuna INSERT/UPDATE/DELETE diretta: tutto via funzioni SECURITY DEFINER
-- (le funzioni bypassano RLS per definizione)

CREATE TRIGGER autisti_assenze_touch_updated_at
  BEFORE UPDATE ON public.autisti_assenze
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Funzioni

-- Limiti effettivi
CREATE OR REPLACE FUNCTION public.assenze_get_effective_limits(_autista_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a record;
  v_c record;
BEGIN
  SELECT org_id, max_riposi_mese, max_ferie_mese, max_permessi_mese
    INTO v_a FROM public.autisti WHERE id = _autista_id;
  IF v_a.org_id IS NULL THEN
    RAISE EXCEPTION 'Autista non trovato' USING ERRCODE='22023';
  END IF;
  SELECT max_riposi_mese, max_ferie_mese, max_permessi_mese, min_autisti_disponibili_giorno
    INTO v_c FROM public.config_assenze WHERE org_id = v_a.org_id;
  IF v_c IS NULL THEN
    INSERT INTO public.config_assenze(org_id) VALUES (v_a.org_id)
      ON CONFLICT DO NOTHING;
    SELECT max_riposi_mese, max_ferie_mese, max_permessi_mese, min_autisti_disponibili_giorno
      INTO v_c FROM public.config_assenze WHERE org_id = v_a.org_id;
  END IF;
  RETURN jsonb_build_object(
    'max_riposi', COALESCE(v_a.max_riposi_mese, v_c.max_riposi_mese),
    'max_ferie', COALESCE(v_a.max_ferie_mese, v_c.max_ferie_mese),
    'max_permessi', COALESCE(v_a.max_permessi_mese, v_c.max_permessi_mese),
    'min_disponibili', v_c.min_autisti_disponibili_giorno,
    'org_id', v_a.org_id
  );
END $$;

-- Conta giorni di un tipo nel mese (stati richiesta+approvata)
CREATE OR REPLACE FUNCTION public.assenze_conteggia_mese(
  _autista_id uuid, _tipo public.assenza_tipo, _anno int, _mese int, _exclude_id uuid DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := make_date(_anno, _mese, 1);
  v_to date := (make_date(_anno, _mese, 1) + interval '1 month - 1 day')::date;
  v_days int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT data_inizio, data_fine FROM public.autisti_assenze
     WHERE autista_id = _autista_id
       AND tipo = _tipo
       AND stato IN ('richiesta','approvata')
       AND (_exclude_id IS NULL OR id <> _exclude_id)
       AND data_inizio <= v_to AND data_fine >= v_from
  LOOP
    v_days := v_days + (
      LEAST(r.data_fine, v_to)::date - GREATEST(r.data_inizio, v_from)::date + 1
    );
  END LOOP;
  RETURN v_days;
END $$;

-- Copertura di un giorno per org
CREATE OR REPLACE FUNCTION public.assenze_copertura_giorno(_org uuid, _giorno date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attivi int;
  v_appr int;
  v_pend int;
  v_min int;
BEGIN
  SELECT COUNT(*) INTO v_attivi FROM public.autisti WHERE org_id=_org AND attivo=true;
  SELECT COUNT(DISTINCT autista_id) INTO v_appr FROM public.autisti_assenze
    WHERE org_id=_org AND stato='approvata'
      AND _giorno BETWEEN data_inizio AND data_fine;
  SELECT COUNT(DISTINCT autista_id) INTO v_pend FROM public.autisti_assenze
    WHERE org_id=_org AND stato='richiesta'
      AND _giorno BETWEEN data_inizio AND data_fine;
  SELECT min_autisti_disponibili_giorno INTO v_min FROM public.config_assenze WHERE org_id=_org;
  v_min := COALESCE(v_min, 1);
  RETURN jsonb_build_object(
    'attivi', v_attivi,
    'assenti_approvati', v_appr,
    'assenti_in_attesa', v_pend,
    'disponibili', GREATEST(v_attivi - v_appr, 0),
    'min_richiesto', v_min,
    'pieno', (v_attivi - v_appr) <= v_min
  );
END $$;

-- Calendario condiviso (privacy: solo nome + tipo)
CREATE OR REPLACE FUNCTION public.assenze_calendario_mese(_anno int, _mese int)
RETURNS TABLE(giorno date, autista_nome text, tipo public.assenza_tipo, stato public.assenza_stato)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_from date := make_date(_anno,_mese,1);
  v_to date := (make_date(_anno,_mese,1) + interval '1 month - 1 day')::date;
BEGIN
  v_org := COALESCE(public.get_user_org_id(auth.uid()), public.get_autista_org_id(auth.uid()));
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT d::date AS giorno,
           trim(coalesce(a.nome,'') || ' ' || coalesce(a.cognome,'')) AS autista_nome,
           az.tipo, az.stato
      FROM public.autisti_assenze az
      JOIN public.autisti a ON a.id = az.autista_id
      CROSS JOIN LATERAL generate_series(
        GREATEST(az.data_inizio, v_from),
        LEAST(az.data_fine, v_to),
        interval '1 day'
      ) AS d
     WHERE az.org_id = v_org
       AND az.stato IN ('richiesta','approvata')
       AND az.data_inizio <= v_to AND az.data_fine >= v_from
     ORDER BY d, autista_nome;
END $$;

-- Richiesta assenza (autista)
CREATE OR REPLACE FUNCTION public.richiedi_assenza(
  _tipo public.assenza_tipo, _data_inizio date, _data_fine date, _motivazione text DEFAULT NULL
) RETURNS public.autisti_assenze
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aut uuid;
  v_org uuid;
  v_limits jsonb;
  v_days int;
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
    -- (a) plafond mensile: valuta per ciascun mese coperto
    v_days := 0;
    v_giorno := _data_inizio;
    WHILE v_giorno <= _data_fine LOOP
      v_days := v_days + 1;
      v_giorno := v_giorno + 1;
    END LOOP;

    v_max := CASE _tipo
      WHEN 'ferie' THEN (v_limits->>'max_ferie')::int
      WHEN 'riposo' THEN (v_limits->>'max_riposi')::int
      WHEN 'permesso' THEN (v_limits->>'max_permessi')::int
    END;

    -- Somma dei giorni del range nel mese corrispondente + già usati
    -- Valutiamo per ogni mese coperto dal range
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

    -- (b) copertura giorno per giorno
    v_giorno := _data_inizio;
    WHILE v_giorno <= _data_fine LOOP
      v_cop := public.assenze_copertura_giorno(v_org, v_giorno);
      -- disponibili DOPO l'approvazione ipotetica: attivi - (approvati+1)
      IF ((v_cop->>'attivi')::int - ((v_cop->>'assenti_approvati')::int + 1)) < (v_cop->>'min_richiesto')::int THEN
        SELECT string_agg(
                 trim(coalesce(a.nome,'')||' '||coalesce(a.cognome,''))||' ('||az.tipo::text||')',
                 ', ')
          INTO v_names
          FROM public.autisti_assenze az
          JOIN public.autisti a ON a.id = az.autista_id
         WHERE az.org_id=v_org
           AND az.stato IN ('approvata','richiesta')
           AND v_giorno BETWEEN az.data_inizio AND az.data_fine;
        RAISE EXCEPTION 'Giorno % pieno. Assenti: %', to_char(v_giorno,'DD/MM/YYYY'), COALESCE(v_names,'nessuno')
          USING ERRCODE='22023';
      END IF;
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

  -- Notifica titolare
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
END $$;

-- Approva (ufficio) — ricontrolla copertura
CREATE OR REPLACE FUNCTION public.approva_assenza(_id uuid, _note text DEFAULT NULL)
RETURNS public.autisti_assenze
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Ricontrolla copertura escludendo la richiesta stessa
  v_giorno := v_row.data_inizio;
  WHILE v_giorno <= v_row.data_fine LOOP
    SELECT COUNT(*) FILTER (WHERE attivo) - COUNT(DISTINCT az.autista_id) FILTER (WHERE az.id IS NOT NULL)
      INTO STRICT v_cop
      FROM public.autisti a
      LEFT JOIN public.autisti_assenze az
        ON az.autista_id=a.id
       AND az.org_id=v_org
       AND az.stato='approvata'
       AND v_giorno BETWEEN az.data_inizio AND az.data_fine
     WHERE a.org_id=v_org;
    -- rifiuto se scenderemmo sotto min con questa approvazione
    DECLARE v_min int; v_disponibili int;
    BEGIN
      SELECT min_autisti_disponibili_giorno INTO v_min FROM public.config_assenze WHERE org_id=v_org;
      v_min := COALESCE(v_min,1);
      v_disponibili := (public.assenze_copertura_giorno(v_org, v_giorno)->>'disponibili')::int;
      IF (v_disponibili - 1) < v_min THEN
        SELECT string_agg(trim(coalesce(a.nome,'')||' '||coalesce(a.cognome,''))||' ('||az.tipo::text||')', ', ')
          INTO v_names
          FROM public.autisti_assenze az JOIN public.autisti a ON a.id=az.autista_id
         WHERE az.org_id=v_org AND az.stato='approvata' AND az.id<>_id
           AND v_giorno BETWEEN az.data_inizio AND az.data_fine;
        RAISE EXCEPTION 'Impossibile approvare: giorno % pieno. Assenti approvati: %',
          to_char(v_giorno,'DD/MM/YYYY'), COALESCE(v_names,'nessuno') USING ERRCODE='22023';
      END IF;
    END;
    v_giorno := v_giorno + 1;
  END LOOP;

  UPDATE public.autisti_assenze
     SET stato='approvata', note_ufficio=COALESCE(_note, note_ufficio),
         deciso_da=v_uid, deciso_at=now()
   WHERE id=_id
  RETURNING * INTO v_row;

  -- Notifica autista
  INSERT INTO public.notifiche(org_id, autista_id, tipo, titolo, messaggio)
  VALUES (v_org, v_row.autista_id, 'assenza_approvata',
    'Assenza approvata',
    'La tua richiesta di ' || v_row.tipo::text || ' dal ' || to_char(v_row.data_inizio,'DD/MM/YYYY') || ' al ' || to_char(v_row.data_fine,'DD/MM/YYYY') || ' è stata approvata.');

  -- Notifica titolare se giorno raggiunge il limite
  v_giorno := v_row.data_inizio;
  WHILE v_giorno <= v_row.data_fine LOOP
    IF (public.assenze_copertura_giorno(v_org, v_giorno)->>'pieno')::boolean THEN
      INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
      VALUES (v_org, 'assenza_giorno_pieno',
        'Copertura al limite',
        'Il giorno ' || to_char(v_giorno,'DD/MM/YYYY') || ' ha raggiunto il minimo di autisti disponibili.');
    END IF;
    v_giorno := v_giorno + 1;
  END LOOP;

  RETURN v_row;
END $$;

-- Rifiuta
CREATE OR REPLACE FUNCTION public.rifiuta_assenza(_id uuid, _note text DEFAULT NULL)
RETURNS public.autisti_assenze
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid := public.get_user_org_id(v_uid);
  v_row public.autisti_assenze%ROWTYPE;
BEGIN
  IF v_org IS NULL OR NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  UPDATE public.autisti_assenze
     SET stato='rifiutata', note_ufficio=COALESCE(_note, note_ufficio),
         deciso_da=v_uid, deciso_at=now()
   WHERE id=_id AND org_id=v_org AND stato='richiesta'
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Richiesta non trovata o non modificabile' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.notifiche(org_id, autista_id, tipo, titolo, messaggio)
  VALUES (v_org, v_row.autista_id, 'assenza_rifiutata',
    'Assenza rifiutata',
    'La tua richiesta di ' || v_row.tipo::text || ' dal ' || to_char(v_row.data_inizio,'DD/MM/YYYY') || ' al ' || to_char(v_row.data_fine,'DD/MM/YYYY') || ' è stata rifiutata.'
    || COALESCE(chr(10)||'Nota: '||_note, ''));
  RETURN v_row;
END $$;

-- Annulla (autista sulle proprie richieste, ufficio su tutte)
CREATE OR REPLACE FUNCTION public.annulla_assenza(_id uuid)
RETURNS public.autisti_assenze
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.autisti_assenze%ROWTYPE;
  v_aut uuid := public.get_autista_id(v_uid);
  v_org uuid := public.get_user_org_id(v_uid);
  v_is_office boolean := (v_org IS NOT NULL AND (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'manager')));
BEGIN
  SELECT * INTO v_row FROM public.autisti_assenze WHERE id=_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Non trovata' USING ERRCODE='22023';
  END IF;
  IF v_is_office THEN
    IF v_row.org_id <> v_org THEN
      RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
    END IF;
  ELSIF v_row.autista_id = v_aut THEN
    IF v_row.stato <> 'richiesta' THEN
      RAISE EXCEPTION 'Puoi annullare solo richieste in attesa' USING ERRCODE='42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  UPDATE public.autisti_assenze SET stato='annullata', deciso_da=v_uid, deciso_at=now()
   WHERE id=_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- Inserimento manuale ufficio
CREATE OR REPLACE FUNCTION public.inserisci_assenza_ufficio(
  _autista_id uuid, _tipo public.assenza_tipo, _data_inizio date, _data_fine date,
  _note text DEFAULT NULL, _force boolean DEFAULT false
) RETURNS public.autisti_assenze
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      IF ((v_cop->>'attivi')::int - ((v_cop->>'assenti_approvati')::int + 1)) < (v_cop->>'min_richiesto')::int THEN
        RAISE EXCEPTION 'Giorno % pieno (usa force per forzare)', to_char(v_giorno,'DD/MM/YYYY')
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
END $$;

-- Permessi execute
REVOKE EXECUTE ON FUNCTION public.assenze_get_effective_limits(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assenze_conteggia_mese(uuid, public.assenza_tipo, int, int, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assenze_copertura_giorno(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assenze_calendario_mese(int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.richiedi_assenza(public.assenza_tipo, date, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approva_assenza(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rifiuta_assenza(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.annulla_assenza(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.inserisci_assenza_ufficio(uuid, public.assenza_tipo, date, date, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assenze_get_effective_limits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assenze_conteggia_mese(uuid, public.assenza_tipo, int, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assenze_copertura_giorno(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assenze_calendario_mese(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.richiedi_assenza(public.assenza_tipo, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approva_assenza(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rifiuta_assenza(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_assenza(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.inserisci_assenza_ufficio(uuid, public.assenza_tipo, date, date, text, boolean) TO authenticated;
