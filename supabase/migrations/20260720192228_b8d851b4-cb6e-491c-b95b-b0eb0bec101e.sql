
-- 1) Colonne nuove
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS cartello text,
  ADD COLUMN IF NOT EXISTS stato_autista text NOT NULL DEFAULT 'da_effettuare',
  ADD COLUMN IF NOT EXISTS transfer_concluso_at timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_nota_chiusura text,
  ADD COLUMN IF NOT EXISTS dispo_conclusa_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispo_nota_chiusura text,
  ADD COLUMN IF NOT EXISTS km_inizio_servizio integer,
  ADD COLUMN IF NOT EXISTS km_fine_servizio integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='servizi_stato_autista_check') THEN
    ALTER TABLE public.servizi ADD CONSTRAINT servizi_stato_autista_check
      CHECK (stato_autista IN ('da_effettuare','in_corso','concluso'));
  END IF;
END $$;

-- 2) Vista servizi_autista_view aggiornata
DROP VIEW IF EXISTS public.servizi_autista_view;
CREATE VIEW public.servizi_autista_view AS
SELECT
  s.id, s.org_id, s.data_servizio, s.ora_inizio, s.citta,
  s.luogo_inizio, s.luogo_fine, s.itinerario, s.stato, s.stato_autista,
  s.tipologia, s.transfer_tipo, s.disposizione_oraria, s.tour_tipo,
  s.veicolo_tipo, s.veicolo_id, s.autista_id,
  s.contatto, s.telefono_contatto, s.telefono_d, s.email_contatto,
  s.n_passeggeri, s.n_bagagli, s.accessori,
  s.info_autista, s.info_cliente_autista, s.note,
  s.codice, s.foglio, s.cartello,
  s.tipo_pagamento,
  s.allegato_path, s.allegato_nome,
  s.con_guida, s.con_assistente, s.ritirare_voucher, s.permesso_effettuato,
  s.modificato_da_cliente, s.modificato_at,
  s.transfer_concluso_at, s.transfer_nota_chiusura,
  s.dispo_conclusa_at, s.dispo_nota_chiusura,
  s.km_inizio_servizio, s.km_fine_servizio,
  s.network_autista_nome, s.network_autista_telefono, s.network_autista_targa,
  s.created_at, s.updated_at
FROM public.servizi s
WHERE s.archiviato = false
  AND s.autista_id IS NOT NULL
  AND s.autista_id = public.get_autista_id(auth.uid())
  AND s.org_id = public.get_autista_org_id(auth.uid());

REVOKE ALL ON public.servizi_autista_view FROM PUBLIC, anon;
GRANT SELECT ON public.servizi_autista_view TO authenticated;

-- 3) Funzione di aggiornamento dall'app autisti
CREATE OR REPLACE FUNCTION public.autista_update_servizio(
  _servizio_id uuid,
  _action text,
  _km integer DEFAULT NULL,
  _ora_fine timestamptz DEFAULT NULL,
  _nota text DEFAULT NULL
)
RETURNS public.servizi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_autista_id uuid;
  v_org_id uuid;
  v_srv public.servizi%ROWTYPE;
  v_has_transfer boolean;
  v_has_dispo boolean;
  v_transfer_done boolean;
  v_dispo_done boolean;
  v_all_done boolean;
