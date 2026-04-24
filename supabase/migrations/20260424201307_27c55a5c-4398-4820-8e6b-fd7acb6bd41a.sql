
-- Add attachment columns to servizi
ALTER TABLE public.servizi
  ADD COLUMN IF NOT EXISTS allegato_path text,
  ADD COLUMN IF NOT EXISTS allegato_nome text;

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('servizi-allegati', 'servizi-allegati', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
-- Path convention: {org_id}/{servizio_id}/{filename}

-- Org members: full access to their org folder
CREATE POLICY "Org members view servizi allegati"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
);

CREATE POLICY "Org members upload servizi allegati"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'servizi-allegati'
  AND (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
);

CREATE POLICY "Org members update servizi allegati"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
);

CREATE POLICY "Org members delete servizi allegati"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
);

-- Clients (parent + utenze): access to their org folder
CREATE POLICY "Clients view servizi allegati"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND public.is_client_user(auth.uid())
  AND (storage.foldername(name))[1] = public.get_client_org_id(auth.uid())::text
);

CREATE POLICY "Clients upload servizi allegati"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'servizi-allegati'
  AND public.is_client_user(auth.uid())
  AND (storage.foldername(name))[1] = public.get_client_org_id(auth.uid())::text
);

CREATE POLICY "Clients update servizi allegati"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND public.is_client_user(auth.uid())
  AND (storage.foldername(name))[1] = public.get_client_org_id(auth.uid())::text
);

CREATE POLICY "Clients delete servizi allegati"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND public.is_client_user(auth.uid())
  AND (storage.foldername(name))[1] = public.get_client_org_id(auth.uid())::text
);
