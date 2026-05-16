import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260623_150000_add_app_performance_diagnostics: Migration =
  {
    id: "20260623_150000_add_app_performance_diagnostics",
    description:
      "Add local app performance diagnostics settings and capture tables",

    up(db: Database.Database): void {
      const userSettingsColumns = getColumnNames(db, "user_settings");

      if (!userSettingsColumns.has("app_performance_monitor_enabled")) {
        db.exec(`
          ALTER TABLE user_settings
          ADD COLUMN app_performance_monitor_enabled INTEGER NOT NULL DEFAULT 0
        `);
      }

      if (!userSettingsColumns.has("app_performance_auto_start_on_session")) {
        db.exec(`
          ALTER TABLE user_settings
          ADD COLUMN app_performance_auto_start_on_session INTEGER NOT NULL DEFAULT 0
        `);
      }

      if (!userSettingsColumns.has("app_performance_retention")) {
        db.exec(`
          ALTER TABLE user_settings
          ADD COLUMN app_performance_retention TEXT NOT NULL DEFAULT '7d'
            CHECK(app_performance_retention IN ('24h', '7d', 'indefinite'))
        `);
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS app_performance_captures (
          id TEXT PRIMARY KEY,
          started_at TEXT NOT NULL,
          stopped_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS app_performance_samples (
          id INTEGER PRIMARY KEY,
          collection_id TEXT NOT NULL,
          sampled_at TEXT NOT NULL,
          uptime_ms INTEGER NOT NULL,
          capture_elapsed_ms INTEGER NOT NULL,
          route TEXT,

          fps REAL,

          system_cpu_percent REAL,
          app_cpu_percent REAL,

          system_memory_used_percent REAL,
          system_memory_total_bytes INTEGER,
          system_memory_free_bytes INTEGER,
          app_memory_bytes INTEGER,
          app_memory_percent REAL,
          main_heap_used_bytes INTEGER,
          renderer_memory_bytes INTEGER,
          renderer_heap_used_bytes INTEGER,

          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (collection_id) REFERENCES app_performance_captures(id)
            ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS app_performance_route_markers (
          id TEXT PRIMARY KEY,
          collection_id TEXT NOT NULL,
          route TEXT NOT NULL,
          label TEXT NOT NULL,
          marked_at TEXT NOT NULL,
          elapsed_ms INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (collection_id) REFERENCES app_performance_captures(id)
            ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_app_perf_samples_collection
          ON app_performance_samples(collection_id, sampled_at)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_app_perf_samples_collection_elapsed
          ON app_performance_samples(collection_id, capture_elapsed_ms, sampled_at)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_app_perf_markers_collection
          ON app_performance_route_markers(collection_id, marked_at)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_app_perf_captures_started_at
          ON app_performance_captures(started_at DESC)
      `);

      console.log(
        "[Migration] ✓ Applied: 20260623_150000_add_app_performance_diagnostics",
      );
    },

    down(db: Database.Database): void {
      db.exec(`
        DROP TABLE IF EXISTS app_performance_route_markers;
        DROP TABLE IF EXISTS app_performance_samples;
        DROP TABLE IF EXISTS app_performance_captures;
      `);

      const userSettingsColumns = getColumnNames(db, "user_settings");

      if (userSettingsColumns.has("app_performance_retention")) {
        db.exec(`
          ALTER TABLE user_settings DROP COLUMN app_performance_retention
        `);
      }

      if (userSettingsColumns.has("app_performance_auto_start_on_session")) {
        db.exec(`
          ALTER TABLE user_settings DROP COLUMN app_performance_auto_start_on_session
        `);
      }

      if (userSettingsColumns.has("app_performance_monitor_enabled")) {
        db.exec(`
          ALTER TABLE user_settings DROP COLUMN app_performance_monitor_enabled
        `);
      }

      console.log(
        "[Migration] ✓ Rolled back: 20260623_150000_add_app_performance_diagnostics",
      );
    },
  };

function getColumnNames(db: Database.Database, tableName: string): Set<string> {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as {
    name: string;
  }[];

  return new Set(columns.map((column) => column.name));
}
