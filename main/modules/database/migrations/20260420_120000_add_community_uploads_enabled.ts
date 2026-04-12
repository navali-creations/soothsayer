import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260420_120000_add_community_uploads_enabled: Migration =
  {
    id: "20260420_120000_add_community_uploads_enabled",
    description:
      "add community_uploads_enabled boolean to user_settings (default: true)",

    up(db: Database.Database): void {
      // Default to 1 (true) — uploads are enabled by default for all users
      db.exec(`
      ALTER TABLE user_settings ADD COLUMN community_uploads_enabled INTEGER NOT NULL DEFAULT 1
    `);
      console.log(
        "[Migration] ✓ Applied: 20260420_120000_add_community_uploads_enabled",
      );
    },

    down(db: Database.Database): void {
      // SQLite doesn't support DROP COLUMN before 3.35.0, but better-sqlite3 bundles >= 3.36
      db.exec(`
      ALTER TABLE user_settings DROP COLUMN community_uploads_enabled
    `);
      console.log(
        "[Migration] ✓ Rolled back: 20260420_120000_add_community_uploads_enabled",
      );
    },
  };
