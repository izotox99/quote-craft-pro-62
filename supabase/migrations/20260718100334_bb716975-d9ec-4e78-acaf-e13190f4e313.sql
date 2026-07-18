ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS non_incassato numeric(10,2),
  ADD COLUMN IF NOT EXISTS costo_centro numeric(10,2);