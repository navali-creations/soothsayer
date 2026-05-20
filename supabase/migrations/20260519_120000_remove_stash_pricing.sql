-- Remove unsupported poe.ninja stash pricing from persisted Supabase data.

DROP FUNCTION IF EXISTS get_latest_snapshot_for_league(UUID);
DROP FUNCTION IF EXISTS create_snapshot_with_prices(
  UUID,
  TIMESTAMPTZ,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  JSONB
);
DROP FUNCTION IF EXISTS create_snapshot_with_prices(
  UUID,
  TIMESTAMPTZ,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  JSONB
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'card_prices'
      AND column_name = 'price_source'
  ) THEN
    DELETE FROM public.card_prices WHERE price_source IS DISTINCT FROM 'exchange';
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.idx_card_prices_snapshot_source;

ALTER TABLE public.card_prices DROP COLUMN IF EXISTS price_source;
ALTER TABLE public.snapshots DROP COLUMN IF EXISTS stash_chaos_to_divine;

CREATE FUNCTION get_latest_snapshot_for_league(p_league_id UUID)
RETURNS TABLE (
  snapshot_id UUID,
  fetched_at TIMESTAMPTZ,
  exchange_chaos_to_divine NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.fetched_at, s.exchange_chaos_to_divine
  FROM snapshots s
  WHERE s.league_id = p_league_id
  ORDER BY s.fetched_at DESC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_latest_snapshot_for_league(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_latest_snapshot_for_league(UUID) TO anon, authenticated, service_role;

CREATE FUNCTION create_snapshot_with_prices(
  p_league_id UUID,
  p_fetched_at TIMESTAMPTZ,
  p_exchange_chaos_to_divine NUMERIC,
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
      chaos_value NUMERIC,
      divine_value NUMERIC,
      confidence SMALLINT
    )
    WHERE price.card_id IS NULL
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
    stacked_deck_chaos_cost,
    stacked_deck_max_volume_rate
  )
  VALUES (
    p_league_id,
    p_fetched_at,
    p_exchange_chaos_to_divine,
    p_stacked_deck_chaos_cost,
    p_stacked_deck_max_volume_rate
  )
  RETURNING * INTO v_snapshot;

  INSERT INTO card_prices (
    snapshot_id,
    card_id,
    chaos_value,
    divine_value,
    confidence
  )
  SELECT
    v_snapshot.id,
    price.card_id,
    price.chaos_value,
    price.divine_value,
    price.confidence
  FROM jsonb_to_recordset(p_prices) AS price(
    card_id UUID,
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
  JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION create_snapshot_with_prices(
  UUID,
  TIMESTAMPTZ,
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
  JSONB
) IS 'Atomically creates a non-empty exchange-only snapshot and card_prices rows, serializing recent writes per league. SECURITY DEFINER, service_role only.';
