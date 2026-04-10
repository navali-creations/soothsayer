import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260408_160000_create_availability_and_drop_from_boss: Migration =
  {
    id: "20260408_160000_create_availability_and_drop_from_boss",
    description:
      "create divination_card_availability table and drop from_boss from divination_cards",

    up(db: Database.Database): void {
      // --- 1. Create divination_card_availability table ---
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='divination_card_availability'",
        )
        .all() as { name: string }[];

      if (tables.length === 0) {
        db.transaction(() => {
          db.exec(`
            CREATE TABLE divination_card_availability (
              game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
              league TEXT NOT NULL,
              card_name TEXT NOT NULL,
              from_boss INTEGER NOT NULL DEFAULT 0 CHECK(from_boss IN (0, 1)),
              is_disabled INTEGER NOT NULL DEFAULT 0 CHECK(is_disabled IN (0, 1)),
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (game, league, card_name)
            )
          `);

          db.exec(`
            CREATE INDEX idx_card_availability_game_league
            ON divination_card_availability(game, league)
          `);

          db.exec(`
            CREATE INDEX idx_card_availability_card_name
            ON divination_card_availability(card_name)
          `);
        })();
      }

      // --- 2. Drop from_boss from divination_cards ---
      const columns = db
        .prepare("PRAGMA table_info(divination_cards)")
        .all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (existing.has("from_boss")) {
        db.transaction(() => {
          db.exec(`
            CREATE TABLE divination_cards_backup (
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
            INSERT INTO divination_cards_backup
            SELECT id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, created_at, updated_at
            FROM divination_cards
          `);

          db.exec(`DROP TABLE divination_cards`);

          db.exec(
            `ALTER TABLE divination_cards_backup RENAME TO divination_cards`,
          );

          db.exec(
            `CREATE INDEX IF NOT EXISTS idx_divination_cards_game_name ON divination_cards(game, name)`,
          );
          db.exec(
            `CREATE INDEX IF NOT EXISTS idx_divination_cards_name ON divination_cards(name)`,
          );
          db.exec(
            `CREATE INDEX IF NOT EXISTS idx_divination_cards_stack_size ON divination_cards(stack_size)`,
          );
        })();
      }

      console.log(
        "[Migration] ✓ Applied: 20260408_160000_create_availability_and_drop_from_boss",
      );
    },

    down(db: Database.Database): void {
      // --- 1. Drop availability table and indexes ---
      db.exec(`DROP INDEX IF EXISTS idx_card_availability_game_league`);
      db.exec(`DROP INDEX IF EXISTS idx_card_availability_card_name`);
      db.exec(`DROP TABLE IF EXISTS divination_card_availability`);

      // --- 2. Add from_boss back to divination_cards ---
      const columns = db
        .prepare("PRAGMA table_info(divination_cards)")
        .all() as {
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
        "[Migration] ✓ Rolled back: 20260408_160000_create_availability_and_drop_from_boss",
      );
    },
  };
