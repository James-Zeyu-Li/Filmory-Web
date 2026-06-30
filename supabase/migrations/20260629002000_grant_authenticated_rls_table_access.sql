-- Filmory-Web: allow authenticated clients to access RLS-protected app tables.
-- RLS policies still enforce per-user isolation; these grants only expose table operations to the role.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cameras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.film_stocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rolls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.photo_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.albums TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.album_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tag_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.other_equipments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ledger_transactions TO authenticated;
