-- Publish aggregate card-drop context whenever at least one matching event
-- exists. Contributor counts remain informational, but no longer gate cards,
-- time buckets, timezones, or locations.

CREATE OR REPLACE FUNCTION get_community_drop_context(
  p_game TEXT,
  p_league TEXT,
  p_card_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_league_id UUID;
  v_league_name TEXT;
  v_card_id UUID;
  v_contributors INTEGER;
  v_total_events BIGINT;
  v_local_buckets JSONB;
  v_utc_buckets JSONB;
  v_timezones JSONB;
  v_locations JSONB;
BEGIN
  IF p_game NOT IN ('poe1', 'poe2')
    OR p_league IS NULL OR LENGTH(BTRIM(p_league)) NOT BETWEEN 1 AND 200
    OR p_card_name IS NULL OR LENGTH(BTRIM(p_card_name)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'get_community_drop_context received invalid arguments'
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

  SELECT card.id
  INTO v_card_id
  FROM cards card
  WHERE card.game = p_game
    AND card.name = BTRIM(p_card_name)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'reason', 'card_not_found'
    );
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      event.upload_id,
      event.location_id,
      event.local_minute,
      event.utc_offset_minutes
    FROM community_drop_events event
    JOIN community_uploads upload ON upload.id = event.upload_id
    WHERE event.card_id = v_card_id
      AND upload.league_id = v_league_id
      AND upload.is_suspicious = false
  ),
  summary AS (
    SELECT
      COUNT(DISTINCT upload_id)::INTEGER AS contributors,
      COUNT(*)::BIGINT AS total_events
    FROM filtered
  ),
  local_groups AS (
    SELECT
      (local_minute / 15) * 15 AS bucket_minute,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY 1
  ),
  utc_groups AS (
    SELECT
      (
        (((local_minute - utc_offset_minutes) % 1440 + 1440) % 1440)
        / 15
      ) * 15 AS bucket_minute,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY 1
  ),
  timezone_groups AS (
    SELECT
      utc_offset_minutes,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY utc_offset_minutes
  ),
  location_groups AS (
    SELECT
      location.name,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    JOIN community_locations location ON location.id = filtered.location_id
    GROUP BY location.id, location.name
    ORDER BY event_count DESC, location.name
    LIMIT 20
  )
  SELECT
    summary.contributors,
    summary.total_events,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'minute', bucket.minute,
          'count', COALESCE(local_groups.event_count, 0)
        )
        ORDER BY bucket.minute
      )
      FROM generate_series(0, 1425, 15) AS bucket(minute)
      LEFT JOIN local_groups ON local_groups.bucket_minute = bucket.minute
    ),
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'minute', bucket.minute,
          'count', COALESCE(utc_groups.event_count, 0)
        )
        ORDER BY bucket.minute
      )
      FROM generate_series(0, 1425, 15) AS bucket(minute)
      LEFT JOIN utc_groups ON utc_groups.bucket_minute = bucket.minute
    ),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'utc_offset_minutes', utc_offset_minutes,
            'count', event_count
          )
          ORDER BY utc_offset_minutes
        )
        FROM timezone_groups
      ),
      '[]'::jsonb
    ),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('name', name, 'count', event_count)
          ORDER BY event_count DESC, name
        )
        FROM location_groups
      ),
      '[]'::jsonb
    )
  INTO
    v_contributors,
    v_total_events,
    v_local_buckets,
    v_utc_buckets,
    v_timezones,
    v_locations
  FROM summary;

  IF v_total_events = 0 THEN
    RETURN jsonb_build_object(
      'found', true,
      'available', false,
      'game', p_game,
      'league', v_league_name,
      'card', BTRIM(p_card_name),
      'bucket_minutes', 15,
      'local_time_buckets', '[]'::jsonb,
      'utc_time_buckets', '[]'::jsonb,
      'utc_offsets', '[]'::jsonb,
      'locations', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'available', true,
    'game', p_game,
    'league', v_league_name,
    'card', BTRIM(p_card_name),
    'bucket_minutes', 15,
    'contributors', v_contributors,
    'observed_events', v_total_events,
    'local_time_buckets', v_local_buckets,
    'utc_time_buckets', v_utc_buckets,
    'utc_offsets', v_timezones,
    'locations', v_locations
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_community_league_drop_context(
  p_game TEXT,
  p_league TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_league_id UUID;
  v_league_name TEXT;
  v_cards JSONB;
BEGIN
  IF p_game NOT IN ('poe1', 'poe2')
    OR p_league IS NULL OR LENGTH(BTRIM(p_league)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'get_community_league_drop_context received invalid arguments'
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

  WITH filtered AS MATERIALIZED (
    SELECT
      event.card_id,
      card.name AS card_name,
      event.upload_id,
      event.location_id,
      location.name AS location_name,
      event.local_minute,
      event.utc_offset_minutes
    FROM community_drop_events event
    JOIN community_uploads upload ON upload.id = event.upload_id
    JOIN cards card ON card.id = event.card_id
    JOIN community_locations location ON location.id = event.location_id
    WHERE upload.league_id = v_league_id
      AND upload.is_suspicious = false
      AND card.game = p_game
  ),
  eligible_cards AS MATERIALIZED (
    SELECT
      card_id,
      card_name,
      COUNT(DISTINCT upload_id)::INTEGER AS contributors,
      COUNT(*)::BIGINT AS observed_events
    FROM filtered
    GROUP BY card_id, card_name
  ),
  local_groups AS (
    SELECT
      card_id,
      (local_minute / 15) * 15 AS bucket_minute,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY card_id, bucket_minute
  ),
  local_location_groups AS (
    SELECT
      card_id,
      (local_minute / 15) * 15 AS bucket_minute,
      location_id,
      location_name,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY card_id, bucket_minute, location_id, location_name
  ),
  utc_groups AS (
    SELECT
      card_id,
      (
        (((local_minute - utc_offset_minutes) % 1440 + 1440) % 1440)
        / 15
      ) * 15 AS bucket_minute,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY card_id, bucket_minute
  ),
  timezone_groups AS (
    SELECT
      card_id,
      utc_offset_minutes,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY card_id, utc_offset_minutes
  ),
  location_groups AS (
    SELECT
      card_id,
      location_id,
      location_name,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY card_id, location_id, location_name
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', eligible.card_name,
        'contributors', eligible.contributors,
        'observed_events', eligible.observed_events,
        'local_time_buckets', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'minute', bucket.minute,
              'count', COALESCE(local_group.event_count, 0),
              'locations', COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'name', local_location.location_name,
                      'count', local_location.event_count
                    )
                    ORDER BY local_location.event_count DESC,
                      local_location.location_name
                  )
                  FROM local_location_groups local_location
                  WHERE local_location.card_id = eligible.card_id
                    AND local_location.bucket_minute = bucket.minute
                ),
                '[]'::jsonb
              )
            )
            ORDER BY bucket.minute
          )
          FROM generate_series(0, 1425, 15) AS bucket(minute)
          LEFT JOIN local_groups local_group
            ON local_group.card_id = eligible.card_id
            AND local_group.bucket_minute = bucket.minute
        ),
        'utc_time_buckets', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'minute', bucket.minute,
              'count', COALESCE(utc_group.event_count, 0)
            )
            ORDER BY bucket.minute
          )
          FROM generate_series(0, 1425, 15) AS bucket(minute)
          LEFT JOIN utc_groups utc_group
            ON utc_group.card_id = eligible.card_id
            AND utc_group.bucket_minute = bucket.minute
        ),
        'utc_offsets', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'utc_offset_minutes', timezone_group.utc_offset_minutes,
                'count', timezone_group.event_count
              )
              ORDER BY timezone_group.utc_offset_minutes
            )
            FROM timezone_groups timezone_group
            WHERE timezone_group.card_id = eligible.card_id
          ),
          '[]'::jsonb
        ),
        'locations', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', ranked_location.location_name,
                'count', ranked_location.event_count
              )
              ORDER BY ranked_location.event_count DESC,
                ranked_location.location_name
            )
            FROM (
              SELECT location_group.location_name, location_group.event_count
              FROM location_groups location_group
              WHERE location_group.card_id = eligible.card_id
              ORDER BY location_group.event_count DESC,
                location_group.location_name
              LIMIT 20
            ) ranked_location
          ),
          '[]'::jsonb
        )
      )
      ORDER BY eligible.card_name
    ),
    '[]'::jsonb
  )
  INTO v_cards
  FROM eligible_cards eligible;

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

