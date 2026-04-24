CREATE OR REPLACE FUNCTION public.notify_servizio_client_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_client boolean;
  client_nome text;
  utenza_nome text;
  v_utenza_id uuid;
BEGIN
  IF current_setting('app.client_portal_managed', true) = 'on' THEN
    RETURN NEW;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.log_servizi_client_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_client boolean;
  fields text[] := ARRAY[
    'data_servizio','ora_inizio','citta','tipologia','transfer_tipo','disposizione_oraria',
    'tour_tipo','luogo_inizio','luogo_fine','itinerario','veicolo_tipo','n_passeggeri',
    'n_bagagli','info_autista','tipo_pagamento','centro_costo','accessori','note','allegato_nome'
  ];
  f text;
  old_v text;
  new_v text;
BEGIN
  IF current_setting('app.client_portal_managed', true) = 'on' THEN
    RETURN NEW;
  END IF;

  is_client := public.is_client_user(auth.uid());
  IF NOT is_client THEN
    RETURN NEW;
  END IF;

  FOREACH f IN ARRAY fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f)
      INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.servizi_modifiche(servizio_id, org_id, changed_by, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.org_id, auth.uid(), f, old_v, new_v);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.client_portal_update_servizio(
  _servizio_id uuid,
  _data_servizio date DEFAULT NULL,
  _ora_inizio text DEFAULT NULL,
  _citta text DEFAULT NULL,
  _n_passeggeri integer DEFAULT NULL,
  _n_bagagli integer DEFAULT NULL,
  _tipologia public.servizio_tipologia DEFAULT NULL,
  _transfer_tipo text DEFAULT NULL,
  _disposizione_oraria text DEFAULT NULL,
  _tour_tipo text DEFAULT NULL,
  _veicolo_tipo text DEFAULT NULL,
  _luogo_inizio text DEFAULT NULL,
  _luogo_fine text DEFAULT NULL,
  _itinerario text DEFAULT NULL,
  _info_autista text DEFAULT NULL,
  _tipo_pagamento text DEFAULT NULL,
  _centro_costo text DEFAULT NULL,
  _accessori text DEFAULT NULL,
  _note text DEFAULT NULL,
  _allegato_path text DEFAULT NULL,
  _allegato_nome text DEFAULT NULL,
  _cancel boolean DEFAULT false
)
RETURNS public.servizi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old public.servizi%ROWTYPE;
  v_new public.servizi%ROWTYPE;
  v_client_nome text;
  v_utenza_id uuid;
  v_utenza_nome text;
  v_changed_fields text[] := ARRAY[]::text[];
  v_field text;
  v_old_text text;
  v_new_text text;
  v_fields text[] := ARRAY[
    'data_servizio','ora_inizio','citta','tipologia','transfer_tipo','disposizione_oraria',
    'tour_tipo','luogo_inizio','luogo_fine','itinerario','veicolo_tipo','n_passeggeri',
    'n_bagagli','info_autista','tipo_pagamento','centro_costo','accessori','note','allegato_nome'
  ];
  v_summary text;
