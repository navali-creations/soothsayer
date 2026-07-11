-- Persisted community drop-rate aggregates.
--
-- Raw per-upload observations stay in community_card_data. These tables hold
-- league-scoped aggregates refreshed at upload time, so public reads do not
-- have to rescan every upload/card row.

CREATE TABLE IF NOT EXISTS community_league_estimates (
  league_id UUID NOT NULL REFERENCES poe_leagues(id) ON DELETE CASCADE,
  aggregate_scope TEXT NOT NULL CHECK (aggregate_scope IN ('all', 'non_suspicious')),
  upload_count INTEGER NOT NULL DEFAULT 0 CHECK (upload_count >= 0),
  observed_total BIGINT NOT NULL DEFAULT 0 CHECK (observed_total >= 0),
  card_observed_total BIGINT NOT NULL DEFAULT 0 CHECK (card_observed_total >= 0),
  contributors INTEGER NOT NULL DEFAULT 0 CHECK (contributors >= 0),
  verified_observed_total BIGINT NOT NULL DEFAULT 0 CHECK (verified_observed_total >= 0),
  verified_card_observed_total BIGINT NOT NULL DEFAULT 0 CHECK (verified_card_observed_total >= 0),
  verified_contributors INTEGER NOT NULL DEFAULT 0 CHECK (verified_contributors >= 0),
  excluded_suspicious_upload_count INTEGER NOT NULL DEFAULT 0 CHECK (excluded_suspicious_upload_count >= 0),
  excluded_suspicious_observed_total BIGINT NOT NULL DEFAULT 0 CHECK (excluded_suspicious_observed_total >= 0),
  unresolved_card_row_count INTEGER NOT NULL DEFAULT 0 CHECK (unresolved_card_row_count >= 0),
  unresolved_card_observed_total BIGINT NOT NULL DEFAULT 0 CHECK (unresolved_card_observed_total >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, aggregate_scope)
);

CREATE TABLE IF NOT EXISTS community_league_card_estimates (
  league_id UUID NOT NULL REFERENCES poe_leagues(id) ON DELETE CASCADE,
  aggregate_scope TEXT NOT NULL CHECK (aggregate_scope IN ('all', 'non_suspicious')),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  count BIGINT NOT NULL DEFAULT 0 CHECK (count >= 0),
  ratio DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (ratio >= 0),
  contributors INTEGER NOT NULL DEFAULT 0 CHECK (contributors >= 0),
  verified_count BIGINT NOT NULL DEFAULT 0 CHECK (verified_count >= 0),
  verified_ratio DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (verified_ratio >= 0),
  verified_contributors INTEGER NOT NULL DEFAULT 0 CHECK (verified_contributors >= 0),
  community_estimated_weight DOUBLE PRECISION,
  community_estimated_chance DOUBLE PRECISION,
  seen_vs_community_estimate DOUBLE PRECISION,
  verified_community_estimated_weight DOUBLE PRECISION,
  verified_community_estimated_chance DOUBLE PRECISION,
  verified_seen_vs_community_estimate DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, aggregate_scope, card_id)
);

CREATE INDEX IF NOT EXISTS idx_community_league_card_estimates_card
  ON community_league_card_estimates(card_id);

ALTER TABLE community_league_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_league_estimates FORCE ROW LEVEL SECURITY;
ALTER TABLE community_league_card_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_league_card_estimates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access for community_league_estimates"
  ON community_league_estimates;
CREATE POLICY "Service role full access for community_league_estimates"
  ON community_league_estimates FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access for community_league_card_estimates"
  ON community_league_card_estimates;
CREATE POLICY "Service role full access for community_league_card_estimates"
  ON community_league_card_estimates FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE community_league_estimates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE community_league_card_estimates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE community_league_estimates TO service_role;
GRANT ALL ON TABLE community_league_card_estimates TO service_role;

