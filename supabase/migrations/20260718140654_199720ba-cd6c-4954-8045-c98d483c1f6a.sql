
-- servizi_state_sync: assegnazione autista → 'da_confermare' (non più 'confermato')
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
      NEW.stato := 'da_confermare';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Explicit confirmation from dashboard must win even if the same auth user
    -- also has access to the client portal.
    IF OLD.modificato_da_cliente = true
       AND NEW.modificato_da_cliente = false
       AND (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL) THEN
      -- l'operatore riprende in mano il servizio: torna a da_confermare
      -- (la conferma esplicita sarà un secondo click)
      IF NEW.stato NOT IN ('confermato','in_corso','completato','annullato') THEN
        NEW.stato := 'da_confermare';
      END IF;
      NEW.modificato_at := NULL;
      RETURN NEW;
    END IF;

    IF is_client THEN
      NEW.modificato_da_cliente := true;
      NEW.modificato_at := now();
      IF OLD.stato IN ('da_confermare','confermato','in_corso') THEN
        NEW.stato := 'nuovo';
      END IF;
      RETURN NEW;
    END IF;

    -- Assegnazione autista da dashboard → da_confermare
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

    IF OLD.modificato_da_cliente = true AND NEW.modificato_da_cliente = OLD.modificato_da_cliente THEN
      NEW.modificato_da_cliente := false;
      NEW.modificato_at := NULL;
      IF NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL THEN
        IF NEW.stato NOT IN ('confermato','in_corso','completato','annullato') THEN
          NEW.stato := 'da_confermare';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- network_sync_b_to_a: sync verso A solo alla CONFERMA di B (transizione a 'confermato')
CREATE OR REPLACE FUNCTION public.network_sync_b_to_a()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dispatch public.servizi_network%ROWTYPE;
  v_nome text;
  v_tel  text;
  v_targa text;
  v_had_driver boolean;
  v_has_driver boolean;
  v_confirmed_now boolean;
  v_unconfirmed_now boolean;
BEGIN
  IF current_setting('app.network_managed', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_dispatch FROM public.servizi_network
   WHERE servizio_b_id = NEW.id AND stato IN ('inviato','accettato')
   LIMIT 1;
  IF v_dispatch.id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.network_managed','on',true);

  -- Annullamento lato B
  IF NEW.stato = 'annullato' AND OLD.stato IS DISTINCT FROM 'annullato' THEN
    UPDATE public.servizi
       SET fornitore_cs_id = NULL,
           stato = 'nuovo',
           network_autista_nome = NULL,
           network_autista_telefono = NULL,
           network_autista_targa = NULL
     WHERE id = v_dispatch.servizio_a_id;
    UPDATE public.servizi_network SET stato='rifiutato', responded_at=now()
     WHERE id = v_dispatch.id;
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_dispatch.org_a, 'network_servizio_rifiutato',
      'Servizio annullato dal partner',
      'Il partner ha annullato il servizio inviato al network.',
      v_dispatch.servizio_a_id);
    RETURN NEW;
  END IF;

  v_had_driver := (OLD.autista_id IS NOT NULL OR OLD.autista_esterno_id IS NOT NULL);
  v_has_driver := (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL);

  -- Rimozione autista lato B → svuota su A
  IF v_had_driver AND NOT v_has_driver THEN
    UPDATE public.servizi
       SET stato = 'nuovo',
           network_autista_nome = NULL,
           network_autista_telefono = NULL,
           network_autista_targa = NULL
     WHERE id = v_dispatch.servizio_a_id;

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_dispatch.org_a, 'network_autista_rimosso',
      'Autista partner rimosso',
      'Il partner ha rimosso l''autista dal servizio inviato al network.',
      v_dispatch.servizio_a_id);
    RETURN NEW;
  END IF;

  -- Conferma esplicita di B: transizione stato a 'confermato' con autista presente
  v_confirmed_now := (NEW.stato = 'confermato' AND OLD.stato IS DISTINCT FROM 'confermato' AND v_has_driver);
  -- Rimozione conferma lato B (torna a da_confermare o nuovo): svuota dati autista su A
  v_unconfirmed_now := (OLD.stato = 'confermato' AND NEW.stato IS DISTINCT FROM 'confermato'
                        AND NEW.stato NOT IN ('completato','annullato'));

  IF v_confirmed_now THEN
    IF NEW.autista_id IS NOT NULL THEN
      SELECT trim(coalesce(a.nome,'') || ' ' || coalesce(a.cognome,'')), a.cellulare
        INTO v_nome, v_tel
        FROM public.autisti a WHERE a.id = NEW.autista_id;
      IF NEW.veicolo_id IS NOT NULL THEN
        SELECT v.targa INTO v_targa FROM public.veicoli v WHERE v.id = NEW.veicolo_id;
      ELSE
        v_targa := NULL;
      END IF;
    ELSE
      SELECT ae.nome, ae.cellulare, ae.targa
        INTO v_nome, v_tel, v_targa
        FROM public.autisti_esterni ae WHERE ae.id = NEW.autista_esterno_id;
    END IF;

    UPDATE public.servizi
       SET stato = 'confermato',
           network_autista_nome = v_nome,
           network_autista_telefono = v_tel,
           network_autista_targa = v_targa
     WHERE id = v_dispatch.servizio_a_id
       AND stato IN ('nuovo','da_confermare','confermato');

    IF v_dispatch.stato = 'inviato' THEN
      UPDATE public.servizi_network SET stato='accettato', responded_at=now()
       WHERE id = v_dispatch.id;
    END IF;

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_dispatch.org_a, 'network_autista_assegnato',
      'Autista partner confermato',
      'Il partner ha confermato ' || COALESCE(v_nome, 'un autista') ||
        CASE WHEN v_targa IS NOT NULL THEN ' (' || v_targa || ')' ELSE '' END ||
        ' per il servizio inviato al network.',
      v_dispatch.servizio_a_id);
  ELSIF v_unconfirmed_now THEN
    -- B ha tolto la conferma: A torna a 'nuovo' senza dati autista
    UPDATE public.servizi
       SET stato = 'nuovo',
           network_autista_nome = NULL,
           network_autista_telefono = NULL,
           network_autista_targa = NULL
     WHERE id = v_dispatch.servizio_a_id
       AND stato = 'confermato';

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_dispatch.org_a, 'network_autista_rimosso',
      'Conferma partner ritirata',
      'Il partner ha ritirato la conferma del servizio inviato al network.',
      v_dispatch.servizio_a_id);
  END IF;

  RETURN NEW;
END;
$function$;
