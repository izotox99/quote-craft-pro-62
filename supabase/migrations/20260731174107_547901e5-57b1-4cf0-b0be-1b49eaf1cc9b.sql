
DROP POLICY IF EXISTS "Scontrini insert org" ON storage.objects;
CREATE POLICY "Scontrini insert org" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'scontrini-carburante'
  AND (storage.foldername(name))[1] IN (
    coalesce(public.get_user_org_id(auth.uid())::text, ''),
    coalesce(public.get_autista_org_id(auth.uid())::text, '')
  )
);

DROP POLICY IF EXISTS "Scontrini select org" ON storage.objects;
CREATE POLICY "Scontrini select org" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'scontrini-carburante'
  AND (storage.foldername(name))[1] IN (
    coalesce(public.get_user_org_id(auth.uid())::text, ''),
    coalesce(public.get_autista_org_id(auth.uid())::text, '')
  )
);

DROP POLICY IF EXISTS "Scontrini delete org" ON storage.objects;
CREATE POLICY "Scontrini delete org" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'scontrini-carburante'
  AND (storage.foldername(name))[1] = coalesce(public.get_user_org_id(auth.uid())::text, '')
);
