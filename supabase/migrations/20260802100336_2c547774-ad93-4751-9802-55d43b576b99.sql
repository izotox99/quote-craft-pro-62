-- 1) Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.guard_veicolo_km_non_decrescente() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_km_da_rifornimento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_veicolo_valuta_tagliando() FROM PUBLIC, anon, authenticated;

-- 2) Replace SECURITY DEFINER view with SECURITY INVOKER view over a definer function
CREATE OR REPLACE FUNCTION public.servizi_autista_rows()
RETURNS SETOF public.servizi
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.*
  FROM public.servizi s
  WHERE s.archiviato = false
    AND s.autista_id IS NOT NULL
    AND s.autista_id = public.get_autista_id(auth.uid())
    AND s.org_id = public.get_autista_org_id(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.servizi_autista_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.servizi_autista_rows() TO authenticated;

DROP VIEW IF EXISTS public.servizi_autista_view;
CREATE VIEW public.servizi_autista_view
WITH (security_invoker = true) AS
  SELECT id, org_id, data_servizio, ora_inizio, citta, luogo_inizio, luogo_fine, itinerario,
         stato, stato_autista, tipologia, transfer_tipo, disposizione_oraria, tour_tipo,
         veicolo_tipo, veicolo_id, autista_id, contatto, telefono_contatto, telefono_d,
         email_contatto, n_passeggeri, n_bagagli, accessori, info_autista, info_cliente_autista,
         note, codice, foglio, cartello, tipo_pagamento, allegato_path, allegato_nome,
         con_guida, con_assistente, ritirare_voucher, permesso_effettuato,
         modificato_da_cliente, modificato_at, transfer_concluso_at, transfer_nota_chiusura,
         dispo_conclusa_at, dispo_nota_chiusura, km_inizio_servizio, km_fine_servizio,
         network_autista_nome, network_autista_telefono, network_autista_targa,
         created_at, updated_at
  FROM public.servizi_autista_rows();

REVOKE ALL ON public.servizi_autista_view FROM PUBLIC, anon;
GRANT SELECT ON public.servizi_autista_view TO authenticated;
GRANT ALL ON public.servizi_autista_view TO service_role;

-- 3) Explicit, priority-based account classification (no pure negative inference)
CREATE OR REPLACE FUNCTION public.get_account_type(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN 'none'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND org_id IS NOT NULL)
      THEN 'staff'
    WHEN EXISTS (SELECT 1 FROM public.autisti WHERE auth_user_id = _user_id AND attivo = true)
      OR EXISTS (SELECT 1 FROM public.autisti_esterni WHERE auth_user_id = _user_id AND attivo = true)
      THEN 'autista'
    WHEN EXISTS (SELECT 1 FROM public.clients WHERE auth_user_id = _user_id AND COALESCE(attivo, true) = true)
      OR EXISTS (SELECT 1 FROM public.client_utenze WHERE auth_user_id = _user_id AND attivo = true)
      THEN 'client'
    ELSE 'none'
  END
$$;

REVOKE ALL ON FUNCTION public.get_account_type(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_account_type(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.get_account_type(_user_id) = 'client' $$;

CREATE OR REPLACE FUNCTION public.is_autista_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.get_account_type(_user_id) = 'autista' $$;