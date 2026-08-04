-- Keep Cloud film stock metadata aligned with the local-first FilmStock model.
-- Both columns are nullable to preserve existing user records.
ALTER TABLE public.film_stocks
  ADD COLUMN IF NOT EXISTS price_per_roll NUMERIC,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
