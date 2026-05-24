CREATE OR REPLACE FUNCTION merge_community_upload_data(
  p_league_id UUID,
  p_device_id TEXT,
  p_ggg_uuid TEXT,
  p_ggg_username TEXT,
  p_is_verified BOOLEAN,
  p_cards JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limits RECORD;
  v_total_cards INTEGER;
  v_requested_total BIGINT;
  v_league_game TEXT;
  v_upload community_uploads%ROWTYPE;
  v_upload_id UUID;
  v_upload_count INTEGER;
  v_is_verified BOOLEAN;
  v_matched_by_ggg BOOLEAN := false;
BEGIN
  SELECT *
  INTO v_limits
  FROM community_upload_limits();

  IF p_league_id IS NULL THEN
    RAISE EXCEPTION 'merge_community_upload_data requires league_id'
      USING ERRCODE = '22023';
  END IF;

  IF p_device_id IS NULL OR LENGTH(BTRIM(p_device_id)) = 0 THEN
    RAISE EXCEPTION 'merge_community_upload_data requires device_id'
      USING ERRCODE = '22023';
  END IF;

  IF p_cards IS NULL OR jsonb_typeof(p_cards) <> 'array' THEN
    RAISE EXCEPTION 'merge_community_upload_data requires a card array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_cards) = 0 THEN
    RAISE EXCEPTION 'merge_community_upload_data requires at least one card row'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_cards) > v_limits.max_cards THEN
    RAISE EXCEPTION 'merge_community_upload_data card payload exceeds maximum length'
      USING ERRCODE = '22023';
  END IF;

  SELECT game
  INTO v_league_game
  FROM poe_leagues
  WHERE id = p_league_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_community_upload_data league_id not found'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(
      card_id UUID,
      card_name TEXT,
      count INTEGER
    )
    WHERE card.count IS NULL
      OR card.count <= 0
      OR card.count > v_limits.max_card_count
      OR (
        card.card_id IS NULL
        AND (
          card.card_name IS NULL
          OR LENGTH(BTRIM(card.card_name)) = 0
        )
      )
      OR (
        card.card_name IS NOT NULL
        AND LENGTH(card.card_name) > 200
      )
  ) THEN
    RAISE EXCEPTION 'merge_community_upload_data received invalid card row'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(card.count::BIGINT), 0)
  INTO v_requested_total
  FROM jsonb_to_recordset(p_cards) AS card(
    card_id UUID,
    card_name TEXT,
    count INTEGER
  );

  IF v_requested_total > v_limits.max_total_cards THEN
    RAISE EXCEPTION 'merge_community_upload_data total exceeds maximum integer'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO cards (game, name)
  SELECT DISTINCT v_league_game, BTRIM(card.card_name)
  FROM jsonb_to_recordset(p_cards) AS card(
    card_id UUID,
    card_name TEXT,
    count INTEGER
  )
  WHERE card.card_id IS NULL
    AND card.card_name IS NOT NULL
    AND LENGTH(BTRIM(card.card_name)) > 0
  ON CONFLICT (game, name) DO NOTHING;

  IF EXISTS (
    WITH input_cards AS (
      SELECT DISTINCT card.card_id
      FROM jsonb_to_recordset(p_cards) AS card(
        card_id UUID,
        card_name TEXT,
        count INTEGER
      )
      WHERE card.card_id IS NOT NULL
    )
    SELECT 1
    FROM input_cards
    LEFT JOIN cards c ON c.id = input_cards.card_id
    WHERE c.id IS NULL
      OR c.game != v_league_game
  ) THEN
    RAISE EXCEPTION 'merge_community_upload_data card_id not found or game mismatch'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    WITH resolved_cards AS (
      SELECT
        COALESCE(card.card_id, c.id) AS card_id
      FROM jsonb_to_recordset(p_cards) AS card(
        card_id UUID,
        card_name TEXT,
        count INTEGER
      )
      LEFT JOIN cards c
        ON card.card_id IS NULL
        AND c.game = v_league_game
        AND c.name = BTRIM(card.card_name)
    )
    SELECT 1
    FROM resolved_cards
    WHERE card_id IS NULL
  ) THEN
    RAISE EXCEPTION 'merge_community_upload_data could not resolve card names'
      USING ERRCODE = '23503';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_league_id::TEXT || ':device:' || p_device_id, 0)
  );

  IF p_ggg_uuid IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_league_id::TEXT || ':ggg:' || p_ggg_uuid, 0)
    );
  END IF;

  SELECT *
  INTO v_upload
  FROM community_uploads
  WHERE league_id = p_league_id
    AND device_id = p_device_id
  LIMIT 1;

  IF NOT FOUND AND p_ggg_uuid IS NOT NULL THEN
    SELECT *
    INTO v_upload
    FROM community_uploads
    WHERE league_id = p_league_id
      AND ggg_uuid = p_ggg_uuid
    ORDER BY is_verified DESC, last_uploaded_at DESC
    LIMIT 1;
    v_matched_by_ggg := FOUND;
  END IF;

  IF FOUND THEN
    UPDATE community_uploads
    SET
      device_id = CASE
        WHEN v_matched_by_ggg THEN p_device_id
        ELSE v_upload.device_id
      END,
      ggg_uuid = COALESCE(p_ggg_uuid, v_upload.ggg_uuid),
      ggg_username = COALESCE(p_ggg_username, v_upload.ggg_username),
      is_verified = COALESCE(p_is_verified, false) OR v_upload.is_verified,
      last_uploaded_at = NOW(),
      upload_count = v_upload.upload_count + 1
    WHERE id = v_upload.id
    RETURNING *
    INTO v_upload;
  ELSE
    INSERT INTO community_uploads (
      league_id,
      device_id,
      ggg_uuid,
      ggg_username,
      is_verified,
      total_cards_uploaded,
      upload_count
    )
    VALUES (
      p_league_id,
      p_device_id,
      p_ggg_uuid,
      p_ggg_username,
      COALESCE(p_is_verified, false),
      0,
      1
    )
    RETURNING *
    INTO v_upload;
  END IF;

  WITH resolved AS (
    SELECT
      COALESCE(card.card_id, c.id) AS card_id,
      card.count
    FROM jsonb_to_recordset(p_cards) AS card(
      card_id UUID,
      card_name TEXT,
      count INTEGER
    )
    LEFT JOIN cards c
      ON card.card_id IS NULL
      AND c.game = v_league_game
      AND c.name = BTRIM(card.card_name)
  ),
  deduped AS (
    SELECT
      resolved.card_id,
      MAX(resolved.count)::INTEGER AS count
    FROM resolved
    GROUP BY resolved.card_id
  )
  INSERT INTO community_card_data (
    upload_id,
    card_id,
    count,
    updated_at
  )
  SELECT
    v_upload.id,
    deduped.card_id,
    deduped.count,
    NOW()
  FROM deduped
  ON CONFLICT (upload_id, card_id) DO UPDATE
    SET
      count = EXCLUDED.count,
      updated_at = NOW()
    WHERE community_card_data.count < EXCLUDED.count;

  SELECT COALESCE(SUM(count::BIGINT), 0)
  INTO v_requested_total
  FROM community_card_data
  WHERE upload_id = v_upload.id;

  IF v_requested_total > v_limits.max_total_cards THEN
    RAISE EXCEPTION 'merge_community_upload_data merged total exceeds maximum integer'
      USING ERRCODE = '22023';
  END IF;

  v_total_cards := v_requested_total::INTEGER;

  UPDATE community_uploads
  SET
    total_cards_uploaded = v_total_cards,
    last_uploaded_at = NOW()
  WHERE id = v_upload.id
  RETURNING id, upload_count, is_verified
  INTO v_upload_id, v_upload_count, v_is_verified;

  RETURN jsonb_build_object(
    'upload_id', v_upload_id,
    'total_cards', v_total_cards,
    'upload_count', v_upload_count,
    'is_verified', v_is_verified
  );
END;
$$;

COMMENT ON FUNCTION merge_community_upload_data(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  JSONB
) IS 'Atomically resolves card names, creates or updates community_uploads, merges community_card_data with GREATEST semantics, and returns the server-side upload summary. SECURITY DEFINER, service_role only.';

NOTIFY pgrst, 'reload schema';
