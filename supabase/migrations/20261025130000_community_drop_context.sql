-- Normalized locations and privacy-preserving per-drop context. Raw event rows
-- remain service-role-only; public consumers should use aggregated RPCs.

CREATE TABLE community_locations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
  name TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game, name)
);

CREATE TABLE community_drop_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  upload_id UUID NOT NULL REFERENCES community_uploads(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  location_id BIGINT NOT NULL REFERENCES community_locations(id) ON DELETE RESTRICT,
  local_minute SMALLINT NOT NULL CHECK (local_minute BETWEEN 0 AND 1439),
  utc_offset_minutes SMALLINT NOT NULL CHECK (utc_offset_minutes BETWEEN -840 AND 840),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Context-only contributors need a stable upload parent before their first
-- aggregate card upload. Zero means no aggregate upload has happened yet.
ALTER TABLE community_uploads
  DROP CONSTRAINT community_uploads_upload_count_check;
ALTER TABLE community_uploads
  ADD CONSTRAINT community_uploads_upload_count_check
  CHECK (upload_count >= 0);

CREATE INDEX idx_community_drop_events_card_upload
  ON community_drop_events(card_id, upload_id)
  INCLUDE (location_id, local_minute, utc_offset_minutes);
CREATE INDEX idx_community_drop_events_location_card
  ON community_drop_events(location_id, card_id);
CREATE INDEX idx_community_drop_events_upload_time
  ON community_drop_events(upload_id, local_minute);

ALTER TABLE community_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE community_drop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_drop_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access for community_locations"
  ON community_locations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access for community_drop_events"
  ON community_drop_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON community_locations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON community_drop_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON community_locations TO service_role;
GRANT SELECT, INSERT ON community_drop_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE community_locations_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE community_drop_events_id_seq TO service_role;

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

  -- Serialize location admission per game so concurrent requests cannot race
  -- past the hard global cardinality limit below.
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
      OR event.location IS NULL
      OR LENGTH(BTRIM(event.location)) NOT BETWEEN 1 AND 200
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
  FROM jsonb_to_recordset(p_events) AS event(location TEXT);

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
  ) game_locations;

  IF v_global_location_count > 2000 THEN
    RAISE EXCEPTION 'ingest_community_drop_events game location limit exceeded'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO community_locations (game, name)
  SELECT DISTINCT v_game, BTRIM(event.location)
  FROM jsonb_to_recordset(p_events) AS event(location TEXT)
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
    JOIN community_locations location ON location.id = existing.location_id
    WHERE existing.upload_id != v_upload_id
      OR c.game != v_game
      OR c.name != BTRIM(event.card_name)
      OR location.name != BTRIM(event.location)
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
  JOIN community_locations location
    ON location.game = v_game
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

COMMENT ON FUNCTION ingest_community_drop_events(UUID, TEXT, JSONB)
IS 'Resolves the contributor by league and device, then validates and idempotently stores privacy-preserving card context. SECURITY DEFINER, service_role only.';

NOTIFY pgrst, 'reload schema';
