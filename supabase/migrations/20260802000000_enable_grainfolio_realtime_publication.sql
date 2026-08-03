-- Keep Cloud, local, and future environments aligned for SyncService postgres_changes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
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
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
    END IF;
  END LOOP;
END $$;
