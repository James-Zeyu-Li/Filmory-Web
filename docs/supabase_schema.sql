-- Filmory-Web: current Supabase initialization reference.
-- Prefer applying files in supabase/migrations for real environments.
-- Includes Dexie parity for collections, rolls.cameraIds, and rolls.collectionId.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- App tables

CREATE TABLE IF NOT EXISTS public.cameras (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  format text NOT NULL,
  camera_system_id uuid,
  back_type text NOT NULL DEFAULT 'fixed' CHECK (back_type IN ('fixed', 'interchangeable')),
  notes text,
  avatar_url text,
  purchase_price numeric,
  status text DEFAULT 'active',
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.camera_systems (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  mount_key text,
  notes text,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.cameras
  DROP CONSTRAINT IF EXISTS cameras_camera_system_id_fkey;
ALTER TABLE public.cameras
  ADD CONSTRAINT cameras_camera_system_id_fkey
  FOREIGN KEY (camera_system_id) REFERENCES public.camera_systems(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.film_backs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE TABLE IF NOT EXISTS public.lenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  focal_length numeric NOT NULL,
  max_aperture text NOT NULL,
  type text NOT NULL,
  mount_key text,
  avatar_url text,
  purchase_price numeric,
  status text DEFAULT 'active',
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.film_stocks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand text NOT NULL,
  name text NOT NULL,
  iso numeric NOT NULL,
  color_type text NOT NULL,
  format text NOT NULL,
  is_system integer DEFAULT 0,
  system_key text,
  stock_count integer DEFAULT 0,
  price_per_roll numeric,
  avatar_url text,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.rolls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  camera_ids uuid[],
  lens_ids uuid[],
  film_back_id uuid REFERENCES public.film_backs(id) ON DELETE SET NULL,
  film_stock_id uuid REFERENCES public.film_stocks(id) ON DELETE SET NULL,
  collection_id uuid,
  status text NOT NULL,
  start_date bigint,
  end_date bigint,
  rating integer,
  location text,
  notes text,
  develop_notes text,
  cover_photo_id uuid,
  film_price numeric,
  develop_price numeric,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.photo_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_id uuid REFERENCES public.rolls(id) ON DELETE CASCADE,
  original_file_name text NOT NULL,
  file_size numeric,
  thumbnail_url text,
  preview_url text,
  storage_key text,
  note text,
  focal_length numeric,
  aperture text,
  shutter_speed text,
  exposure_compensation numeric,
  is_pinned integer DEFAULT 0,
  rating integer,
  tags text,
  order_index numeric,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.rolls
  DROP CONSTRAINT IF EXISTS rolls_cover_photo_id_fkey;
ALTER TABLE public.rolls
  ADD CONSTRAINT rolls_cover_photo_id_fkey
  FOREIGN KEY (cover_photo_id) REFERENCES public.photo_assets(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.other_equipments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  notes text,
  purchase_date bigint,
  expiry_date bigint,
  avatar_url text,
  purchase_price numeric,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.tag_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS public.albums (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_photo_id uuid REFERENCES public.photo_assets(id) ON DELETE SET NULL,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.album_photos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id uuid REFERENCES public.albums(id) ON DELETE CASCADE,
  photo_id uuid REFERENCES public.photo_assets(id) ON DELETE CASCADE,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(album_id, photo_id)
);

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
  DROP CONSTRAINT IF EXISTS rolls_collection_id_fkey;
ALTER TABLE public.rolls
  ADD CONSTRAINT rolls_collection_id_fkey
  FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  date bigint NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  related_entity_id uuid,
  notes text,
  added_at bigint,
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'regular',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name text,
  high_res_quota_used integer NOT NULL DEFAULT 0,
  membership_request_status text CHECK (membership_request_status IN ('pending')),
  membership_requested_at bigint,
  membership_contact_email text,
  membership_request_note text,
  membership_request_source text CHECK (membership_request_source IN ('generic', 'roll-limit')),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- updated_at trigger

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
  FOREACH t IN ARRAY ARRAY[
    'cameras', 'camera_systems', 'film_backs', 'lenses', 'film_stocks', 'rolls', 'photo_assets',
    'other_equipments', 'tag_configs', 'albums', 'album_photos', 'collections',
    'ledger_transactions', 'user_profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_modtime ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER update_%s_modtime BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();',
      t, t
    );
  END LOOP;
END $$;

-- User profile bootstrap

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_id, tier, display_name, high_res_quota_used)
  VALUES (
    new.id,
    new.id,
    'regular',
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Membership hard guard: regular users can have at most 5 active rolls.

CREATE OR REPLACE FUNCTION public.enforce_membership_active_roll_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  active_roll_count integer;
  active_roll_limit integer := 5;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  SELECT COALESCE(up.tier, 'regular')
    INTO user_tier
  FROM public.user_profiles up
  WHERE up.user_id = NEW.user_id
    AND up.deleted_at IS NULL
  LIMIT 1;

  IF COALESCE(user_tier, 'regular') = 'vip' THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO active_roll_count
  FROM public.rolls r
  WHERE r.user_id = NEW.user_id
    AND r.status = 'active'
    AND r.deleted_at IS NULL
    AND r.id <> NEW.id;

  IF active_roll_count >= active_roll_limit THEN
    RAISE EXCEPTION 'FREE_ACTIVE_ROLL_LIMIT_REACHED'
      USING ERRCODE = 'P0001',
            DETAIL = 'Regular users can have at most 5 active rolls.',
            HINT = 'Archive an active roll or upgrade the user profile to vip.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_membership_active_roll_limit_on_rolls ON public.rolls;
CREATE TRIGGER enforce_membership_active_roll_limit_on_rolls
  BEFORE INSERT OR UPDATE OF user_id, status, deleted_at ON public.rolls
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_membership_active_roll_limit();

-- RLS and table grants

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cameras', 'camera_systems', 'film_backs', 'lenses', 'film_stocks', 'rolls', 'photo_assets',
    'other_equipments', 'tag_configs', 'albums', 'album_photos', 'collections',
    'ledger_transactions', 'user_profiles'
  ]
  LOOP
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

-- Private Storage bucket and policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('filmory-assets', 'filmory-assets', false)
ON CONFLICT (id) DO UPDATE SET public = false;

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

-- Account deletion RPC

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
