-- Add stacked_deck_max_volume_rate to snapshots table (idempotent)
--
-- This column stores the bulk exchange rate (decks per divine) observed by
-- poe.ninja at snapshot time. It comes from the `maxVolumeRate` field in the
-- poe.ninja Currency API for the "stacked-deck" line item.
--
-- When available, this is a better base rate for the sliding exchange model
-- than the derived `floor(chaosToDivine / stackedDeckChaosCost)` because it
-- reflects the actual volume-weighted rate traders are getting on the exchange.
--
-- NULL means the field was not available at snapshot creation time (older
-- snapshots created before this migration).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'stacked_deck_max_volume_rate'
  ) THEN
    -- Column exists but may be wrong type (NUMERIC) — convert to INTEGER and floor existing values
    ALTER TABLE snapshots
      ALTER COLUMN stacked_deck_max_volume_rate TYPE INTEGER USING FLOOR(stacked_deck_max_volume_rate)::INTEGER;
  ELSE
    ALTER TABLE snapshots
      ADD COLUMN stacked_deck_max_volume_rate INTEGER DEFAULT NULL;
  END IF;
END
$$;

COMMENT ON COLUMN snapshots.stacked_deck_max_volume_rate
  IS 'Bulk exchange rate (decks per divine) from poe.ninja maxVolumeRate at snapshot time (floored to integer)';
