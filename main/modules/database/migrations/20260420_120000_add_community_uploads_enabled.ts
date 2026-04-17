import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260420_120000_add_community_uploads_enabled: Migration =
  {
    id: "20260420_120000_add_community_uploads_enabled",
    description:
      "add community_uploads_enabled boolean to user_settings (default: true)",

    up(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (!existing.has("community_uploads_enabled")) {
        db.exec(`
          ALTER TABLE user_settings ADD COLUMN community_uploads_enabled INTEGER NOT NULL DEFAULT 1
        `);
      }

      console.log(
        "[Migration] ✓ Applied: 20260420_120000_add_community_uploads_enabled",
      );
    },

    down(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (existing.has("community_uploads_enabled")) {
        db.exec(`
          ALTER TABLE user_settings DROP COLUMN community_uploads_enabled
        `);
      }

      console.log(
        "[Migration] ✓ Rolled back: 20260420_120000_add_community_uploads_enabled",
      );
    },
  };
