-- Migration: Add secure RPC for user account deletion

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
  -- Assuming cascade deletes are set up correctly on foreign keys, 
  -- this will also remove user data in the public schema if configured.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Restrict execution to authenticated users only.
REVOKE EXECUTE ON FUNCTION delete_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_user() FROM anon;
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