CREATE OR REPLACE FUNCTION refresh_community_league_card_estimates(p_league_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_league_id IS NULL THEN
    RAISE EXCEPTION 'refresh_community_league_card_estimates requires league_id'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM poe_leagues WHERE id = p_league_id) THEN
    RAISE EXCEPTION 'refresh_community_league_card_estimates league_id not found'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM community_league_card_estimates
  WHERE league_id = p_league_id;

  DELETE FROM community_league_estimates
  WHERE league_id = p_league_id;

  WITH scopes AS (
    SELECT 'all'::TEXT AS aggregate_scope, false AS exclude_suspicious
    UNION ALL
    SELECT 'non_suspicious'::TEXT AS aggregate_scope, true AS exclude_suspicious
  ),
  upload_stats AS (
    SELECT
      scopes.aggregate_scope,
      COUNT(cu.id)::INTEGER AS upload_count,
      COALESCE(SUM(cu.total_cards_uploaded::BIGINT), 0)::BIGINT AS observed_total,
      COUNT(DISTINCT cu.device_id) FILTER (WHERE cu.device_id IS NOT NULL)::INTEGER AS contributors,
      COALESCE(SUM(cu.total_cards_uploaded::BIGINT) FILTER (WHERE cu.is_verified), 0)::BIGINT AS verified_observed_total,
      COUNT(DISTINCT cu.ggg_uuid) FILTER (WHERE cu.is_verified AND cu.ggg_uuid IS NOT NULL)::INTEGER AS verified_contributors
    FROM scopes
    LEFT JOIN community_uploads cu
      ON cu.league_id = p_league_id
      AND (NOT scopes.exclude_suspicious OR cu.is_suspicious = false)
    GROUP BY scopes.aggregate_scope
  ),
  card_totals AS (
    SELECT
      scopes.aggregate_scope,
      COALESCE(SUM(ccd.count::BIGINT), 0)::BIGINT AS card_observed_total,
      COALESCE(SUM(ccd.count::BIGINT) FILTER (WHERE cu.is_verified), 0)::BIGINT AS verified_card_observed_total
    FROM scopes
    LEFT JOIN community_uploads cu
      ON cu.league_id = p_league_id
      AND (NOT scopes.exclude_suspicious OR cu.is_suspicious = false)
    LEFT JOIN community_card_data ccd
      ON ccd.upload_id = cu.id
    GROUP BY scopes.aggregate_scope
  ),
  suspicious_totals AS (
    SELECT
      COUNT(*)::INTEGER AS upload_count,
      COALESCE(SUM(total_cards_uploaded::BIGINT), 0)::BIGINT AS observed_total
    FROM community_uploads
    WHERE league_id = p_league_id
      AND is_suspicious = true
  )
  INSERT INTO community_league_estimates (
    league_id,
    aggregate_scope,
    upload_count,
    observed_total,
    card_observed_total,
    contributors,
    verified_observed_total,
    verified_card_observed_total,
    verified_contributors,
    excluded_suspicious_upload_count,
    excluded_suspicious_observed_total,
    unresolved_card_row_count,
    unresolved_card_observed_total,
    updated_at
  )
  SELECT
    p_league_id,
    upload_stats.aggregate_scope,
    upload_stats.upload_count,
    upload_stats.observed_total,
    card_totals.card_observed_total,
    upload_stats.contributors,
    upload_stats.verified_observed_total,
    card_totals.verified_card_observed_total,
    upload_stats.verified_contributors,
    CASE
      WHEN upload_stats.aggregate_scope = 'non_suspicious' THEN suspicious_totals.upload_count
      ELSE 0
    END,
    CASE
      WHEN upload_stats.aggregate_scope = 'non_suspicious' THEN suspicious_totals.observed_total
      ELSE 0
    END,
    0,
    0,
    v_now
  FROM upload_stats
  JOIN card_totals
    ON card_totals.aggregate_scope = upload_stats.aggregate_scope
  CROSS JOIN suspicious_totals;

  WITH scopes AS (
    SELECT 'all'::TEXT AS aggregate_scope, false AS exclude_suspicious
    UNION ALL
    SELECT 'non_suspicious'::TEXT AS aggregate_scope, true AS exclude_suspicious
  ),
  raw AS (
    SELECT
      scopes.aggregate_scope,
      ccd.card_id,
      SUM(ccd.count::BIGINT)::BIGINT AS count,
      COUNT(DISTINCT cu.device_id) FILTER (WHERE cu.device_id IS NOT NULL)::INTEGER AS contributors,
      COALESCE(SUM(ccd.count::BIGINT) FILTER (WHERE cu.is_verified), 0)::BIGINT AS verified_count,
      COUNT(DISTINCT cu.ggg_uuid) FILTER (WHERE cu.is_verified AND cu.ggg_uuid IS NOT NULL)::INTEGER AS verified_contributors
    FROM scopes
    JOIN community_uploads cu
      ON cu.league_id = p_league_id
      AND (NOT scopes.exclude_suspicious OR cu.is_suspicious = false)
    JOIN community_card_data ccd
      ON ccd.upload_id = cu.id
    GROUP BY scopes.aggregate_scope, ccd.card_id
  ),
  totals AS (
    SELECT
      aggregate_scope,
      SUM(count)::DOUBLE PRECISION AS total_count,
      SUM(verified_count)::DOUBLE PRECISION AS verified_total_count
    FROM raw
    GROUP BY aggregate_scope
  ),
  anchors AS (
    SELECT
      raw.aggregate_scope,
      MAX(raw.count) FILTER (WHERE cards.name = 'Rain of Chaos')::DOUBLE PRECISION AS anchor_count,
      MAX(raw.verified_count) FILTER (WHERE cards.name = 'Rain of Chaos')::DOUBLE PRECISION AS verified_anchor_count
    FROM raw
    JOIN cards ON cards.id = raw.card_id
    GROUP BY raw.aggregate_scope
  ),
  weighted AS (
    SELECT
      raw.aggregate_scope,
      raw.card_id,
      raw.count,
      ROUND((raw.count::DOUBLE PRECISION / NULLIF(totals.total_count, 0))::NUMERIC, 6)::DOUBLE PRECISION AS ratio,
      raw.contributors,
      raw.verified_count,
      COALESCE(
        ROUND((raw.verified_count::DOUBLE PRECISION / NULLIF(totals.verified_total_count, 0))::NUMERIC, 6)::DOUBLE PRECISION,
        0
      ) AS verified_ratio,
      raw.verified_contributors,
      CASE
        WHEN anchors.anchor_count IS NOT NULL AND anchors.anchor_count > 0 AND raw.count > 0 THEN
          ROUND((
            POWER(raw.count::DOUBLE PRECISION, 1.5)
            / (POWER(anchors.anchor_count, 1.5) / 121400)
          )::NUMERIC, 3)::DOUBLE PRECISION
        ELSE NULL
      END AS community_estimated_weight,
      CASE
        WHEN anchors.verified_anchor_count IS NOT NULL AND anchors.verified_anchor_count > 0 AND raw.verified_count > 0 THEN
          ROUND((
            POWER(raw.verified_count::DOUBLE PRECISION, 1.5)
            / (POWER(anchors.verified_anchor_count, 1.5) / 121400)
          )::NUMERIC, 3)::DOUBLE PRECISION
        ELSE NULL
      END AS verified_community_estimated_weight
    FROM raw
    JOIN totals
      ON totals.aggregate_scope = raw.aggregate_scope
    LEFT JOIN anchors
      ON anchors.aggregate_scope = raw.aggregate_scope
  ),
  normalized AS (
    SELECT
      weighted.*,
      SUM(weighted.community_estimated_weight) OVER (PARTITION BY weighted.aggregate_scope) AS community_weight_total,
      SUM(weighted.verified_community_estimated_weight) OVER (PARTITION BY weighted.aggregate_scope) AS verified_community_weight_total
    FROM weighted
  )
  INSERT INTO community_league_card_estimates (
    league_id,
    aggregate_scope,
    card_id,
    count,
    ratio,
    contributors,
    verified_count,
    verified_ratio,
    verified_contributors,
    community_estimated_weight,
    community_estimated_chance,
    seen_vs_community_estimate,
    verified_community_estimated_weight,
    verified_community_estimated_chance,
    verified_seen_vs_community_estimate,
    updated_at
  )
  SELECT
    p_league_id,
    aggregate_scope,
    card_id,
    count,
    ratio,
    contributors,
    verified_count,
    verified_ratio,
    verified_contributors,
    community_estimated_weight,
    CASE
      WHEN community_estimated_weight IS NOT NULL AND community_weight_total > 0 THEN
        ROUND((community_estimated_weight / community_weight_total)::NUMERIC, 12)::DOUBLE PRECISION
      ELSE NULL
    END AS community_estimated_chance,
    CASE
      WHEN community_estimated_weight IS NOT NULL AND community_weight_total > 0 THEN
        ROUND((
          ratio / NULLIF(
            ROUND((community_estimated_weight / community_weight_total)::NUMERIC, 12)::DOUBLE PRECISION,
            0
          )
        )::NUMERIC, 12)::DOUBLE PRECISION
      ELSE NULL
    END AS seen_vs_community_estimate,
    verified_community_estimated_weight,
    CASE
      WHEN verified_community_estimated_weight IS NOT NULL AND verified_community_weight_total > 0 THEN
        ROUND((verified_community_estimated_weight / verified_community_weight_total)::NUMERIC, 12)::DOUBLE PRECISION
      ELSE NULL
    END AS verified_community_estimated_chance,
    CASE
      WHEN verified_community_estimated_weight IS NOT NULL AND verified_community_weight_total > 0 AND verified_count > 0 THEN
        ROUND((
          verified_ratio / NULLIF(
            ROUND((verified_community_estimated_weight / verified_community_weight_total)::NUMERIC, 12)::DOUBLE PRECISION,
            0
          )
        )::NUMERIC, 12)::DOUBLE PRECISION
      ELSE NULL
    END AS verified_seen_vs_community_estimate,
    v_now
  FROM normalized;
