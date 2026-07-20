
-- 1. Autisti: nuove colonne
ALTER TABLE public.autisti
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_cambiata_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accettata_at timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_accesso_at timestamptz,
  ADD COLUMN IF NOT EXISTS foto_url text;

CREATE INDEX IF NOT EXISTS idx_autisti_auth_user ON public.autisti(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2. Funzioni SECURITY DEFINER per la categoria "autista"
CREATE OR REPLACE FUNCTION public.is_autista_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.autisti
    WHERE auth_user_id = _user_id AND attivo = true
  )
  AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND org_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = _user_id)
  AND NOT EXISTS (SELECT 1 FROM public.client_utenze WHERE auth_user_id = _user_id AND attivo = true)
$$;

CREATE OR REPLACE FUNCTION public.get_autista_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.autisti WHERE auth_user_id = _user_id AND attivo = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_autista_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.autisti WHERE auth_user_id = _user_id AND attivo = true LIMIT 1
$$;

-- 3. is_client_user: escludi esplicitamente gli autisti
CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND org_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.autisti WHERE auth_user_id = _user_id AND attivo = true)
    AND (
      EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.client_utenze WHERE auth_user_id = _user_id AND attivo = true)
    )
$$;

REVOKE EXECUTE ON FUNCTION public.is_autista_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_autista_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_autista_org_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_autista_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_autista_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_autista_org_id(uuid) TO authenticated;

-- 4. Vista servizi per autista (solo operativi, filtro server-side su auth.uid())
DROP VIEW IF EXISTS public.servizi_autista_view;
CREATE VIEW public.servizi_autista_view
WITH (security_invoker = false)
AS
SELECT
  s.id, s.org_id, s.data_servizio, s.ora_inizio, s.citta,
  s.luogo_inizio, s.luogo_fine, s.itinerario, s.stato,
  s.tipologia, s.transfer_tipo, s.disposizione_oraria, s.tour_tipo,
  s.veicolo_tipo, s.veicolo_id, s.autista_id,
  s.contatto, s.telefono_contatto, s.telefono_d, s.email_contatto,
  s.n_passeggeri, s.n_bagagli, s.accessori,
  s.info_autista, s.info_cliente_autista, s.note,
  s.codice, s.foglio,
  s.tipo_pagamento,
  s.allegato_path, s.allegato_nome,
  s.con_guida, s.con_assistente, s.ritirare_voucher, s.permesso_effettuato,
  s.modificato_da_cliente, s.modificato_at,
  s.network_autista_nome, s.network_autista_telefono, s.network_autista_targa,
  s.created_at, s.updated_at
FROM public.servizi s
WHERE s.archiviato = false
  AND s.autista_id IS NOT NULL
  AND s.autista_id = public.get_autista_id(auth.uid())
  AND s.org_id = public.get_autista_org_id(auth.uid());

REVOKE ALL ON public.servizi_autista_view FROM PUBLIC, anon;
GRANT SELECT ON public.servizi_autista_view TO authenticated;
