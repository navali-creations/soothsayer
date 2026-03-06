import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add card_price_history_cache table
 *
 * Creates a local SQLite cache table for poe.ninja exchange details API
 * responses. This enables offline support and reduces redundant API calls
 * by caching price history data with a 30-minute TTL.
 *
 * The UNIQUE constraint on (game, league, details_id) allows efficient
 * upserts via INSERT ... ON CONFLICT.
 */
export const migration_20260305_014700_add_card_price_history_cache: Migration =
  {
    id: "20260305_014700_add_card_price_history_cache",
    description:
      "add card_price_history_cache table for poe.ninja price history caching",

    up(db: Database.Database): void {
      db.exec(`
        CREATE TABLE IF NOT EXISTS card_price_history_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
          league TEXT NOT NULL,
          details_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          response_data TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(game, league, details_id)
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_card_price_cache_lookup
        ON card_price_history_cache(game, league, details_id)
      `);

      console.log(
        "[Migration] ✓ Applied: 20260305_014700_add_card_price_history_cache",
      );
    },

    down(db: Database.Database): void {
      db.exec(`DROP INDEX IF EXISTS idx_card_price_cache_lookup`);
      db.exec(`DROP TABLE IF EXISTS card_price_history_cache`);

      console.log(
        "[Migration] ✓ Rolled back: 20260305_014700_add_card_price_history_cache",
      );
    },
  };
