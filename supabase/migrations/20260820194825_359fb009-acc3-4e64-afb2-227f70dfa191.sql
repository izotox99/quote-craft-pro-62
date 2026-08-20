-- 1. Campi extra spese autisti
ALTER TABLE public.autisti_spese
  ADD COLUMN IF NOT EXISTS tipo_pagamento text,
  ADD COLUMN IF NOT EXISTS centro_costo text NOT NULL DEFAULT 'autista',
  ADD COLUMN IF NOT EXISTS giorni_preavviso integer NOT NULL DEFAULT 30;

-- 2. Campi extra spese veicoli
ALTER TABLE public.veicoli_spese
  ADD COLUMN IF NOT EXISTS tipo_pagamento text,
  ADD COLUMN IF NOT EXISTS fornitore text,
  ADD COLUMN IF NOT EXISTS centro_costo text NOT NULL DEFAULT 'veicolo',
  ADD COLUMN IF NOT EXISTS ricorrenza text,
  ADD COLUMN IF NOT EXISTS giorni_preavviso integer NOT NULL DEFAULT 30;

-- 3. Altri costi (spese generali)
CREATE TABLE IF NOT EXISTS public.costi_generali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  descrizione text NOT NULL,
  categoria text,
  data date,
  data_scadenza date,
  importo numeric NOT NULL DEFAULT 0,
  tipo_pagamento text,
  fornitore text,
  note text,
  centro_costo text NOT NULL DEFAULT 'generale',
  giorni_preavviso integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costi_generali TO authenticated;
GRANT ALL ON public.costi_generali TO service_role;
ALTER TABLE public.costi_generali ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org view costi generali" ON public.costi_generali;
CREATE POLICY "Org view costi generali" ON public.costi_generali FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
DROP POLICY IF EXISTS "Org insert costi generali" ON public.costi_generali;
CREATE POLICY "Org insert costi generali" ON public.costi_generali FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));
DROP POLICY IF EXISTS "Org update costi generali" ON public.costi_generali;
CREATE POLICY "Org update costi generali" ON public.costi_generali FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));
DROP POLICY IF EXISTS "Org delete costi generali" ON public.costi_generali;
CREATE POLICY "Org delete costi generali" ON public.costi_generali FOR DELETE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

DROP TRIGGER IF EXISTS trg_costi_generali_org ON public.costi_generali;
CREATE TRIGGER trg_costi_generali_org BEFORE INSERT ON public.costi_generali
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();
DROP TRIGGER IF EXISTS trg_costi_generali_updated ON public.costi_generali;
CREATE TRIGGER trg_costi_generali_updated BEFORE UPDATE ON public.costi_generali
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_costi_generali_org ON public.costi_generali(org_id);
CREATE INDEX IF NOT EXISTS idx_costi_generali_scad ON public.costi_generali(data_scadenza) WHERE data_scadenza IS NOT NULL;

-- 4. Tipi di costo configurabili
CREATE TABLE IF NOT EXISTS public.config_tipi_costo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  ambito text NOT NULL CHECK (ambito IN ('autista','veicolo','generale')),
  valore text NOT NULL,
  ricorrente boolean NOT NULL DEFAULT false,
  ordine integer NOT NULL DEFAULT 0,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, ambito, valore)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_tipi_costo TO authenticated;
GRANT ALL ON public.config_tipi_costo TO service_role;
ALTER TABLE public.config_tipi_costo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org view tipi costo" ON public.config_tipi_costo;
CREATE POLICY "Org view tipi costo" ON public.config_tipi_costo FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));
DROP POLICY IF EXISTS "Org manage tipi costo" ON public.config_tipi_costo;
CREATE POLICY "Org manage tipi costo" ON public.config_tipi_costo FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()) AND public.can_write(auth.uid()));

DROP TRIGGER IF EXISTS trg_config_tipi_costo_org ON public.config_tipi_costo;
CREATE TRIGGER trg_config_tipi_costo_org BEFORE INSERT ON public.config_tipi_costo
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_org_id();

-- 5. Seed dei tipi di default per una org
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
    (_org, 'veicolo', 'Rata finanziamento', true, 5),
    (_org, 'generale', 'Utenze', false, 1),
    (_org, 'generale', 'Affitto', true, 2),
    (_org, 'generale', 'Consulenze', false, 3),
    (_org, 'generale', 'Abbonamenti', true, 4),
    (_org, 'generale', 'Altro', false, 5)
  ON CONFLICT (org_id, ambito, valore) DO NOTHING;
$$;

-- popola le org già esistenti
DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_config_tipi_costo(o.id);
  END LOOP;
END $$;

-- aggancio alla creazione organizzazione
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_account_type text;
  v_org_id uuid;
  v_org_name text;
