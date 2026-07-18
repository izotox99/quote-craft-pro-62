
CREATE TABLE IF NOT EXISTS public.password_fingerprints (
  fingerprint text PRIMARY KEY,
  owner_type text NOT NULL CHECK (owner_type IN ('client','utenza')),
  owner_id uuid NOT NULL,
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id)
);

GRANT ALL ON public.password_fingerprints TO service_role;

ALTER TABLE public.password_fingerprints ENABLE ROW LEVEL SECURITY;

-- Nessuna policy: solo service_role (nelle edge function) può leggere/scrivere.

CREATE INDEX IF NOT EXISTS idx_password_fingerprints_owner
  ON public.password_fingerprints (owner_type, owner_id);
