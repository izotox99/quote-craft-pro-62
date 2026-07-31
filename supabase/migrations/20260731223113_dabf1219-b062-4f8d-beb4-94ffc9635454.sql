CREATE OR REPLACE FUNCTION public.notifica_nuova_comunicazione()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.destinatari = 'singolo' AND NEW.autista_id IS NOT NULL THEN
    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio, autista_id)
    VALUES (NEW.org_id, 'nota_autista',
            'Nuova nota: ' || NEW.titolo,
            left(NEW.testo, 200),
            NEW.autista_id);
  ELSE
    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
    VALUES (NEW.org_id, 'comunicazione',
            'Nuova comunicazione: ' || NEW.titolo,
            left(NEW.testo, 200));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notifica_nuova_comunicazione ON public.comunicazioni;
CREATE TRIGGER trg_notifica_nuova_comunicazione
AFTER INSERT ON public.comunicazioni
FOR EACH ROW EXECUTE FUNCTION public.notifica_nuova_comunicazione();

REVOKE EXECUTE ON FUNCTION public.notifica_nuova_comunicazione() FROM PUBLIC, anon, authenticated;