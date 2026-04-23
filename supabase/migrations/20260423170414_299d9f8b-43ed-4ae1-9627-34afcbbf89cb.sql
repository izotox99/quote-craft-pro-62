DROP POLICY IF EXISTS "Utenze can view their parent client" ON public.clients;

CREATE POLICY "Utenze can view their parent client"
ON public.clients
FOR SELECT
TO authenticated
USING (
  id = public.get_utenza_parent_client_id(auth.uid())
);