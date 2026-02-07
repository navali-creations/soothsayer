import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: Add net profit tracking (stacked deck cost)
 *
 * Problem:
 * - Currently we only track "pure" card values (Total Value)
 * - We don't account for the cost of Stacked Decks themselves
 * - Users who buy Stacked Decks to open can't see their actual profit
 *
 * Solution:
 * - Store stacked deck chaos cost per snapshot (from poe.ninja Currency API)
 * - Add net profit columns to session_summaries (Total Value - deck investment)
 * - Net Profit = Total Card Value - (stacked_deck_chaos_cost × total_decks_opened)
 */
export const migration_20260206_213800_add_net_profit: Migration = {
  id: "20260206_213800_add_net_profit",
  description: "Add stacked deck cost and net profit columns",

  up(db: Database.Database): void {
    // 1. Add stacked deck chaos cost to snapshots table
    // This captures the deck price at the time of the snapshot
    db.exec(`
      ALTER TABLE snapshots
      ADD COLUMN stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0
    `);

    // 2. Add stacked deck chaos cost to session_summaries
    // Stored here too so summaries are self-contained for historical accuracy
    db.exec(`
      ALTER TABLE session_summaries
      ADD COLUMN stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0
    `);

    // 3. Add net profit columns to session_summaries
    // These are nullable because old sessions won't have this data
    db.exec(`
      ALTER TABLE session_summaries
      ADD COLUMN total_exchange_net_profit REAL
    `);

    db.exec(`
      ALTER TABLE session_summaries
      ADD COLUMN total_stash_net_profit REAL
    `);

    console.log("[Migration] ✓ Added stacked deck cost and net profit columns");
  },

  down(db: Database.Database): void {
    // SQLite doesn't support DROP COLUMN before 3.35.0, so we recreate tables

    // 1. Recreate snapshots without stacked_deck_chaos_cost
    db.exec(`
      CREATE TABLE snapshots_backup AS
      SELECT id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, created_at
      FROM snapshots
    `);
    db.exec(`DROP TABLE snapshots`);
    db.exec(`
      CREATE TABLE snapshots (
        id TEXT PRIMARY KEY,
        league_id TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        exchange_chaos_to_divine REAL NOT NULL,
        stash_chaos_to_divine REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, created_at)
      SELECT id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, created_at
      FROM snapshots_backup
    `);
    db.exec(`DROP TABLE snapshots_backup`);

    // 2. Recreate session_summaries without new columns
    db.exec(`
      CREATE TABLE session_summaries_backup AS
      SELECT session_id, game, league, started_at, ended_at, duration_minutes,
             total_decks_opened, total_exchange_value, total_stash_value,
             exchange_chaos_to_divine, stash_chaos_to_divine, created_at
      FROM session_summaries
    `);
    db.exec(`DROP TABLE session_summaries`);
    db.exec(`
      CREATE TABLE session_summaries (
        session_id TEXT PRIMARY KEY,
        game TEXT NOT NULL,
        league TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        total_decks_opened INTEGER NOT NULL,
        total_exchange_value REAL NOT NULL DEFAULT 0,
        total_stash_value REAL NOT NULL DEFAULT 0,
        exchange_chaos_to_divine REAL NOT NULL DEFAULT 0,
        stash_chaos_to_divine REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      INSERT INTO session_summaries
        (session_id, game, league, started_at, ended_at, duration_minutes,
         total_decks_opened, total_exchange_value, total_stash_value,
         exchange_chaos_to_divine, stash_chaos_to_divine, created_at)
      SELECT session_id, game, league, started_at, ended_at, duration_minutes,
             total_decks_opened, total_exchange_value, total_stash_value,
             exchange_chaos_to_divine, stash_chaos_to_divine, created_at
      FROM session_summaries_backup
    `);
    db.exec(`DROP TABLE session_summaries_backup`);

    console.log(
      "[Migration] ✓ Rolled back stacked deck cost and net profit columns",
    );
  },
};
