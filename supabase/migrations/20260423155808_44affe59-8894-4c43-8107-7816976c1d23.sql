CREATE OR REPLACE FUNCTION public.servizi_state_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_client boolean;
BEGIN
  is_client := public.is_client_user(auth.uid());

  IF TG_OP = 'INSERT' THEN
    IF (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL)
       AND NOT is_client AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Explicit confirmation from dashboard must win even if the same auth user
    -- also has access to the client portal.
    IF OLD.modificato_da_cliente = true
       AND NEW.modificato_da_cliente = false
       AND (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL) THEN
      NEW.stato := 'confermato';
      NEW.modificato_at := NULL;
      RETURN NEW;
    END IF;

    IF is_client THEN
      NEW.modificato_da_cliente := true;
      NEW.modificato_at := now();
      IF OLD.stato IN ('confermato','in_corso') THEN
        NEW.stato := 'nuovo';
      END IF;
      RETURN NEW;
    END IF;

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

    IF OLD.modificato_da_cliente = true AND NEW.modificato_da_cliente = OLD.modificato_da_cliente THEN
      NEW.modificato_da_cliente := false;
      NEW.modificato_at := NULL;
      IF NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL THEN
        NEW.stato := 'confermato';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;