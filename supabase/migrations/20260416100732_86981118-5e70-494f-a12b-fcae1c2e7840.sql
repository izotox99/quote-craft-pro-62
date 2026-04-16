
-- Enum per tipo utenza
CREATE TYPE public.utenza_tipo AS ENUM ('singolo', 'gruppo');

-- Tabella utenze clienti
CREATE TABLE public.client_utenze (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  cellulare TEXT,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  tipo utenza_tipo NOT NULL DEFAULT 'singolo',
  attivo BOOLEAN NOT NULL DEFAULT true,
  auth_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_utenze ENABLE ROW LEVEL SECURITY;

-- Clients can view utenze of their own company
CREATE POLICY "Clients can view own utenze"
ON public.client_utenze
FOR SELECT
TO authenticated
USING (
  parent_client_id = (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1
  )
);

-- Clients can insert utenze for their own company
CREATE POLICY "Clients can insert own utenze"
ON public.client_utenze
FOR INSERT
TO authenticated
WITH CHECK (
  parent_client_id = (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1
  )
);

-- Clients can update own utenze
CREATE POLICY "Clients can update own utenze"
ON public.client_utenze
FOR UPDATE
TO authenticated
USING (
  parent_client_id = (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1
  )
);

-- Clients can delete own utenze
CREATE POLICY "Clients can delete own utenze"
ON public.client_utenze
FOR DELETE
TO authenticated
USING (
  parent_client_id = (
    SELECT id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1
  )
);

-- Org members can view all utenze of their org's clients
CREATE POLICY "Org members can view client_utenze"
ON public.client_utenze
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_utenze.parent_client_id
    AND c.org_id = get_user_org_id(auth.uid())
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_client_utenze_updated_at
BEFORE UPDATE ON public.client_utenze
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
