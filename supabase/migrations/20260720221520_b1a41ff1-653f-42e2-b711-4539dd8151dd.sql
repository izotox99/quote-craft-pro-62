
-- 1) Estendi autisti_esterni con campi credenziali
ALTER TABLE public.autisti_esterni
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_cambiata_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accettata_at timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_accesso_at timestamptz,
  ADD COLUMN IF NOT EXISTS foto_url text;

CREATE INDEX IF NOT EXISTS idx_autisti_esterni_auth_user
  ON public.autisti_esterni(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2) Deprecate password in chiaro
UPDATE public.autisti SET password = NULL WHERE password IS NOT NULL;
UPDATE public.autisti_esterni SET password = NULL WHERE password IS NOT NULL;

-- 3) Tipizzazione precisa dei parametri retributivi
ALTER TABLE public.autisti
  ALTER COLUMN prezzo_ora_ord TYPE numeric(10,2),
  ALTER COLUMN prezzo_ora_straord TYPE numeric(10,2),
  ALTER COLUMN trasferta TYPE numeric(10,2),
  ALTER COLUMN trasferta_2 TYPE numeric(10,2),
  ALTER COLUMN buono_pasto TYPE numeric(10,2),
  ALTER COLUMN assicurazione TYPE numeric(10,2),
  ALTER COLUMN numero_ore_ord TYPE numeric(5,2),
  ALTER COLUMN percentuale_notturno TYPE numeric(5,2);

-- 4) Estendi funzioni di riconoscimento autista per includere anche autisti_esterni
CREATE OR REPLACE FUNCTION public.is_autista_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT (
    EXISTS (SELECT 1 FROM public.autisti WHERE auth_user_id = _user_id AND attivo = true)
    OR EXISTS (SELECT 1 FROM public.autisti_esterni WHERE auth_user_id = _user_id AND attivo = true)
  )
  AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND org_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = _user_id)
  AND NOT EXISTS (SELECT 1 FROM public.client_utenze WHERE auth_user_id = _user_id AND attivo = true)
$function$;

CREATE OR REPLACE FUNCTION public.get_autista_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id FROM public.autisti WHERE auth_user_id = _user_id AND attivo = true LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_autista_esterno_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id FROM public.autisti_esterni WHERE auth_user_id = _user_id AND attivo = true LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_autista_org_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT org_id FROM public.autisti WHERE auth_user_id = _user_id AND attivo = true LIMIT 1),
    (SELECT org_id FROM public.autisti_esterni WHERE auth_user_id = _user_id AND attivo = true LIMIT 1)
  )
$function$;
