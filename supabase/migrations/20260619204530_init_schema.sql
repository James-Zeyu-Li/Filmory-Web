-- =================================================================================
-- Grainfolio-Web: Initial Supabase Schema, RLS, and Storage Bucket Setup
-- =================================================================================

-- 1. Enable UUID generation support (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =================================================================================
-- 2. CREATE TABLES (Map 1:1 with Dexie Local-First Entities)
-- =================================================================================

-- 📷 CAMERAS
CREATE TABLE public.cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    format TEXT NOT NULL,
    notes TEXT,
    avatar_url TEXT,
    purchase_price NUMERIC,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🔍 LENSES
CREATE TABLE public.lenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    focal_length NUMERIC NOT NULL,
    max_aperture TEXT NOT NULL,
    type TEXT NOT NULL,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🎞️ FILM STOCKS
CREATE TABLE public.film_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    iso NUMERIC NOT NULL,
    color_type TEXT NOT NULL,
    format TEXT NOT NULL,
    is_system INTEGER DEFAULT 0,
    system_key TEXT,
    stock_count INTEGER DEFAULT 0,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🎞️ ROLLS
CREATE TABLE public.rolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    camera_id UUID REFERENCES public.cameras(id),
    film_stock_id UUID REFERENCES public.film_stocks(id),
    status TEXT NOT NULL,
    start_date BIGINT,
    end_date BIGINT,
    rating INTEGER,
    location TEXT,
    notes TEXT,
    develop_notes TEXT,
    cover_photo_id UUID, -- Will self-reference photo_assets later
    film_price NUMERIC,
    develop_price NUMERIC,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🖼️ PHOTO ASSETS
CREATE TABLE public.photo_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    roll_id UUID NOT NULL REFERENCES public.rolls(id) ON DELETE CASCADE,
    original_file_name TEXT NOT NULL,
    file_size NUMERIC,
    thumbnail_url TEXT,
    preview_url TEXT,
    storage_key TEXT,
    note TEXT,
    focal_length NUMERIC,
    aperture TEXT,
    shutter_speed TEXT,
    exposure_compensation NUMERIC,
    is_pinned INTEGER DEFAULT 0,
    rating INTEGER,
    tags TEXT,
    order_index NUMERIC,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🏷️ TAG CONFIGS
CREATE TABLE public.tag_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, name)
);

-- 🎒 OTHER EQUIPMENTS
CREATE TABLE public.other_equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    notes TEXT,
    purchase_date BIGINT,
    expiry_date BIGINT,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 📚 ALBUMS
CREATE TABLE public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_photo_id UUID REFERENCES public.photo_assets(id) ON DELETE SET NULL,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🔗 ALBUM PHOTOS (Mapping Table)
CREATE TABLE public.album_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES public.photo_assets(id) ON DELETE CASCADE,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(album_id, photo_id)
);


-- =================================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS) & POLICIES
-- =================================================================================

-- A generic policy template function could be used, but explicit is better for clarity.
DO $$ 
DECLARE
  table_name text;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_name);
    
    -- Absolute Isolation: Only allow actions if user_id matches authenticated user
    EXECUTE format('
      CREATE POLICY "Tenant Isolation Policy" 
      ON public.%I 
      FOR ALL 
      USING (auth.uid() = user_id) 
      WITH CHECK (auth.uid() = user_id);
    ', table_name);
  END LOOP;
END $$;


-- =================================================================================
-- 4. STORAGE BUCKET CONFIGURATION
-- =================================================================================

-- Insert the physical storage bucket definition
INSERT INTO storage.buckets (id, name, public) 
VALUES ('grainfolio-assets', 'grainfolio-assets', false) 
ON CONFLICT (id) DO NOTHING;

-- RLS for Storage (Objects)
-- 1. Authenticated users can read only their own files. Frontend access must use signed URLs.
CREATE POLICY "Owner Read Access" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'grainfolio-assets'
  AND auth.uid() = owner
);

-- 2. Authenticated users can upload, update, and delete only files in their own user folder.
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
