ALTER TABLE public.veicoli
  ADD COLUMN IF NOT EXISTS telepass text,
  ADD COLUMN IF NOT EXISTS viacard text,
  ADD COLUMN IF NOT EXISTS autorizzazione_numero text,
  ADD COLUMN IF NOT EXISTS autorizzazione_comune text;

ALTER TABLE public.autisti_veicolo_sessioni
  ADD COLUMN IF NOT EXISTS km_inizio integer,
  ADD COLUMN IF NOT EXISTS km_fine integer;

DROP POLICY IF EXISTS "autista vede proprie sessioni" ON public.autisti_veicolo_sessioni;
CREATE POLICY "autista vede proprie sessioni"
ON public.autisti_veicolo_sessioni FOR SELECT TO authenticated
USING (
  autista_id = public.get_autista_id(auth.uid())
  OR org_id = public.get_user_org_id(auth.uid())
  OR org_id = public.get_autista_org_id(auth.uid())
);

CREATE OR REPLACE FUNCTION public.veicoli_occupati()
RETURNS TABLE(veicolo_id uuid, autista_id uuid, autista_nome text, aperta_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.veicolo_id, s.autista_id,
         trim(coalesce(a.nome,'') || ' ' || coalesce(a.cognome,'')) AS autista_nome,
         s.aperta_at
  FROM public.autisti_veicolo_sessioni s
  JOIN public.autisti a ON a.id = s.autista_id
  WHERE s.chiusa_at IS NULL
    AND s.org_id = coalesce(public.get_autista_org_id(auth.uid()), public.get_user_org_id(auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.autista_apri_sessione_veicolo(_veicolo_id uuid, _km_inizio integer DEFAULT NULL)
RETURNS public.autisti_veicolo_sessioni
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a uuid; _org uuid; _row public.autisti_veicolo_sessioni; _busy text;
BEGIN
  _a := public.get_autista_id(auth.uid());
  _org := public.get_autista_org_id(auth.uid());
  IF _a IS NULL THEN RAISE EXCEPTION 'Solo gli autisti possono selezionare un veicolo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.veicoli v WHERE v.id = _veicolo_id AND v.org_id = _org AND v.attivo) THEN
    RAISE EXCEPTION 'Veicolo non valido o non attivo';
  END IF;

  SELECT trim(coalesce(a.nome,'') || ' ' || coalesce(a.cognome,'')) INTO _busy
  FROM public.autisti_veicolo_sessioni s
  JOIN public.autisti a ON a.id = s.autista_id
  WHERE s.veicolo_id = _veicolo_id AND s.chiusa_at IS NULL AND s.autista_id <> _a
  LIMIT 1;
  IF _busy IS NOT NULL THEN
    RAISE EXCEPTION 'Veicolo già in uso da %', _busy;
  END IF;

  UPDATE public.autisti_veicolo_sessioni SET chiusa_at = now()
    WHERE autista_id = _a AND chiusa_at IS NULL;

  INSERT INTO public.autisti_veicolo_sessioni (org_id, autista_id, veicolo_id, km_inizio)
    VALUES (_org, _a, _veicolo_id, _km_inizio) RETURNING * INTO _row;

  IF _km_inizio IS NOT NULL THEN
    UPDATE public.veicoli SET km_attuale = _km_inizio
      WHERE id = _veicolo_id AND (km_attuale IS NULL OR _km_inizio > km_attuale);
  END IF;

  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.autista_chiudi_sessione_veicolo(_km_fine integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a uuid; _v uuid;
BEGIN
  _a := public.get_autista_id(auth.uid());
  IF _a IS NULL THEN RAISE EXCEPTION 'Solo gli autisti'; END IF;
  UPDATE public.autisti_veicolo_sessioni SET chiusa_at = now(), km_fine = _km_fine
    WHERE autista_id = _a AND chiusa_at IS NULL
    RETURNING veicolo_id INTO _v;
  IF _v IS NOT NULL AND _km_fine IS NOT NULL THEN
    UPDATE public.veicoli SET km_attuale = _km_fine
      WHERE id = _v AND (km_attuale IS NULL OR _km_fine > km_attuale);
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.veicoli_occupati() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.autista_apri_sessione_veicolo(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.autista_chiudi_sessione_veicolo(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.veicoli_occupati() TO authenticated;
GRANT EXECUTE ON FUNCTION public.autista_apri_sessione_veicolo(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.autista_chiudi_sessione_veicolo(integer) TO authenticated;

DROP FUNCTION IF EXISTS public.autista_apri_sessione_veicolo(uuid);
DROP FUNCTION IF EXISTS public.autista_chiudi_sessione_veicolo();