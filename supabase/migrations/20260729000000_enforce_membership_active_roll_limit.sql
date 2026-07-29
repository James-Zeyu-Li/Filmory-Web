-- Filmory-Web: backend hard guard for regular membership active roll limit.
-- Product scope: only active shooting rolls are limited. Gear, film inventory,
-- collections, and archived rolls remain unlimited.

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

  -- Serialize limit checks per user so concurrent inserts cannot pass together.
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