BEGIN
  v_autista_id := public.get_autista_id(v_uid);
  v_org_id := public.get_autista_org_id(v_uid);
  IF v_autista_id IS NULL THEN
    RAISE EXCEPTION 'Non autorizzato' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_srv FROM public.servizi WHERE id = _servizio_id;
  IF v_srv.id IS NULL THEN
    RAISE EXCEPTION 'Servizio non trovato' USING ERRCODE='22023';
  END IF;
  IF v_srv.autista_id <> v_autista_id OR v_srv.org_id <> v_org_id THEN
    RAISE EXCEPTION 'Servizio non assegnato a te' USING ERRCODE='42501';
  END IF;
  IF v_srv.stato = 'annullato' THEN
    RAISE EXCEPTION 'Servizio annullato' USING ERRCODE='22023';
  END IF;

  v_has_transfer := (v_srv.tipologia::text = 'transfer' OR v_srv.transfer_tipo IS NOT NULL);
  v_has_dispo := (v_srv.tipologia::text = 'disposizione' OR NULLIF(v_srv.disposizione_oraria,'') IS NOT NULL);
  IF NOT v_has_transfer AND NOT v_has_dispo THEN
    -- fallback: tratta come transfer singolo
    v_has_transfer := true;
  END IF;

  IF _action = 'start' THEN
    IF v_srv.stato_autista <> 'da_effettuare' THEN
      RAISE EXCEPTION 'Servizio già iniziato' USING ERRCODE='22023';
    END IF;
    UPDATE public.servizi SET
      stato_autista = 'in_corso',
      stato = CASE WHEN stato IN ('completato','annullato') THEN stato ELSE 'in_corso' END,
      km_inizio_servizio = COALESCE(_km, km_inizio_servizio)
    WHERE id = _servizio_id
    RETURNING * INTO v_srv;

    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
    VALUES (v_srv.org_id, 'autista_inizio_servizio',
      'Servizio iniziato',
      'L''autista ha iniziato il servizio del ' || to_char(v_srv.data_servizio,'DD/MM/YYYY') ||
        COALESCE(' km ' || _km::text, ''),
      v_srv.id);

  ELSIF _action IN ('close_transfer','close_dispo') THEN
    IF v_srv.stato_autista = 'concluso' THEN
      RAISE EXCEPTION 'Servizio già concluso' USING ERRCODE='22023';
    END IF;

    IF _action = 'close_transfer' THEN
      IF NOT v_has_transfer THEN
        RAISE EXCEPTION 'Servizio senza componente transfer' USING ERRCODE='22023';
      END IF;
      UPDATE public.servizi SET
        transfer_concluso_at = COALESCE(_ora_fine, now()),
        transfer_nota_chiusura = _nota,
        km_fine_servizio = COALESCE(_km, km_fine_servizio)
      WHERE id = _servizio_id
      RETURNING * INTO v_srv;
    ELSE
      IF NOT v_has_dispo THEN
        RAISE EXCEPTION 'Servizio senza componente disposizione' USING ERRCODE='22023';
      END IF;
      UPDATE public.servizi SET
        dispo_conclusa_at = COALESCE(_ora_fine, now()),
        dispo_nota_chiusura = _nota,
        km_fine_servizio = COALESCE(_km, km_fine_servizio)
      WHERE id = _servizio_id
      RETURNING * INTO v_srv;
    END IF;

    v_transfer_done := (NOT v_has_transfer) OR v_srv.transfer_concluso_at IS NOT NULL;
    v_dispo_done := (NOT v_has_dispo) OR v_srv.dispo_conclusa_at IS NOT NULL;
    v_all_done := v_transfer_done AND v_dispo_done;

    IF v_all_done THEN
      UPDATE public.servizi SET
        stato_autista = 'concluso',
        stato = 'completato'
      WHERE id = _servizio_id
      RETURNING * INTO v_srv;

      IF v_srv.veicolo_id IS NOT NULL AND v_srv.km_fine_servizio IS NOT NULL THEN
        UPDATE public.veicoli
        SET km_attuale = v_srv.km_fine_servizio
        WHERE id = v_srv.veicolo_id
          AND (km_attuale IS NULL OR km_attuale < v_srv.km_fine_servizio);
      END IF;

      INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio, servizio_id)
      VALUES (v_srv.org_id, 'autista_fine_servizio',
        'Servizio concluso',
        'Servizio del ' || to_char(v_srv.data_servizio,'DD/MM/YYYY') || ' concluso' ||
          COALESCE(' — km fine ' || v_srv.km_fine_servizio::text, ''),
        v_srv.id);
    END IF;
  ELSE
    RAISE EXCEPTION 'Azione non valida' USING ERRCODE='22023';
  END IF;

  RETURN v_srv;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.autista_update_servizio(uuid,text,integer,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autista_update_servizio(uuid,text,integer,timestamptz,text) TO authenticated;
