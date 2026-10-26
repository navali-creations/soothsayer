-- Privacy-preserving aggregate API for card-drop locations and time-of-day.
-- Raw rows remain service-role-only. Every published breakdown group must
-- contain events from at least the configured number of contributors.

CREATE OR REPLACE FUNCTION get_community_drop_context(
  p_game TEXT,
  p_league TEXT,
  p_card_name TEXT,
  p_min_contributors INTEGER DEFAULT 5
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
    OR p_min_contributors NOT BETWEEN 2 AND 100
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
    HAVING COUNT(DISTINCT upload_id) >= p_min_contributors
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
    HAVING COUNT(DISTINCT upload_id) >= p_min_contributors
  ),
  timezone_groups AS (
    SELECT
      utc_offset_minutes,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    GROUP BY utc_offset_minutes
    HAVING COUNT(DISTINCT upload_id) >= p_min_contributors
  ),
  location_groups AS (
    SELECT
      location.name,
      COUNT(*)::BIGINT AS event_count
    FROM filtered
    JOIN community_locations location ON location.id = filtered.location_id
    GROUP BY location.id, location.name
    HAVING COUNT(DISTINCT filtered.upload_id) >= p_min_contributors
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

  IF v_contributors < p_min_contributors THEN
    RETURN jsonb_build_object(
      'found', true,
      'available', false,
      'game', p_game,
      'league', v_league_name,
      'card', BTRIM(p_card_name),
      'bucket_minutes', 15,
      'min_contributors', p_min_contributors,
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
    'min_contributors', p_min_contributors,
    'contributors', v_contributors,
    'observed_events', v_total_events,
    'local_time_buckets', v_local_buckets,
    'utc_time_buckets', v_utc_buckets,
    'utc_offsets', v_timezones,
    'locations', v_locations
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT, INTEGER)
TO service_role;

COMMENT ON FUNCTION get_community_drop_context(TEXT, TEXT, TEXT, INTEGER)
IS 'Returns 15-minute local/UTC and location aggregates with per-group contributor privacy thresholds.';

NOTIFY pgrst, 'reload schema';
