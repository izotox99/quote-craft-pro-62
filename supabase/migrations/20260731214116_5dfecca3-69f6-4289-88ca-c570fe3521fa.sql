CREATE OR REPLACE FUNCTION public.enforce_user_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_org uuid;
BEGIN
  IF current_setting('app.network_managed', true) = 'on' THEN
    RETURN NEW;
  END IF;

  v_user_org := COALESCE(
    public.get_user_org_id(auth.uid()),
    public.get_autista_org_id(auth.uid())
  );

  IF v_user_org IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.org_id := v_user_org;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_vehicle_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_org uuid;
  v_autista_org uuid;
BEGIN
  v_user_org := public.get_user_org_id(auth.uid());

  IF v_user_org IS NOT NULL THEN
    NEW.org_id := v_user_org;
    RETURN NEW;
  END IF;

  v_autista_org := public.get_autista_org_id(auth.uid());

  IF v_autista_org IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.org_id IS DISTINCT FROM v_autista_org THEN
        RAISE EXCEPTION 'Veicolo non appartenente alla tua azienda' USING ERRCODE = '42501';
      END IF;
      NEW.org_id := OLD.org_id;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Non autorizzato a creare veicoli' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Account NCC non configurato: profilo aziendale mancante'
    USING ERRCODE = '42501';
END;
$function$;