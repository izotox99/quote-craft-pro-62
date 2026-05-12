CREATE OR REPLACE FUNCTION public.enforce_user_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_org uuid;
BEGIN
  v_user_org := public.get_user_org_id(auth.uid());

  -- Gli utenti non NCC (clienti/utenze portale) sono gestiti dalle loro RLS specifiche.
  IF v_user_org IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.org_id := v_user_org;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_vehicle_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_org uuid;
BEGIN
  v_user_org := public.get_user_org_id(auth.uid());

  IF v_user_org IS NULL THEN
    RAISE EXCEPTION 'Account NCC non configurato: profilo aziendale mancante'
      USING ERRCODE = '42501';
  END IF;

  NEW.org_id := v_user_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_org_id ON public.veicoli;
DROP TRIGGER IF EXISTS enforce_user_org_id_trg ON public.veicoli;
CREATE TRIGGER enforce_vehicle_org_id_trg
BEFORE INSERT OR UPDATE ON public.veicoli
FOR EACH ROW
EXECUTE FUNCTION public.enforce_vehicle_org_id();

DROP POLICY IF EXISTS "Org members can insert veicoli" ON public.veicoli;
CREATE POLICY "Org members can insert veicoli"
ON public.veicoli
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_org_id(auth.uid()) IS NOT NULL
  AND org_id = public.get_user_org_id(auth.uid())
);