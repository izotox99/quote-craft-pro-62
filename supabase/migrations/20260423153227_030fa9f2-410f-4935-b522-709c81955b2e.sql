-- Prevent duplicate client emails within the same organization (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS clients_org_email_unique
  ON public.clients (org_id, lower(email))
  WHERE email IS NOT NULL;