
CREATE TABLE IF NOT EXISTS public.servizi_modifiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servizio_id uuid NOT NULL REFERENCES public.servizi(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  changed_by uuid,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servizi_modifiche_servizio ON public.servizi_modifiche(servizio_id, created_at DESC);

ALTER TABLE public.servizi_modifiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view servizi_modifiche"
ON public.servizi_modifiche FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_servizi_client_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_client boolean;
  fields text[] := ARRAY[
    'data_servizio','ora_inizio','citta','tipologia','transfer_tipo','disposizione_oraria',
    'tour_tipo','luogo_inizio','luogo_fine','itinerario','veicolo_tipo','n_passeggeri',
    'n_bagagli','info_autista','tipo_pagamento','centro_costo','accessori','note'
  ];
  f text;
  old_v text;
  new_v text;
BEGIN
  is_client := public.is_client_user(auth.uid());
  IF NOT is_client THEN
    RETURN NEW;
  END IF;

  FOREACH f IN ARRAY fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f)
      INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.servizi_modifiche(servizio_id, org_id, changed_by, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.org_id, auth.uid(), f, old_v, new_v);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_servizi_client_changes ON public.servizi;
CREATE TRIGGER trg_log_servizi_client_changes
AFTER UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.log_servizi_client_changes();

ALTER PUBLICATION supabase_realtime ADD TABLE public.servizi_modifiche;
