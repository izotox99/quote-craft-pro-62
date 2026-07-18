
-- 1. network_partners table
CREATE TABLE public.network_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_a uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_b uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by_email text,
  invite_code text NOT NULL UNIQUE,
  stato text NOT NULL DEFAULT 'invitato' CHECK (stato IN ('invitato','attivo','rifiutato','revocato')),
  invited_by_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_by_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (org_a <> org_b),
  CHECK (org_b IS NOT NULL OR invited_by_email IS NOT NULL)
);

-- Prevent duplicate pending/active partnerships between the same two orgs
CREATE UNIQUE INDEX network_partners_unique_pair_active
  ON public.network_partners (LEAST(org_a, org_b), GREATEST(org_a, org_b))
  WHERE org_b IS NOT NULL AND stato IN ('invitato','attivo');

CREATE INDEX network_partners_org_a_idx ON public.network_partners (org_a);
CREATE INDEX network_partners_org_b_idx ON public.network_partners (org_b);
CREATE INDEX network_partners_email_idx ON public.network_partners (lower(invited_by_email)) WHERE invited_by_email IS NOT NULL;

GRANT SELECT ON public.network_partners TO authenticated;
GRANT ALL ON public.network_partners TO service_role;

ALTER TABLE public.network_partners ENABLE ROW LEVEL SECURITY;

-- Ogni org vede le partnership che la coinvolgono; se org_b è NULL, la vede solo chi ha invitato oppure l'utente con quell'email.
CREATE POLICY "network_partners_select_own_org" ON public.network_partners
  FOR SELECT TO authenticated
  USING (
    org_a = public.get_user_org_id(auth.uid())
    OR org_b = public.get_user_org_id(auth.uid())
    OR (
      org_b IS NULL
      AND invited_by_email IS NOT NULL
      AND lower(invited_by_email) = lower(COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
    )
  );

-- Scritture solo via SECURITY DEFINER
CREATE TRIGGER network_partners_updated_at
  BEFORE UPDATE ON public.network_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. fornitori_cs.partner_org_id
ALTER TABLE public.fornitori_cs
  ADD COLUMN partner_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX fornitori_cs_partner_org_idx ON public.fornitori_cs (partner_org_id) WHERE partner_org_id IS NOT NULL;

-- Trigger: validate that partner_org_id points to an active partnership with caller org
CREATE OR REPLACE FUNCTION public.validate_fornitore_partner_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF NEW.partner_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.partner_org_id = NEW.org_id THEN
    RAISE EXCEPTION 'Non puoi collegare il fornitore alla tua stessa organizzazione' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.network_partners
    WHERE stato = 'attivo'
      AND (
        (org_a = NEW.org_id AND org_b = NEW.partner_org_id)
        OR (org_b = NEW.org_id AND org_a = NEW.partner_org_id)
      )
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Nessuna partnership attiva con questa organizzazione' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER fornitori_cs_validate_partner
  BEFORE INSERT OR UPDATE OF partner_org_id ON public.fornitori_cs
  FOR EACH ROW EXECUTE FUNCTION public.validate_fornitore_partner_org();

-- 3. Function: invite a partner
CREATE OR REPLACE FUNCTION public.network_invite_partner(
  _email text DEFAULT NULL,
  _org_b uuid DEFAULT NULL
)
RETURNS public.network_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_org_a uuid;
  v_code text;
  v_row public.network_partners%ROWTYPE;
  v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un amministratore può invitare partner' USING ERRCODE = '42501';
  END IF;

  v_org_a := public.get_user_org_id(auth.uid());
  IF v_org_a IS NULL THEN
    RAISE EXCEPTION 'Organizzazione non configurata' USING ERRCODE = '42501';
  END IF;

  IF _email IS NULL AND _org_b IS NULL THEN
    RAISE EXCEPTION 'Fornire email o organizzazione partner' USING ERRCODE = '22023';
  END IF;

  IF _org_b IS NOT NULL AND _org_b = v_org_a THEN
    RAISE EXCEPTION 'Non puoi invitare la tua stessa organizzazione' USING ERRCODE = '22023';
  END IF;

  v_email := NULLIF(TRIM(LOWER(COALESCE(_email, ''))), '');

  -- Duplicate check
  IF _org_b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.network_partners
    WHERE stato IN ('invitato','attivo')
      AND (
        (org_a = v_org_a AND org_b = _org_b)
        OR (org_b = v_org_a AND org_a = _org_b)
      )
  ) THEN
    RAISE EXCEPTION 'Esiste già un invito o una partnership con questa organizzazione' USING ERRCODE = '22023';
  END IF;

  -- Long random code: 32 hex chars
  v_code := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.network_partners (
    org_a, org_b, invited_by_email, invite_code, invited_by_user
  ) VALUES (
    v_org_a, _org_b, v_email, v_code, auth.uid()
  )
  RETURNING * INTO v_row;

  -- Notification to the receiving org if known
  IF _org_b IS NOT NULL THEN
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
    VALUES (
      _org_b,
      'network_invito_ricevuto',
      'Nuovo invito partnership',
      'Hai ricevuto un invito a collegare la tua organizzazione a un partner del network.'
    );
  END IF;

  RETURN v_row;
