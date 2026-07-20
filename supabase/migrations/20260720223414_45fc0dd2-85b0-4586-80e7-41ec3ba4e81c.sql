
-- Add WITH CHECK clauses to org-scoped UPDATE policies
ALTER POLICY "Org members can update autisti" ON public.autisti
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org members can update autisti_esterni" ON public.autisti_esterni
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org members can update autisti_spese" ON public.autisti_spese
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org members can update fornitori_cs" ON public.fornitori_cs
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org members update passeggeri_rubrica" ON public.passeggeri_rubrica
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Parent clients update own passeggeri" ON public.passeggeri_rubrica
  USING (client_id = (SELECT clients.id FROM public.clients WHERE clients.auth_user_id = auth.uid() LIMIT 1))
  WITH CHECK (client_id = (SELECT clients.id FROM public.clients WHERE clients.auth_user_id = auth.uid() LIMIT 1));

ALTER POLICY "Utenze update parent passeggeri" ON public.passeggeri_rubrica
  USING (client_id = public.get_utenza_parent_client_id(auth.uid()))
  WITH CHECK (client_id = public.get_utenza_parent_client_id(auth.uid()));

ALTER POLICY "Org members can update clients" ON public.clients
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org members update notifiche" ON public.notifiche
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org members can update org templates" ON public.templates
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Admins can update departments" ON public.departments
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Users can update own proposals" ON public.proposals
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER POLICY "Org members can update servizi" ON public.servizi
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Parent clients update their servizi" ON public.servizi
  USING (client_id = (SELECT clients.id FROM public.clients WHERE clients.auth_user_id = auth.uid() LIMIT 1))
  WITH CHECK (client_id = (SELECT clients.id FROM public.clients WHERE clients.auth_user_id = auth.uid() LIMIT 1));

ALTER POLICY "Utenze update their scoped servizi" ON public.servizi
  USING (EXISTS (SELECT 1 FROM public.client_utenze u WHERE u.auth_user_id = auth.uid() AND u.attivo = true AND u.parent_client_id = servizi.client_id AND (u.tipo = 'gruppo'::utenza_tipo OR (u.tipo = 'singolo'::utenza_tipo AND servizi.utenza_id = u.id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.client_utenze u WHERE u.auth_user_id = auth.uid() AND u.attivo = true AND u.parent_client_id = servizi.client_id AND (u.tipo = 'gruppo'::utenza_tipo OR (u.tipo = 'singolo'::utenza_tipo AND servizi.utenza_id = u.id))));

ALTER POLICY "Org members can update veicoli" ON public.veicoli
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org update veicoli_documenti" ON public.veicoli_documenti
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org update gasolio" ON public.veicoli_gasolio
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org update man_ord" ON public.veicoli_manutenzione_ord
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org update man_str" ON public.veicoli_manutenzione_straord
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

ALTER POLICY "Org update spese" ON public.veicoli_spese
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- Revoke EXECUTE from authenticated on internal SECURITY DEFINER helpers
-- that must only be invoked server-side (via service_role / triggers / cron).
REVOKE EXECUTE ON FUNCTION public.hash_share_password(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_utenza_password(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_share_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_utenza_password(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_servizi_annullati() FROM PUBLIC, anon, authenticated;
