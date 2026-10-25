import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MigrationRunner } from "../migrations";
import { migration_20261025_120000_remove_retired_analytics_storage as migration } from "../migrations/20261025_120000_remove_retired_analytics_storage";

function getColumnNames(db: Database.Database, tableName: string): string[] {
  return (
    db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{
      name: string;
    }>
  ).map((column) => column.name);
}

function hasTable(db: Database.Database, tableName: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function createLegacyAnalyticsStorage(db: Database.Database): void {
  db.exec(`
    CREATE TABLE user_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      app_exit_action TEXT NOT NULL DEFAULT 'exit',
      telemetry_crash_reporting INTEGER NOT NULL DEFAULT 0,
      telemetry_usage_analytics INTEGER NOT NULL DEFAULT 0,
      main_window_bounds TEXT
    );

    INSERT INTO user_settings (
      id,
      app_exit_action,
      telemetry_crash_reporting,
      telemetry_usage_analytics,
      main_window_bounds
    ) VALUES (
      1,
      'minimize',
      1,
      1,
      '{"x":100,"y":200,"width":1400,"height":900}'
    );

    CREATE TABLE card_price_history_cache (
      id INTEGER PRIMARY KEY,
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      details_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      response_data TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    INSERT INTO card_price_history_cache (
      game,
      league,
      details_id,
      card_name,
      response_data,
      fetched_at
    ) VALUES (
      'poe1',
      'Keepers',
      'doctor',
      'The Doctor',
      '{}',
      '2026-10-01T00:00:00Z'
    );
  `);
}

describe("remove retired analytics storage migration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("removes retired storage and preserves active settings", () => {
    createLegacyAnalyticsStorage(db);

    migration.up(db);

    expect(getColumnNames(db, "user_settings")).not.toContain(
      "telemetry_usage_analytics",
    );
    expect(hasTable(db, "card_price_history_cache")).toBe(false);
    expect(
      db
        .prepare(
          "SELECT app_exit_action, telemetry_crash_reporting, main_window_bounds FROM user_settings WHERE id = 1",
        )
        .get(),
    ).toEqual({
      app_exit_action: "minimize",
      telemetry_crash_reporting: 1,
      main_window_bounds: '{"x":100,"y":200,"width":1400,"height":900}',
    });
  });

  it("is safe when the retired storage is already absent", () => {
    db.exec(`
      CREATE TABLE user_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        telemetry_crash_reporting INTEGER NOT NULL DEFAULT 0
      )
    `);

    expect(() => migration.up(db)).not.toThrow();
    expect(() => migration.up(db)).not.toThrow();

    expect(getColumnNames(db, "user_settings")).toEqual([
      "id",
      "telemetry_crash_reporting",
    ]);
    expect(hasTable(db, "card_price_history_cache")).toBe(false);
  });

  it("is safe for a partially initialized database", () => {
    db.exec(`
      CREATE TABLE card_price_history_cache (
        id INTEGER PRIMARY KEY
      )
    `);

    expect(() => migration.up(db)).not.toThrow();
    expect(hasTable(db, "card_price_history_cache")).toBe(false);
  });

  it("restores the preceding empty schema when rolled back", () => {
    createLegacyAnalyticsStorage(db);
    migration.up(db);

    migration.down(db);
    migration.down(db);

    expect(getColumnNames(db, "user_settings")).toContain(
      "telemetry_usage_analytics",
    );
    expect(
      db
        .prepare(
          "SELECT telemetry_usage_analytics, telemetry_crash_reporting, main_window_bounds FROM user_settings WHERE id = 1",
        )
        .get(),
    ).toEqual({
      telemetry_usage_analytics: 0,
      telemetry_crash_reporting: 1,
      main_window_bounds: '{"x":100,"y":200,"width":1400,"height":900}',
    });
    expect(hasTable(db, "card_price_history_cache")).toBe(true);
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM card_price_history_cache")
        .get(),
    ).toEqual({ count: 0 });
  });

  it("can roll back a partially initialized database", () => {
    expect(() => migration.down(db)).not.toThrow();

    expect(getColumnNames(db, "user_settings")).toEqual([]);
    expect(hasTable(db, "card_price_history_cache")).toBe(true);
  });

  it("applies once through MigrationRunner", () => {
    createLegacyAnalyticsStorage(db);
    const runner = new MigrationRunner(db);

    runner.runMigrations([migration]);
    expect(() => runner.runMigrations([migration])).not.toThrow();

    expect(runner.listAppliedMigrations()).toHaveLength(1);
    expect(runner.listAppliedMigrations()[0]).toContain(migration.id);
  });
});
