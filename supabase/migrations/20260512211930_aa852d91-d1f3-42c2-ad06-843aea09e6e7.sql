DO $$
DECLARE
  v_user record;
  v_org_id uuid;
  v_org_name text;
BEGIN
  FOR v_user IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.auth_user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.client_utenze cu WHERE cu.auth_user_id = u.id
    )
    AND COALESCE(u.raw_user_meta_data->>'account_type', '') <> 'client'
    AND COALESCE(u.email, '') NOT LIKE 'utenza+%@portal.local'
  LOOP
    v_org_name := NULLIF(TRIM(COALESCE(v_user.raw_user_meta_data->>'company_name', '')), '');
    IF v_org_name IS NULL THEN
      v_org_name := COALESCE(split_part(v_user.email, '@', 1), 'NCC');
    END IF;

    INSERT INTO public.organizations (name)
    VALUES (v_org_name)
    RETURNING id INTO v_org_id;

    INSERT INTO public.profiles (user_id, org_id)
    VALUES (v_user.id, v_org_id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;

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
CREATE TRIGGER enforce_org_id
BEFORE INSERT OR UPDATE ON public.veicoli
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_org_id();

DROP POLICY IF EXISTS "Org members can insert veicoli" ON public.veicoli;
CREATE POLICY "Org members can insert veicoli"
ON public.veicoli
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_org_id(auth.uid()) IS NOT NULL
  AND org_id = public.get_user_org_id(auth.uid())
);