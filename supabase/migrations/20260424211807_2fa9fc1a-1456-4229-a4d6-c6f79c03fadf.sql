
-- Estensioni per cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Tabella notifiche
CREATE TABLE public.notifiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  tipo text NOT NULL, -- 'servizio_annullato' | 'servizio_modificato' | 'servizio_creato'
  titolo text NOT NULL,
  messaggio text,
  servizio_id uuid REFERENCES public.servizi(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  utenza_id uuid REFERENCES public.client_utenze(id) ON DELETE SET NULL,
  letta boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifiche_org_created ON public.notifiche(org_id, created_at DESC);
CREATE INDEX idx_notifiche_letta ON public.notifiche(org_id, letta) WHERE letta = false;

ALTER TABLE public.notifiche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view notifiche"
ON public.notifiche FOR SELECT TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members update notifiche"
ON public.notifiche FOR UPDATE TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members delete notifiche"
ON public.notifiche FOR DELETE TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

-- Trigger: crea notifica quando un cliente modifica/annulla un servizio
CREATE OR REPLACE FUNCTION public.notify_servizio_client_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_client boolean;
  client_nome text;
  utenza_nome text;
  v_utenza_id uuid;
BEGIN
  is_client := public.is_client_user(auth.uid());
  IF NOT is_client THEN
    RETURN NEW;
  END IF;

  SELECT name INTO client_nome FROM public.clients WHERE id = NEW.client_id;
  v_utenza_id := public.get_active_utenza_id(auth.uid());
  IF v_utenza_id IS NOT NULL THEN
    SELECT (nome || ' ' || cognome) INTO utenza_nome FROM public.client_utenze WHERE id = v_utenza_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id, client_id, utenza_id)
    VALUES (
      NEW.org_id,
      'servizio_creato',
      'Nuovo servizio da ' || COALESCE(client_nome, 'cliente'),
      COALESCE(utenza_nome || ' ha ', '') || 'creato un servizio per il ' || to_char(NEW.data_servizio, 'DD/MM/YYYY'),
      NEW.id, NEW.client_id, v_utenza_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stato IS DISTINCT FROM NEW.stato AND NEW.stato = 'annullato' THEN
      INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id, client_id, utenza_id)
      VALUES (
        NEW.org_id,
        'servizio_annullato',
        'Servizio annullato da ' || COALESCE(client_nome, 'cliente'),
        'Servizio del ' || to_char(NEW.data_servizio, 'DD/MM/YYYY') || COALESCE(' (' || NEW.luogo_inizio || ')', '') || ' è stato annullato.',
        NEW.id, NEW.client_id, v_utenza_id
      );
    ELSIF OLD.stato IS NOT DISTINCT FROM NEW.stato THEN
      -- modifica generica (stato non cambiato, qualcosa è cambiato lato cliente)
      INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id, client_id, utenza_id)
      VALUES (
        NEW.org_id,
        'servizio_modificato',
        'Servizio modificato da ' || COALESCE(client_nome, 'cliente'),
        'Servizio del ' || to_char(NEW.data_servizio, 'DD/MM/YYYY') || ' è stato modificato.',
        NEW.id, NEW.client_id, v_utenza_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_servizio_client_insert
AFTER INSERT ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.notify_servizio_client_change();

CREATE TRIGGER trg_notify_servizio_client_update
AFTER UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.notify_servizio_client_change();

-- Pulizia: elimina servizi annullati > 7 giorni e notifiche orfane > 30 giorni
CREATE OR REPLACE FUNCTION public.cleanup_servizi_annullati()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.servizi
  WHERE stato = 'annullato'
    AND COALESCE(modificato_at, updated_at) < now() - interval '7 days';

  DELETE FROM public.notifiche
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- Schedule giornaliero
SELECT cron.schedule(
  'cleanup-servizi-annullati-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_servizi_annullati(); $$
);
