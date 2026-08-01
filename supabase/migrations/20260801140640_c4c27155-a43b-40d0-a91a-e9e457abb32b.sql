CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_account_type text;
  v_org_id uuid;
  v_org_name text;
BEGIN
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', '');

  IF v_account_type IN ('client', 'autista', 'org_member') THEN
    RETURN NEW;
  END IF;

  v_org_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'company_name', '')), '');
  IF v_org_name IS NULL THEN
    v_org_name := COALESCE(split_part(NEW.email, '@', 1), 'NCC');
  END IF;

  INSERT INTO public.organizations (name, owner_user_id) VALUES (v_org_name, NEW.id) RETURNING id INTO v_org_id;
  INSERT INTO public.profiles (user_id, org_id) VALUES (NEW.id, v_org_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$function$;