BEGIN
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', '');

  IF v_account_type IN ('client', 'autista', 'org_member') THEN
    RETURN NEW;
  END IF;

  v_org_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'company_name', '')), '');
  IF v_org_name IS NULL THEN
    v_org_name := COALESCE(split_part(NEW.email, '@', 1), 'NCC');
  END IF;

  INSERT INTO public.organizations (name, owner_user_id) VALUES (v_org_name, NEW.id) RETURNING id INTO v_org_id;
  INSERT INTO public.profiles (user_id, org_id) VALUES (NEW.id, v_org_id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  PERFORM public.seed_config_tipi_costo(v_org_id);

  RETURN NEW;
END;
$function$;

-- 6. Vista unica delle scadenze costi
CREATE OR REPLACE VIEW public.scadenze_costi
WITH (security_invoker = true) AS
SELECT
  'autista'::text AS origine,
  s.id AS riga_id,
  s.org_id,
  COALESCE(a.nome, 'Autista') AS riferimento,
  s.autista_id AS autista_id,
  NULL::uuid AS veicolo_id,
  s.tipo,
  s.data_scadenza,
  s.giorni_preavviso,
  (s.data_scadenza - CURRENT_DATE) AS giorni_mancanti,
  CASE
    WHEN s.data_scadenza < CURRENT_DATE THEN 'scaduto'
    WHEN s.data_scadenza <= CURRENT_DATE + s.giorni_preavviso THEN 'avviso'
    ELSE 'ok'
  END AS stato
FROM public.autisti_spese s
LEFT JOIN public.autisti a ON a.id = s.autista_id
WHERE s.data_scadenza IS NOT NULL
UNION ALL
SELECT
  'veicolo'::text,
  v.id,
  v.org_id,
  COALESCE(m.targa, 'Mezzo') || COALESCE(' - ' || COALESCE(m.modello, m.tipo_macchina), ''),
  NULL::uuid,
  v.veicolo_id,
  v.tipo,
  v.data_scadenza,
  v.giorni_preavviso,
  (v.data_scadenza - CURRENT_DATE),
  CASE
    WHEN v.data_scadenza < CURRENT_DATE THEN 'scaduto'
    WHEN v.data_scadenza <= CURRENT_DATE + v.giorni_preavviso THEN 'avviso'
    ELSE 'ok'
  END
FROM public.veicoli_spese v
LEFT JOIN public.veicoli m ON m.id = v.veicolo_id
WHERE v.data_scadenza IS NOT NULL
UNION ALL
SELECT
  'generale'::text,
  g.id,
  g.org_id,
  g.descrizione,
  NULL::uuid,
  NULL::uuid,
  COALESCE(g.categoria, 'Costo generale'),
  g.data_scadenza,
  g.giorni_preavviso,
  (g.data_scadenza - CURRENT_DATE),
  CASE
    WHEN g.data_scadenza < CURRENT_DATE THEN 'scaduto'
    WHEN g.data_scadenza <= CURRENT_DATE + g.giorni_preavviso THEN 'avviso'
    ELSE 'ok'
  END
FROM public.costi_generali g
WHERE g.data_scadenza IS NOT NULL;

GRANT SELECT ON public.scadenze_costi TO authenticated;

-- 7. Deduplica notifiche scadenze
CREATE TABLE IF NOT EXISTS public.scadenze_notificate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origine text NOT NULL,
  riga_id uuid NOT NULL,
  data_scadenza date NOT NULL,
  fase text NOT NULL CHECK (fase IN ('avviso','scaduto')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origine, riga_id, data_scadenza, fase)
);
GRANT SELECT ON public.scadenze_notificate TO authenticated;
GRANT ALL ON public.scadenze_notificate TO service_role;
ALTER TABLE public.scadenze_notificate ENABLE ROW LEVEL SECURITY;

-- 8. Job giornaliero: una sola notifica per fase
CREATE OR REPLACE FUNCTION public.scadenze_costi_process()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM public.scadenze_costi WHERE stato IN ('avviso','scaduto')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.scadenze_notificate n
      WHERE n.origine = r.origine AND n.riga_id = r.riga_id
        AND n.data_scadenza = r.data_scadenza AND n.fase = r.stato
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifiche (org_id, tipo, titolo, messaggio)
    VALUES (
      r.org_id,
      'scadenza_costo',
      CASE WHEN r.stato = 'scaduto' THEN 'Scadenza superata: ' ELSE 'Scadenza in arrivo: ' END || r.tipo,
      r.riferimento || ' — ' || r.tipo || ' scade il ' || to_char(r.data_scadenza, 'DD/MM/YYYY') ||
      CASE WHEN r.stato = 'scaduto'
        THEN ' (scaduta da ' || ABS(r.giorni_mancanti) || ' giorni)'
        ELSE ' (tra ' || r.giorni_mancanti || ' giorni)' END
    );

    INSERT INTO public.scadenze_notificate (origine, riga_id, data_scadenza, fase)
    VALUES (r.origine, r.riga_id, r.data_scadenza, r.stato)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;