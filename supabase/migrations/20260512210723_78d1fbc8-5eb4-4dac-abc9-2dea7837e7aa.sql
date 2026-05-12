DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'veicoli','clients','servizi','autisti','autisti_esterni','autisti_spese',
    'fornitori_cs','templates','proposals','passeggeri_rubrica'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS enforce_org_id ON public.%I', t);
      EXECUTE format('CREATE TRIGGER enforce_org_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id()', t);
    END IF;
  END LOOP;
END $$;