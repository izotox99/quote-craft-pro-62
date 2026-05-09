
ALTER TABLE public.veicoli
  ADD COLUMN IF NOT EXISTS consumo_km_litro numeric,
  ADD COLUMN IF NOT EXISTS manutenzione_ordinaria text,
  ADD COLUMN IF NOT EXISTS visibile_servizi boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibile_magazzino boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS km_voucher numeric,
  ADD COLUMN IF NOT EXISTS km_iniziale numeric,
  ADD COLUMN IF NOT EXISTS prezzo_acquisto numeric,
  ADD COLUMN IF NOT EXISTS quota_mensile_credito numeric,
  ADD COLUMN IF NOT EXISTS data_inizio_credito date,
  ADD COLUMN IF NOT EXISTS data_ultima_quota_credito date,
  ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('veicoli-foto', 'veicoli-foto', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public read veicoli foto"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'veicoli-foto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated upload veicoli foto"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'veicoli-foto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated update veicoli foto"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'veicoli-foto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated delete veicoli foto"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'veicoli-foto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
