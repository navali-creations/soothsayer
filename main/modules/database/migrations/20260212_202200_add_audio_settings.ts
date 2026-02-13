import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add audio settings
 *
 * Adds audio-related columns to user_settings table for controlling
 * rarity drop sounds: enable/disable, volume, and custom sound file paths.
 */
export const migration_20260212_202200_add_audio_settings: Migration = {
  id: "20260212_202200_add_audio_settings",
  description: "add audio settings",

  up(db: Database.Database): void {
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (!existing.has("audio_enabled")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN audio_enabled INTEGER NOT NULL DEFAULT 1
      `);
    }
    if (!existing.has("audio_volume")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN audio_volume REAL NOT NULL DEFAULT 0.5
      `);
    }
    if (!existing.has("audio_rarity1_path")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN audio_rarity1_path TEXT
      `);
    }
    if (!existing.has("audio_rarity2_path")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN audio_rarity2_path TEXT
      `);
    }
    if (!existing.has("audio_rarity3_path")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN audio_rarity3_path TEXT
      `);
    }

    console.log("[Migration] ✓ Applied: 20260212_202200_add_audio_settings");
  },

  down(db: Database.Database): void {
    db.exec(`ALTER TABLE user_settings DROP COLUMN audio_enabled`);
    db.exec(`ALTER TABLE user_settings DROP COLUMN audio_volume`);
    db.exec(`ALTER TABLE user_settings DROP COLUMN audio_rarity1_path`);
    db.exec(`ALTER TABLE user_settings DROP COLUMN audio_rarity2_path`);
    db.exec(`ALTER TABLE user_settings DROP COLUMN audio_rarity3_path`);

    console.log(
      "[Migration] ✓ Rolled back: 20260212_202200_add_audio_settings",
    );
  },
};
