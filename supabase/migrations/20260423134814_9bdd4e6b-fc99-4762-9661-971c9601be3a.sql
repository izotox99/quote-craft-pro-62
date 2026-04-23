-- Add notification flag for client modifications on confirmed services
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS modificato_da_cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modificato_at timestamp with time zone;

-- Trigger function: auto-confirm when autista assigned, revert to nuovo on client edit
CREATE OR REPLACE FUNCTION public.servizi_state_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_client boolean;
BEGIN
  is_client := public.is_client_user(auth.uid());

  IF TG_OP = 'INSERT' THEN
    -- New service: confirmed only if autista already assigned at creation by org member
    IF NEW.autista_id IS NOT NULL AND NOT is_client AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Client modified an existing service: flag + revert to nuovo
    IF is_client THEN
      NEW.modificato_da_cliente := true;
      NEW.modificato_at := now();
      IF OLD.stato IN ('confermato','in_corso') THEN
        NEW.stato := 'nuovo';
      END IF;
      RETURN NEW;
    END IF;

    -- Org member assigned an autista on a "nuovo" service => auto-confirm
    IF NEW.autista_id IS NOT NULL
       AND (OLD.autista_id IS NULL OR OLD.autista_id IS DISTINCT FROM NEW.autista_id)
       AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;

    -- Org member acknowledged the client modification (any update clears flag)
    IF OLD.modificato_da_cliente = true AND NEW.modificato_da_cliente = OLD.modificato_da_cliente THEN
      NEW.modificato_da_cliente := false;
      NEW.modificato_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servizi_state_sync ON public.servizi;
CREATE TRIGGER trg_servizi_state_sync
BEFORE INSERT OR UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.servizi_state_sync();