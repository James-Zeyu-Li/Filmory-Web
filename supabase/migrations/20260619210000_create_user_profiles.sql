-- Filmory-Web: Create the user_profiles table.
-- This migration MUST run before any ALTER TABLE public.user_profiles statements
-- (e.g. 20260701000000_add_user_profile_roles.sql).
--
-- Column notes:
--   id          → same as auth.users.id (1:1 relationship, used as PK)
--   user_id     → FK to auth.users.id (kept for Dexie sync key symmetry)
--   tier        → 'regular' | 'vip'  (VIP gating, Roadmap P1)
--   role        → 'user' | 'admin'   (added later by add_user_profile_roles migration)
--   high_res_quota_used → number of high-res uploads consumed this period
--   updated_at  → managed by trigger for sync watermark
--   deleted_at  → soft-delete, mirrors Dexie pattern

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier        TEXT NOT NULL DEFAULT 'regular'
                    CHECK (tier IN ('regular', 'vip')),
    high_res_quota_used INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    deleted_at  TIMESTAMP WITH TIME ZONE
);

-- updated_at auto-update trigger (reuses the function from other migrations if already created)
CREATE OR REPLACE FUNCTION public.update_user_profiles_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_modtime ON public.user_profiles;
CREATE TRIGGER update_user_profiles_modtime
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE PROCEDURE public.update_user_profiles_modified();

-- Row Level Security: each user can only read/write their own profile
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.user_profiles;
CREATE POLICY "Tenant Isolation Policy"
    ON public.user_profiles
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Table-level grants so PostgREST roles can reach the table
-- (RLS still enforces per-user isolation)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO service_role;
