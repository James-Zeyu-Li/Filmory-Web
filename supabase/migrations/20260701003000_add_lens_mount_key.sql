ALTER TABLE public.lenses
  ADD COLUMN IF NOT EXISTS mount_key text;
