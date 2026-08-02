-- 1) accessori_catalogo: restrict client-portal visibility
DROP POLICY IF EXISTS "Org members view accessori_catalogo" ON public.accessori_catalogo;

CREATE POLICY "Org members view accessori_catalogo"
ON public.accessori_catalogo
FOR SELECT
TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Clients view active accessori of their org"
ON public.accessori_catalogo
FOR SELECT
TO authenticated
USING (
  org_id IS NOT NULL
  AND org_id = public.get_client_org_id(auth.uid())
  AND (
    attivo = true
    OR EXISTS (
      SELECT 1
      FROM public.servizi_accessori sa
      JOIN public.servizi s ON s.id = sa.servizio_id
      WHERE sa.accessorio_id = accessori_catalogo.id
        AND s.client_id IN (
          SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid()
          UNION
          SELECT public.get_utenza_parent_client_id(auth.uid())
        )
    )
  )
);

-- 2) storage: folder must match a REAL org of the user + ownership check
DROP POLICY IF EXISTS "Allegati autisti select org" ON storage.objects;
DROP POLICY IF EXISTS "Allegati autisti insert org" ON storage.objects;
DROP POLICY IF EXISTS "Allegati autisti delete ufficio" ON storage.objects;
DROP POLICY IF EXISTS "Scontrini select org" ON storage.objects;
DROP POLICY IF EXISTS "Scontrini insert org" ON storage.objects;
DROP POLICY IF EXISTS "Scontrini delete org" ON storage.objects;

CREATE OR REPLACE FUNCTION public.storage_org_folder_ok(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _folder IS NOT NULL
     AND _folder <> ''
     AND (
       _folder = (public.get_user_org_id(auth.uid()))::text
       OR _folder = (public.get_autista_org_id(auth.uid()))::text
     );
$$;

REVOKE EXECUTE ON FUNCTION public.storage_org_folder_ok(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_org_folder_ok(text) TO authenticated;

-- office members (non-driver) get full org access; drivers only their own objects
CREATE POLICY "Allegati autisti select org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'allegati-autisti'
  AND public.storage_org_folder_ok((storage.foldername(name))[1])
  AND (
    (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
    OR owner = auth.uid()
  )
);

CREATE POLICY "Allegati autisti insert org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'allegati-autisti'
  AND public.storage_org_folder_ok((storage.foldername(name))[1])
  AND owner = auth.uid()
);

CREATE POLICY "Allegati autisti delete ufficio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'allegati-autisti'
  AND (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
  AND public.can_write(auth.uid())
);

CREATE POLICY "Scontrini select org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'scontrini-carburante'
  AND public.storage_org_folder_ok((storage.foldername(name))[1])
  AND (
    (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
    OR owner = auth.uid()
  )
);

CREATE POLICY "Scontrini insert org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'scontrini-carburante'
  AND public.storage_org_folder_ok((storage.foldername(name))[1])
  AND owner = auth.uid()
);

CREATE POLICY "Scontrini delete org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'scontrini-carburante'
  AND (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
  AND public.can_write(auth.uid())
);