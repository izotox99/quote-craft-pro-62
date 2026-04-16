
-- Add auth_user_id and gdpr_accepted_at to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS gdpr_accepted_at timestamp with time zone;

-- Function to check if current user is a client
CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE auth_user_id = _user_id
  )
$$;

-- Function to get client's org_id
CREATE OR REPLACE FUNCTION public.get_client_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.clients WHERE auth_user_id = _user_id LIMIT 1
$$;

-- Clients can view their own client record
CREATE POLICY "Clients can view own record"
ON public.clients
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Clients can update their own gdpr_accepted_at
CREATE POLICY "Clients can update own gdpr"
ON public.clients
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Clients can view servizi of their org
CREATE POLICY "Clients can view their org servizi"
ON public.servizi
FOR SELECT
TO authenticated
USING (
  is_client_user(auth.uid()) AND org_id = get_client_org_id(auth.uid())
  AND client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
);
