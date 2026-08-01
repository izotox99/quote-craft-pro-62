
-- servizi: rami org
ALTER POLICY "Org members can insert servizi" ON public.servizi
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));
ALTER POLICY "Org members can update servizi" ON public.servizi
  USING (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
  WITH CHECK (org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()));

-- servizi_accessori: ramo org dell'insert
ALTER POLICY "Insert servizi_accessori scoped" ON public.servizi_accessori
  WITH CHECK (EXISTS (
    SELECT 1 FROM servizi s
    WHERE s.id = servizi_accessori.servizio_id
      AND (
        (s.org_id = get_user_org_id(auth.uid()) AND can_write(auth.uid()))
        OR (is_client_user(auth.uid()) AND s.org_id = get_client_org_id(auth.uid())
            AND (s.client_id = (SELECT c.id FROM clients c WHERE c.auth_user_id = auth.uid() LIMIT 1)
              OR EXISTS (SELECT 1 FROM client_utenze u
                         WHERE u.auth_user_id = auth.uid() AND u.attivo = true
                           AND u.parent_client_id = s.client_id
                           AND (u.tipo = 'gruppo'::utenza_tipo
                                OR (u.tipo = 'singolo'::utenza_tipo AND s.utenza_id = u.id)))))
      )
  ));

-- gestione ruoli riservata al titolare, limitata alla propria org
CREATE OR REPLACE FUNCTION public.owner_can_manage_user(_target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    JOIN public.profiles p ON p.org_id = o.id
    WHERE o.owner_user_id = auth.uid()
      AND p.user_id = _target_user
      AND o.owner_user_id <> _target_user
  );
$$;
REVOKE EXECUTE ON FUNCTION public.owner_can_manage_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_can_manage_user(uuid) TO authenticated;

ALTER POLICY "Admins can insert roles" ON public.user_roles
  WITH CHECK (public.owner_can_manage_user(user_id));
ALTER POLICY "Admins can update roles" ON public.user_roles
  USING (public.owner_can_manage_user(user_id));
ALTER POLICY "Admins can delete roles" ON public.user_roles
  USING (public.owner_can_manage_user(user_id));

-- guardia sola lettura nelle RPC operative
DO $do$
DECLARE
  fn record;
  def text;
  guard text := E'\nBEGIN\n  IF NOT public.can_write(auth.uid()) THEN\n    RAISE EXCEPTION ''Permesso negato: account in sola lettura'' USING ERRCODE = ''42501'';\n  END IF;\n';
BEGIN
  FOR fn IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('approva_assenza','rifiuta_assenza','inserisci_assenza_ufficio',
                        'network_dispatch_servizio','network_withdraw_servizio',
                        'network_invite_partner','network_revoke_partnership',
                        'veicolo_tagliando_eseguito')
  LOOP
    def := pg_get_functiondef(fn.oid);
    IF position('can_write(auth.uid())' in def) = 0 THEN
      def := overlay(def placing guard from position(E'\nBEGIN\n' in def) for length(E'\nBEGIN\n'));
      EXECUTE def;
    END IF;
  END LOOP;
END
$do$;
