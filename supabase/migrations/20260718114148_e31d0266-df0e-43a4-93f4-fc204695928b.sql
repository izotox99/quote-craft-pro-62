
CREATE TABLE public.dashboard_viste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  colonne JSONB NOT NULL DEFAULT '[]'::jsonb,
  predefinita BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_viste TO authenticated;
GRANT ALL ON public.dashboard_viste TO service_role;

ALTER TABLE public.dashboard_viste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Le viste sono personali per utente"
ON public.dashboard_viste FOR ALL
TO authenticated
USING (user_id = auth.uid() AND org_id = public.get_user_org_id(auth.uid()))
WITH CHECK (user_id = auth.uid() AND org_id = public.get_user_org_id(auth.uid()));

CREATE TRIGGER dashboard_viste_set_org
BEFORE INSERT OR UPDATE ON public.dashboard_viste
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();

CREATE TRIGGER dashboard_viste_updated_at
BEFORE UPDATE ON public.dashboard_viste
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Solo una vista predefinita per utente
CREATE OR REPLACE FUNCTION public.dashboard_viste_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.predefinita = true THEN
    UPDATE public.dashboard_viste
    SET predefinita = false
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND predefinita = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dashboard_viste_single_default_trg
AFTER INSERT OR UPDATE OF predefinita ON public.dashboard_viste
FOR EACH ROW EXECUTE FUNCTION public.dashboard_viste_single_default();

CREATE INDEX idx_dashboard_viste_user ON public.dashboard_viste(user_id);
