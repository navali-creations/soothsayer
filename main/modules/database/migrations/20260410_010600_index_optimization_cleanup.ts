import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260410_010600_index_optimization_cleanup: Migration = {
  id: "20260410_010600_index_optimization_cleanup",
  description:
    "Add covering index for availability pool queries; drop redundant/unused indexes; add missing FK index on sessions.snapshot_id",

  up(db: Database.Database): void {
    db.transaction(() => {
      // ── 1. Covering index for pool queries ─────────────────────────
      // getStackedDeckCardCount, getStackedDeckCardNames, getUncollectedCardNames,
      // and getCardPoolBreakdown all filter on (game, league, from_boss, is_disabled).
      // The existing idx_card_availability_game_league only covers (game, league),
      // so SQLite must scan all rows for that (game, league) pair to evaluate
      // from_boss and is_disabled. This composite index covers the full WHERE clause.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_card_availability_pool
        ON divination_card_availability(game, league, from_boss, is_disabled)
      `);

      // ── 2. Drop redundant idx_card_price_cache_lookup (O4) ─────────
      // The UNIQUE(game, league, details_id) constraint on card_price_history_cache
      // automatically creates an equivalent index. This explicit index doubles
      // write overhead for no read benefit.
      db.exec(`DROP INDEX IF EXISTS idx_card_price_cache_lookup`);

      // ── 3. Drop redundant idx_divination_cards_name (O5) ───────────
      // All repository queries that filter by name also filter by game,
      // so the composite idx_divination_cards_game_name(game, name) is used
      // instead. This standalone name index is unused.
      db.exec(`DROP INDEX IF EXISTS idx_divination_cards_name`);

      // ── 4. Drop unused idx_divination_cards_stack_size (F11) ───────
      // No query in the codebase filters or sorts by stack_size alone.
      db.exec(`DROP INDEX IF EXISTS idx_divination_cards_stack_size`);

      // ── 5. Add missing FK index on sessions.snapshot_id (O6) ───────
      // sessions.snapshot_id references snapshots.id but has no supporting
      // index. Without it, cascade deletes on snapshots require a full
      // scan of the sessions table.
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_snapshot
        ON sessions(snapshot_id)
      `);
    })();

    console.log(
      "[Migration] ✓ Applied: 20260410_010600_index_optimization_cleanup",
    );
  },

  down(db: Database.Database): void {
    db.transaction(() => {
      // Reverse: drop new indexes, recreate removed ones
      db.exec(`DROP INDEX IF EXISTS idx_card_availability_pool`);
      db.exec(`DROP INDEX IF EXISTS idx_sessions_snapshot`);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_card_price_cache_lookup
        ON card_price_history_cache(game, league, details_id)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_divination_cards_name
        ON divination_cards(name)
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_divination_cards_stack_size
        ON divination_cards(stack_size)
      `);
    })();

    console.log(
      "[Migration] ✓ Rolled back: 20260410_010600_index_optimization_cleanup",
    );
  },
};
