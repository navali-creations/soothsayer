import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260408_190000_drop_prohibited_library_tables: Migration =
  {
    id: "20260408_190000_drop_prohibited_library_tables",
    description:
      "drop prohibited_library_card_weights and prohibited_library_cache_metadata tables",

    up(db: Database.Database): void {
      db.exec(`DROP INDEX IF EXISTS idx_pl_card_weights_game_league`);
      db.exec(`DROP INDEX IF EXISTS idx_pl_card_weights_card_name`);
      db.exec(`DROP TABLE IF EXISTS prohibited_library_card_weights`);
      db.exec(`DROP TABLE IF EXISTS prohibited_library_cache_metadata`);

      console.log(
        "[Migration] ✓ Applied: 20260408_190000_drop_prohibited_library_tables",
      );
    },

    down(db: Database.Database): void {
      db.exec(`
        CREATE TABLE IF NOT EXISTS prohibited_library_card_weights (
          card_name TEXT NOT NULL,
          game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
          league TEXT NOT NULL,
          weight INTEGER NOT NULL,
          rarity INTEGER NOT NULL DEFAULT 0 CHECK(rarity >= 0 AND rarity <= 4),
          from_boss INTEGER NOT NULL DEFAULT 0 CHECK(from_boss IN (0, 1)),
          loaded_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(card_name, game, league)
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

      db.exec(`
        CREATE TABLE IF NOT EXISTS prohibited_library_cache_metadata (
          game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')) PRIMARY KEY,
          league TEXT NOT NULL,
          loaded_at TEXT NOT NULL,
          app_version TEXT NOT NULL,
          card_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      console.log(
        "[Migration] ✓ Rolled back: 20260408_190000_drop_prohibited_library_tables",
      );
    },
  };
