-- 1) assenze_copertura_giorno: impedisce di interrogare org altrui
CREATE OR REPLACE FUNCTION public.assenze_copertura_giorno(_org uuid, _giorno date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mt int; v_mr int; v_max int; v_appr int; v_pend int;
  v_uid uuid := auth.uid();
  v_caller_org uuid;
BEGIN
  IF v_uid IS NOT NULL THEN
    v_caller_org := COALESCE(public.get_user_org_id(v_uid), public.get_autista_org_id(v_uid));
    IF v_caller_org IS NULL OR v_caller_org <> _org THEN
      RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
    END IF;
  END IF;

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
END $function$;

-- 2) assenze_conteggia_mese: autorizzazione sul chiamante
CREATE OR REPLACE FUNCTION public.assenze_conteggia_mese(_autista_id uuid, _tipo assenza_tipo, _anno integer, _mese integer, _exclude_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := make_date(_anno, _mese, 1);
  v_to date := (make_date(_anno, _mese, 1) + interval '1 month - 1 day')::date;
  v_days int := 0;
  r record;
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT org_id INTO v_org FROM public.autisti WHERE id = _autista_id;
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'Autista non trovato' USING ERRCODE='22023';
    END IF;
    IF NOT (
      _autista_id = public.get_autista_id(v_uid)
      OR v_org = public.get_user_org_id(v_uid)
    ) THEN
      RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
    END IF;
  END IF;

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
END $function$;

-- 3) assenze_get_effective_limits: autorizzazione sul chiamante
CREATE OR REPLACE FUNCTION public.assenze_get_effective_limits(_autista_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_a record;
  v_c record;
  v_uid uuid := auth.uid();
BEGIN
  SELECT org_id, max_riposi_mese, max_ferie_mese, max_permessi_mese
    INTO v_a FROM public.autisti WHERE id = _autista_id;
  IF v_a.org_id IS NULL THEN
    RAISE EXCEPTION 'Autista non trovato' USING ERRCODE='22023';
  END IF;

  IF v_uid IS NOT NULL THEN
    IF NOT (
      _autista_id = public.get_autista_id(v_uid)
      OR v_a.org_id = public.get_user_org_id(v_uid)
    ) THEN
      RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
    END IF;
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
END $function$;

-- 4) Vista autisti: sola lettura
REVOKE ALL ON public.servizi_autista_view FROM anon, authenticated;
GRANT SELECT ON public.servizi_autista_view TO authenticated;

-- 5) Riduzione GRANT: nessun accesso anon, niente privilegi tecnici per authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM authenticated', r.relname);
  END LOOP;
END $$;

-- Tabelle raggiungibili dai link pubblici delle proposte
GRANT SELECT ON public.proposals TO anon;
GRANT SELECT ON public.line_items TO anon;
GRANT SELECT, INSERT ON public.proposal_events TO anon;

-- 6) Tabelle tecniche: nessun accesso dalle app client
REVOKE ALL ON public.login_attempts FROM anon, authenticated;
REVOKE ALL ON public.password_fingerprints FROM anon, authenticated;
GRANT ALL ON public.login_attempts TO service_role;
GRANT ALL ON public.password_fingerprints TO service_role;