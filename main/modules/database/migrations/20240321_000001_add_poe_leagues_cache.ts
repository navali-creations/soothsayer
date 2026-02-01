import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: Add POE leagues cache table
 *
 * Purpose:
 * - Cache leagues fetched from Supabase get-leagues-legacy edge function
 * - Supabase has a 1 request per 24h rate limit, so we need local persistence
 * - Allows the app to work offline or when rate limited
 *
 * Structure:
 * - Stores league data per game (poe1/poe2)
 * - Tracks when data was fetched to determine staleness
 * - Uses composite primary key on (game, league_id)
 */
export const migration_20240321_000001_add_poe_leagues_cache: Migration = {
  id: "20240321_000001_add_poe_leagues_cache",
  description: "Add poe_leagues_cache table for caching Supabase league data",

  up(db: Database.Database): void {
    // Create the poe_leagues_cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS poe_leagues_cache (
        id TEXT NOT NULL,
        game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
        league_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_at TEXT,
        end_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (game, league_id)
      )
    `);

    // Create index for common queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_poe_leagues_cache_game
      ON poe_leagues_cache (game)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_poe_leagues_cache_game_active
      ON poe_leagues_cache (game, is_active)
    `);

    // Create a metadata table to track when we last fetched for each game
    db.exec(`
      CREATE TABLE IF NOT EXISTS poe_leagues_cache_metadata (
        game TEXT NOT NULL PRIMARY KEY CHECK (game IN ('poe1', 'poe2')),
        last_fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    console.log("[Migration] ✓ Added poe_leagues_cache table");
  },

  down(db: Database.Database): void {
    db.exec(`DROP TABLE IF EXISTS poe_leagues_cache_metadata`);
    db.exec(`DROP INDEX IF EXISTS idx_poe_leagues_cache_game_active`);
    db.exec(`DROP INDEX IF EXISTS idx_poe_leagues_cache_game`);
    db.exec(`DROP TABLE IF EXISTS poe_leagues_cache`);

    console.log("[Migration] ✓ Removed poe_leagues_cache table");
  },
};
