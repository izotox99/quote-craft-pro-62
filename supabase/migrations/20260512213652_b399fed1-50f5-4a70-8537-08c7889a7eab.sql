-- Fix NCC user that was incorrectly skipped from backfill because their auth_user_id
-- was linked to a client record. Create org/profile/role for the NCC user.
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
    LEFT JOIN public.client_utenze cu ON cu.auth_user_id = au.id AND cu.attivo = true
    WHERE p.user_id IS NULL
      AND cu.id IS NULL
      AND COALESCE(au.raw_user_meta_data->>'account_type','') <> 'client'
      AND au.email NOT LIKE 'utenza+%@portal.local'
  LOOP
    v_org_name := NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'company_name','')),'');
    IF v_org_name IS NULL THEN
      v_org_name := NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'full_name','')),'');
    END IF;
    IF v_org_name IS NULL THEN
      v_org_name := COALESCE(split_part(u.email,'@',1),'NCC');
    END IF;

    INSERT INTO public.organizations(name) VALUES (v_org_name) RETURNING id INTO v_org_id;
    INSERT INTO public.profiles(user_id, org_id) VALUES (u.id, v_org_id);
    INSERT INTO public.user_roles(user_id, role) VALUES (u.id, 'admin') ON CONFLICT DO NOTHING;

    -- Unlink any client record incorrectly tied to this NCC owner's auth account.
    UPDATE public.clients SET auth_user_id = NULL WHERE auth_user_id = u.id;
  END LOOP;
END $$;