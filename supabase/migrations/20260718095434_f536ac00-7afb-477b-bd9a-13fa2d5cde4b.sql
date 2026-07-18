
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (edge functions) can access this table.

CREATE INDEX idx_login_attempts_email_time
  ON public.login_attempts (lower(email), attempted_at DESC)
  WHERE success = false;

CREATE INDEX idx_login_attempts_ip_time
  ON public.login_attempts (ip_address, attempted_at DESC)
  WHERE success = false AND ip_address IS NOT NULL;

-- Extend cleanup routine
CREATE OR REPLACE FUNCTION public.cleanup_servizi_annullati()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.servizi
  SET archiviato = true
  WHERE stato = 'annullato'
    AND archiviato = false
    AND COALESCE(modificato_at, updated_at) < now() - interval '7 days';

  DELETE FROM public.notifiche
  WHERE created_at < now() - interval '30 days';

  DELETE FROM public.login_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$function$;

-- Clean up residual plaintext passwords (bcrypt hash already stored)
UPDATE public.client_utenze
SET password = NULL
WHERE password IS NOT NULL
  AND password_hash IS NOT NULL
  AND password_hash LIKE '$2%';
