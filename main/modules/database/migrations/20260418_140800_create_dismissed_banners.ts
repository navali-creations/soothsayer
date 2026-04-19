import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260418_140800_create_dismissed_banners: Migration = {
  id: "20260418_140800_create_dismissed_banners",
  description: "Create dismissed_banners table for persistent banner dismissal",
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dismissed_banners (
        banner_id TEXT NOT NULL PRIMARY KEY,
        dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log(
      "[Migration] ✓ Applied: 20260418_140800_create_dismissed_banners",
    );
  },
  down(db: Database.Database): void {
    db.exec(`DROP TABLE IF EXISTS dismissed_banners`);
    console.log(
      "[Migration] ✓ Rolled back: 20260418_140800_create_dismissed_banners",
    );
  },
};
