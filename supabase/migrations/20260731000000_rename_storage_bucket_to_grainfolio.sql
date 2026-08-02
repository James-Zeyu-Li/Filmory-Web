-- Grainfolio-Web: configure the private storage bucket after the product rename.
-- Object migration is intentionally not handled in SQL because Supabase Storage
-- files should be copied or moved through the Storage API, not by editing metadata.

INSERT INTO storage.buckets (id, name, public)
VALUES ('grainfolio-assets', 'grainfolio-assets', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false;

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Owner Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

CREATE POLICY "Owner Read Access"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'grainfolio-assets'
  AND auth.uid() = owner
);

CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'grainfolio-assets'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'grainfolio-assets'
  AND auth.uid() = owner
);

CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'grainfolio-assets'
  AND auth.uid() = owner
);