BEGIN
  SELECT * INTO v_old
  FROM public.servizi
  WHERE id = _servizio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servizio non trovato';
  END IF;

  IF NOT public.is_client_user(auth.uid()) THEN
    RAISE EXCEPTION 'Operazione consentita solo dal portale cliente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_utenze u
    WHERE u.auth_user_id = auth.uid()
      AND u.attivo = true
      AND u.parent_client_id = v_old.client_id
      AND (u.tipo = 'gruppo' OR (u.tipo = 'singolo' AND v_old.utenza_id = u.id))
  ) OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.auth_user_id = auth.uid()
      AND c.id = v_old.client_id
  ) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Non autorizzato per questo servizio';
  END IF;

  PERFORM set_config('app.client_portal_managed', 'on', true);

  UPDATE public.servizi
  SET
    data_servizio = COALESCE(_data_servizio, data_servizio),
    ora_inizio = _ora_inizio,
    citta = _citta,
    n_passeggeri = _n_passeggeri,
    n_bagagli = _n_bagagli,
    tipologia = _tipologia,
    transfer_tipo = CASE WHEN _tipologia = 'transfer' THEN _transfer_tipo ELSE NULL END,
    disposizione_oraria = CASE WHEN _tipologia = 'disposizione' THEN _disposizione_oraria ELSE NULL END,
    tour_tipo = CASE WHEN _tipologia = 'tour' THEN _tour_tipo ELSE NULL END,
    veicolo_tipo = _veicolo_tipo,
    luogo_inizio = _luogo_inizio,
    luogo_fine = _luogo_fine,
    itinerario = _itinerario,
    info_autista = _info_autista,
    tipo_pagamento = _tipo_pagamento,
    centro_costo = _centro_costo,
    accessori = _accessori,
    note = _note,
    allegato_path = COALESCE(_allegato_path, allegato_path),
    allegato_nome = _allegato_nome,
    modificato_da_cliente = true,
    modificato_at = now(),
    stato = CASE WHEN _cancel THEN 'annullato'::public.servizio_stato ELSE 'nuovo'::public.servizio_stato END
  WHERE id = _servizio_id
  RETURNING * INTO v_new;

  FOREACH v_field IN ARRAY v_fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field)
      INTO v_old_text, v_new_text USING v_old, v_new;

    IF v_old_text IS DISTINCT FROM v_new_text THEN
      v_changed_fields := array_append(v_changed_fields, v_field);
      INSERT INTO public.servizi_modifiche(servizio_id, org_id, changed_by, field_name, old_value, new_value)
      VALUES (v_new.id, v_new.org_id, auth.uid(), v_field, v_old_text, v_new_text);
    END IF;
  END LOOP;

  SELECT name INTO v_client_nome FROM public.clients WHERE id = v_new.client_id;
  v_utenza_id := public.get_active_utenza_id(auth.uid());
  IF v_utenza_id IS NOT NULL THEN
    SELECT (nome || ' ' || cognome) INTO v_utenza_nome FROM public.client_utenze WHERE id = v_utenza_id;
  END IF;

  IF _cancel AND v_old.stato IS DISTINCT FROM 'annullato' THEN
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id, client_id, utenza_id)
    VALUES (
      v_new.org_id,
      'servizio_annullato',
      'Servizio annullato da ' || COALESCE(v_client_nome, 'cliente'),
      'Servizio del ' || to_char(v_new.data_servizio, 'DD/MM/YYYY') || COALESCE(' (' || v_new.luogo_inizio || ')', '') || ' è stato annullato.',
      v_new.id, v_new.client_id, v_utenza_id
    );

    RETURN v_new;
  END IF;

  IF array_length(v_changed_fields, 1) > 0 THEN
    SELECT string_agg(
      CASE field_name
        WHEN 'data_servizio' THEN 'Data'
        WHEN 'ora_inizio' THEN 'Ora'
        WHEN 'citta' THEN 'Città'
        WHEN 'tipologia' THEN 'Tipologia'
        WHEN 'transfer_tipo' THEN 'Tipo transfer'
        WHEN 'disposizione_oraria' THEN 'Disposizione'
        WHEN 'tour_tipo' THEN 'Tipo tour'
        WHEN 'luogo_inizio' THEN 'Luogo inizio'
        WHEN 'luogo_fine' THEN 'Luogo fine'
        WHEN 'itinerario' THEN 'Itinerario'
        WHEN 'veicolo_tipo' THEN 'Veicolo'
        WHEN 'n_passeggeri' THEN 'Passeggeri'
        WHEN 'n_bagagli' THEN 'Bagagli'
        WHEN 'info_autista' THEN 'Info autista'
        WHEN 'tipo_pagamento' THEN 'Pagamento'
        WHEN 'centro_costo' THEN 'Centro di costo'
        WHEN 'accessori' THEN 'Accessori'
        WHEN 'note' THEN 'Note'
        WHEN 'allegato_nome' THEN 'Allegato'
        ELSE field_name
      END,
      ', ' ORDER BY array_position(v_changed_fields, field_name)
    ) INTO v_summary
    FROM unnest(v_changed_fields) AS field_name;

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id, client_id, utenza_id)
    VALUES (
      v_new.org_id,
      'servizio_modificato',
      'Servizio modificato da ' || COALESCE(v_client_nome, 'cliente'),
      COALESCE(v_utenza_nome || ' ha modificato: ', 'Modifiche: ') || COALESCE(v_summary, 'dettagli servizio'),
      v_new.id, v_new.client_id, v_utenza_id
    );
  END IF;

  RETURN v_new;
END;
$function$;