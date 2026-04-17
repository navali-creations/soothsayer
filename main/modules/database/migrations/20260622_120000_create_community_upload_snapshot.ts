import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260622_120000_create_community_upload_snapshot: Migration =
  {
    id: "20260622_120000_create_community_upload_snapshot",
    description: "Create community_upload_snapshot table for delta uploads",

    up(db: Database.Database): void {
      db.exec(`
      CREATE TABLE IF NOT EXISTS community_upload_snapshot (
        game TEXT NOT NULL,
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL,
        UNIQUE(game, scope, card_name)
      )
    `);
      console.log(
        "[Migration] ✓ Applied: 20260622_120000_create_community_upload_snapshot",
      );
    },

    down(db: Database.Database): void {
      db.exec(`DROP TABLE IF EXISTS community_upload_snapshot`);
      console.log(
        "[Migration] ✓ Rolled back: 20260622_120000_create_community_upload_snapshot",
      );
    },
  };
