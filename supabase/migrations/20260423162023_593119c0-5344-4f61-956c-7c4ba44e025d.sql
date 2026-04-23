
-- 1. Add utenza_id to servizi to track which sub-user booked the service
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS utenza_id uuid REFERENCES public.client_utenze(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_servizi_utenza_id ON public.servizi(utenza_id);

-- 2. Helper: returns the active utenza row for the currently authenticated user
--    Utenze share the parent client's auth account, so we identify them via auth_user_id link.
CREATE OR REPLACE FUNCTION public.get_active_utenza_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.client_utenze
  WHERE auth_user_id = _user_id
    AND attivo = true
  LIMIT 1
$$;

-- 3. Helper: parent client id for a utenza user
CREATE OR REPLACE FUNCTION public.get_utenza_parent_client_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT parent_client_id
  FROM public.client_utenze
  WHERE auth_user_id = _user_id
    AND attivo = true
  LIMIT 1
$$;

-- 4. Update is_client_user to include utenze users
CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients WHERE auth_user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.client_utenze WHERE auth_user_id = _user_id AND attivo = true
  )
$$;

-- 5. Update get_client_org_id to support utenza users
CREATE OR REPLACE FUNCTION public.get_client_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT org_id FROM public.clients WHERE auth_user_id = _user_id LIMIT 1),
    (SELECT c.org_id FROM public.client_utenze u
       JOIN public.clients c ON c.id = u.parent_client_id
       WHERE u.auth_user_id = _user_id AND u.attivo = true LIMIT 1)
  )
$$;

-- 6. Drop and recreate servizi RLS for clients + utenze
DROP POLICY IF EXISTS "Clients can view their org servizi" ON public.servizi;
DROP POLICY IF EXISTS "Clients can insert servizi" ON public.servizi;
DROP POLICY IF EXISTS "Clients can update servizi" ON public.servizi;

-- Parent client sees ALL servizi for their client_id
CREATE POLICY "Parent clients view their servizi"
ON public.servizi FOR SELECT
TO authenticated
USING (
  client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Utenze "singolo" see only servizi they booked. Utenze "gruppo" see all servizi for parent client.
CREATE POLICY "Utenze view their scoped servizi"
ON public.servizi FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_utenze u
    WHERE u.auth_user_id = auth.uid()
      AND u.attivo = true
      AND u.parent_client_id = servizi.client_id
      AND (
        u.tipo = 'gruppo'
        OR (u.tipo = 'singolo' AND servizi.utenza_id = u.id)
      )
  )
);

-- Parent client can insert servizi
CREATE POLICY "Parent clients insert servizi"
ON public.servizi FOR INSERT
TO authenticated
WITH CHECK (
  is_client_user(auth.uid())
  AND org_id = get_client_org_id(auth.uid())
  AND client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Utenze can insert servizi for their parent client
CREATE POLICY "Utenze insert servizi"
ON public.servizi FOR INSERT
TO authenticated
WITH CHECK (
  is_client_user(auth.uid())
  AND org_id = get_client_org_id(auth.uid())
  AND client_id = get_utenza_parent_client_id(auth.uid())
  AND utenza_id = get_active_utenza_id(auth.uid())
);

-- Parent client can update their servizi (e.g., modifications)
CREATE POLICY "Parent clients update their servizi"
ON public.servizi FOR UPDATE
TO authenticated
USING (
  client_id = (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Utenze can update their scoped servizi
CREATE POLICY "Utenze update their scoped servizi"
ON public.servizi FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_utenze u
    WHERE u.auth_user_id = auth.uid()
      AND u.attivo = true
      AND u.parent_client_id = servizi.client_id
      AND (
        u.tipo = 'gruppo'
        OR (u.tipo = 'singolo' AND servizi.utenza_id = u.id)
      )
  )
);
