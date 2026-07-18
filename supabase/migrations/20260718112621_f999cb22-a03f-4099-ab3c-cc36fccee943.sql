CREATE OR REPLACE FUNCTION public.network_dispatch_servizio(_servizio_id uuid, _partner_org_id uuid, _prezzo_concordato numeric)
 RETURNS servizi_network
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_a uuid;
  v_servizio public.servizi%ROWTYPE;
  v_partnership public.network_partners%ROWTYPE;
  v_proxy_client_id uuid;
  v_org_a_name text;
  v_new_b public.servizi%ROWTYPE;
  v_snapshot jsonb;
  v_dispatch public.servizi_network%ROWTYPE;
BEGIN
  v_org_a := public.get_user_org_id(auth.uid());
  IF v_org_a IS NULL THEN
    RAISE EXCEPTION 'Organizzazione non configurata' USING ERRCODE='42501';
  END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;
  IF _prezzo_concordato IS NULL OR _prezzo_concordato < 0 THEN
    RAISE EXCEPTION 'Prezzo concordato non valido' USING ERRCODE='22023';
  END IF;
  IF _partner_org_id = v_org_a THEN
    RAISE EXCEPTION 'Non puoi inviare a te stesso' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_servizio FROM public.servizi WHERE id=_servizio_id AND org_id=v_org_a;
  IF v_servizio.id IS NULL THEN
    RAISE EXCEPTION 'Servizio non trovato' USING ERRCODE='22023';
  END IF;
  IF v_servizio.stato = 'annullato' THEN
    RAISE EXCEPTION 'Servizio annullato' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_partnership FROM public.network_partners
   WHERE stato='attivo'
     AND ((org_a=v_org_a AND org_b=_partner_org_id) OR (org_b=v_org_a AND org_a=_partner_org_id))
   LIMIT 1;
  IF v_partnership.id IS NULL THEN
    RAISE EXCEPTION 'Nessuna partnership attiva con il partner selezionato' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servizi_network
    WHERE servizio_a_id=_servizio_id AND stato IN ('inviato','accettato')
  ) THEN
    RAISE EXCEPTION 'Servizio già inviato al network' USING ERRCODE='22023';
  END IF;

  SELECT name INTO v_org_a_name FROM public.organizations WHERE id=v_org_a;

  PERFORM set_config('app.network_managed','on',true);

  SELECT id INTO v_proxy_client_id FROM public.clients
   WHERE org_id=_partner_org_id AND network_org_id=v_org_a LIMIT 1;
  IF v_proxy_client_id IS NULL THEN
    INSERT INTO public.clients(org_id, network_org_id, name, company, attivo, auth_user_id, created_by)
    VALUES (_partner_org_id, v_org_a, v_org_a_name, v_org_a_name, true, NULL, auth.uid())
    RETURNING id INTO v_proxy_client_id;
  END IF;

  -- Whitelist: dati operativi + dati passeggero (contatto, telefono, telefono_d).
  -- ESCLUSI SEMPRE: client_id reale, email_contatto, allegati, campi economici (prezzo, incasso, costo_*, prezzo_fattura, com_cliente, tipo_pagamento, centro_costo).
  v_snapshot := jsonb_build_object(
    'data_servizio', v_servizio.data_servizio,
    'ora_inizio', v_servizio.ora_inizio,
    'citta', v_servizio.citta,
    'tipologia', v_servizio.tipologia,
    'transfer_tipo', v_servizio.transfer_tipo,
    'disposizione_oraria', v_servizio.disposizione_oraria,
    'tour_tipo', v_servizio.tour_tipo,
    'luogo_inizio', v_servizio.luogo_inizio,
    'luogo_fine', v_servizio.luogo_fine,
    'itinerario', v_servizio.itinerario,
    'veicolo_tipo', v_servizio.veicolo_tipo,
    'n_passeggeri', v_servizio.n_passeggeri,
    'n_bagagli', v_servizio.n_bagagli,
    'accessori', v_servizio.accessori,
    'info_autista', v_servizio.info_autista,
    'note', v_servizio.note,
    'con_guida', v_servizio.con_guida,
    'con_assistente', v_servizio.con_assistente,
    'ritirare_voucher', v_servizio.ritirare_voucher,
    'contatto', v_servizio.contatto,
    'telefono_contatto', v_servizio.telefono_contatto,
    'telefono_d', v_servizio.telefono_d
  );

  INSERT INTO public.servizi (
    org_id, client_id, data_servizio, ora_inizio, citta,
    tipologia, transfer_tipo, disposizione_oraria, tour_tipo,
    luogo_inizio, luogo_fine, itinerario,
    veicolo_tipo, n_passeggeri, n_bagagli,
    accessori, info_autista, note,
    con_guida, con_assistente, ritirare_voucher,
    contatto, telefono_contatto, telefono_d,
    prezzo, stato, created_by
  ) VALUES (
    _partner_org_id, v_proxy_client_id, v_servizio.data_servizio, v_servizio.ora_inizio, v_servizio.citta,
    v_servizio.tipologia, v_servizio.transfer_tipo, v_servizio.disposizione_oraria, v_servizio.tour_tipo,
    v_servizio.luogo_inizio, v_servizio.luogo_fine, v_servizio.itinerario,
    v_servizio.veicolo_tipo, v_servizio.n_passeggeri, v_servizio.n_bagagli,
    v_servizio.accessori, v_servizio.info_autista, v_servizio.note,
    v_servizio.con_guida, v_servizio.con_assistente, v_servizio.ritirare_voucher,
    v_servizio.contatto, v_servizio.telefono_contatto, v_servizio.telefono_d,
    _prezzo_concordato, 'nuovo', auth.uid()
  ) RETURNING * INTO v_new_b;

  INSERT INTO public.servizi_network(
    servizio_a_id, servizio_b_id, org_a, org_b, partnership_id,
    prezzo_concordato, snapshot, dispatched_by
  ) VALUES (
    _servizio_id, v_new_b.id, v_org_a, _partner_org_id, v_partnership.id,
    _prezzo_concordato, v_snapshot, auth.uid()
  ) RETURNING * INTO v_dispatch;

  INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
  VALUES (_partner_org_id, 'network_servizio_ricevuto',
    'Nuovo servizio dal network',
    'Ricevuto da ' || v_org_a_name || ' per il ' || to_char(v_servizio.data_servizio,'DD/MM/YYYY'),
    v_new_b.id);

  RETURN v_dispatch;
END $function$;