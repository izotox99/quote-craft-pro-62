ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS fatturato boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_minute boolean NOT NULL DEFAULT false;