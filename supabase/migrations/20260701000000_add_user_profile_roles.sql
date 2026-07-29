-- Filmory-Web: split development auth bypass from real admin accounts.
-- Dev bypass is frontend-local only; production admin mode is represented by user_profiles.role.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('user', 'admin'));

-- Local seed/admin account used by Supabase local development.
UPDATE public.user_profiles
SET role = 'admin'
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'admin@filmory.com'
);
