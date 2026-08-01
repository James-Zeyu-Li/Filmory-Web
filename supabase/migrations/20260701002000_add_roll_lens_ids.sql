-- Grainfolio-Web: track roll-level lens usage without global lens occupancy.

ALTER TABLE public.rolls
  ADD COLUMN IF NOT EXISTS lens_ids uuid[];
