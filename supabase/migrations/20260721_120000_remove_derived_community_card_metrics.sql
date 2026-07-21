-- Ratios are derived from card counts and league totals by the public edge
-- function. Persisting them duplicated data and previously truncated rare-card
-- ratios to six decimal places.

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
      raw.contributors,
      raw.verified_count,
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
    contributors,
    verified_count,
    verified_contributors,
    community_estimated_weight,
    community_estimated_chance,
    verified_community_estimated_weight,
    verified_community_estimated_chance,
    updated_at
  )
  SELECT
    p_league_id,
    aggregate_scope,
    card_id,
    count,
    contributors,
    verified_count,
    verified_contributors,
    community_estimated_weight,
    CASE
      WHEN community_estimated_weight IS NOT NULL AND community_weight_total > 0 THEN
        ROUND((community_estimated_weight / community_weight_total)::NUMERIC, 12)::DOUBLE PRECISION
      ELSE NULL
    END,
    verified_community_estimated_weight,
    CASE
      WHEN verified_community_estimated_weight IS NOT NULL AND verified_community_weight_total > 0 THEN
        ROUND((verified_community_estimated_weight / verified_community_weight_total)::NUMERIC, 12)::DOUBLE PRECISION
      ELSE NULL
    END,
    v_now
  FROM normalized;
END;
$$;

ALTER TABLE community_league_card_estimates
  DROP COLUMN IF EXISTS ratio,
  DROP COLUMN IF EXISTS verified_ratio,
  DROP COLUMN IF EXISTS seen_vs_community_estimate,
  DROP COLUMN IF EXISTS verified_seen_vs_community_estimate;

REVOKE ALL ON FUNCTION refresh_community_league_card_estimates(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_community_league_card_estimates(UUID)
  TO service_role;

COMMENT ON FUNCTION refresh_community_league_card_estimates(UUID)
  IS 'Refreshes persisted all/non-suspicious community league/card aggregates for one league. Ratios are derived from counts by consumers. SECURITY DEFINER, service_role only.';
