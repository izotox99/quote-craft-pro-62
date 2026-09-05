CREATE OR REPLACE VIEW public.scadenze_costi AS
 SELECT 'autista'::text AS origine,
    s.id AS riga_id,
    s.org_id,
    COALESCE(a.nome, 'Autista'::text) AS riferimento,
    s.autista_id,
    NULL::uuid AS veicolo_id,
    s.tipo,
    s.data_scadenza,
    s.giorni_preavviso,
    s.data_scadenza - CURRENT_DATE AS giorni_mancanti,
    CASE
      WHEN s.data_scadenza < CURRENT_DATE THEN 'scaduto'::text
      WHEN s.data_scadenza <= (CURRENT_DATE + s.giorni_preavviso) THEN 'avviso'::text
      ELSE 'ok'::text
    END AS stato
   FROM public.autisti_spese s
     LEFT JOIN public.autisti a ON a.id = s.autista_id
  WHERE s.data_scadenza IS NOT NULL
UNION ALL
 SELECT 'veicolo'::text AS origine,
    v.id AS riga_id,
    v.org_id,
    COALESCE(m.targa, 'Mezzo'::text) || COALESCE(' - '::text || COALESCE(m.modello, m.tipo_macchina), ''::text) AS riferimento,
    NULL::uuid AS autista_id,
    v.veicolo_id,
    v.tipo,
    v.data_scadenza,
    v.giorni_preavviso,
    v.data_scadenza - CURRENT_DATE AS giorni_mancanti,
    CASE
      WHEN v.data_scadenza < CURRENT_DATE THEN 'scaduto'::text
      WHEN v.data_scadenza <= (CURRENT_DATE + v.giorni_preavviso) THEN 'avviso'::text
      ELSE 'ok'::text
    END AS stato
   FROM public.veicoli_spese v
     LEFT JOIN public.veicoli m ON m.id = v.veicolo_id
  WHERE v.data_scadenza IS NOT NULL;

DROP TABLE IF EXISTS public.costi_generali;

DELETE FROM public.config_tipi_costo WHERE ambito = 'generale';

CREATE OR REPLACE FUNCTION public.seed_config_tipi_costo(_org uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.config_tipi_costo (org_id, ambito, valore, ricorrente, ordine)
  VALUES
    (_org, 'autista', 'Patente', true, 1),
    (_org, 'autista', 'Patente K', true, 2),
    (_org, 'autista', 'Permesso Civitavecchia', true, 3),
    (_org, 'autista', 'Visita medica', true, 4),
    (_org, 'autista', 'Altro', false, 5),
    (_org, 'veicolo', 'Bollo', true, 1),
    (_org, 'veicolo', 'Assicurazione', true, 2),
    (_org, 'veicolo', 'Licenza', true, 3),
    (_org, 'veicolo', 'Permesso ZTL', true, 4),
    (_org, 'veicolo', 'Rata finanziamento', true, 5)
  ON CONFLICT (org_id, ambito, valore) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.seed_config_tipi_costo(uuid) FROM public, anon, authenticated;