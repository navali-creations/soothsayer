-- ═══════════════════════════════════════════════════════════════
-- Migration: Deduplicate cards table — per-game instead of per-league
--
-- Previously: cards(id, game, league_id, name) UNIQUE(league_id, name)
--   → One row per card per league (1799 rows for 464 unique poe1 cards)
--
-- After: cards(id, game, name) UNIQUE(game, name)
--   → One row per card per game (~464 rows for poe1)
--
-- Steps:
--   1. Pick one canonical card ID per (game, name) — the oldest row
--   2. Remap card_prices.card_id to the canonical IDs
--   3. Remap community_card_data.card_id (if any rows exist)
--   4. Delete duplicate card rows
--   5. Drop league_id column, old constraints, old trigger/function
--   6. Add new UNIQUE(game, name) constraint
--   7. Update populate_cards and cron management functions
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. Build a mapping table: for each (game, name), pick the
--    canonical card ID (the one with the smallest id, i.e. first created)
-- ═══════════════════════════════════════════════════════════════

CREATE TEMPORARY TABLE _card_canonical AS
SELECT DISTINCT ON (game, name)
  id AS canonical_id,
  game,
  name
FROM cards
ORDER BY game, name, id;

CREATE INDEX _idx_card_canonical ON _card_canonical (game, name);

-- Build a full mapping: every card id → its canonical id
CREATE TEMPORARY TABLE _card_id_map AS
SELECT c.id AS old_id, cc.canonical_id
FROM cards c
JOIN _card_canonical cc ON cc.game = c.game AND cc.name = c.name;

CREATE INDEX _idx_card_id_map ON _card_id_map (old_id);


-- ═══════════════════════════════════════════════════════════════
-- 2. Remap card_prices.card_id to canonical IDs
-- ═══════════════════════════════════════════════════════════════

UPDATE card_prices cp
SET card_id = m.canonical_id
FROM _card_id_map m
WHERE cp.card_id = m.old_id
  AND cp.card_id != m.canonical_id;


-- ═══════════════════════════════════════════════════════════════
-- 3. Remap community_card_data.card_id (if any rows exist)
--
--    Since community_card_data has UNIQUE(upload_id, card_id),
--    remapping could cause conflicts if two rows for the same
--    upload point to different league-specific cards that map to
--    the same canonical card. We handle this by keeping the
--    higher count (GREATEST) and deleting the duplicate.
-- ═══════════════════════════════════════════════════════════════

-- First, update non-conflicting rows
UPDATE community_card_data ccd
SET card_id = m.canonical_id
FROM _card_id_map m
WHERE ccd.card_id = m.old_id
  AND ccd.card_id != m.canonical_id
  AND NOT EXISTS (
    SELECT 1 FROM community_card_data other
    WHERE other.upload_id = ccd.upload_id
      AND other.card_id = m.canonical_id
      AND other.id != ccd.id
  );

-- For conflicting rows: keep the one with the higher count, delete the other
-- (This block is a no-op if community_card_data is empty, which it currently is)
WITH conflicts AS (
  SELECT ccd.id, ccd.upload_id, ccd.card_id AS old_card_id, m.canonical_id, ccd.count,
         ROW_NUMBER() OVER (
           PARTITION BY ccd.upload_id, m.canonical_id
           ORDER BY ccd.count DESC, ccd.id
         ) AS rn
  FROM community_card_data ccd
  JOIN _card_id_map m ON ccd.card_id = m.old_id
  WHERE ccd.card_id != m.canonical_id
)
DELETE FROM community_card_data WHERE id IN (
  SELECT id FROM conflicts WHERE rn > 1
);

-- Now update any remaining non-canonical references
UPDATE community_card_data ccd
SET card_id = m.canonical_id
FROM _card_id_map m
WHERE ccd.card_id = m.old_id
  AND ccd.card_id != m.canonical_id;


-- ═══════════════════════════════════════════════════════════════
-- 4. Delete duplicate card rows (keep only canonical IDs)
-- ═══════════════════════════════════════════════════════════════

DELETE FROM cards
WHERE id NOT IN (SELECT canonical_id FROM _card_canonical);


