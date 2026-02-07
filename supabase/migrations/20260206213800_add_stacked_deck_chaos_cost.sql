-- Add stacked deck chaos cost to snapshots table
-- This stores the poe.ninja price of a Stacked Deck at the time of the snapshot
-- Used to calculate Net Profit (Total Card Value minus deck investment)
ALTER TABLE snapshots
ADD COLUMN stacked_deck_chaos_cost NUMERIC(10, 4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN snapshots.stacked_deck_chaos_cost IS 'Chaos cost of a single Stacked Deck from poe.ninja Currency API at snapshot time';
