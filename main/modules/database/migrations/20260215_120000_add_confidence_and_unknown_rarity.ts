import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add confidence to snapshot_card_prices, allow rarity 0 ("Unknown"),
 * and add override_rarity to divination_card_rarities.
 *
 * Changes:
 * - `snapshot_card_prices`: adds `confidence` column (INTEGER, default 1)
 *   where 1 = high, 2 = medium, 3 = low
 * - `snapshot_card_prices`: drops `stack_size` and `created_at` columns if present
 * - `divination_card_rarities`: recreates table to change CHECK constraint
 *   from `rarity >= 1 AND rarity <= 4` to `rarity >= 0 AND rarity <= 4`,
 *   and adds `override_rarity` column (INTEGER, nullable)
 *
 * Rarity 0 = "Unknown" — used for cards with low-confidence poe.ninja data
 * or cards with no pricing data at all.
 *
 * override_rarity stores a user-chosen rarity for cards the system marked
 * as rarity 0. When the system later detects improved confidence (1 or 2),
 * it clears override_rarity and sets a calculated rarity instead.
 */
export const migration_20260215_120000_add_confidence_and_unknown_rarity: Migration =
  {
    id: "20260215_120000_add_confidence_and_unknown_rarity",
    description:
      "add confidence to snapshot_card_prices, allow rarity 0 (Unknown), add override_rarity to divination_card_rarities",

    up(db: Database.Database): void {
      // ── 1. Handle confidence column on snapshot_card_prices ─────────
      const scpColumns = db
        .prepare("PRAGMA table_info(snapshot_card_prices)")
        .all() as { name: string; type: string }[];
      const scpExisting = new Set(scpColumns.map((c) => c.name));

      if (!scpExisting.has("confidence")) {
        // Fresh install or pre-confidence schema — just add INTEGER column
        db.exec(`
          ALTER TABLE snapshot_card_prices
          ADD COLUMN confidence INTEGER NOT NULL DEFAULT 1
            CHECK(confidence IN (1, 2, 3))
        `);
      } else {
        // Confidence column exists — check if it's TEXT (old) or INTEGER (new)
        const confCol = scpColumns.find((c) => c.name === "confidence");
        if (confCol && confCol.type === "TEXT") {
          // Migrate from TEXT to INTEGER by recreating the table
          // SQLite doesn't support ALTER COLUMN, so we rebuild
          db.exec(`
            ALTER TABLE snapshot_card_prices
            RENAME TO snapshot_card_prices_old
          `);

          db.exec(`
            CREATE TABLE snapshot_card_prices (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              snapshot_id TEXT NOT NULL,
              card_name TEXT NOT NULL,
              price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
              chaos_value REAL NOT NULL,
              divine_value REAL NOT NULL,
              confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence IN (1, 2, 3)),
              FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
              UNIQUE(snapshot_id, card_name, price_source)
            )
          `);

          db.exec(`
            INSERT INTO snapshot_card_prices (id, snapshot_id, card_name, price_source, chaos_value, divine_value, confidence)
            SELECT id, snapshot_id, card_name, price_source, chaos_value, divine_value,
              CASE confidence
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
                ELSE 1
              END
            FROM snapshot_card_prices_old
          `);

          db.exec(`DROP TABLE snapshot_card_prices_old`);

          // Recreate indexes
          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_snapshot_prices_snapshot
            ON snapshot_card_prices(snapshot_id)
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_snapshot_prices_card
            ON snapshot_card_prices(card_name, price_source)
          `);
        }
      }

      // ── 1b. Drop stack_size and created_at columns if they exist ────
      // Re-read columns after potential rebuild above
      const currentColumns = db
        .prepare("PRAGMA table_info(snapshot_card_prices)")
        .all() as { name: string }[];
      const currentColNames = new Set(currentColumns.map((c) => c.name));

      if (currentColNames.has("stack_size")) {
        db.exec(`
          ALTER TABLE snapshot_card_prices DROP COLUMN stack_size
        `);
      }

      if (currentColNames.has("created_at")) {
        db.exec(`
          ALTER TABLE snapshot_card_prices DROP COLUMN created_at
        `);
      }

      // ── 2. Recreate divination_card_rarities to widen CHECK constraint
      //       and add override_rarity column ────────────────────────────
      //
      // SQLite cannot ALTER CHECK constraints, so we must:
      //   1. Rename old table
      //   2. Create new table with updated constraints
      //   3. Copy data
      //   4. Drop old table
      //   5. Recreate indexes

      // Check if migration was already partially applied (e.g. new table exists)
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='divination_card_rarities'",
        )
        .all() as { name: string }[];

      if (tables.length > 0) {
        // Check if override_rarity column already exists (migration already applied)
        const dcrColumns = db
          .prepare("PRAGMA table_info(divination_card_rarities)")
          .all() as { name: string }[];
        const dcrExisting = new Set(dcrColumns.map((c) => c.name));

        if (!dcrExisting.has("override_rarity")) {
          db.exec(`
            ALTER TABLE divination_card_rarities
            RENAME TO divination_card_rarities_old
          `);

          db.exec(`
            CREATE TABLE divination_card_rarities (
              game TEXT NOT NULL,
              league TEXT NOT NULL,
              card_name TEXT NOT NULL,
              rarity INTEGER NOT NULL CHECK(rarity >= 0 AND rarity <= 4),
              override_rarity INTEGER CHECK(override_rarity IS NULL OR (override_rarity >= 0 AND override_rarity <= 4)),
              last_updated TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (game, league, card_name)
            )
          `);

          db.exec(`
            INSERT INTO divination_card_rarities (game, league, card_name, rarity, last_updated)
            SELECT game, league, card_name, rarity, last_updated
            FROM divination_card_rarities_old
          `);

          db.exec(`DROP TABLE divination_card_rarities_old`);

          // Recreate indexes
          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
            ON divination_card_rarities(game, league)
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
            ON divination_card_rarities(card_name)
          `);
        }
      }

      console.log(
        "[Migration] ✓ Applied: 20260215_120000_add_confidence_and_unknown_rarity",
      );
    },

    down(db: Database.Database): void {
      // ── 1. Convert confidence back to TEXT and restore stack_size/created_at ──
      const scpColumns = db
        .prepare("PRAGMA table_info(snapshot_card_prices)")
        .all() as { name: string; type: string }[];
      const scpExisting = new Set(scpColumns.map((c) => c.name));

      if (scpExisting.has("confidence")) {
        db.exec(`
          ALTER TABLE snapshot_card_prices
          RENAME TO snapshot_card_prices_old
        `);

        db.exec(`
          CREATE TABLE snapshot_card_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL,
            card_name TEXT NOT NULL,
            price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
            chaos_value REAL NOT NULL,
            divine_value REAL NOT NULL,
            stack_size INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
            UNIQUE(snapshot_id, card_name, price_source)
          )
        `);

        db.exec(`
          INSERT INTO snapshot_card_prices (id, snapshot_id, card_name, price_source, chaos_value, divine_value)
          SELECT id, snapshot_id, card_name, price_source, chaos_value, divine_value
          FROM snapshot_card_prices_old
        `);

        db.exec(`DROP TABLE snapshot_card_prices_old`);

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_snapshot_prices_snapshot
          ON snapshot_card_prices(snapshot_id)
        `);

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_snapshot_prices_card
          ON snapshot_card_prices(card_name, price_source)
        `);
      }

      // ── 2. Recreate divination_card_rarities with original constraints ──
      const dcrColumns = db
        .prepare("PRAGMA table_info(divination_card_rarities)")
        .all() as { name: string }[];
      const dcrExisting = new Set(dcrColumns.map((c) => c.name));

      if (dcrExisting.has("override_rarity")) {
        db.exec(`
          ALTER TABLE divination_card_rarities
          RENAME TO divination_card_rarities_old
        `);

        db.exec(`
          CREATE TABLE divination_card_rarities (
            game TEXT NOT NULL,
            league TEXT NOT NULL,
            card_name TEXT NOT NULL,
            rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
            last_updated TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (game, league, card_name)
          )
        `);

        // Clamp rarity 0 back to 1 on downgrade (best-effort, data may be lossy)
        db.exec(`
          INSERT INTO divination_card_rarities (game, league, card_name, rarity, last_updated)
          SELECT game, league, card_name,
            CASE WHEN rarity < 1 THEN 1 ELSE rarity END,
            last_updated
          FROM divination_card_rarities_old
        `);

        db.exec(`DROP TABLE divination_card_rarities_old`);

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
          ON divination_card_rarities(game, league)
        `);

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
          ON divination_card_rarities(card_name)
        `);
      }

      console.log(
        "[Migration] ✓ Rolled back: 20260215_120000_add_confidence_and_unknown_rarity",
      );
    },
  };
