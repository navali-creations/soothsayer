-- Keep time context when the client has not observed a location yet, and
-- publish league-wide denominators for normalized time/location rates.

ALTER TABLE community_drop_events
  ALTER COLUMN location_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION ingest_community_drop_events(
  p_league_id UUID,
  p_device_id TEXT,
  p_events JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_game TEXT;
  v_upload_id UUID;
  v_inserted INTEGER;
  v_distinct_location_count INTEGER;
  v_global_location_count INTEGER;
BEGIN
  IF p_league_id IS NULL
    OR p_device_id IS NULL
    OR LENGTH(BTRIM(p_device_id)) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'ingest_community_drop_events requires league and device identity'
      USING ERRCODE = '22023';
  END IF;

  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RAISE EXCEPTION 'ingest_community_drop_events requires an event array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_events) = 0 OR jsonb_array_length(p_events) > 500 THEN
    RAISE EXCEPTION 'ingest_community_drop_events event payload length is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT pl.game
  INTO v_game
  FROM poe_leagues pl
  WHERE pl.id = p_league_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ingest_community_drop_events league_id not found'
      USING ERRCODE = '23503';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('community-drop-locations:' || v_game, 0)
  );

  INSERT INTO community_uploads (
    league_id,
    device_id,
    total_cards_uploaded,
    upload_count
  )
  VALUES (p_league_id, BTRIM(p_device_id), 0, 0)
  ON CONFLICT (league_id, device_id) DO UPDATE
    SET device_id = EXCLUDED.device_id
  RETURNING id INTO v_upload_id;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_events) AS event(
      event_id UUID,
      card_name TEXT,
      location TEXT,
      local_minute INTEGER,
      utc_offset_minutes INTEGER
    )
    WHERE event.event_id IS NULL
      OR event.card_name IS NULL
      OR LENGTH(BTRIM(event.card_name)) NOT BETWEEN 1 AND 200
      OR (
        event.location IS NOT NULL
        AND LENGTH(BTRIM(event.location)) NOT BETWEEN 1 AND 200
      )
      OR event.local_minute IS NULL
      OR event.local_minute NOT BETWEEN 0 AND 1439
      OR event.utc_offset_minutes IS NULL
      OR event.utc_offset_minutes NOT BETWEEN -840 AND 840
  ) THEN
    RAISE EXCEPTION 'ingest_community_drop_events received an invalid event row'
      USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM jsonb_to_recordset(p_events) AS event(event_id UUID)
  ) != (
    SELECT COUNT(DISTINCT event.event_id)
    FROM jsonb_to_recordset(p_events) AS event(event_id UUID)
  ) THEN
    RAISE EXCEPTION 'ingest_community_drop_events received duplicate event IDs'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(DISTINCT BTRIM(event.location))
  INTO v_distinct_location_count
  FROM jsonb_to_recordset(p_events) AS event(location TEXT)
  WHERE event.location IS NOT NULL;

  IF v_distinct_location_count > 100 THEN
    RAISE EXCEPTION 'ingest_community_drop_events location cardinality is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_events) AS event(card_name TEXT)
    LEFT JOIN cards c
      ON c.game = v_game
      AND c.name = BTRIM(event.card_name)
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'ingest_community_drop_events could not resolve card names'
      USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*)
  INTO v_distinct_location_count
  FROM (
    SELECT location.name
    FROM community_drop_events existing
    JOIN community_locations location ON location.id = existing.location_id
    WHERE existing.upload_id = v_upload_id
    UNION
    SELECT BTRIM(event.location)
    FROM jsonb_to_recordset(p_events) AS event(location TEXT)
    WHERE event.location IS NOT NULL
  ) contributor_locations;

  IF v_distinct_location_count > 1000 THEN
    RAISE EXCEPTION 'ingest_community_drop_events contributor location limit exceeded'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)
  INTO v_global_location_count
  FROM (
    SELECT location.name
    FROM community_locations location
    WHERE location.game = v_game
    UNION
    SELECT BTRIM(event.location)
    FROM jsonb_to_recordset(p_events) AS event(location TEXT)
    WHERE event.location IS NOT NULL
  ) game_locations;

  IF v_global_location_count > 2000 THEN
    RAISE EXCEPTION 'ingest_community_drop_events game location limit exceeded'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO community_locations (game, name)
  SELECT DISTINCT v_game, BTRIM(event.location)
  FROM jsonb_to_recordset(p_events) AS event(location TEXT)
  WHERE event.location IS NOT NULL
  ON CONFLICT (game, name) DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_events) AS event(
      event_id UUID,
      card_name TEXT,
      location TEXT,
      local_minute INTEGER,
      utc_offset_minutes INTEGER
    )
    JOIN community_drop_events existing
      ON existing.event_id = event.event_id
    JOIN cards c ON c.id = existing.card_id
    LEFT JOIN community_locations location ON location.id = existing.location_id
    WHERE existing.upload_id != v_upload_id
      OR c.game != v_game
      OR c.name != BTRIM(event.card_name)
      OR location.name IS DISTINCT FROM (
        CASE
          WHEN event.location IS NULL THEN NULL
          ELSE BTRIM(event.location)
        END
      )
      OR existing.local_minute != event.local_minute
      OR existing.utc_offset_minutes != event.utc_offset_minutes
  ) THEN
    RAISE EXCEPTION 'ingest_community_drop_events event ID collision'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO community_drop_events (
    event_id,
    upload_id,
    card_id,
    location_id,
    local_minute,
    utc_offset_minutes
  )
  SELECT
    event.event_id,
    v_upload_id,
    c.id,
    location.id,
    event.local_minute::SMALLINT,
    event.utc_offset_minutes::SMALLINT
  FROM jsonb_to_recordset(p_events) AS event(
    event_id UUID,
    card_name TEXT,
    location TEXT,
    local_minute INTEGER,
    utc_offset_minutes INTEGER
  )
  JOIN cards c
    ON c.game = v_game
    AND c.name = BTRIM(event.card_name)
  LEFT JOIN community_locations location
    ON event.location IS NOT NULL
    AND location.game = v_game
    AND location.name = BTRIM(event.location)
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION ingest_community_drop_events(UUID, TEXT, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ingest_community_drop_events(UUID, TEXT, JSONB)
TO service_role;

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
  v_totals JSONB;
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

  WITH relevant_events AS MATERIALIZED (
    SELECT
      event.card_id,
      (event.local_minute / 15) * 15 AS local_bucket,
      (
        (
          (event.local_minute - event.utc_offset_minutes) % 1440 + 1440
        ) % 1440 / 15
      ) * 15 AS utc_bucket,
      event.location_id
    FROM community_uploads upload
    JOIN community_drop_events event ON event.upload_id = upload.id
    WHERE upload.league_id = v_league_id
  ),
  rollups AS MATERIALIZED (
    SELECT
      relevant.card_id,
      relevant.local_bucket,
      relevant.utc_bucket,
      relevant.location_id,
      GROUPING(relevant.card_id) AS card_grouped,
      GROUPING(relevant.local_bucket) AS local_grouped,
      GROUPING(relevant.utc_bucket) AS utc_grouped,
      GROUPING(relevant.location_id) AS location_grouped,
      COUNT(*)::BIGINT AS event_count
    FROM relevant_events relevant
    GROUP BY GROUPING SETS (
      (relevant.card_id, relevant.local_bucket),
      (relevant.card_id, relevant.utc_bucket),
      (relevant.card_id, relevant.location_id),
      (relevant.card_id),
      (relevant.local_bucket),
      (relevant.utc_bucket),
      (relevant.location_id),
      ()
    )
  ),
  eligible_cards AS MATERIALIZED (
    SELECT
      rollup.card_id,
      card.name AS card_name,
      rollup.event_count AS observed_events
    FROM rollups rollup
    JOIN cards card
      ON card.id = rollup.card_id
      AND card.game = p_game
    WHERE rollup.card_grouped = 0
      AND rollup.local_grouped = 1
      AND rollup.utc_grouped = 1
      AND rollup.location_grouped = 1
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
      AND local_rollup.card_grouped = 0
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
      AND utc_rollup.card_grouped = 0
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
    WHERE rollup.card_grouped = 0
      AND rollup.local_grouped = 1
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
  ),
  located_events_by_card AS MATERIALIZED (
    SELECT
      rollup.card_id,
      SUM(rollup.event_count)::BIGINT AS located_events
    FROM rollups rollup
    WHERE rollup.card_grouped = 0
      AND rollup.local_grouped = 1
      AND rollup.utc_grouped = 1
      AND rollup.location_grouped = 0
      AND rollup.location_id IS NOT NULL
    GROUP BY rollup.card_id
  ),
  cards_payload AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name', eligible.card_name,
          'observed_events', eligible.observed_events,
          'located_events', COALESCE(located.located_events, 0),
          'local_time_buckets', local_buckets.buckets,
          'utc_time_buckets', utc_buckets.buckets,
          'locations', COALESCE(locations.locations, '[]'::jsonb)
        )
        ORDER BY eligible.card_name
      ),
      '[]'::jsonb
    ) AS cards
    FROM eligible_cards eligible
    JOIN local_buckets_by_card local_buckets
      ON local_buckets.card_id = eligible.card_id
    JOIN utc_buckets_by_card utc_buckets
      ON utc_buckets.card_id = eligible.card_id
    LEFT JOIN locations_by_card locations
      ON locations.card_id = eligible.card_id
    LEFT JOIN located_events_by_card located
      ON located.card_id = eligible.card_id
  ),
  totals_payload AS (
    SELECT jsonb_build_object(
      'observed_events', COALESCE(
        (
          SELECT rollup.event_count
          FROM rollups rollup
          WHERE rollup.card_grouped = 1
            AND rollup.local_grouped = 1
            AND rollup.utc_grouped = 1
            AND rollup.location_grouped = 1
        ),
        0
      ),
      'located_events', COALESCE(
        (
          SELECT SUM(location_rollup.event_count)::BIGINT
          FROM rollups location_rollup
          WHERE location_rollup.card_grouped = 1
            AND location_rollup.local_grouped = 1
            AND location_rollup.utc_grouped = 1
            AND location_rollup.location_grouped = 0
            AND location_rollup.location_id IS NOT NULL
        ),
        0
      ),
      'local_time_buckets', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'minute', bucket.minute,
            'count', COALESCE(local_rollup.event_count, 0)
          )
          ORDER BY bucket.minute
        )
        FROM generate_series(0, 1425, 15) AS bucket(minute)
        LEFT JOIN rollups local_rollup
          ON local_rollup.local_bucket = bucket.minute
          AND local_rollup.card_grouped = 1
          AND local_rollup.local_grouped = 0
          AND local_rollup.utc_grouped = 1
          AND local_rollup.location_grouped = 1
      ),
      'utc_time_buckets', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'minute', bucket.minute,
            'count', COALESCE(utc_rollup.event_count, 0)
          )
          ORDER BY bucket.minute
        )
        FROM generate_series(0, 1425, 15) AS bucket(minute)
        LEFT JOIN rollups utc_rollup
          ON utc_rollup.utc_bucket = bucket.minute
          AND utc_rollup.card_grouped = 1
          AND utc_rollup.local_grouped = 1
          AND utc_rollup.utc_grouped = 0
          AND utc_rollup.location_grouped = 1
      ),
      'locations', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'name', location.name,
              'count', location_rollup.event_count
            )
            ORDER BY location_rollup.event_count DESC, location.name
          )
          FROM rollups location_rollup
          JOIN community_locations location
            ON location.id = location_rollup.location_id
          WHERE location_rollup.card_grouped = 1
            AND location_rollup.local_grouped = 1
            AND location_rollup.utc_grouped = 1
            AND location_rollup.location_grouped = 0
        ),
        '[]'::jsonb
      )
    ) AS totals
  )
  SELECT cards_payload.cards, totals_payload.totals
  INTO v_cards, v_totals
  FROM cards_payload
  CROSS JOIN totals_payload;

  RETURN jsonb_build_object(
    'found', true,
    'available', jsonb_array_length(v_cards) > 0,
    'game', p_game,
    'league', v_league_name,
    'bucket_minutes', 15,
    'totals', v_totals,
    'cards', v_cards
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION get_community_league_drop_context_static(TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_community_league_drop_context_static(TEXT, TEXT)
TO service_role;

COMMENT ON FUNCTION get_community_league_drop_context_static(TEXT, TEXT)
IS 'Returns card context plus exact league-wide denominators for normalized static time and location rates.';

NOTIFY pgrst, 'reload schema';
