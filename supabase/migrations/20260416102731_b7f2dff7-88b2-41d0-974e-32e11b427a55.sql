
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS ora_inizio text,
  ADD COLUMN IF NOT EXISTS email_contatto text,
  ADD COLUMN IF NOT EXISTS veicolo_tipo text,
  ADD COLUMN IF NOT EXISTS transfer_tipo text,
  ADD COLUMN IF NOT EXISTS disposizione_oraria text,
  ADD COLUMN IF NOT EXISTS tour_tipo text,
  ADD COLUMN IF NOT EXISTS tipo_pagamento text,
  ADD COLUMN IF NOT EXISTS prezzo numeric,
  ADD COLUMN IF NOT EXISTS centro_costo text;
