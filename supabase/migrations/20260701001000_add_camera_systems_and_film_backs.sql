-- Grainfolio-Web: model interchangeable 120 film backs as camera-system resources.

CREATE TABLE IF NOT EXISTS public.camera_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  mount_key text,
  notes text,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.film_backs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_system_id uuid NOT NULL REFERENCES public.camera_systems(id) ON DELETE CASCADE,
  name text NOT NULL,
  format text NOT NULL DEFAULT '120',
  status text NOT NULL DEFAULT 'active',
  notes text,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS camera_system_id uuid REFERENCES public.camera_systems(id) ON DELETE SET NULL;

ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS back_type text NOT NULL DEFAULT 'fixed';

ALTER TABLE public.cameras
  DROP CONSTRAINT IF EXISTS cameras_back_type_check;

ALTER TABLE public.cameras
  ADD CONSTRAINT cameras_back_type_check CHECK (back_type IN ('fixed', 'interchangeable'));

ALTER TABLE public.rolls
  ADD COLUMN IF NOT EXISTS film_back_id uuid REFERENCES public.film_backs(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['camera_systems', 'film_backs']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_modtime ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER update_%s_modtime BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();',
      t, t
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "Tenant Isolation Policy" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
      t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role;', t);
  END LOOP;
END $$;
