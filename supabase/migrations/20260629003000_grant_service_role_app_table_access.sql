-- Grainfolio-Web: allow service_role clients to administer app tables in local/production maintenance flows.
-- RLS bypass still depends on Supabase service role semantics; these are table-level privileges.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cameras TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lenses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.film_stocks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rolls TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.photo_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.albums TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.album_photos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tag_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.other_equipments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ledger_transactions TO service_role;
