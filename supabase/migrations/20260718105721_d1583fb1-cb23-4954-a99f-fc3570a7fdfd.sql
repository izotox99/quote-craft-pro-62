
-- 1) Helper: email dell'utente corrente (SECURITY DEFINER per bypassare i grant su auth.users)
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated, service_role;

-- 2) Sostituisci policy network_partners che leggeva direttamente auth.users
DROP POLICY IF EXISTS network_partners_select_own_org ON public.network_partners;

CREATE POLICY network_partners_select_own_org
ON public.network_partners
FOR SELECT
TO authenticated
USING (
  org_a = public.get_user_org_id(auth.uid())
  OR org_b = public.get_user_org_id(auth.uid())
  OR (
    org_b IS NULL
    AND invited_by_email IS NOT NULL
    AND lower(invited_by_email) = lower(COALESCE(public.current_user_email(), ''))
  )
);

-- 3) Funzione dedicata per esporre SOLO id + nome delle org visibili nel contesto network
CREATE OR REPLACE FUNCTION public.network_visible_orgs()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_email AS (
    SELECT lower(COALESCE(public.current_user_email(), '')) AS email
  ),
  my_org AS (
    SELECT public.get_user_org_id(auth.uid()) AS org_id
  ),
  visible_ids AS (
    SELECT np.org_a AS org_id
      FROM public.network_partners np, my_org, my_email
     WHERE np.org_a = my_org.org_id
        OR np.org_b = my_org.org_id
        OR (np.org_b IS NULL
            AND np.invited_by_email IS NOT NULL
            AND lower(np.invited_by_email) = my_email.email)
    UNION
    SELECT np.org_b AS org_id
      FROM public.network_partners np, my_org, my_email
     WHERE np.org_b IS NOT NULL
       AND (
         np.org_a = my_org.org_id
         OR np.org_b = my_org.org_id
         OR (np.org_b IS NULL
             AND np.invited_by_email IS NOT NULL
             AND lower(np.invited_by_email) = my_email.email)
       )
  )
  SELECT o.id, o.name
    FROM public.organizations o
    JOIN visible_ids v ON v.org_id = o.id
$$;

REVOKE ALL ON FUNCTION public.network_visible_orgs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_visible_orgs() TO authenticated, service_role;

-- 4) network_invite_partner: risoluzione email -> organizzazione al suo interno
CREATE OR REPLACE FUNCTION public.network_invite_partner(_email text DEFAULT NULL, _org_b uuid DEFAULT NULL)
RETURNS public.network_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_org_a uuid;
  v_code text;
  v_row public.network_partners%ROWTYPE;
  v_email text;
  v_resolved_org uuid;
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

  v_email := NULLIF(TRIM(LOWER(COALESCE(_email, ''))), '');

  -- Risolvi email -> org (admin di un'altra organizzazione)
  IF _org_b IS NULL AND v_email IS NOT NULL THEN
    SELECT p.org_id INTO v_resolved_org
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
    WHERE lower(u.email) = v_email
      AND p.org_id IS NOT NULL
      AND p.org_id <> v_org_a
    LIMIT 1;

    IF v_resolved_org IS NOT NULL THEN
      _org_b := v_resolved_org;
    END IF;
  END IF;

  IF _org_b IS NOT NULL AND _org_b = v_org_a THEN
    RAISE EXCEPTION 'Non puoi invitare la tua stessa organizzazione' USING ERRCODE = '22023';
  END IF;

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

  v_code := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.network_partners (
    org_a, org_b, invited_by_email, invite_code, invited_by_user
  ) VALUES (
    v_org_a, _org_b, v_email, v_code, auth.uid()
  )
  RETURNING * INTO v_row;

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
$function$;
