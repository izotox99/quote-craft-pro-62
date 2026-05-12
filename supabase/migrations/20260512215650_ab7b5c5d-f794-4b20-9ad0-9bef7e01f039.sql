
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS p_iva text,
  ADD COLUMN IF NOT EXISTS sede_legale text;
