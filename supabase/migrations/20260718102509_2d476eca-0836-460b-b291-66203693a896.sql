
-- Colonne tariffario su clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tariffario_url text,
  ADD COLUMN IF NOT EXISTS tariffario_nome text;

-- Policy storage: path = {org_id}/{client_id}/{filename}
-- NCC dell'org scrive/legge/aggiorna/elimina i file della propria org
CREATE POLICY "NCC gestiscono tariffari clienti propri"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'tariffari-clienti'
    AND (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'tariffari-clienti'
    AND (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
  );

-- Cliente legge il tariffario del proprio client_id (sia utenza sia parent)
CREATE POLICY "Cliente legge proprio tariffario"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tariffari-clienti'
    AND (
      EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.auth_user_id = auth.uid()
          AND (storage.foldername(name))[1] = c.org_id::text
          AND (storage.foldername(name))[2] = c.id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.client_utenze u
        JOIN public.clients c ON c.id = u.parent_client_id
        WHERE u.auth_user_id = auth.uid()
          AND u.attivo = true
          AND (storage.foldername(name))[1] = c.org_id::text
          AND (storage.foldername(name))[2] = c.id::text
      )
    )
  );
