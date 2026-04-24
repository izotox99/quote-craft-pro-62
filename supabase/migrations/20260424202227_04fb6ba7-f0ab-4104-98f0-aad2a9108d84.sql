ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tutorial_completato_at timestamptz;
ALTER TABLE public.client_utenze ADD COLUMN IF NOT EXISTS tutorial_completato_at timestamptz;

DROP POLICY IF EXISTS "Utenze can update own tutorial flag" ON public.client_utenze;
CREATE POLICY "Utenze can update own tutorial flag"
ON public.client_utenze
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());