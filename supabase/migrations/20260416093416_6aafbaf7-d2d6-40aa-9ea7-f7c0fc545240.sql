
-- Clients can insert servizi for their org
CREATE POLICY "Clients can insert servizi"
ON public.servizi
FOR INSERT
TO authenticated
WITH CHECK (
  is_client_user(auth.uid())
  AND org_id = get_client_org_id(auth.uid())
  AND client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Clients can view their organization
CREATE POLICY "Clients can view their org"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  is_client_user(auth.uid()) AND id = get_client_org_id(auth.uid())
);
