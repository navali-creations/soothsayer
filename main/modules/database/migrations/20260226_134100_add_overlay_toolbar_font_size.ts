import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add overlay_toolbar_font_size to user_settings
 *
 * Adds column for:
 * - overlay_toolbar_font_size: user-adjustable font size for overlay toolbar elements
 *   (tabs, lock/close icons) — default 1.0 = 100%
 */
export const migration_20260226_134100_add_overlay_toolbar_font_size: Migration =
  {
    id: "20260226_134100_add_overlay_toolbar_font_size",
    description: "add overlay_toolbar_font_size to user_settings",

    up(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (!existing.has("overlay_toolbar_font_size")) {
        db.exec(`
          ALTER TABLE user_settings ADD COLUMN overlay_toolbar_font_size REAL DEFAULT 1.0
        `);
      }

      console.log(
        "[Migration] ✓ Applied: 20260226_134100_add_overlay_toolbar_font_size",
      );
    },

    down(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (existing.has("overlay_toolbar_font_size")) {
        db.exec(
          `ALTER TABLE user_settings DROP COLUMN overlay_toolbar_font_size`,
        );
      }

      console.log(
        "[Migration] ✓ Rolled back: 20260226_134100_add_overlay_toolbar_font_size",
      );
    },
  };
