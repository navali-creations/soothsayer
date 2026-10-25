import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

const MIGRATION_ID = "20261025_120000_remove_retired_analytics_storage";

function getColumnNames(db: Database.Database, tableName: string): Set<string> {
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as Array<{ name: string }>;

  return new Set(columns.map((column) => column.name));
}

/**
 * Removes storage that no longer has a live application consumer.
 *
 * Historical migrations still create these objects for older databases. This
 * migration intentionally runs after them so fresh installs and upgrades end
 * with the same current schema.
 */
export const migration_20261025_120000_remove_retired_analytics_storage: Migration =
  {
    id: MIGRATION_ID,
    description: "remove retired usage analytics and card price cache storage",

    up(db: Database.Database): void {
      const settingsColumns = getColumnNames(db, "user_settings");

      if (settingsColumns.has("telemetry_usage_analytics")) {
        db.exec(
          "ALTER TABLE user_settings DROP COLUMN telemetry_usage_analytics",
        );
      }

      db.exec("DROP TABLE IF EXISTS card_price_history_cache");

      console.log(`[Migration] ✓ Applied: ${MIGRATION_ID}`);
    },

    down(db: Database.Database): void {
      const settingsColumns = getColumnNames(db, "user_settings");

      if (
        settingsColumns.size > 0 &&
        !settingsColumns.has("telemetry_usage_analytics")
      ) {
        db.exec(`
          ALTER TABLE user_settings
          ADD COLUMN telemetry_usage_analytics INTEGER NOT NULL DEFAULT 0
        `);
      }

      // Restore the immediately preceding schema so older migration down()
      // methods can unwind safely. Removed cache data cannot be recovered.
      db.exec(`
        CREATE TABLE IF NOT EXISTS card_price_history_cache (
          id INTEGER PRIMARY KEY,
          game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
          league TEXT NOT NULL,
          details_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          response_data TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(game, league, details_id)
        )
      `);

      console.log(`[Migration] ✓ Rolled back: ${MIGRATION_ID}`);
    },
  };
