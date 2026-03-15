import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add CSV export support
 *
 * 1. Creates the `csv_export_snapshots` table for incremental export tracking.
 *    Each row records the count for a specific card at the time of the last
 *    successful export, keyed by (game, scope, card_name).
 *
 *    - `count`: the card count at the time of the snapshot
 *    - `total_count`: the total number of cards across all card names in this snapshot
 *    - `exported_at`: ISO timestamp of when the export occurred
 *    - `integrity_status`: nullable result of backend integrity checks ("pass" | "warn" | "fail")
 *    - `integrity_details`: nullable JSON string with detailed check results
 *
 *    The UNIQUE constraint on (game, scope, card_name) allows efficient upserts
 *    via INSERT ... ON CONFLICT, ensuring only one snapshot row per card per scope.
 *
 * 2. Adds `csv_export_path` column to
 `user_settings` for user-configurable
 *    CSV export directory. When null, defaults to Desktop/soothsayer-exports.
 */
export const migration_20260314_131100_add_csv_export_snapshots: Migration = {
  id: "20260314_131100_add_csv_export_snapshots",
  description:
    "add csv_export_snapshots table and csv_export_path setting for CSV export support",

  up(db: Database.Database): void {
    // 1. Create csv_export_snapshots table
    db.exec(`
      CREATE TABLE IF NOT EXISTS csv_export_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        total_count INTEGER NOT NULL DEFAULT 0,
        exported_at TEXT NOT NULL,
        integrity_status TEXT CHECK(integrity_status IN ('pass', 'warn', 'fail') OR integrity_status IS NULL),
        integrity_details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, scope, card_name)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_csv_export_snapshots_lookup
      ON csv_export_snapshots(game, scope)
    `);

    // 2. Add csv_export_path to user_settings
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (!existing.has("csv_export_path")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN csv_export_path TEXT
      `);
    }

    console.log(
      "[Migration] ✓ Applied: 20260314_131100_add_csv_export_snapshots",
    );
  },

  down(db: Database.Database): void {
    // 1. Drop csv_export_snapshots table and index
    db.exec(`DROP INDEX IF EXISTS idx_csv_export_snapshots_lookup`);
    db.exec(`DROP TABLE IF EXISTS csv_export_snapshots`);

    // 2. Remove csv_export_path from user_settings
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (existing.has("csv_export_path")) {
      db.exec(`ALTER TABLE user_settings DROP COLUMN csv_export_path`);
    }

    console.log(
      "[Migration] ✓ Rolled back: 20260314_131100_add_csv_export_snapshots",
    );
  },
};
