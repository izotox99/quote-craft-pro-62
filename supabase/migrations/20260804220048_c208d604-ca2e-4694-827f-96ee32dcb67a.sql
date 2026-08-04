ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS cartello_path text,
  ADD COLUMN IF NOT EXISTS cartello_nome text;

DROP VIEW IF EXISTS public.servizi_autista_view;
CREATE VIEW public.servizi_autista_view
WITH (security_invoker = true) AS
  SELECT id, org_id, data_servizio, ora_inizio, citta, luogo_inizio, luogo_fine, itinerario,
    stato, stato_autista, tipologia, transfer_tipo, disposizione_oraria, tour_tipo, veicolo_tipo,
    veicolo_id, autista_id, contatto, telefono_contatto, telefono_d, email_contatto,
    n_passeggeri, n_bagagli, accessori, info_autista, info_cliente_autista, note, codice, foglio,
    cartello, cartello_path, cartello_nome, tipo_pagamento, allegato_path, allegato_nome,
    con_guida, con_assistente, ritirare_voucher, permesso_effettuato,
    modificato_da_cliente, modificato_at, transfer_concluso_at, transfer_nota_chiusura,
    dispo_conclusa_at, dispo_nota_chiusura, km_inizio_servizio, km_fine_servizio,
    network_autista_nome, network_autista_telefono, network_autista_targa, created_at, updated_at
  FROM public.servizi_autista_rows();

REVOKE ALL ON public.servizi_autista_view FROM anon, authenticated;
GRANT SELECT ON public.servizi_autista_view TO authenticated;

DROP POLICY IF EXISTS "Autisti view servizi allegati" ON storage.objects;
CREATE POLICY "Autisti view servizi allegati"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND public.is_autista_user(auth.uid())
  AND (storage.foldername(name))[1] = (public.get_autista_org_id(auth.uid()))::text
);

DROP FUNCTION IF EXISTS public.client_portal_update_servizio(uuid, date, text, text, integer, integer, servizio_tipologia, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, jsonb);

CREATE OR REPLACE FUNCTION public.client_portal_update_servizio(_servizio_id uuid, _data_servizio date DEFAULT NULL::date, _ora_inizio text DEFAULT NULL::text, _citta text DEFAULT NULL::text, _n_passeggeri integer DEFAULT NULL::integer, _n_bagagli integer DEFAULT NULL::integer, _tipologia servizio_tipologia DEFAULT NULL::servizio_tipologia, _transfer_tipo text DEFAULT NULL::text, _disposizione_oraria text DEFAULT NULL::text, _tour_tipo text DEFAULT NULL::text, _veicolo_tipo text DEFAULT NULL::text, _luogo_inizio text DEFAULT NULL::text, _luogo_fine text DEFAULT NULL::text, _itinerario text DEFAULT NULL::text, _info_autista text DEFAULT NULL::text, _tipo_pagamento text DEFAULT NULL::text, _centro_costo text DEFAULT NULL::text, _accessori text DEFAULT NULL::text, _note text DEFAULT NULL::text, _allegato_path text DEFAULT NULL::text, _allegato_nome text DEFAULT NULL::text, _remove_allegato boolean DEFAULT false, _cancel boolean DEFAULT false, _accessori_items jsonb DEFAULT NULL::jsonb, _cartello_path text DEFAULT NULL::text, _cartello_nome text DEFAULT NULL::text, _remove_cartello boolean DEFAULT false)
 RETURNS servizi
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
    'n_bagagli','info_autista','tipo_pagamento','centro_costo','accessori','note','allegato_nome','cartello_nome'
  ];
  v_summary text;
  v_old_accessori jsonb;
  v_new_accessori jsonb;
  v_new_stato public.servizio_stato;
  v_has_driver boolean;
