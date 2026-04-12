-- =============================================================================
-- Phase B: Drop card_name from card_prices
-- =============================================================================
-- This migration completes the card_prices normalization begun in Phase A.
--
-- Phase A backfilled card_id for every existing card_prices row, ensuring each
-- row references the correct cards record. Now that card_id is fully populated:
--
--   1. Make card_id NOT NULL — every card_prices row must reference a card.
--   2. Drop the card_name column — it is redundant now that we JOIN via card_id.
--   3. Drop idx_card_prices_name — no longer useful without card_name.
--   4. Update populate_cards_for_game() — the old implementation read
--      cp.card_name from card_prices to insert into cards. Since card_name no
--      longer exists, the function is rewritten to be a defensive no-op that
--      ensures every card referenced by card_prices already exists in cards.
-- =============================================================================

-- 1. Make card_id NOT NULL
ALTER TABLE card_prices ALTER COLUMN card_id SET NOT NULL;

-- 2. Drop the card_name column
ALTER TABLE card_prices DROP COLUMN card_name;

-- 3. Drop the now-useless index on card_name
DROP INDEX IF EXISTS idx_card_prices_name;

-- 4. Update populate_cards_for_game to work without card_name
CREATE OR REPLACE FUNCTION populate_cards_for_game(p_game TEXT)
RETURNS INT AS $$
DECLARE
  inserted_count INT;
BEGIN
  IF p_game NOT IN ('poe1', 'poe2') THEN
    RAISE WARNING 'populate_cards_for_game: invalid game %', p_game;
    RETURN 0;
  END IF;

  -- After Phase B, card_prices no longer has card_name.
  -- All card_prices rows already reference cards via card_id (NOT NULL).
  -- This function now ensures any cards referenced by card_prices exist
  -- in the cards table (defensive — should always be a no-op).
  INSERT INTO cards (game, name)
  SELECT DISTINCT p_game, c.name
  FROM card_prices cp
  JOIN cards c ON c.id = cp.card_id
  WHERE c.game = p_game
  ON CONFLICT (game, name) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE LOG 'populate_cards_for_game(%): inserted % cards', p_game, inserted_count;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
