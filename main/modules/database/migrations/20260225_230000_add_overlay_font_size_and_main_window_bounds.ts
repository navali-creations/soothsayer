import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add overlay_font_size and main_window_bounds to user_settings
 *
 * Adds columns for:
 * - overlay_font_size: user-adjustable zoom level for the overlay (default 1.0 = 100%)
 * - main_window_bounds: JSON string of { x, y, width, height } for main window position persistence
 */
export const migration_20260225_230000_add_overlay_font_size_and_main_window_bounds: Migration =
  {
    id: "20260225_230000_add_overlay_font_size_and_main_window_bounds",
    description:
      "add overlay_font_size and main_window_bounds to user_settings",

    up(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (!existing.has("overlay_font_size")) {
        db.exec(`
          ALTER TABLE user_settings ADD COLUMN overlay_font_size REAL DEFAULT 1.0
        `);
      }

      if (!existing.has("main_window_bounds")) {
        db.exec(`
          ALTER TABLE user_settings ADD COLUMN main_window_bounds TEXT
        `);
      }

      console.log(
        "[Migration] ✓ Applied: 20260225_230000_add_overlay_font_size_and_main_window_bounds",
      );
    },

    down(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (existing.has("overlay_font_size")) {
        db.exec(`ALTER TABLE user_settings DROP COLUMN overlay_font_size`);
      }

      if (existing.has("main_window_bounds")) {
        db.exec(`ALTER TABLE user_settings DROP COLUMN main_window_bounds`);
      }

      console.log(
        "[Migration] ✓ Rolled back: 20260225_230000_add_overlay_font_size_and_main_window_bounds",
      );
    },
  };
