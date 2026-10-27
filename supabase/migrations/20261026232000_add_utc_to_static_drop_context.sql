-- Publish both UTC-normalized and player-local time distributions without
-- adding another pass over the league's drop events. The existing covering
-- index includes local_minute and utc_offset_minutes for this calculation.
CREATE OR REPLACE FUNCTION get_community_league_drop_context_static(
  p_game TEXT,
  p_league TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '55s'
AS $$
DECLARE
  v_league_id UUID;
  v_league_name TEXT;
  v_cards JSONB;
BEGIN
  IF p_game NOT IN ('poe1', 'poe2')
    OR p_league IS NULL OR LENGTH(BTRIM(p_league)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'get_community_league_drop_context_static received invalid arguments'
      USING ERRCODE = '22023';
  END IF;

  SELECT league.id, league.league_id
  INTO v_league_id, v_league_name
  FROM poe_leagues league
  WHERE league.game = p_game
    AND (
      league.league_id = BTRIM(p_league)
      OR league.name = BTRIM(p_league)
    )
  ORDER BY (league.league_id = BTRIM(p_league)) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'reason', 'league_not_found'
    );
  END IF;

  WITH relevant_uploads AS MATERIALIZED (
    SELECT upload.id
    FROM community_uploads upload
    WHERE upload.league_id = v_league_id
  ),
  rollups AS MATERIALIZED (
    SELECT
      bucketed.card_id,
      bucketed.local_bucket,
      bucketed.utc_bucket,
      bucketed.location_id,
      GROUPING(bucketed.local_bucket) AS local_grouped,
      GROUPING(bucketed.utc_bucket) AS utc_grouped,
      GROUPING(bucketed.location_id) AS location_grouped,
      COUNT(*)::BIGINT AS event_count
    FROM (
      SELECT
        event.card_id,
        (event.local_minute / 15) * 15 AS local_bucket,
        (
          (
            (
              event.local_minute - event.utc_offset_minutes
            ) % 1440 + 1440
          ) % 1440 / 15
        ) * 15 AS utc_bucket,
        event.location_id
      FROM relevant_uploads upload
      JOIN community_drop_events event ON event.upload_id = upload.id
    ) bucketed
    GROUP BY GROUPING SETS (
      (bucketed.card_id, bucketed.local_bucket),
      (bucketed.card_id, bucketed.utc_bucket),
      (bucketed.card_id, bucketed.location_id)
    )
  ),
  eligible_cards AS MATERIALIZED (
    SELECT
      rollup.card_id,
      card.name AS card_name
    FROM rollups rollup
    JOIN cards card
      ON card.id = rollup.card_id
      AND card.game = p_game
    WHERE rollup.local_grouped = 0
      AND rollup.utc_grouped = 1
      AND rollup.location_grouped = 1
    GROUP BY rollup.card_id, card.name
  ),
  local_buckets_by_card AS MATERIALIZED (
    SELECT
      eligible.card_id,
      jsonb_agg(
        jsonb_build_object(
          'minute', bucket.minute,
          'count', COALESCE(local_rollup.event_count, 0)
        )
        ORDER BY bucket.minute
      ) AS buckets
    FROM eligible_cards eligible
    CROSS JOIN generate_series(0, 1425, 15) AS bucket(minute)
    LEFT JOIN rollups local_rollup
      ON local_rollup.card_id = eligible.card_id
      AND local_rollup.local_bucket = bucket.minute
      AND local_rollup.local_grouped = 0
      AND local_rollup.utc_grouped = 1
      AND local_rollup.location_grouped = 1
    GROUP BY eligible.card_id
  ),
  utc_buckets_by_card AS MATERIALIZED (
    SELECT
      eligible.card_id,
      jsonb_agg(
        jsonb_build_object(
          'minute', bucket.minute,
          'count', COALESCE(utc_rollup.event_count, 0)
        )
        ORDER BY bucket.minute
      ) AS buckets
    FROM eligible_cards eligible
    CROSS JOIN generate_series(0, 1425, 15) AS bucket(minute)
    LEFT JOIN rollups utc_rollup
      ON utc_rollup.card_id = eligible.card_id
      AND utc_rollup.utc_bucket = bucket.minute
      AND utc_rollup.local_grouped = 1
      AND utc_rollup.utc_grouped = 0
      AND utc_rollup.location_grouped = 1
    GROUP BY eligible.card_id
  ),
  ranked_locations AS MATERIALIZED (
    SELECT
      rollup.card_id,
      rollup.location_id,
      rollup.event_count,
      ROW_NUMBER() OVER (
        PARTITION BY rollup.card_id
        ORDER BY rollup.event_count DESC, location.name
      ) AS location_rank
    FROM rollups rollup
    JOIN community_locations location ON location.id = rollup.location_id
    WHERE rollup.local_grouped = 1
      AND rollup.utc_grouped = 1
      AND rollup.location_grouped = 0
  ),
  locations_by_card AS MATERIALIZED (
    SELECT
      ranked.card_id,
      jsonb_agg(
        jsonb_build_object(
          'name', location.name,
          'count', ranked.event_count
        )
        ORDER BY ranked.event_count DESC, location.name
      ) AS locations
    FROM ranked_locations ranked
    JOIN community_locations location ON location.id = ranked.location_id
    WHERE ranked.location_rank <= 20
    GROUP BY ranked.card_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', eligible.card_name,
        'local_time_buckets', local_buckets.buckets,
        'utc_time_buckets', utc_buckets.buckets,
        'locations', COALESCE(locations.locations, '[]'::jsonb)
      )
      ORDER BY eligible.card_name
    ),
    '[]'::jsonb
  )
  INTO v_cards
  FROM eligible_cards eligible
  JOIN local_buckets_by_card local_buckets
    ON local_buckets.card_id = eligible.card_id
  JOIN utc_buckets_by_card utc_buckets
    ON utc_buckets.card_id = eligible.card_id
  LEFT JOIN locations_by_card locations
    ON locations.card_id = eligible.card_id;

  RETURN jsonb_build_object(
    'found', true,
    'available', jsonb_array_length(v_cards) > 0,
    'game', p_game,
    'league', v_league_name,
    'bucket_minutes', 15,
    'cards', v_cards
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_community_league_drop_context_static(TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_community_league_drop_context_static(TEXT, TEXT)
TO service_role;

COMMENT ON FUNCTION get_community_league_drop_context_static(TEXT, TEXT)
IS 'Returns UTC, player-local time, and location aggregates used by static league datasets.';

NOTIFY pgrst, 'reload schema';