-- ═══════════════════════════════════════════════════════════════
-- 5. Drop league_id column, old constraints, old trigger/function
-- ═══════════════════════════════════════════════════════════════

-- Drop the game-consistency trigger (no league_id to validate against)
DROP TRIGGER IF EXISTS trg_cards_game_consistency ON cards;
DROP FUNCTION IF EXISTS validate_card_game_matches_league();

-- Drop the league-based index
DROP INDEX IF EXISTS idx_cards_league;

-- Drop the old unique constraint (league_id, name)
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_league_id_name_key;

-- Drop the league_id FK and column
ALTER TABLE cards DROP COLUMN league_id;


-- ═══════════════════════════════════════════════════════════════
-- 6. Add new UNIQUE(game, name) constraint + index
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE cards ADD CONSTRAINT cards_game_name_key UNIQUE (game, name);

-- The game index still exists (idx_cards_game from the original migration)


-- ═══════════════════════════════════════════════════════════════
-- 7. Replace populate_cards_for_league → populate_cards_for_game
--
--    New function gathers unique card names from card_prices
--    across ALL leagues for a given game and upserts into cards.
-- ═══════════════════════════════════════════════════════════════

-- Drop old function and its cron management
DROP FUNCTION IF EXISTS populate_cards_for_league(UUID);

CREATE OR REPLACE FUNCTION populate_cards_for_game(p_game TEXT)
RETURNS INT AS $$
DECLARE
  inserted_count INT;
BEGIN
  IF p_game NOT IN ('poe1', 'poe2') THEN
    RAISE WARNING 'populate_cards_for_game: invalid game %', p_game;
    RETURN 0;
  END IF;

  INSERT INTO cards (game, name)
  SELECT DISTINCT p_game, cp.card_name
  FROM card_prices cp
  JOIN snapshots s ON s.id = cp.snapshot_id
  JOIN poe_leagues pl ON pl.id = s.league_id
  WHERE pl.game = p_game
  ON CONFLICT (game, name) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE LOG 'populate_cards_for_game(%): inserted % cards', p_game, inserted_count;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION populate_cards_for_game(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION populate_cards_for_game(TEXT) FROM PUBLIC;
COMMENT ON FUNCTION populate_cards_for_game(TEXT) IS 'Upserts unique card names from card_prices into cards for a given game. SECURITY DEFINER, service_role only.';


-- ═══════════════════════════════════════════════════════════════
-- 8. Replace manage_card_population_cron_jobs
--
--    The old function created per-league cron jobs. The new one
--    just runs populate_cards_for_game for each game that has
--    active leagues. Simplified since cards are per-game now.
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS manage_card_population_cron_jobs();

CREATE OR REPLACE FUNCTION manage_card_population_cron_jobs()
RETURNS void AS $$
DECLARE
  v_game TEXT;
  job_name TEXT;
  job_exists BOOLEAN;
BEGIN
  -- For each game that has active leagues, ensure a cron job exists
  FOR v_game IN
    SELECT DISTINCT game FROM poe_leagues WHERE is_active = true
  LOOP
    job_name := 'populate-cards-' || v_game;
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = job_name) INTO job_exists;

    IF NOT job_exists THEN
      PERFORM cron.schedule(
        job_name,
        '0 2 * * *',
        format('SELECT populate_cards_for_game(%L);', v_game)
      );
      RAISE LOG 'Created cron job % for game %', job_name, v_game;
    END IF;
  END LOOP;

  -- Remove old per-league cron jobs if any still exist
  DELETE FROM cron.job WHERE jobname LIKE 'populate-cards-%'
    AND jobname NOT IN (
      SELECT 'populate-cards-' || game FROM poe_leagues WHERE is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION manage_card_population_cron_jobs() TO service_role;
REVOKE EXECUTE ON FUNCTION manage_card_population_cron_jobs() FROM PUBLIC;
COMMENT ON FUNCTION manage_card_population_cron_jobs() IS 'Creates/removes pg_cron jobs for card population per game. Runs daily via cron.';


-- ═══════════════════════════════════════════════════════════════
-- 9. Clean up temp tables
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS _card_id_map;
DROP TABLE IF EXISTS _card_canonical;
