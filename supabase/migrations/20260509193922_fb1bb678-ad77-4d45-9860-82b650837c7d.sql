ALTER TABLE public.veicoli
  ADD COLUMN IF NOT EXISTS attivo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dati_tecnici text,
  ADD COLUMN IF NOT EXISTS km_attuale integer,
  ADD COLUMN IF NOT EXISTS km_prima_scadenza integer,
  ADD COLUMN IF NOT EXISTS data_immatricolazione date,
  ADD COLUMN IF NOT EXISTS telaio text;

CREATE INDEX IF NOT EXISTS idx_veicoli_attivo ON public.veicoli(attivo);