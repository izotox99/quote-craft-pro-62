
-- 1) Proxy client per rappresentare un partner del network dentro un'altra org
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS network_org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS clients_network_proxy_uniq
  ON public.clients(org_id, network_org_id) WHERE network_org_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_network_proxy_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.network_org_id IS NOT NULL AND NEW.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'I clienti proxy di rete non possono avere credenziali' USING ERRCODE = '42501';
  END IF;
  IF NEW.network_org_id IS NOT NULL AND NEW.network_org_id = NEW.org_id THEN
    RAISE EXCEPTION 'Il proxy di rete deve puntare a un''altra organizzazione' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_network_proxy_client ON public.clients;
CREATE TRIGGER trg_guard_network_proxy_client
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.guard_network_proxy_client();

-- 2) Adegua enforce_user_org_id per rispettare il flag network_managed
CREATE OR REPLACE FUNCTION public.enforce_user_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_org uuid;
BEGIN
  IF current_setting('app.network_managed', true) = 'on' THEN
    RETURN NEW;
  END IF;

  v_user_org := public.get_user_org_id(auth.uid());
  IF v_user_org IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.org_id := v_user_org;
  RETURN NEW;
END $$;

-- 3) Enum + tabella dispatch
DO $$ BEGIN
  CREATE TYPE public.network_dispatch_stato AS ENUM ('inviato','accettato','rifiutato','completato','ritirato');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.servizi_network (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servizio_a_id uuid NOT NULL REFERENCES public.servizi(id) ON DELETE CASCADE,
  servizio_b_id uuid REFERENCES public.servizi(id) ON DELETE SET NULL,
  org_a uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  org_b uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  partnership_id uuid NOT NULL REFERENCES public.network_partners(id) ON DELETE RESTRICT,
  prezzo_concordato numeric NOT NULL CHECK (prezzo_concordato >= 0),
  stato public.network_dispatch_stato NOT NULL DEFAULT 'inviato',
  snapshot jsonb NOT NULL,
  dispatched_by uuid,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS servizi_network_active_uniq
  ON public.servizi_network(servizio_a_id)
  WHERE stato IN ('inviato','accettato');
CREATE INDEX IF NOT EXISTS servizi_network_org_a_idx ON public.servizi_network(org_a);
CREATE INDEX IF NOT EXISTS servizi_network_org_b_idx ON public.servizi_network(org_b);

GRANT SELECT ON public.servizi_network TO authenticated;
GRANT ALL ON public.servizi_network TO service_role;
ALTER TABLE public.servizi_network ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "network dispatch visible to both orgs" ON public.servizi_network;
CREATE POLICY "network dispatch visible to both orgs" ON public.servizi_network
  FOR SELECT TO authenticated
  USING (
    org_a = public.get_user_org_id(auth.uid())
    OR org_b = public.get_user_org_id(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_servizi_network_updated_at ON public.servizi_network;
CREATE TRIGGER trg_servizi_network_updated_at
BEFORE UPDATE ON public.servizi_network
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.servizi_network FROM PUBLIC, anon;

-- 4) Dispatch: invia servizio ad un partner
CREATE OR REPLACE FUNCTION public.network_dispatch_servizio(
  _servizio_id uuid,
  _partner_org_id uuid,
  _prezzo_concordato numeric
) RETURNS public.servizi_network
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- Whitelist snapshot: solo dati operativi. NIENTE cliente finale, email, contatti, economics di A.
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
    'ritirare_voucher', v_servizio.ritirare_voucher
  );

  INSERT INTO public.servizi (
    org_id, client_id, data_servizio, ora_inizio, citta,
    tipologia, transfer_tipo, disposizione_oraria, tour_tipo,
    luogo_inizio, luogo_fine, itinerario,
    veicolo_tipo, n_passeggeri, n_bagagli,
    accessori, info_autista, note,
    con_guida, con_assistente, ritirare_voucher,
    prezzo, stato, created_by
  ) VALUES (
    _partner_org_id, v_proxy_client_id, v_servizio.data_servizio, v_servizio.ora_inizio, v_servizio.citta,
    v_servizio.tipologia, v_servizio.transfer_tipo, v_servizio.disposizione_oraria, v_servizio.tour_tipo,
    v_servizio.luogo_inizio, v_servizio.luogo_fine, v_servizio.itinerario,
    v_servizio.veicolo_tipo, v_servizio.n_passeggeri, v_servizio.n_bagagli,
    v_servizio.accessori, v_servizio.info_autista, v_servizio.note,
    v_servizio.con_guida, v_servizio.con_assistente, v_servizio.ritirare_voucher,
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
END $$;

-- 5) Ritiro dal network
CREATE OR REPLACE FUNCTION public.network_withdraw_servizio(_servizio_id uuid)
RETURNS public.servizi_network
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_a uuid;
  v_dispatch public.servizi_network%ROWTYPE;
BEGIN
  v_org_a := public.get_user_org_id(auth.uid());
  IF v_org_a IS NULL THEN
    RAISE EXCEPTION 'Organizzazione non configurata' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_dispatch FROM public.servizi_network
   WHERE servizio_a_id=_servizio_id AND stato IN ('inviato','accettato')
   ORDER BY dispatched_at DESC LIMIT 1;
  IF v_dispatch.id IS NULL THEN
    RAISE EXCEPTION 'Nessun dispatch attivo per questo servizio' USING ERRCODE='22023';
  END IF;
  IF v_dispatch.org_a <> v_org_a THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;

  PERFORM set_config('app.network_managed','on',true);

  IF v_dispatch.servizio_b_id IS NOT NULL THEN
    DELETE FROM public.servizi WHERE id = v_dispatch.servizio_b_id;
  END IF;

  UPDATE public.servizi_network
     SET stato='ritirato', responded_at=now()
   WHERE id=v_dispatch.id
  RETURNING * INTO v_dispatch;

  UPDATE public.servizi
     SET fornitore_cs_id = NULL,
         stato = 'nuovo'
   WHERE id = _servizio_id;

  INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
  VALUES (v_dispatch.org_b, 'network_servizio_ritirato',
    'Servizio ritirato dal network',
    'Il mittente ha ritirato un servizio ricevuto dal network.');

  RETURN v_dispatch;
END $$;

-- 6) Blocco cambio fornitore con dispatch attivo
CREATE OR REPLACE FUNCTION public.guard_fornitore_dispatch_attivo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.network_managed', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.fornitore_cs_id IS DISTINCT FROM OLD.fornitore_cs_id THEN
    IF EXISTS (
      SELECT 1 FROM public.servizi_network
      WHERE servizio_a_id = NEW.id AND stato IN ('inviato','accettato')
    ) THEN
      RAISE EXCEPTION 'Servizio inviato al network: usa "Ritira dal network" prima di cambiare fornitore'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_fornitore_dispatch ON public.servizi;
