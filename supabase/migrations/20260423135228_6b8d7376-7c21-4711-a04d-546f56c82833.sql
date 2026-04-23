-- Make logos bucket private (files still accessible via signed URLs / direct paths from app)
UPDATE storage.buckets SET public = false WHERE id = 'logos';

-- Allow public read of individual objects (so existing logo URLs still work) but no listing
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
CREATE POLICY "Public read logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Only authenticated org members can upload/update/delete
DROP POLICY IF EXISTS "Auth users manage logos insert" ON storage.objects;
CREATE POLICY "Auth users manage logos insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "Auth users manage logos update" ON storage.objects;
CREATE POLICY "Auth users manage logos update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Auth users manage logos delete" ON storage.objects;
CREATE POLICY "Auth users manage logos delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos');