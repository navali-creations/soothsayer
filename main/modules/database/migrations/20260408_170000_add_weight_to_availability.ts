import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260408_170000_add_weight_to_availability: Migration = {
  id: "20260408_170000_add_weight_to_availability",
  description: "add weight column to divination_card_availability",

  up(db: Database.Database): void {
    const columns = db
      .prepare("PRAGMA table_info(divination_card_availability)")
      .all() as { name: string }[];
    const existing = new Set(columns.map((c) => c.name));

    if (!existing.has("weight")) {
      db.exec(`
        ALTER TABLE divination_card_availability
        ADD COLUMN weight INTEGER DEFAULT NULL
      `);
    }

    console.log(
      "[Migration] ✓ Applied: 20260408_170000_add_weight_to_availability",
    );
  },

  down(db: Database.Database): void {
    const columns = db
      .prepare("PRAGMA table_info(divination_card_availability)")
      .all() as { name: string }[];
    const existing = new Set(columns.map((c) => c.name));

    if (existing.has("weight")) {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE divination_card_availability_backup (
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
          INSERT INTO divination_card_availability_backup
          SELECT game, league, card_name, from_boss, is_disabled, created_at, updated_at
          FROM divination_card_availability
        `);

        db.exec(`DROP TABLE divination_card_availability`);

        db.exec(
          `ALTER TABLE divination_card_availability_backup RENAME TO divination_card_availability`,
        );

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

    console.log(
      "[Migration] ✓ Rolled back: 20260408_170000_add_weight_to_availability",
    );
  },
};
