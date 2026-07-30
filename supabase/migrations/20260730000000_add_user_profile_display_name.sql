-- Filmory-Web: add optional display_name to user_profiles and bootstrap it from auth metadata.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

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
