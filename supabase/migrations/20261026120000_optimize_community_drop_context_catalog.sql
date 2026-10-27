-- Build the league-wide context response from per-card rollups instead of
-- repeatedly scanning aggregate CTEs from correlated JSON subqueries.

-- League exports start from upload ids, so keep all event dimensions needed
-- by the aggregate in the index. This avoids heap reads for the nightly
-- static projection once visibility-map coverage is established.
CREATE INDEX IF NOT EXISTS idx_community_drop_events_upload_context
  ON community_drop_events(upload_id, card_id)
  INCLUDE (location_id, local_minute, utc_offset_minutes);

CREATE INDEX IF NOT EXISTS idx_community_uploads_league_context
  ON community_uploads(league_id, id);

CREATE OR REPLACE FUNCTION get_community_league_drop_context(
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
      event.upload_id,
      event.location_id,
      event.local_minute,
      event.utc_offset_minutes
    FROM community_uploads upload
    JOIN community_drop_events event ON event.upload_id = upload.id
    WHERE upload.league_id = v_league_id
  ),
  eligible_cards AS MATERIALIZED (
    SELECT
      filtered.card_id,
      card.name AS card_name,
      COUNT(DISTINCT filtered.upload_id)::INTEGER AS contributors,
      COUNT(*)::BIGINT AS observed_events
    FROM filtered
    JOIN cards card
      ON card.id = filtered.card_id
      AND card.game = p_game
    GROUP BY filtered.card_id, card.name
  ),
  rollups AS MATERIALIZED (
    SELECT
      bucketed.card_id,
      bucketed.local_bucket,
      bucketed.utc_bucket,
      bucketed.utc_offset_minutes,
      bucketed.location_id,
      GROUPING(bucketed.local_bucket) AS local_grouped,
      GROUPING(bucketed.utc_bucket) AS utc_grouped,
      GROUPING(bucketed.utc_offset_minutes) AS offset_grouped,
      GROUPING(bucketed.location_id) AS location_grouped,
      COUNT(*)::BIGINT AS event_count
    FROM (
      SELECT
        filtered.card_id,
        (filtered.local_minute / 15) * 15 AS local_bucket,
        (
          (
            (
              filtered.local_minute - filtered.utc_offset_minutes
            ) % 1440 + 1440
          ) % 1440 / 15
        ) * 15 AS utc_bucket,
        filtered.utc_offset_minutes,
        filtered.location_id
      FROM filtered
    ) bucketed
    GROUP BY GROUPING SETS (
      (bucketed.card_id, bucketed.local_bucket),
      (bucketed.card_id, bucketed.local_bucket, bucketed.location_id),
      (bucketed.card_id, bucketed.utc_bucket),
      (bucketed.card_id, bucketed.utc_offset_minutes),
      (bucketed.card_id, bucketed.location_id)
    )
  ),
  local_locations_by_bucket AS MATERIALIZED (
    SELECT
      rollup.card_id,
      rollup.local_bucket,
      jsonb_agg(
        jsonb_build_object(
          'name', location.name,
          'count', rollup.event_count
        )
        ORDER BY rollup.event_count DESC, location.name
      ) AS locations
    FROM rollups rollup
    JOIN community_locations location ON location.id = rollup.location_id
    WHERE rollup.local_grouped = 0
      AND rollup.utc_grouped = 1
      AND rollup.offset_grouped = 1
      AND rollup.location_grouped = 0
    GROUP BY rollup.card_id, rollup.local_bucket
  ),
  local_buckets_by_card AS MATERIALIZED (
    SELECT
      eligible.card_id,
      jsonb_agg(
        jsonb_build_object(
          'minute', bucket.minute,
          'count', COALESCE(local_rollup.event_count, 0),
          'locations', COALESCE(
            local_locations.locations,
            '[]'::jsonb
          )
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
      AND local_rollup.offset_grouped = 1
      AND local_rollup.location_grouped = 1
    LEFT JOIN local_locations_by_bucket local_locations
      ON local_locations.card_id = eligible.card_id
      AND local_locations.local_bucket = bucket.minute
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
      AND utc_rollup.offset_grouped = 1
      AND utc_rollup.location_grouped = 1
    GROUP BY eligible.card_id
  ),
  utc_offsets_by_card AS MATERIALIZED (
    SELECT
      rollup.card_id,
      jsonb_agg(
        jsonb_build_object(
          'utc_offset_minutes', rollup.utc_offset_minutes,
          'count', rollup.event_count
        )
        ORDER BY rollup.utc_offset_minutes
      ) AS offsets
    FROM rollups rollup
    WHERE rollup.local_grouped = 1
      AND rollup.utc_grouped = 1
      AND rollup.offset_grouped = 0
      AND rollup.location_grouped = 1
    GROUP BY rollup.card_id
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
      AND rollup.offset_grouped = 1
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
        'contributors', eligible.contributors,
        'observed_events', eligible.observed_events,
        'local_time_buckets', local_buckets.buckets,
        'utc_time_buckets', utc_buckets.buckets,
        'utc_offsets', COALESCE(utc_offsets.offsets, '[]'::jsonb),
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
  LEFT JOIN utc_offsets_by_card utc_offsets
    ON utc_offsets.card_id = eligible.card_id
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

REVOKE EXECUTE ON FUNCTION get_community_league_drop_context(TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_community_league_drop_context(TEXT, TEXT)
TO service_role;

COMMENT ON FUNCTION get_community_league_drop_context(TEXT, TEXT)
IS 'Returns all available card drop-context aggregates for a league using pre-aggregated rollups.';

-- Static-site exports only need local-time buckets and the global location
-- distribution. Keeping that projection separate avoids computing UTC and
-- per-bucket location dimensions that wraeclast.cards does not publish.
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
      event.card_id,
      (event.local_minute / 15) * 15 AS local_bucket,
      event.location_id,
      GROUPING((event.local_minute / 15) * 15) AS local_grouped,
      GROUPING(event.location_id) AS location_grouped,
      COUNT(*)::BIGINT AS event_count
    FROM relevant_uploads upload
    JOIN community_drop_events event ON event.upload_id = upload.id
    GROUP BY GROUPING SETS (
      (event.card_id, (event.local_minute / 15) * 15),
      (event.card_id, event.location_id)
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
      AND local_rollup.location_grouped = 1
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
IS 'Returns the lean local-time and location projection used by static league datasets.';

NOTIFY pgrst, 'reload schema';
