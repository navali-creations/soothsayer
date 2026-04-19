import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../migrations";
import {
  createBaselineSchema,
  EXPECTED_AUDIO_COLUMNS,
  EXPECTED_AVAILABILITY_COLUMNS,
  EXPECTED_FILTER_CARD_RARITIES_COLUMNS,
  EXPECTED_FILTER_METADATA_COLUMNS,
  EXPECTED_FILTER_SETTINGS_COLUMNS,
  EXPECTED_FILTER_TABLES,
  EXPECTED_LAST_SEEN_APP_VERSION_COLUMNS,
  EXPECTED_SESSION_CARD_EVENTS_COLUMNS,
  EXPECTED_SESSION_CARD_EVENTS_INDEXES,
  getColumnNames,
  getIndexNames,
  getTableNames,
  setupMigrationDb,
} from "./migrations-shared";

describe("Migrations – Fresh Install", () => {
  const { getDb } = setupMigrationDb();

  it("should run all migrations without errors on a fresh database", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);

    expect(() => runner.runMigrations(migrations)).not.toThrow();
  });

  it("should have all audio columns after migrations", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "user_settings");
    for (const col of EXPECTED_AUDIO_COLUMNS) {
      expect(columns).toContain(col);
    }
  });

  it("should have all filter settings columns after migrations", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "user_settings");
    for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
      expect(columns).toContain(col);
    }
  });

  it("should have filter_metadata and filter_card_rarities tables after migrations", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const tables = getTableNames(db);
    for (const table of EXPECTED_FILTER_TABLES) {
      expect(tables).toContain(table);
    }
  });

  it("should have correct columns in filter_metadata table", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "filter_metadata");
    expect(columns.sort()).toEqual(EXPECTED_FILTER_METADATA_COLUMNS.sort());
  });

  it("should have correct columns in filter_card_rarities table", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "filter_card_rarities");
    expect(columns.sort()).toEqual(
      EXPECTED_FILTER_CARD_RARITIES_COLUMNS.sort(),
    );
  });

  it("should have divination_card_availability table after migrations", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const tables = getTableNames(db);
    expect(tables).toContain("divination_card_availability");
    expect(tables).not.toContain("prohibited_library_card_weights");
    expect(tables).not.toContain("prohibited_library_cache_metadata");
  });

  it("should have correct columns in divination_card_availability table", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "divination_card_availability");
    expect(columns).toEqual(EXPECTED_AVAILABILITY_COLUMNS);
  });

  it("should NOT have from_boss column on divination_cards after migrations (moved to availability)", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "divination_cards");
    expect(columns).not.toContain("from_boss");
  });

  it("should have last_seen_app_version column on user_settings after migrations", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "user_settings");
    for (const col of EXPECTED_LAST_SEEN_APP_VERSION_COLUMNS) {
      expect(columns).toContain(col);
    }
  });

  it("should default last_seen_app_version to NULL on fresh install", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const row = db
      .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
      .get() as { last_seen_app_version: string | null };

    expect(row.last_seen_app_version).toBeNull();
  });

  it("should record all migrations as applied", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const applied = runner.listAppliedMigrations();
    expect(applied).toHaveLength(migrations.length);

    for (const migration of migrations) {
      expect(applied.some((a) => a.includes(migration.id))).toBe(true);
    }
  });

  it("should be idempotent — running migrations twice does not throw", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);

    runner.runMigrations(migrations);
    expect(() => runner.runMigrations(migrations)).not.toThrow();

    const applied = runner.listAppliedMigrations();
    expect(applied).toHaveLength(migrations.length);
  });

  it("should preserve existing user settings data", () => {
    const db = getDb();
    createBaselineSchema(db);

    // Simulate a user who has already configured settings
    db.prepare(
      "UPDATE user_settings SET app_exit_action = 'minimize', selected_game = 'poe1' WHERE id = 1",
    ).run();

    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const row = db
      .prepare(
        "SELECT app_exit_action, selected_game FROM user_settings WHERE id = 1",
      )
      .get() as { app_exit_action: string; selected_game: string };

    expect(row.app_exit_action).toBe("minimize");
    expect(row.selected_game).toBe("poe1");
  });

  it("should store and retrieve last_seen_app_version after migration", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "UPDATE user_settings SET last_seen_app_version = ? WHERE id = 1",
    ).run("0.5.0");

    const row = db
      .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
      .get() as { last_seen_app_version: string | null };

    expect(row.last_seen_app_version).toBe("0.5.0");
  });

  it("should have session_card_events table after migrations", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const tables = getTableNames(db);
    expect(tables).toContain("session_card_events");
  });

  it("should have correct columns in session_card_events table", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const columns = getColumnNames(db, "session_card_events");
    expect(columns.sort()).toEqual(EXPECTED_SESSION_CARD_EVENTS_COLUMNS.sort());
  });

  it("should have correct indexes on session_card_events table", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const indexes = getIndexNames(db, "session_card_events");
    for (const idx of EXPECTED_SESSION_CARD_EVENTS_INDEXES) {
      expect(indexes).toContain(idx);
    }
  });
});
