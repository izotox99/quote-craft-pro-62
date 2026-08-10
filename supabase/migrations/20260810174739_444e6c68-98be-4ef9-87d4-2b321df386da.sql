-- 1) dedupe servizi_accessori keeping latest row per (servizio, accessorio)
DELETE FROM public.servizi_accessori sa
USING public.servizi_accessori keep
WHERE sa.servizio_id = keep.servizio_id
  AND sa.accessorio_id = keep.accessorio_id
  AND (sa.created_at, sa.id) < (keep.created_at, keep.id);

ALTER TABLE public.servizi_accessori
  ADD CONSTRAINT servizi_accessori_servizio_accessorio_key UNIQUE (servizio_id, accessorio_id);

-- 2) driver view: expose vehicle plate/brand/model
DROP VIEW IF EXISTS public.servizi_autista_view;
CREATE VIEW public.servizi_autista_view
WITH (security_invoker = false) AS
SELECT r.id, r.org_id, r.data_servizio, r.ora_inizio, r.citta, r.luogo_inizio, r.luogo_fine, r.itinerario,
  r.stato, r.stato_autista, r.tipologia, r.transfer_tipo, r.disposizione_oraria, r.tour_tipo,
  r.veicolo_tipo, r.veicolo_id, r.autista_id, r.contatto, r.telefono_contatto, r.telefono_d, r.email_contatto,
  r.n_passeggeri, r.n_bagagli, r.accessori, r.info_autista, r.info_cliente_autista, r.note, r.codice, r.foglio,
  r.cartello, r.cartello_path, r.cartello_nome, r.tipo_pagamento, r.allegato_path, r.allegato_nome,
  r.con_guida, r.con_assistente, r.ritirare_voucher, r.permesso_effettuato,
  r.modificato_da_cliente, r.modificato_at, r.transfer_concluso_at, r.transfer_nota_chiusura,
  r.dispo_conclusa_at, r.dispo_nota_chiusura, r.km_inizio_servizio, r.km_fine_servizio,
  r.network_autista_nome, r.network_autista_telefono, r.network_autista_targa,
  r.created_at, r.updated_at,
  public.autista_servizio_societa(r.id) AS societa_cliente,
  public.autista_servizio_accessori(r.id) AS accessori_dettaglio,
  v.targa AS veicolo_targa,
  v.marca AS veicolo_marca,
  v.modello AS veicolo_modello,
  v.photo_url AS veicolo_foto_url,
  v.km_attuale AS veicolo_km_attuale
FROM public.servizi_autista_rows() r
LEFT JOIN public.veicoli v ON v.id = r.veicolo_id;

GRANT SELECT ON public.servizi_autista_view TO authenticated;