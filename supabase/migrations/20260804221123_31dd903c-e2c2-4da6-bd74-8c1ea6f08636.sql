CREATE OR REPLACE FUNCTION public.servizi_guard_doppio_invio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.servizi s
    WHERE s.org_id = NEW.org_id
      AND s.created_at > now() - interval '60 seconds'
      AND s.data_servizio = NEW.data_servizio
      AND s.client_id IS NOT DISTINCT FROM NEW.client_id
      AND coalesce(s.ora_inizio,'') = coalesce(NEW.ora_inizio,'')
      AND coalesce(s.contatto,'') = coalesce(NEW.contatto,'')
      AND coalesce(s.luogo_inizio,'') = coalesce(NEW.luogo_inizio,'')
      AND coalesce(s.luogo_fine,'') = coalesce(NEW.luogo_fine,'')
      AND coalesce(s.itinerario,'') = coalesce(NEW.itinerario,'')
  ) THEN
    RAISE EXCEPTION 'Servizio identico già creato pochi secondi fa: doppio invio bloccato';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servizi_guard_doppio_invio ON public.servizi;
CREATE TRIGGER trg_servizi_guard_doppio_invio
BEFORE INSERT ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.servizi_guard_doppio_invio();

REVOKE EXECUTE ON FUNCTION public.servizi_guard_doppio_invio() FROM PUBLIC, anon, authenticated;