END;
$$;

-- 4. Function: respond to an invite (accept/reject) with rate limiting
CREATE OR REPLACE FUNCTION public.network_respond_invite(
  _partnership_id uuid DEFAULT NULL,
  _invite_code text DEFAULT NULL,
  _accept boolean DEFAULT true
)
RETURNS public.network_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.network_partners%ROWTYPE;
  v_org_b uuid;
  v_user_email text;
  v_attempts int;
  v_key text;
BEGIN
  v_org_b := public.get_user_org_id(auth.uid());
  IF v_org_b IS NULL THEN
    RAISE EXCEPTION 'Organizzazione non configurata' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un amministratore può rispondere agli inviti' USING ERRCODE = '42501';
  END IF;

  -- Rate limit: max 10 respond attempts per user in the last 15 minutes
  v_key := 'network_accept:' || auth.uid()::text;
  SELECT count(*) INTO v_attempts
  FROM public.login_attempts
  WHERE email = v_key AND attempted_at > now() - interval '15 minutes';

  IF v_attempts >= 10 THEN
    RAISE EXCEPTION 'Troppi tentativi, riprova tra qualche minuto' USING ERRCODE = '42P05';
  END IF;

  INSERT INTO public.login_attempts (email, ip_address, success) VALUES (v_key, NULL, false);

  IF _partnership_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.network_partners WHERE id = _partnership_id;
  ELSIF _invite_code IS NOT NULL THEN
    SELECT * INTO v_row FROM public.network_partners WHERE invite_code = _invite_code;
  ELSE
    RAISE EXCEPTION 'Specificare invito o codice' USING ERRCODE = '22023';
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Invito non trovato' USING ERRCODE = '22023';
  END IF;

  IF v_row.stato <> 'invitato' THEN
    RAISE EXCEPTION 'Invito non più valido' USING ERRCODE = '22023';
  END IF;

  -- Authorization: either org_b already matches caller org, or invite is by email matching caller
  IF v_row.org_b IS NOT NULL THEN
    IF v_row.org_b <> v_org_b THEN
      RAISE EXCEPTION 'Non sei autorizzato per questo invito' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_row.invited_by_email IS NULL THEN
      RAISE EXCEPTION 'Invito non valido' USING ERRCODE = '22023';
    END IF;
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    IF lower(COALESCE(v_user_email, '')) <> lower(v_row.invited_by_email)
       AND _invite_code IS NULL THEN
      RAISE EXCEPTION 'Non sei autorizzato per questo invito' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_org_b = v_row.org_a THEN
    RAISE EXCEPTION 'Non puoi accettare un invito della tua stessa organizzazione' USING ERRCODE = '22023';
  END IF;

  UPDATE public.network_partners
  SET org_b = v_org_b,
      stato = CASE WHEN _accept THEN 'attivo' ELSE 'rifiutato' END,
      responded_by_user = auth.uid(),
      responded_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  -- Notify inviter
  INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
  VALUES (
    v_row.org_a,
    CASE WHEN _accept THEN 'network_invito_accettato' ELSE 'network_invito_rifiutato' END,
    CASE WHEN _accept THEN 'Invito partnership accettato' ELSE 'Invito partnership rifiutato' END,
    'L''organizzazione partner ha risposto al tuo invito.'
  );

  RETURN v_row;
END;
$$;

-- 5. Function: revoke partnership
CREATE OR REPLACE FUNCTION public.network_revoke_partnership(_partnership_id uuid)
RETURNS public.network_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.network_partners%ROWTYPE;
  v_my_org uuid;
  v_other_org uuid;
BEGIN
  v_my_org := public.get_user_org_id(auth.uid());
  IF v_my_org IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un amministratore può revocare' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.network_partners WHERE id = _partnership_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Partnership non trovata' USING ERRCODE = '22023';
  END IF;

  IF v_row.org_a <> v_my_org AND v_row.org_b IS DISTINCT FROM v_my_org THEN
    RAISE EXCEPTION 'Non sei autorizzato' USING ERRCODE = '42501';
  END IF;

  IF v_row.stato NOT IN ('invitato','attivo') THEN
    RAISE EXCEPTION 'Partnership non revocabile' USING ERRCODE = '22023';
  END IF;

  UPDATE public.network_partners
  SET stato = 'revocato', responded_at = now()
  WHERE id = _partnership_id
  RETURNING * INTO v_row;

  -- Unlink fornitori_cs pointers on both sides
  UPDATE public.fornitori_cs
  SET partner_org_id = NULL
  WHERE partner_org_id IN (v_row.org_a, v_row.org_b)
    AND org_id IN (v_row.org_a, v_row.org_b);

  v_other_org := CASE WHEN v_row.org_a = v_my_org THEN v_row.org_b ELSE v_row.org_a END;
  IF v_other_org IS NOT NULL THEN
    INSERT INTO public.notifiche(org_id, tipo, titolo, messaggio)
    VALUES (
      v_other_org,
      'network_partnership_revocata',
      'Partnership revocata',
      'Una partnership del network è stata revocata.'
    );
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.network_invite_partner(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_respond_invite(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_revoke_partnership(uuid) TO authenticated;
