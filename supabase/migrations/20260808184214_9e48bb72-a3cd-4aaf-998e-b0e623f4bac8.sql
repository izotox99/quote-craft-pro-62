CREATE OR REPLACE FUNCTION public.autista_servizio_societa(_servizio_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(NULLIF(c.company, ''), NULLIF(c.societa_fattura, ''), c.name)
  FROM public.servizi s
  JOIN public.clients c ON c.id = s.client_id
  WHERE s.id = _servizio_id
    AND s.autista_id = public.get_autista_id(auth.uid())
    AND s.org_id = public.get_autista_org_id(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.autista_servizio_accessori(_servizio_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT string_agg(sa.quantita || '× ' || a.nome, ', ' ORDER BY a.nome)
  FROM public.servizi_accessori sa
  JOIN public.accessori_catalogo a ON a.id = sa.accessorio_id
  WHERE sa.servizio_id = _servizio_id
    AND EXISTS (
      SELECT 1 FROM public.servizi s
      WHERE s.id = _servizio_id
        AND s.autista_id = public.get_autista_id(auth.uid())
        AND s.org_id = public.get_autista_org_id(auth.uid())
    )
$$;

GRANT EXECUTE ON FUNCTION public.autista_servizio_societa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.autista_servizio_accessori(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.servizi_autista_view
WITH (security_invoker = true) AS
SELECT
  r.id, r.org_id, r.data_servizio, r.ora_inizio, r.citta, r.luogo_inizio, r.luogo_fine,
  r.itinerario, r.stato, r.stato_autista, r.tipologia, r.transfer_tipo, r.disposizione_oraria,
  r.tour_tipo, r.veicolo_tipo, r.veicolo_id, r.autista_id, r.contatto, r.telefono_contatto,
  r.telefono_d, r.email_contatto, r.n_passeggeri, r.n_bagagli, r.accessori, r.info_autista,
  r.info_cliente_autista, r.note, r.codice, r.foglio, r.cartello, r.cartello_path, r.cartello_nome,
  r.tipo_pagamento, r.allegato_path, r.allegato_nome, r.con_guida, r.con_assistente,
  r.ritirare_voucher, r.permesso_effettuato, r.modificato_da_cliente, r.modificato_at,
  r.transfer_concluso_at, r.transfer_nota_chiusura, r.dispo_conclusa_at, r.dispo_nota_chiusura,
  r.km_inizio_servizio, r.km_fine_servizio, r.network_autista_nome, r.network_autista_telefono,
  r.network_autista_targa, r.created_at, r.updated_at,
  public.autista_servizio_societa(r.id) AS societa_cliente,
  public.autista_servizio_accessori(r.id) AS accessori_dettaglio
FROM public.servizi_autista_rows() r;

GRANT SELECT ON public.servizi_autista_view TO authenticated;