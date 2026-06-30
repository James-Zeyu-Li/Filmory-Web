-- Filmory-Web: Supabase Postgres Initialization Script
-- Execute this script in your Supabase SQL Editor.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Create Tables
-- ==========================================

-- Cameras
CREATE TABLE cameras (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  format text NOT NULL,
  notes text,
  avatar_url text,
  added_at bigint NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Lenses
CREATE TABLE lenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  focal_length int NOT NULL,
  max_aperture text NOT NULL,
  type text NOT NULL,
  avatar_url text,
  added_at bigint NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Film Stocks
CREATE TABLE film_stocks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand text NOT NULL,
  name text NOT NULL,
  iso int NOT NULL,
  color_type text NOT NULL,
  format text NOT NULL,
  is_system smallint NOT NULL DEFAULT 0,
  system_key text,
  stock_count int,
  avatar_url text,
  added_at bigint NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Rolls
CREATE TABLE rolls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  camera_id uuid REFERENCES cameras(id) ON DELETE SET NULL,
  film_stock_id uuid REFERENCES film_stocks(id) ON DELETE SET NULL,
  status text NOT NULL,
  start_date bigint,
  end_date bigint,
  rating smallint,
  location text,
  notes text,
  develop_notes text,
  cover_photo_id uuid, -- Reference photo_assets (added after table creation)
  film_price numeric,
  develop_price numeric,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Photo Assets
CREATE TABLE photo_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_id uuid REFERENCES rolls(id) ON DELETE CASCADE,
  original_file_name text NOT NULL,
  file_size int NOT NULL,
  thumbnail_url text,
  preview_url text,
  storage_key text,
  added_at bigint NOT NULL,
  note text,
  focal_length numeric,
  aperture text,
  shutter_speed text,
  exposure_compensation numeric,
  is_pinned smallint NOT NULL DEFAULT 0,
  rating smallint,
  tags text,
  order_index int,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Add foreign key back to Rolls for cover_photo
ALTER TABLE rolls ADD CONSTRAINT rolls_cover_photo_id_fkey FOREIGN KEY (cover_photo_id) REFERENCES photo_assets(id) ON DELETE SET NULL;

-- Other Equipment
CREATE TABLE other_equipments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  notes text,
  purchase_date bigint,
  expiry_date bigint,
  avatar_url text,
  added_at bigint NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Tag Configs
CREATE TABLE tag_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Albums
CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_photo_id uuid REFERENCES photo_assets(id) ON DELETE SET NULL,
  added_at bigint NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Album Photos Relation
CREATE TABLE album_photos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id uuid REFERENCES albums(id) ON DELETE CASCADE,
  photo_id uuid REFERENCES photo_assets(id) ON DELETE CASCADE,
  added_at bigint NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- User Profiles (VIP / Regular Tier)
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'regular',
  high_res_quota_used int NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);


-- ==========================================
-- 2. Create Triggers for updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cameras_modtime BEFORE UPDATE ON cameras FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_lenses_modtime BEFORE UPDATE ON lenses FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_film_stocks_modtime BEFORE UPDATE ON film_stocks FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_rolls_modtime BEFORE UPDATE ON rolls FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_photo_assets_modtime BEFORE UPDATE ON photo_assets FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_other_equipments_modtime BEFORE UPDATE ON other_equipments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_tag_configs_modtime BEFORE UPDATE ON tag_configs FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_albums_modtime BEFORE UPDATE ON albums FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_album_photos_modtime BEFORE UPDATE ON album_photos FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_user_profiles_modtime BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ==========================================
-- 2.1 Create Auth Trigger for User Profiles
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_id, tier, high_res_quota_used)
  VALUES (new.id, new.id, 'regular', 0);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==========================================
-- 3. Enable Row Level Security (RLS)
-- ==========================================

ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE lenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;

-- Create Policies (Only users can view and edit their own data)

CREATE POLICY "Users can manage their own cameras" ON cameras FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own lenses" ON lenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own film_stocks" ON film_stocks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own rolls" ON rolls FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own photo_assets" ON photo_assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own other_equipments" ON other_equipments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own tag_configs" ON tag_configs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own albums" ON albums FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own album_photos" ON album_photos FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own profiles" ON user_profiles FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 4. RPC Functions
-- ==========================================

-- Function to allow users to delete their own account securely
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete the caller from the auth.users table.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;

-- DONE!