BEGIN
  SELECT * INTO v_old FROM public.servizi WHERE id = _servizio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Servizio non trovato';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.client_utenze u
    WHERE u.auth_user_id = auth.uid() AND u.attivo = true
      AND u.parent_client_id = v_old.client_id
      AND (u.tipo = 'gruppo' OR (u.tipo = 'singolo' AND v_old.utenza_id = u.id))
  ) OR EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.auth_user_id = auth.uid() AND c.id = v_old.client_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.org_id = v_old.org_id
  ) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Non autorizzato per questo servizio';
  END IF;

  PERFORM set_config('app.client_portal_managed', 'on', true);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'accessorio_id', accessorio_id, 'quantita', quantita, 'prezzo_unitario', prezzo_unitario
  ) ORDER BY accessorio_id), '[]'::jsonb)
  INTO v_old_accessori
  FROM public.servizi_accessori WHERE servizio_id = _servizio_id;

  v_has_driver := (v_old.autista_id IS NOT NULL OR v_old.autista_esterno_id IS NOT NULL);
  IF _cancel THEN
    v_new_stato := 'annullato'::public.servizio_stato;
  ELSIF v_has_driver THEN
    v_new_stato := 'da_confermare'::public.servizio_stato;
  ELSE
    v_new_stato := 'nuovo'::public.servizio_stato;
  END IF;

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
    allegato_path = CASE
      WHEN _remove_allegato THEN NULL
      WHEN _allegato_path IS NOT NULL THEN _allegato_path
      ELSE allegato_path
    END,
    allegato_nome = CASE WHEN _remove_allegato THEN NULL ELSE _allegato_nome END,
    cartello_path = CASE
      WHEN _remove_cartello THEN NULL
      WHEN _cartello_path IS NOT NULL THEN _cartello_path
      ELSE cartello_path
    END,
    cartello_nome = CASE
      WHEN _remove_cartello THEN NULL
      WHEN _cartello_path IS NOT NULL THEN _cartello_nome
      ELSE cartello_nome
    END,
    modificato_da_cliente = true,
    modificato_at = now(),
    stato = v_new_stato
  WHERE id = _servizio_id
  RETURNING * INTO v_new;

  IF _accessori_items IS NOT NULL THEN
    DELETE FROM public.servizi_accessori WHERE servizio_id = _servizio_id;
    INSERT INTO public.servizi_accessori (servizio_id, accessorio_id, quantita, prezzo_unitario)
    SELECT _servizio_id, (item->>'accessorio_id')::uuid,
      COALESCE((item->>'quantita')::int, 1),
      COALESCE((item->>'prezzo_unitario')::numeric, 0)
    FROM jsonb_array_elements(_accessori_items) AS item
    WHERE (item->>'accessorio_id') IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.accessori_catalogo ac
        WHERE ac.id = (item->>'accessorio_id')::uuid AND ac.org_id = v_new.org_id);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'accessorio_id', accessorio_id, 'quantita', quantita, 'prezzo_unitario', prezzo_unitario
    ) ORDER BY accessorio_id), '[]'::jsonb)
    INTO v_new_accessori
    FROM public.servizi_accessori WHERE servizio_id = _servizio_id;

    IF v_old_accessori IS DISTINCT FROM v_new_accessori THEN
      v_changed_fields := array_append(v_changed_fields, 'accessori_items');
      INSERT INTO public.servizi_modifiche(servizio_id, org_id, changed_by, field_name, old_value, new_value)
      VALUES (v_new.id, v_new.org_id, auth.uid(), 'accessori_items', v_old_accessori::text, v_new_accessori::text);
    END IF;
  END IF;

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
    VALUES (v_new.org_id, 'servizio_annullato',
      'Servizio annullato da ' || COALESCE(v_client_nome, 'cliente'),
      'Servizio del ' || to_char(v_new.data_servizio, 'DD/MM/YYYY') || COALESCE(' (' || v_new.luogo_inizio || ')', '') || ' è stato annullato.',
      v_new.id, v_new.client_id, v_utenza_id);
    RETURN v_new;
  END IF;

  IF array_length(v_changed_fields, 1) > 0 THEN
    SELECT string_agg(
      CASE field_name
        WHEN 'data_servizio' THEN 'Data' WHEN 'ora_inizio' THEN 'Ora' WHEN 'citta' THEN 'Città'
        WHEN 'tipologia' THEN 'Tipologia' WHEN 'transfer_tipo' THEN 'Tipo transfer'
        WHEN 'disposizione_oraria' THEN 'Disposizione' WHEN 'tour_tipo' THEN 'Tipo tour'
        WHEN 'luogo_inizio' THEN 'Luogo inizio' WHEN 'luogo_fine' THEN 'Luogo fine'
        WHEN 'itinerario' THEN 'Itinerario' WHEN 'veicolo_tipo' THEN 'Veicolo'
        WHEN 'n_passeggeri' THEN 'Passeggeri' WHEN 'n_bagagli' THEN 'Bagagli'
        WHEN 'info_autista' THEN 'Info autista' WHEN 'tipo_pagamento' THEN 'Pagamento'
        WHEN 'centro_costo' THEN 'Centro di costo' WHEN 'accessori' THEN 'Accessori (note)'
        WHEN 'accessori_items' THEN 'Accessori' WHEN 'note' THEN 'Note'
        WHEN 'allegato_nome' THEN 'Allegato' WHEN 'cartello_nome' THEN 'Cartello' ELSE field_name
      END, ', ' ORDER BY array_position(v_changed_fields, field_name)
    ) INTO v_summary FROM unnest(v_changed_fields) AS field_name;

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id, client_id, utenza_id)
    VALUES (v_new.org_id, 'servizio_modificato',
      'Servizio modificato da ' || COALESCE(v_client_nome, 'cliente'),
      COALESCE(v_utenza_nome || ' ha modificato: ', 'Modifiche: ') || COALESCE(v_summary, 'dettagli servizio'),
      v_new.id, v_new.client_id, v_utenza_id);
  END IF;

  RETURN v_new;
END;
$function$;

REVOKE ALL ON FUNCTION public.client_portal_update_servizio(uuid, date, text, text, integer, integer, servizio_tipologia, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, jsonb, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_portal_update_servizio(uuid, date, text, text, integer, integer, servizio_tipologia, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, jsonb, text, text, boolean) TO authenticated;