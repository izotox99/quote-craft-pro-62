-- Campi aggiuntivi per autisti interni
ALTER TABLE public.autisti
  ADD COLUMN IF NOT EXISTS calcola_riposi boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS numero_ore_ord numeric,
  ADD COLUMN IF NOT EXISTS trasferta numeric,
  ADD COLUMN IF NOT EXISTS trasferta_2 numeric,
  ADD COLUMN IF NOT EXISTS buono_pasto numeric,
  ADD COLUMN IF NOT EXISTS assicurazione numeric,
  ADD COLUMN IF NOT EXISTS percentuale_notturno numeric;

-- Campi aggiuntivi per autisti esterni
ALTER TABLE public.autisti_esterni
  ADD COLUMN IF NOT EXISTS calcola_riposi boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS percentuale_network numeric,
  ADD COLUMN IF NOT EXISTS percentuale_last_minute numeric,
  ADD COLUMN IF NOT EXISTS numero_compto text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS banca text,
  ADD COLUMN IF NOT EXISTS km_voucher numeric,
  ADD COLUMN IF NOT EXISTS modello_veicolo text,
  ADD COLUMN IF NOT EXISTS lingua text;