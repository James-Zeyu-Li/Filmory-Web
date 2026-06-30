-- Filmory-Web: lock storage bucket to private access and require signed URLs.

UPDATE storage.buckets
SET public = false
WHERE id = 'filmory-assets';

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Owner Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

CREATE POLICY "Owner Read Access"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'filmory-assets'
  AND auth.uid() = owner
);

CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'filmory-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'filmory-assets'
  AND auth.uid() = owner
);

CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'filmory-assets'
  AND auth.uid() = owner
);
