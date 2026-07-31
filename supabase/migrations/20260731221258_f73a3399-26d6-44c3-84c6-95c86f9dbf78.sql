CREATE TABLE IF NOT EXISTS public.autisti_veicolo_sessioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  autista_id uuid NOT NULL REFERENCES public.autisti(id) ON DELETE CASCADE,
  veicolo_id uuid NOT NULL REFERENCES public.veicoli(id),
  aperta_at timestamptz NOT NULL DEFAULT now(),
  chiusa_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sessione_aperta_autista
  ON public.autisti_veicolo_sessioni(autista_id) WHERE chiusa_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.autisti_veicolo_sessioni TO authenticated;
GRANT ALL ON public.autisti_veicolo_sessioni TO service_role;

ALTER TABLE public.autisti_veicolo_sessioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autista vede proprie sessioni"
ON public.autisti_veicolo_sessioni FOR SELECT TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()) OR org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "autista crea proprie sessioni"
ON public.autisti_veicolo_sessioni FOR INSERT TO authenticated
WITH CHECK (autista_id = public.get_autista_id(auth.uid()) AND org_id = public.get_autista_org_id(auth.uid()));

CREATE POLICY "autista aggiorna proprie sessioni"
ON public.autisti_veicolo_sessioni FOR UPDATE TO authenticated
USING (autista_id = public.get_autista_id(auth.uid()))
WITH CHECK (autista_id = public.get_autista_id(auth.uid()));

CREATE TRIGGER set_updated_at_veicolo_sessioni
BEFORE UPDATE ON public.autisti_veicolo_sessioni
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.autista_apri_sessione_veicolo(_veicolo_id uuid)
RETURNS public.autisti_veicolo_sessioni
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a uuid; _org uuid; _row public.autisti_veicolo_sessioni;
BEGIN
  _a := public.get_autista_id(auth.uid());
  _org := public.get_autista_org_id(auth.uid());
  IF _a IS NULL THEN RAISE EXCEPTION 'Solo gli autisti possono selezionare un veicolo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.veicoli v WHERE v.id = _veicolo_id AND v.org_id = _org) THEN
    RAISE EXCEPTION 'Veicolo non valido';
  END IF;
  UPDATE public.autisti_veicolo_sessioni SET chiusa_at = now()
    WHERE autista_id = _a AND chiusa_at IS NULL;
  INSERT INTO public.autisti_veicolo_sessioni (org_id, autista_id, veicolo_id)
    VALUES (_org, _a, _veicolo_id) RETURNING * INTO _row;
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.autista_chiudi_sessione_veicolo()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a uuid;
BEGIN
  _a := public.get_autista_id(auth.uid());
  IF _a IS NULL THEN RAISE EXCEPTION 'Solo gli autisti'; END IF;
  UPDATE public.autisti_veicolo_sessioni SET chiusa_at = now()
    WHERE autista_id = _a AND chiusa_at IS NULL;
END; $$;

REVOKE EXECUTE ON FUNCTION public.autista_apri_sessione_veicolo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.autista_chiudi_sessione_veicolo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autista_apri_sessione_veicolo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.autista_chiudi_sessione_veicolo() TO authenticated;