-- Ensure pgcrypto is available (already used by hash_share_password)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Add password_hash column (nullable initially for backfill)
ALTER TABLE public.client_utenze
ADD COLUMN IF NOT EXISTS password_hash text;

-- 2. Helper functions
CREATE OR REPLACE FUNCTION public.hash_utenza_password(_password text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.crypt(_password, extensions.gen_salt('bf'))
$$;

CREATE OR REPLACE FUNCTION public.verify_utenza_password(_utenza_id uuid, _password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_utenze
    WHERE id = _utenza_id
      AND password_hash IS NOT NULL
      AND password_hash = extensions.crypt(_password, password_hash)
  )
$$;

-- 3. Backfill existing plaintext passwords into password_hash
UPDATE public.client_utenze
SET password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
WHERE password_hash IS NULL
  AND password IS NOT NULL;

-- 4. Make password_hash required for new rows; keep legacy `password` column nullable
ALTER TABLE public.client_utenze
ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE public.client_utenze
ALTER COLUMN password DROP NOT NULL;