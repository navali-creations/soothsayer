-- ═══════════════════════════════════════════════════════════════
-- Migration: Community Upload Schema (Phase 1a)
--
-- Implements the foundation for community-sourced divination card
-- data uploads. This migration:
--
--   1. Creates `cards` table (normalized card lookup per league)
--   2. Backfills `cards` from existing `card_prices` data
--   3. Adds nullable `card_id` column to `card_prices` + backfill
--   4. Creates `community_uploads` table (upload sessions/devices)
--   5. Creates `community_card_data` table (per-card counts)
--   6. Creates DB functions for card population & suspicious upload detection
--   7. Schedules cron job for card population management
--
-- Phase B (deferred): drop card_name, make card_id NOT NULL
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. TABLE: cards (normalized card lookup)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
  league_id UUID NOT NULL REFERENCES poe_leagues(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  UNIQUE(league_id, name)
);

CREATE INDEX idx_cards_league ON cards(league_id);
CREATE INDEX idx_cards_game ON cards(game);

-- Trigger to ensure cards.game matches the referenced league's game
CREATE OR REPLACE FUNCTION validate_card_game_matches_league()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.game != (SELECT game FROM poe_leagues WHERE id = NEW.league_id) THEN
    RAISE EXCEPTION 'cards.game (%) does not match poe_leagues.game for league_id %', NEW.game, NEW.league_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cards_game_consistency
  BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION validate_card_game_matches_league();

-- RLS: public read, service_role full access
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards FORCE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for cards"
  ON cards FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access for cards"
  ON cards FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- 2. BACKFILL: Populate cards from existing card_prices data
-- ═══════════════════════════════════════════════════════════════

INSERT INTO cards (game, league_id, name)
SELECT DISTINCT pl.game, s.league_id, cp.card_name
FROM card_prices cp
JOIN snapshots s ON s.id = cp.snapshot_id
JOIN poe_leagues pl ON pl.id = s.league_id
ON CONFLICT (league_id, name) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- 3. ALTER card_prices: add nullable card_id + backfill + index
--
--    Phase B will make card_id NOT NULL and drop card_name.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE card_prices ADD COLUMN card_id UUID REFERENCES cards(id);

UPDATE card_prices cp
SET card_id = c.id
FROM cards c
JOIN snapshots s ON s.league_id = c.league_id
WHERE cp.snapshot_id = s.id
  AND cp.card_name = c.name;

CREATE INDEX idx_card_prices_card_id ON card_prices(card_id);


-- ═══════════════════════════════════════════════════════════════
-- 4. TABLE: community_uploads (upload sessions / device tracking)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE community_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES poe_leagues(id) ON DELETE RESTRICT,
  device_id TEXT NOT NULL,
  ggg_uuid TEXT DEFAULT NULL,
  ggg_username TEXT DEFAULT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  total_cards_uploaded INT NOT NULL DEFAULT 0 CHECK (total_cards_uploaded >= 0),
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  suspicion_reasons TEXT[] DEFAULT '{}',
  first_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  upload_count INT NOT NULL DEFAULT 1 CHECK (upload_count > 0),
  UNIQUE(league_id, device_id)
);

CREATE INDEX idx_community_uploads_league ON community_uploads(league_id);
CREATE INDEX idx_community_uploads_device ON community_uploads(device_id);
CREATE INDEX idx_community_uploads_ggg ON community_uploads(ggg_uuid) WHERE ggg_uuid IS NOT NULL;
CREATE INDEX idx_community_uploads_verified ON community_uploads(league_id, is_verified) WHERE is_verified = true;

-- RLS: service_role only (no public access)
ALTER TABLE community_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_uploads FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access for community_uploads"
  ON community_uploads FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- 5. TABLE: community_card_data (per-card counts from uploads)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE community_card_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES community_uploads(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  count INT NOT NULL CHECK (count > 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(upload_id, card_id)
);

CREATE INDEX idx_community_card_data_upload ON community_card_data(upload_id);
CREATE INDEX idx_community_card_data_card ON community_card_data(card_id);

-- RLS: public read, service_role full access
ALTER TABLE community_card_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_card_data FORCE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for community_card_data"
  ON community_card_data FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access for community_card_data"
  ON community_card_data FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- 6a. FUNCTION: populate_cards_for_league(p_league_id UUID)
--
--     Gathers unique card names from card_prices for a given league
--     and upserts them into the cards table. Returns the number of
--     newly inserted cards.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION populate_cards_for_league(p_league_id UUID)
RETURNS INT AS $$
DECLARE
  inserted_count INT;
  v_game TEXT;
BEGIN
  SELECT game INTO v_game FROM poe_leagues WHERE id = p_league_id;

  IF v_game IS NULL THEN
    RAISE WARNING 'populate_cards_for_league: league % not found', p_league_id;
    RETURN 0;
  END IF;

  INSERT INTO cards (game, league_id, name)
  SELECT DISTINCT v_game, p_league_id, cp.card_name
  FROM card_prices cp
  JOIN snapshots s ON s.id = cp.snapshot_id
  WHERE s.league_id = p_league_id
  ON CONFLICT (league_id, name) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE LOG 'populate_cards_for_league(%): inserted % cards', p_league_id, inserted_count;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION populate_cards_for_league(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION populate_cards_for_league(UUID) FROM PUBLIC;
COMMENT ON FUNCTION populate_cards_for_league(UUID) IS 'Upserts unique card names from card_prices into cards for a given league. SECURITY DEFINER, service_role only.';


-- ═══════════════════════════════════════════════════════════════
-- 6b. FUNCTION: manage_card_population_cron_jobs()
--
--     Creates daily cron jobs for active leagues nearing their end
--     (within 7 days of end_at) to populate the cards table.
--     Removes cron jobs for leagues that have already ended.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION manage_card_population_cron_jobs()
RETURNS void AS $$
DECLARE
  league RECORD;
  job_name TEXT;
  job_exists BOOLEAN;
BEGIN
  -- Create cron jobs for active leagues ending within 7 days
  FOR league IN
    SELECT id, league_id
    FROM poe_leagues
    WHERE is_active = true
      AND end_at IS NOT NULL
      AND end_at > NOW()
      AND end_at <= NOW() + INTERVAL '7 days'
  LOOP
    job_name := 'populate-cards-' || league.id::text;
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = job_name) INTO job_exists;

    IF NOT job_exists THEN
      PERFORM cron.schedule(
        job_name,
        '0 2 * * *',
        format('SELECT populate_cards_for_league(%L::uuid);', league.id)
      );
      RAISE LOG 'Created cron job % for league %', job_name, league.league_id;
    END IF;
  END LOOP;

  -- Remove cron jobs for ended leagues
  FOR league IN
    SELECT id, league_id
    FROM poe_leagues
    WHERE end_at IS NOT NULL
      AND end_at < NOW()
  LOOP
    job_name := 'populate-cards-' || league.id::text;
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = job_name) INTO job_exists;

    IF job_exists THEN
      PERFORM cron.unschedule(job_name);
      RAISE LOG 'Removed cron job % for ended league %', job_name, league.league_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION manage_card_population_cron_jobs() TO service_role;
