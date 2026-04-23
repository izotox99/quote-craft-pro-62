
CREATE POLICY "Utenze can view themselves"
ON public.client_utenze FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Allow utenze to view their parent client (for org/company name)
CREATE POLICY "Utenze can view their parent client"
ON public.clients FOR SELECT
TO authenticated
USING (
  id = (SELECT parent_client_id FROM public.client_utenze
        WHERE auth_user_id = auth.uid() AND attivo = true LIMIT 1)
);

-- Allow utenze to view sibling utenze (for the Prenota dropdown)
CREATE POLICY "Utenze can view sibling utenze"
ON public.client_utenze FOR SELECT
TO authenticated
USING (
  parent_client_id = (SELECT parent_client_id FROM public.client_utenze
                       WHERE auth_user_id = auth.uid() AND attivo = true LIMIT 1)
);
