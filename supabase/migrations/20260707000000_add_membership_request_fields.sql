-- Filmory-Web: keep local manual VIP upgrade request status schema-aligned with user_profiles.
-- This does not require production payment integration; it only preserves the local/manual request
-- state once sync is enabled in the future.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS membership_request_status text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS membership_requested_at bigint;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS membership_contact_email text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS membership_request_note text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS membership_request_source text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_membership_request_status_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_membership_request_status_check
  CHECK (
    membership_request_status IS NULL
    OR membership_request_status IN ('pending')
  );

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_membership_request_source_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_membership_request_source_check
  CHECK (
    membership_request_source IS NULL
    OR membership_request_source IN ('generic', 'roll-limit')
  );
