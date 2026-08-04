CREATE OR REPLACE FUNCTION public.autista_can_read_allegato(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.servizi s
    WHERE s.id::text = (storage.foldername(_path))[2]
      AND s.org_id::text = (storage.foldername(_path))[1]
      AND (storage.foldername(_path))[3] = 'cartello'
      AND (
        s.autista_id = public.get_autista_id(auth.uid())
        OR s.autista_esterno_id = public.get_autista_esterno_id(auth.uid())
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.autista_can_read_allegato(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autista_can_read_allegato(text) TO authenticated;

DROP POLICY IF EXISTS "Autisti view servizi allegati" ON storage.objects;

CREATE POLICY "Autisti view cartello servizi assegnati"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'servizi-allegati'
  AND public.is_autista_user(auth.uid())
  AND public.autista_can_read_allegato(name)
);