CREATE TRIGGER trg_guard_fornitore_dispatch
BEFORE UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.guard_fornitore_dispatch_attivo();

-- 7) Sync B → A (assegnazione autista / annullamento)
CREATE OR REPLACE FUNCTION public.network_sync_b_to_a()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dispatch public.servizi_network%ROWTYPE;
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

  IF NEW.stato = 'annullato' AND OLD.stato IS DISTINCT FROM 'annullato' THEN
    UPDATE public.servizi SET fornitore_cs_id=NULL, stato='nuovo'
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

  IF (NEW.autista_id IS NOT NULL OR NEW.autista_esterno_id IS NOT NULL)
     AND (OLD.autista_id IS DISTINCT FROM NEW.autista_id
          OR OLD.autista_esterno_id IS DISTINCT FROM NEW.autista_esterno_id) THEN
    UPDATE public.servizi
       SET stato='confermato'
     WHERE id = v_dispatch.servizio_a_id
       AND stato IN ('nuovo','confermato');
    IF v_dispatch.stato = 'inviato' THEN
      UPDATE public.servizi_network SET stato='accettato', responded_at=now()
       WHERE id = v_dispatch.id;
    END IF;
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_dispatch.org_a, 'network_servizio_confermato',
      'Servizio confermato dal partner',
      'Il partner ha assegnato un autista al servizio.',
      v_dispatch.servizio_a_id);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_network_sync_b_to_a ON public.servizi;
CREATE TRIGGER trg_network_sync_b_to_a
AFTER UPDATE ON public.servizi
FOR EACH ROW EXECUTE FUNCTION public.network_sync_b_to_a();

-- 8) Permessi execute (le funzioni cross-org sono SECURITY DEFINER: revoca da PUBLIC/anon, concedi ad authenticated)
REVOKE ALL ON FUNCTION public.network_dispatch_servizio(uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.network_withdraw_servizio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_dispatch_servizio(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_withdraw_servizio(uuid) TO authenticated;
