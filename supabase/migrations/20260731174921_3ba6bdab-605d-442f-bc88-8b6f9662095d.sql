
CREATE POLICY "Allegati autisti insert org" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'allegati-autisti'
  AND (storage.foldername(name))[1] IN (
    coalesce(public.get_user_org_id(auth.uid())::text, ''),
    coalesce(public.get_autista_org_id(auth.uid())::text, '')
  )
);

CREATE POLICY "Allegati autisti select org" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'allegati-autisti'
  AND (storage.foldername(name))[1] IN (
    coalesce(public.get_user_org_id(auth.uid())::text, ''),
    coalesce(public.get_autista_org_id(auth.uid())::text, '')
  )
);

CREATE POLICY "Allegati autisti delete ufficio" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'allegati-autisti'
  AND (storage.foldername(name))[1] = coalesce(public.get_user_org_id(auth.uid())::text, '')
);
