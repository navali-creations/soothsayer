import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: create app_metadata table
 *
 * Creates the `app_metadata` table, a generic key-value store for
 * application-level metadata that doesn't belong in user_settings.
 *
 * On creation, a `device_id` UUID v4 is generated and inserted. This ID
 * uniquely identifies the installation and persists across app updates.
 * `INSERT OR IGNORE` ensures the device_id is only set once, even if
 * the migration is re-run.
 */
export const migration_20260412_125200_create_app_metadata: Migration = {
  id: "20260412_125200_create_app_metadata",
  description:
    "create app_metadata key-value table and generate a persistent device_id UUID",

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    const deviceId = crypto.randomUUID();

    db.prepare(
      `INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('device_id', ?)`,
    ).run(deviceId);

    console.log("[Migration] ✓ Applied: 20260412_125200_create_app_metadata");
  },

  down(db: Database.Database): void {
    db.exec(`DROP TABLE IF EXISTS app_metadata`);

    console.log(
      "[Migration] ✓ Rolled back: 20260412_125200_create_app_metadata",
    );
  },
};
