-- Change stacked_deck_chaos_cost from NUMERIC(10,4) to NUMERIC(10,2)
--
-- The extra precision was never needed — poe.ninja returns values like 2.75
-- and downstream consumers only display 2 decimal places. Rounding at the
-- DB level means every consumer gets clean data without application-level
-- Math.round() calls.

ALTER TABLE snapshots
  ALTER COLUMN stacked_deck_chaos_cost TYPE NUMERIC(10, 2)
  USING ROUND(stacked_deck_chaos_cost, 2);