REVOKE EXECUTE ON FUNCTION manage_card_population_cron_jobs() FROM PUBLIC;
COMMENT ON FUNCTION manage_card_population_cron_jobs() IS 'Creates/removes pg_cron jobs for card population based on league end dates. Runs daily via cron.';


-- ═══════════════════════════════════════════════════════════════
-- 6c. FUNCTION: flag_suspicious_uploads(p_league_id UUID)
--
--     Checks non-suspicious community uploads in a league for
--     statistical anomalies:
--       - card_ratio_outlier: total card count is >3 stddev from
--         the community mean for that league
--       - too_many_round_numbers: >50% of card counts are
--         multiples of 10
--     Flags matching uploads with is_suspicious = true and records
--     the reasons. Returns the number of newly flagged uploads.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION flag_suspicious_uploads(p_league_id UUID)
RETURNS INT AS $$
DECLARE
  flagged_count INT := 0;
  v_mean NUMERIC;
  v_stddev NUMERIC;
  v_upper_bound NUMERIC;
  rec RECORD;
  v_reasons TEXT[];
  v_round_count INT;
  v_total_entries INT;
BEGIN
  -- Calculate community-wide stats for total_cards_uploaded in this league
  -- Only consider non-suspicious uploads for the baseline
  SELECT
    COALESCE(AVG(total_cards_uploaded), 0),
    COALESCE(STDDEV_POP(total_cards_uploaded), 0)
  INTO v_mean, v_stddev
  FROM community_uploads
  WHERE league_id = p_league_id
    AND is_suspicious = false
    AND total_cards_uploaded > 0;

  -- Upper bound: mean + 3 standard deviations
  v_upper_bound := v_mean + (3 * v_stddev);

  -- Iterate over non-suspicious uploads in this league
  FOR rec IN
    SELECT cu.id, cu.total_cards_uploaded
    FROM community_uploads cu
    WHERE cu.league_id = p_league_id
      AND cu.is_suspicious = false
      AND cu.total_cards_uploaded > 0
  LOOP
    v_reasons := '{}';

    -- Check 1: card_ratio_outlier (total cards > 3 stddev from mean)
    -- Only flag if stddev is meaningful (> 0) to avoid flagging when all values are identical
    IF v_stddev > 0 AND rec.total_cards_uploaded > v_upper_bound THEN
      v_reasons := array_append(v_reasons, 'card_ratio_outlier');
    END IF;

    -- Check 2: too_many_round_numbers (>50% of card counts are multiples of 10)
    SELECT
      COUNT(*) FILTER (WHERE ccd.count % 10 = 0),
      COUNT(*)
    INTO v_round_count, v_total_entries
    FROM community_card_data ccd
    WHERE ccd.upload_id = rec.id;

    IF v_total_entries > 0 AND (v_round_count::numeric / v_total_entries) > 0.5 THEN
      v_reasons := array_append(v_reasons, 'too_many_round_numbers');
    END IF;

    -- Flag the upload if any reasons were found
    IF array_length(v_reasons, 1) > 0 THEN
      UPDATE community_uploads
      SET is_suspicious = true,
          suspicion_reasons = v_reasons
      WHERE id = rec.id;

      flagged_count := flagged_count + 1;
    END IF;
  END LOOP;

  RAISE LOG 'flag_suspicious_uploads(%): flagged % uploads', p_league_id, flagged_count;
  RETURN flagged_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION flag_suspicious_uploads(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION flag_suspicious_uploads(UUID) FROM PUBLIC;
COMMENT ON FUNCTION flag_suspicious_uploads(UUID) IS 'Flags community uploads as suspicious based on statistical anomalies (3-stddev outlier, round number patterns). SECURITY DEFINER, service_role only.';


-- ═══════════════════════════════════════════════════════════════
-- 7. CRON: Schedule manage_card_population_cron_jobs() daily
--
--    Runs at 01:30 UTC, 30 minutes after the league sync cron
--    at 01:00 UTC. This gives the async edge function time to
--    complete before we evaluate league end dates.
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
  'manage-card-population-crons',
  '30 1 * * *',
  'SELECT manage_card_population_cron_jobs();'
);
