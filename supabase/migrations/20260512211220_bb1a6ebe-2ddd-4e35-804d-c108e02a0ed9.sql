DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for NCC users (skip portal client utenze)
DO $$
DECLARE
  u RECORD;
  v_org_id uuid;
  v_org_name text;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.user_id IS NULL
      AND COALESCE(au.raw_user_meta_data->>'account_type','') <> 'client'
      AND au.email NOT LIKE 'utenza+%@portal.local'
      AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.auth_user_id = au.id)
      AND NOT EXISTS (SELECT 1 FROM public.client_utenze cu WHERE cu.auth_user_id = au.id)
  LOOP
    v_org_name := NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'company_name','')), '');
    IF v_org_name IS NULL THEN
      v_org_name := COALESCE(split_part(u.email,'@',1),'NCC');
    END IF;
    INSERT INTO public.organizations(name) VALUES (v_org_name) RETURNING id INTO v_org_id;
    INSERT INTO public.profiles(user_id, org_id) VALUES (u.id, v_org_id);
    INSERT INTO public.user_roles(user_id, role) VALUES (u.id, 'admin') ON CONFLICT DO NOTHING;
  END LOOP;
END $$;