-- Preserve the previous signatures while deployed callers roll forward. The
-- threshold argument is intentionally ignored and no longer has a default,
-- avoiding ambiguity with the new threshold-free overloads in PostgREST.
DROP FUNCTION IF EXISTS get_community_drop_context(TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_community_league_drop_context(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_community_drop_context(
  p_game TEXT,
  p_league TEXT,
  p_card_name TEXT,
  p_min_contributors INTEGER
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT get_community_drop_context(p_game, p_league, p_card_name);
$$;

CREATE OR REPLACE FUNCTION get_community_league_drop_context(
  p_game TEXT,
  p_league TEXT,
  p_min_contributors INTEGER
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT get_community_league_drop_context(p_game, p_league);
$$;

REVOKE EXECUTE ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT, INTEGER)
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_community_league_drop_context(TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_community_league_drop_context(TEXT, TEXT, INTEGER)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT, INTEGER)
TO service_role;
GRANT EXECUTE ON FUNCTION get_community_league_drop_context(TEXT, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION get_community_league_drop_context(TEXT, TEXT, INTEGER)
TO service_role;

COMMENT ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT)
IS 'Returns all available 15-minute local/UTC and location aggregates for a card.';
COMMENT ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT, INTEGER)
IS 'Compatibility wrapper for threshold-free card drop-context aggregation.';
COMMENT ON FUNCTION get_community_league_drop_context(TEXT, TEXT)
IS 'Returns all available card drop-context aggregates for a league.';
COMMENT ON FUNCTION get_community_league_drop_context(TEXT, TEXT, INTEGER)
IS 'Compatibility wrapper for threshold-free league drop-context aggregation.';

NOTIFY pgrst, 'reload schema';
