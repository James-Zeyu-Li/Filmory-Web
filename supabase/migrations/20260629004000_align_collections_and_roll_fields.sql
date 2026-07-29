-- Filmory-Web: align Supabase schema with Dexie collections and roll relationships.

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  date bigint NOT NULL,
  description text,
  cover_url text,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.rolls
  ADD COLUMN IF NOT EXISTS camera_ids uuid[];

ALTER TABLE public.rolls
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL;

UPDATE public.rolls
SET camera_ids = ARRAY[camera_id]
WHERE camera_ids IS NULL
  AND camera_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_collections_modtime ON public.collections;
CREATE TRIGGER update_collections_modtime
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.collections;
CREATE POLICY "Tenant Isolation Policy"
ON public.collections
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.collections TO service_role;
