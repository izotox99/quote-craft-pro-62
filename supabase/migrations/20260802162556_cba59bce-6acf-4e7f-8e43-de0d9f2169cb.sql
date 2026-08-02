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

  SELECT max_riposi_mese, max_ferie_mese, max_permessi_mese, mezzi_totali, mezzi_richiesti_giorno
    INTO v_c FROM public.config_assenze WHERE org_id = v_a.org_id;
  IF v_c IS NULL THEN
    INSERT INTO public.config_assenze(org_id) VALUES (v_a.org_id)
      ON CONFLICT DO NOTHING;
    SELECT max_riposi_mese, max_ferie_mese, max_permessi_mese, mezzi_totali, mezzi_richiesti_giorno
      INTO v_c FROM public.config_assenze WHERE org_id = v_a.org_id;
  END IF;
  RETURN jsonb_build_object(
    'max_riposi', COALESCE(v_a.max_riposi_mese, v_c.max_riposi_mese),
    'max_ferie', COALESCE(v_a.max_ferie_mese, v_c.max_ferie_mese),
    'max_permessi', COALESCE(v_a.max_permessi_mese, v_c.max_permessi_mese),
    'mezzi_totali', v_c.mezzi_totali,
    'mezzi_richiesti', v_c.mezzi_richiesti_giorno,
    'min_disponibili', v_c.mezzi_richiesti_giorno,
    'org_id', v_a.org_id
  );
END $function$;