import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260408_180000_add_pl_rarity_to_card_rarities: Migration =
  {
    id: "20260408_180000_add_pl_rarity_to_card_rarities",
    description:
      "add prohibited_library_rarity column to divination_card_rarities",

    up(db: Database.Database): void {
      const columns = db
        .prepare("PRAGMA table_info(divination_card_rarities)")
        .all() as { name: string }[];
      const existing = new Set(columns.map((c) => c.name));

      if (!existing.has("prohibited_library_rarity")) {
        db.exec(`
        ALTER TABLE divination_card_rarities
        ADD COLUMN prohibited_library_rarity INTEGER DEFAULT NULL
        CHECK(prohibited_library_rarity IS NULL OR (prohibited_library_rarity >= 0 AND prohibited_library_rarity <= 4))
      `);
      }

      console.log(
        "[Migration] ✓ Applied: 20260408_180000_add_pl_rarity_to_card_rarities",
      );
    },

    down(db: Database.Database): void {
      const columns = db
        .prepare("PRAGMA table_info(divination_card_rarities)")
        .all() as { name: string }[];
      const existing = new Set(columns.map((c) => c.name));

      if (existing.has("prohibited_library_rarity")) {
        db.transaction(() => {
          db.exec(`
          CREATE TABLE divination_card_rarities_backup (
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
          INSERT INTO divination_card_rarities_backup
          SELECT game, league, card_name, rarity, override_rarity, last_updated
          FROM divination_card_rarities
        `);

          db.exec(`DROP TABLE divination_card_rarities`);

          db.exec(
            `ALTER TABLE divination_card_rarities_backup RENAME TO divination_card_rarities`,
          );

          db.exec(`
          CREATE INDEX idx_card_rarities_card_name
          ON divination_card_rarities(card_name)
        `);
        })();
      }

      console.log(
        "[Migration] ✓ Rolled back: 20260408_180000_add_pl_rarity_to_card_rarities",
      );
    },
  };
