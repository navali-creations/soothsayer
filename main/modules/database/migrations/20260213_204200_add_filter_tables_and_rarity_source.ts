import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add filter tables and rarity source
 *
 * Creates:
 * - `filter_metadata` table for storing discovered filter file info
 * - `filter_card_rarities` table for per-filter card-to-rarity mappings
 *
 * Adds to `user_settings`:
 * - `rarity_source` column (default 'poe.ninja')
 * - `selected_filter_id` column (nullable FK to filter_metadata)
 */
export const migration_20260213_204200_add_filter_tables_and_rarity_source: Migration =
  {
    id: "20260213_204200_add_filter_tables_and_rarity_source",
    description: "add filter tables and rarity source",

    up(db: Database.Database): void {
      // ── Create filter_metadata table ─────────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS filter_metadata (
          id TEXT PRIMARY KEY,
          filter_type TEXT NOT NULL CHECK(filter_type IN ('local', 'online')),
          file_path TEXT NOT NULL UNIQUE,
          filter_name TEXT NOT NULL,
          last_update TEXT,
          is_fully_parsed INTEGER NOT NULL DEFAULT 0,
          parsed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_metadata_type
        ON filter_metadata(filter_type)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_metadata_file_path
        ON filter_metadata(file_path)
      `);

      // ── Create filter_card_rarities table ────────────────────────────
      db.exec(`
        CREATE TABLE IF NOT EXISTS filter_card_rarities (
          filter_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (filter_id, card_name),
          FOREIGN KEY (filter_id) REFERENCES filter_metadata(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_card_rarities_filter
        ON filter_card_rarities(filter_id)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_card_rarities_card
        ON filter_card_rarities(card_name)
      `);

      // ── Add rarity_source column to user_settings ────────────────────
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (!existing.has("rarity_source")) {
        db.exec(`
          ALTER TABLE user_settings
          ADD COLUMN rarity_source TEXT NOT NULL DEFAULT 'poe.ninja'
            CHECK(rarity_source IN ('poe.ninja', 'filter', 'prohibited-library'))
        `);
      }

      if (!existing.has("selected_filter_id")) {
        db.exec(`
          ALTER TABLE user_settings
          ADD COLUMN selected_filter_id TEXT REFERENCES filter_metadata(id) ON DELETE SET NULL
        `);
      }

      console.log(
        "[Migration] ✓ Applied: 20260213_204200_add_filter_tables_and_rarity_source",
      );
    },

    down(db: Database.Database): void {
      // ── Remove user_settings columns ─────────────────────────────────
      // SQLite supports DROP COLUMN since 3.35.0
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (existing.has("selected_filter_id")) {
        db.exec(`ALTER TABLE user_settings DROP COLUMN selected_filter_id`);
      }

      if (existing.has("rarity_source")) {
        db.exec(`ALTER TABLE user_settings DROP COLUMN rarity_source`);
      }

      // ── Drop filter tables ───────────────────────────────────────────
      db.exec(`DROP TABLE IF EXISTS filter_card_rarities`);
      db.exec(`DROP TABLE IF EXISTS filter_metadata`);

      console.log(
        "[Migration] ✓ Rolled back: 20260213_204200_add_filter_tables_and_rarity_source",
      );
    },
  };
