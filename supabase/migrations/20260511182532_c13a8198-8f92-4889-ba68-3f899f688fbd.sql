
-- 1) Rimuovere i default condivisi che causavano il mix di dati
ALTER TABLE public.profiles ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.clients ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.servizi ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.veicoli ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.autisti ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.autisti_esterni ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.autisti_spese ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.fornitori_cs ALTER COLUMN org_id DROP DEFAULT;
ALTER TABLE public.proposals ALTER COLUMN org_id DROP DEFAULT;

-- 2) Pulire utenti cliente/utenza che per errore hanno profilo/ruolo NCC
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT auth_user_id FROM public.clients WHERE auth_user_id IS NOT NULL
  UNION
  SELECT auth_user_id FROM public.client_utenze WHERE auth_user_id IS NOT NULL
);
DELETE FROM public.profiles
WHERE user_id IN (
  SELECT auth_user_id FROM public.clients WHERE auth_user_id IS NOT NULL
  UNION
  SELECT auth_user_id FROM public.client_utenze WHERE auth_user_id IS NOT NULL
);

-- 3) Backfill: assegnare i dati esistenti all'admin originale e dare a ogni altro NCC la sua org
DO $$
DECLARE
  r record;
  v_org_id uuid;
  v_admin uuid;
BEGIN
  SELECT ur.user_id INTO v_admin
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_admin IS NOT NULL THEN
    INSERT INTO public.organizations (name) VALUES ('NCC Principale') RETURNING id INTO v_org_id;
    UPDATE public.profiles SET org_id = v_org_id WHERE user_id = v_admin;

    UPDATE public.clients          SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.servizi          SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.veicoli          SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.autisti          SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.autisti_esterni  SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.autisti_spese    SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.fornitori_cs     SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.proposals        SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.templates        SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001' AND is_default = false;
    UPDATE public.notifiche        SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.passeggeri_rubrica SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
    UPDATE public.servizi_modifiche  SET org_id = v_org_id WHERE org_id = '00000000-0000-0000-0000-000000000001';
  END IF;

  -- Ogni altro membro ancora sull'org condivisa riceve la propria org vuota
  FOR r IN
    SELECT user_id FROM public.profiles WHERE org_id = '00000000-0000-0000-0000-000000000001'
  LOOP
    INSERT INTO public.organizations (name)
    VALUES ('NCC ' || substring(r.user_id::text, 1, 8))
    RETURNING id INTO v_org_id;
    UPDATE public.profiles SET org_id = v_org_id WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 4) handle_new_user: creare una nuova org per ogni nuovo account NCC; saltare per i clienti
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_client boolean;
  v_org_id uuid;
  v_org_name text;
BEGIN
  v_is_client := COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'client';

  IF v_is_client THEN
    RETURN NEW;
  END IF;

  v_org_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'company_name', '')), '');
  IF v_org_name IS NULL THEN
    v_org_name := COALESCE(split_part(NEW.email, '@', 1), 'NCC');
  END IF;

  INSERT INTO public.organizations (name) VALUES (v_org_name) RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (user_id, org_id) VALUES (NEW.id, v_org_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$;

-- 5) Trigger di guardia: l'org_id di ogni record viene forzato a quello dell'utente NCC che esegue l'operazione
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
  -- Se non è un membro NCC (es. cliente dal portale), lasciamo che le RLS lato cliente decidano
  IF v_user_org IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.org_id IS NULL OR NEW.org_id <> v_user_org THEN
    NEW.org_id := v_user_org;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','servizi','veicoli','autisti','autisti_esterni',
    'autisti_spese','fornitori_cs','templates','proposals','passeggeri_rubrica'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_user_org_id_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER enforce_user_org_id_trg BEFORE INSERT OR UPDATE OF org_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id()', t);
  END LOOP;
END $$;
