-- Keep the atomic creation RPC aligned with the current-camera model.

CREATE OR REPLACE FUNCTION public.create_roll_with_inventory(
  p_operation_id uuid,
  p_roll jsonb,
  p_consume_inventory boolean,
  p_ledger jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_result jsonb;
  v_roll_id uuid;
  v_film_stock_id uuid;
  v_stock_count integer;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT result INTO v_existing_result
  FROM public.sync_operations
  WHERE operation_id = p_operation_id
    AND user_id = v_user_id
    AND operation_type = 'create_roll_with_inventory';

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  v_roll_id := NULLIF(p_roll->>'id', '')::uuid;
  v_film_stock_id := NULLIF(p_roll->>'filmStockId', '')::uuid;

  IF v_roll_id IS NULL OR COALESCE(NULLIF(trim(p_roll->>'name'), ''), '') = '' THEN
    RAISE EXCEPTION 'INVALID_ROLL_PAYLOAD' USING ERRCODE = '22P02';
  END IF;

  INSERT INTO public.rolls (
    id, user_id, name, current_camera_id, camera_ids, camera_transfers,
    lens_ids, film_back_id, film_stock_id, collection_id, status,
    start_date, end_date, rating, location, notes, develop_notes,
    cover_photo_id, film_price, develop_price, added_at
  ) VALUES (
    v_roll_id,
    v_user_id,
    p_roll->>'name',
    COALESCE(
      NULLIF(p_roll->>'currentCameraId', '')::uuid,
      NULLIF(p_roll->>'cameraId', '')::uuid,
      (ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_roll->'cameraIds', '[]'::jsonb))::uuid))[1]
    ),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_roll->'cameraIds', '[]'::jsonb))::uuid),
    COALESCE(p_roll->'cameraTransfers', '[]'::jsonb),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_roll->'lensIds', '[]'::jsonb))::uuid),
    NULLIF(p_roll->>'filmBackId', '')::uuid,
    v_film_stock_id,
    NULLIF(p_roll->>'collectionId', '')::uuid,
    COALESCE(NULLIF(p_roll->>'status', ''), 'active'),
    NULLIF(p_roll->>'startDate', '')::bigint,
    NULLIF(p_roll->>'endDate', '')::bigint,
    NULLIF(p_roll->>'rating', '')::integer,
    NULLIF(p_roll->>'location', ''),
    NULLIF(p_roll->>'notes', ''),
    NULLIF(p_roll->>'developNotes', ''),
    NULLIF(p_roll->>'coverPhotoId', '')::uuid,
    NULLIF(p_roll->>'filmPrice', '')::numeric,
    NULLIF(p_roll->>'developPrice', '')::numeric,
    NULLIF(p_roll->>'addedAt', '')::bigint
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLL_ALREADY_EXISTS' USING ERRCODE = '23505';
  END IF;

  IF p_consume_inventory AND v_film_stock_id IS NOT NULL THEN
    UPDATE public.film_stocks
    SET stock_count = GREATEST(COALESCE(stock_count, 0) - 1, 0), updated_at = now()
    WHERE id = v_film_stock_id AND user_id = v_user_id AND deleted_at IS NULL
    RETURNING stock_count INTO v_stock_count;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FILM_STOCK_NOT_FOUND' USING ERRCODE = '23503';
    END IF;
  ELSIF v_film_stock_id IS NOT NULL THEN
    SELECT stock_count INTO v_stock_count
    FROM public.film_stocks
    WHERE id = v_film_stock_id AND user_id = v_user_id AND deleted_at IS NULL;
  END IF;

  IF p_ledger IS NOT NULL THEN
    INSERT INTO public.ledger_transactions (
      id, user_id, amount, date, type, category, related_entity_id, notes, added_at
    ) VALUES (
      NULLIF(p_ledger->>'id', '')::uuid, v_user_id, (p_ledger->>'amount')::numeric,
      (p_ledger->>'date')::bigint, p_ledger->>'type', p_ledger->>'category',
      NULLIF(p_ledger->>'relatedEntityId', '')::uuid, NULLIF(p_ledger->>'notes', ''),
      NULLIF(p_ledger->>'addedAt', '')::bigint
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  v_result := jsonb_build_object(
    'operationId', p_operation_id, 'rollId', v_roll_id,
    'filmStockId', v_film_stock_id, 'stockCount', v_stock_count
  );
  INSERT INTO public.sync_operations (operation_id, user_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, 'create_roll_with_inventory', v_result);
  RETURN v_result;
END;
$$;
