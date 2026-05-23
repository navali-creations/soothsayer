import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260626_120000_add_filter_tier_styles: Migration = {
  id: "20260626_120000_add_filter_tier_styles",
  description: "add filter tier styles",

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS filter_tier_styles (
        filter_id TEXT NOT NULL,
        rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
        bg_r INTEGER,
        bg_g INTEGER,
        bg_b INTEGER,
        bg_a INTEGER,
        text_r INTEGER,
        text_g INTEGER,
        text_b INTEGER,
        text_a INTEGER,
        border_r INTEGER,
        border_g INTEGER,
        border_b INTEGER,
        border_a INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (filter_id, rarity),
        FOREIGN KEY (filter_id) REFERENCES filter_metadata(id) ON DELETE CASCADE
      )
    `);

    console.log(
      "[Migration] ✓ Applied: 20260626_120000_add_filter_tier_styles",
    );
  },

  down(db: Database.Database): void {
    db.exec("DROP TABLE IF EXISTS filter_tier_styles");

    console.log(
      "[Migration] ✓ Rolled back: 20260626_120000_add_filter_tier_styles",
    );
  },
};
