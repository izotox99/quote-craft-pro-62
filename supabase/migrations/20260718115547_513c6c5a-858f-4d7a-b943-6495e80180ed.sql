
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS network_autista_nome text,
  ADD COLUMN IF NOT EXISTS network_autista_telefono text,
  ADD COLUMN IF NOT EXISTS network_autista_targa text;

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

  -- Annullamento lato B: pulisci fornitore/autista partner sul servizio A
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

  -- Rimozione autista lato B: svuota campi sul servizio A e torna a 'nuovo'
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

  -- Assegnazione/cambio autista lato B
  IF v_has_driver
     AND (OLD.autista_id IS DISTINCT FROM NEW.autista_id
          OR OLD.autista_esterno_id IS DISTINCT FROM NEW.autista_esterno_id) THEN

    IF NEW.autista_id IS NOT NULL THEN
      SELECT trim(coalesce(a.nome,'') || ' ' || coalesce(a.cognome,'')),
             a.cellulare
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
       AND stato IN ('nuovo','confermato');

    IF v_dispatch.stato = 'inviato' THEN
      UPDATE public.servizi_network SET stato='accettato', responded_at=now()
       WHERE id = v_dispatch.id;
    END IF;

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_dispatch.org_a, 'network_autista_assegnato',
      'Autista partner assegnato',
      'Il partner ha assegnato ' || COALESCE(v_nome, 'un autista') ||
        CASE WHEN v_targa IS NOT NULL THEN ' (' || v_targa || ')' ELSE '' END ||
        ' al servizio inviato al network.',
      v_dispatch.servizio_a_id);
  END IF;

  RETURN NEW;
END $function$;
