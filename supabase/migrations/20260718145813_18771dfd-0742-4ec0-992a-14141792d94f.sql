
CREATE OR REPLACE FUNCTION public.servizi_state_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_client boolean;
  has_driver boolean;
BEGIN
  is_client := public.is_client_user(auth.uid());

  IF TG_OP = 'INSERT' THEN
    IF (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL)
       AND NOT is_client AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'da_confermare';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    has_driver := (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL);

    -- Conferma esplicita dell'operatore: azzera flag modificato_da_cliente e
    -- rispetta lo stato scelto (tipicamente 'confermato').
    IF OLD.modificato_da_cliente = true
       AND NEW.modificato_da_cliente = false THEN
      NEW.modificato_at := NULL;
      RETURN NEW;
    END IF;

    -- Modifica dal portale cliente
    IF is_client THEN
      NEW.modificato_da_cliente := true;
      NEW.modificato_at := now();
      IF OLD.stato IN ('da_confermare','confermato','in_corso') THEN
        IF has_driver THEN
          NEW.stato := 'da_confermare';
        ELSE
          NEW.stato := 'nuovo';
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    -- Operatore: assegnazione autista da 'nuovo' → 'da_confermare'
    IF NEW.autista_id IS NOT NULL
       AND (OLD.autista_id IS NULL OR OLD.autista_id IS DISTINCT FROM NEW.autista_id)
       AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'da_confermare';
    END IF;

    IF NEW.autista_esterno_id IS NOT NULL
       AND (OLD.autista_esterno_id IS NULL OR OLD.autista_esterno_id IS DISTINCT FROM NEW.autista_esterno_id)
       AND NEW.stato = 'nuovo' THEN
      NEW.stato := 'da_confermare';
    END IF;

    -- Se il servizio era modificato_da_cliente e l'operatore fa altre modifiche
    -- (senza toccare esplicitamente il flag), il flag e lo stato restano
    -- invariati finché non premerà "Conferma".

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
