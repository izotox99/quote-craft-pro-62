-- Fix servizi_state_sync: prioritize client identity over profile membership.
-- A user with a record in clients.auth_user_id must always be treated as a client
-- when modifying their own services, even if they also appear in profiles.
CREATE OR REPLACE FUNCTION public.servizi_state_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_client boolean;
BEGIN
  -- A user is acting as a client if they own a client record
  is_client := public.is_client_user(auth.uid());

  IF TG_OP = 'INSERT' THEN
    IF (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL)
       AND NOT is_client AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF is_client THEN
      -- Client edited the service: flag it and reset state so org must re-confirm
      NEW.modificato_da_cliente := true;
      NEW.modificato_at := now();
      IF OLD.stato IN ('confermato','in_corso') THEN
        NEW.stato := 'nuovo';
      END IF;
      RETURN NEW;
    END IF;

    -- Org member assigning a driver auto-confirms
    IF NEW.autista_id IS NOT NULL
       AND (OLD.autista_id IS NULL OR OLD.autista_id IS DISTINCT FROM NEW.autista_id)
       AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;

    IF NEW.autista_esterno_id IS NOT NULL
       AND (OLD.autista_esterno_id IS NULL OR OLD.autista_esterno_id IS DISTINCT FROM NEW.autista_esterno_id)
       AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;

    -- Clear "modified by client" flag when org saves an update
    IF OLD.modificato_da_cliente = true AND NEW.modificato_da_cliente = OLD.modificato_da_cliente THEN
      NEW.modificato_da_cliente := false;
      NEW.modificato_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;