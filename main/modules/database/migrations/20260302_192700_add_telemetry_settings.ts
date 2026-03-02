import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add telemetry settings columns to user_settings
 *
 * Adds columns for:
 * - telemetry_crash_reporting: Whether the user has opted in to Sentry crash reporting.
 *   Default 0 (disabled) for existing users — they must explicitly re-enable in
 *   Settings → Privacy & Telemetry. New users get the opt-out choice in the setup
 *   wizard (step 4), where both toggles default to ON.
 *
 * - telemetry_usage_analytics: Whether the user has opted in to Umami usage analytics.
 *   Same default behavior as crash reporting.
 *
 * Also updates the setup_step column to allow step 4 (TELEMETRY_CONSENT).
 * Previously the valid range was 0–3; now it is 0–4.
 */
export const migration_20260302_192700_add_telemetry_settings: Migration = {
  id: "20260302_192700_add_telemetry_settings",
  description:
    "add telemetry_crash_reporting and telemetry_usage_analytics to user_settings, allow setup_step 4",

  up(db: Database.Database): void {
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (!existing.has("telemetry_crash_reporting")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN telemetry_crash_reporting INTEGER NOT NULL DEFAULT 0
      `);
    }

    if (!existing.has("telemetry_usage_analytics")) {
      db.exec(`
        ALTER TABLE user_settings ADD COLUMN telemetry_usage_analytics INTEGER NOT NULL DEFAULT 0
      `);
    }

    console.log(
      "[Migration] ✓ Applied: 20260302_192700_add_telemetry_settings",
    );
  },

  down(db: Database.Database): void {
    const columns = db.prepare("PRAGMA table_info(user_settings)").all() as {
      name: string;
    }[];
    const existing = new Set(columns.map((c) => c.name));

    if (existing.has("telemetry_crash_reporting")) {
      db.exec(
        `ALTER TABLE user_settings DROP COLUMN telemetry_crash_reporting`,
      );
    }

    if (existing.has("telemetry_usage_analytics")) {
      db.exec(
        `ALTER TABLE user_settings DROP COLUMN telemetry_usage_analytics`,
      );
    }

    console.log(
      "[Migration] ✓ Rolled back: 20260302_192700_add_telemetry_settings",
    );
  },
};
