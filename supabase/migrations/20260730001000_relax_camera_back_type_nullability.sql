-- Grainfolio-Web: align Supabase cameras.back_type with Dexie's optional Camera.backType.
-- 135 and digital cameras do not need an explicit back type; 120 camera flows still write
-- fixed/interchangeable when the value matters.

ALTER TABLE public.cameras
  ALTER COLUMN back_type DROP NOT NULL;

ALTER TABLE public.cameras
  ALTER COLUMN back_type SET DEFAULT 'fixed';
