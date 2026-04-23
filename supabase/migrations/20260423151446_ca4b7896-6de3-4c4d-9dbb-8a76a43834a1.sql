-- Add external driver reference to servizi
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS autista_esterno_id uuid REFERENCES public.autisti_esterni(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_servizi_autista_esterno_id ON public.servizi(autista_esterno_id);

-- Update state-sync trigger to also auto-confirm when an external driver is assigned
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
    IF is_client THEN
      NEW.modificato_da_cliente := true;
      NEW.modificato_at := now();
      IF OLD.stato IN ('confermato','in_corso') THEN
        NEW.stato := 'nuovo';
      END IF;
      RETURN NEW;
    END IF;

    -- Auto-confirm when an internal driver is newly assigned
    IF NEW.autista_id IS NOT NULL
       AND (OLD.autista_id IS NULL OR OLD.autista_id IS DISTINCT FROM NEW.autista_id)
       AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;

    -- Auto-confirm when an external driver is newly assigned
    IF NEW.autista_esterno_id IS NOT NULL
       AND (OLD.autista_esterno_id IS NULL OR OLD.autista_esterno_id IS DISTINCT FROM NEW.autista_esterno_id)
       AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'confermato';
    END IF;

    IF OLD.modificato_da_cliente = true AND NEW.modificato_da_cliente = OLD.modificato_da_cliente THEN
      NEW.modificato_da_cliente := false;
      NEW.modificato_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;