-- Grainfolio-Web: restrict account deletion RPC execution to authenticated users only.

REVOKE EXECUTE ON FUNCTION delete_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_user() FROM anon;
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
