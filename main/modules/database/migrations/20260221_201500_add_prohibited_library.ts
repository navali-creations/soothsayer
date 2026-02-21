import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add Prohibited Library tables and `from_boss` column to `divination_cards`.
 *
 * Changes:
 * - Creates `prohibited_library_card_weights` table — stores per-card drop weights
 *   parsed from the bundled Prohibited Library CSV asset, keyed by (card_name, game, league).
 * - Creates `prohibited_library_cache_metadata` table — tracks when the CSV was last
 *   parsed and for which league/app version, enabling smart re-parse on app updates.
 * - Adds `from_boss` column to `divination_cards` — boolean flag indicating whether
 *   a card is boss-exclusive (not obtainable from stacked decks). Sourced from the
 *   Prohibited Library spreadsheet's column D (Ritual value = 4 → boss-specific).
 */
export const migration_20260221_201500_add_prohibited_library: Migration = {
  id: "20260221_201500_add_prohibited_library",
  description:
    "add prohibited_library_card_weights table, prohibited_library_cache_metadata table, and from_boss column to divination_cards",

  up(db: Database.Database): void {
    // ── 1. Create prohibited_library_card_weights table ───────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS prohibited_library_card_weights (
        card_name   TEXT    NOT NULL,
        game        TEXT    NOT NULL CHECK(game IN ('poe1', 'poe2')),
        league      TEXT    NOT NULL,
        weight      INTEGER NOT NULL,
        rarity      INTEGER NOT NULL CHECK(rarity BETWEEN 1 AND 4),
        from_boss   INTEGER NOT NULL DEFAULT 0 CHECK(from_boss IN (0, 1)),
        loaded_at   TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (card_name, game, league)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pl_card_weights_game_league
      ON prohibited_library_card_weights(game, league)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pl_card_weights_card_name
      ON prohibited_library_card_weights(card_name)
    `);

    // ── 2. Create prohibited_library_cache_metadata table ────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS prohibited_library_cache_metadata (
        game        TEXT NOT NULL PRIMARY KEY CHECK(game IN ('poe1', 'poe2')),
        league      TEXT NOT NULL,
        loaded_at   TEXT NOT NULL,
        app_version TEXT NOT NULL,
        card_count  INTEGER NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── 3. Add from_boss column to divination_cards ──────────────────
    // Check if column already exists (idempotency)
    const columns = db.prepare("PRAGMA table_info(divination_cards)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (!existing.has("from_boss")) {
      db.exec(`
        ALTER TABLE divination_cards
        ADD COLUMN from_boss INTEGER NOT NULL DEFAULT 0 CHECK(from_boss IN (0, 1))
      `);
    }

    console.log(
      "[Migration] ✓ Applied: 20260221_201500_add_prohibited_library",
    );
  },

  down(db: Database.Database): void {
    // ── 1. Drop prohibited_library_cache_metadata ────────────────────
    db.exec(`DROP TABLE IF EXISTS prohibited_library_cache_metadata`);

    // ── 2. Drop prohibited_library_card_weights ──────────────────────
    db.exec(`DROP TABLE IF EXISTS prohibited_library_card_weights`);

    // ── 3. Remove from_boss from divination_cards ────────────────────
    // SQLite does not support DROP COLUMN in older versions, so we
    // rebuild the table without the column.
    const columns = db.prepare("PRAGMA table_info(divination_cards)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (existing.has("from_boss")) {
      db.exec(`
        ALTER TABLE divination_cards RENAME TO divination_cards_old
      `);

      db.exec(`
        CREATE TABLE divination_cards (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          stack_size INTEGER NOT NULL,
          description TEXT NOT NULL,
          reward_html TEXT NOT NULL,
          art_src TEXT NOT NULL,
          flavour_html TEXT,
          game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
          data_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(game, name)
        )
      `);

      db.exec(`
        INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, created_at, updated_at)
        SELECT id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, created_at, updated_at
        FROM divination_cards_old
      `);

      db.exec(`DROP TABLE divination_cards_old`);

      // Recreate indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_divination_cards_game_name
        ON divination_cards(game, name)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_divination_cards_name
        ON divination_cards(name)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_divination_cards_stack_size
        ON divination_cards(stack_size)
      `);
    }

    console.log(
      "[Migration] ✓ Rolled back: 20260221_201500_add_prohibited_library",
    );
  },
};