END;
$$;

REVOKE ALL ON FUNCTION refresh_community_league_card_estimates(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_community_league_card_estimates(UUID)
  TO service_role;
COMMENT ON FUNCTION refresh_community_league_card_estimates(UUID)
  IS 'Refreshes persisted all/non-suspicious community league/card aggregates for one league. SECURITY DEFINER, service_role only.';

CREATE OR REPLACE FUNCTION refresh_community_league_estimates_on_suspicion_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM refresh_community_league_card_estimates(NEW.league_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_community_league_estimates_after_suspicion_update
  ON community_uploads;
CREATE TRIGGER refresh_community_league_estimates_after_suspicion_update
  AFTER UPDATE OF is_suspicious ON community_uploads
  FOR EACH ROW
  WHEN (OLD.is_suspicious IS DISTINCT FROM NEW.is_suspicious)
  EXECUTE FUNCTION refresh_community_league_estimates_on_suspicion_change();

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

  PERFORM refresh_community_league_card_estimates(p_league_id);

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
) IS 'Atomically resolves card names, creates or updates community_uploads, merges community_card_data with GREATEST semantics, refreshes persisted community league/card aggregates, and returns the server-side upload summary. SECURITY DEFINER, service_role only.';

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT league_id
    FROM community_uploads
  LOOP
    PERFORM refresh_community_league_card_estimates(rec.league_id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
