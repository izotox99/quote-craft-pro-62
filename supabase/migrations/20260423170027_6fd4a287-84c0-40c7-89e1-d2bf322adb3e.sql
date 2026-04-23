DROP POLICY IF EXISTS "Utenze can view sibling utenze" ON public.client_utenze;

CREATE POLICY "Utenze can view sibling utenze"
ON public.client_utenze
FOR SELECT
TO authenticated
USING (
  parent_client_id = public.get_utenza_parent_client_id(auth.uid())
);