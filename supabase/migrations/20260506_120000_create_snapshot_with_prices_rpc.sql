CREATE OR REPLACE FUNCTION create_snapshot_with_prices(
  p_league_id UUID,
  p_fetched_at TIMESTAMPTZ,
  p_exchange_chaos_to_divine NUMERIC,
  p_stash_chaos_to_divine NUMERIC,
  p_stacked_deck_chaos_cost NUMERIC,
  p_stacked_deck_max_volume_rate NUMERIC,
  p_prices JSONB
)
RETURNS snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_snapshot snapshots;
BEGIN
  IF p_prices IS NULL
    OR jsonb_typeof(p_prices) <> 'array'
    OR jsonb_array_length(p_prices) = 0
  THEN
    RAISE EXCEPTION 'create_snapshot_with_prices requires at least one price row'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_prices) AS price(
      card_id UUID,
      price_source TEXT,
      chaos_value NUMERIC,
      divine_value NUMERIC,
      confidence SMALLINT
    )
    WHERE price.card_id IS NULL
      OR price.price_source IS NULL
      OR price.price_source NOT IN ('exchange', 'stash')
      OR price.chaos_value IS NULL
      OR price.chaos_value < 0
      OR price.divine_value IS NULL
      OR price.divine_value < 0
      OR price.confidence IS NULL
      OR price.confidence NOT IN (1, 2, 3)
  ) THEN
    RAISE EXCEPTION 'create_snapshot_with_prices received invalid price row'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_league_id::TEXT, 0));

  SELECT *
  INTO v_snapshot
  FROM snapshots
  WHERE league_id = p_league_id
    AND fetched_at >= p_fetched_at - INTERVAL '10 minutes'
  ORDER BY fetched_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_snapshot;
  END IF;

  INSERT INTO snapshots (
    league_id,
    fetched_at,
    exchange_chaos_to_divine,
    stash_chaos_to_divine,
    stacked_deck_chaos_cost,
    stacked_deck_max_volume_rate
  )
  VALUES (
    p_league_id,
    p_fetched_at,
    p_exchange_chaos_to_divine,
    p_stash_chaos_to_divine,
    p_stacked_deck_chaos_cost,
    p_stacked_deck_max_volume_rate
  )
  RETURNING * INTO v_snapshot;

  INSERT INTO card_prices (
    snapshot_id,
    card_id,
    price_source,
    chaos_value,
    divine_value,
    confidence
  )
  SELECT
    v_snapshot.id,
    price.card_id,
    price.price_source,
    price.chaos_value,
    price.divine_value,
    price.confidence
  FROM jsonb_to_recordset(p_prices) AS price(
    card_id UUID,
    price_source TEXT,
    chaos_value NUMERIC,
    divine_value NUMERIC,
    confidence SMALLINT
  );

  RETURN v_snapshot;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_snapshot_with_prices(
  UUID,
  TIMESTAMPTZ,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION create_snapshot_with_prices(
  UUID,
  TIMESTAMPTZ,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  JSONB
) TO service_role;
COMMENT ON FUNCTION create_snapshot_with_prices(
  UUID,
  TIMESTAMPTZ,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  JSONB
) IS 'Atomically creates a non-empty snapshot and card_prices rows, serializing recent writes per league. SECURITY DEFINER, service_role only.';
