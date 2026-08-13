-- A shooting record normally has one current camera body. camera_ids remains
-- as a legacy compatibility list; explicit transfer events preserve exceptions.

ALTER TABLE public.rolls
  ADD COLUMN IF NOT EXISTS current_camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL;

ALTER TABLE public.rolls
  ADD COLUMN IF NOT EXISTS camera_transfers jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.rolls
SET current_camera_id = COALESCE(current_camera_id, camera_ids[1], camera_id)
WHERE current_camera_id IS NULL;

ALTER TABLE public.rolls
  DROP CONSTRAINT IF EXISTS rolls_camera_transfers_is_array;

ALTER TABLE public.rolls
  ADD CONSTRAINT rolls_camera_transfers_is_array
  CHECK (jsonb_typeof(camera_transfers) = 'array');

CREATE INDEX IF NOT EXISTS rolls_current_camera_id_idx
  ON public.rolls (current_camera_id)
  WHERE deleted_at IS NULL;
