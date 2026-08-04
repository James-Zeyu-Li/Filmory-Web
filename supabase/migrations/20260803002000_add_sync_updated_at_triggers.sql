-- Incremental Pull depends on updated_at advancing whenever an existing row changes.
-- This migration installs the invariant without rewriting existing user data.
CREATE OR REPLACE FUNCTION public.set_sync_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Replace the few legacy per-table triggers with one shared sync contract.
DROP TRIGGER IF EXISTS update_user_profiles_modtime ON public.user_profiles;
DROP TRIGGER IF EXISTS update_collections_modtime ON public.collections;
DROP TRIGGER IF EXISTS update_camera_systems_modtime ON public.camera_systems;
DROP TRIGGER IF EXISTS update_film_backs_modtime ON public.film_backs;

DO $$
DECLARE
  sync_table text;
BEGIN
  FOREACH sync_table IN ARRAY ARRAY[
    'cameras',
    'camera_systems',
    'film_backs',
    'lenses',
    'film_stocks',
    'rolls',
    'photo_assets',
    'other_equipments',
    'collections',
    'albums',
    'album_photos',
    'tag_configs',
    'ledger_transactions',
    'user_profiles'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_sync_updated_at ON public.%I',
      sync_table
    );
    EXECUTE format(
      'CREATE TRIGGER set_sync_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_sync_updated_at()',
      sync_table
    );
  END LOOP;
END;
$$;
