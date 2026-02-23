import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add last_seen_app_version to user_settings
 *
 * Adds a column to track the last app version the user launched,
 * enabling post-update detection (e.g. showing the "What's New" modal
 * after an update).
 */
export const migration_20260223_010100_add_last_seen_app_version: Migration = {
  id: "20260223_010100_add_last_seen_app_version",
  description: "add last_seen_app_version to user_settings",

  up(db: Database.Database): void {
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (!existing.has("last_seen_app_version")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN last_seen_app_version TEXT
      `);
    }

    console.log(
      "[Migration] ✓ Applied: 20260223_010100_add_last_seen_app_version",
    );
  },

  down(db: Database.Database): void {
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (existing.has("last_seen_app_version")) {
      db.exec(`ALTER TABLE user_settings DROP COLUMN last_seen_app_version`);
    }

    console.log(
      "[Migration] ✓ Rolled back: 20260223_010100_add_last_seen_app_version",
    );
  },
};
