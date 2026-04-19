import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260302_192700_add_telemetry_settings } from "../../migrations/20260302_192700_add_telemetry_settings";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("telemetry settings migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should skip adding columns when they already exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const before = getColumnNames(db, "user_settings");
    expect(before).toContain("telemetry_crash_reporting");
    expect(before).toContain("telemetry_usage_analytics");

    expect(() =>
      migration_20260302_192700_add_telemetry_settings.up(db),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    expect(after.filter((c) => c === "telemetry_crash_reporting").length).toBe(
      1,
    );
    expect(after.filter((c) => c === "telemetry_usage_analytics").length).toBe(
      1,
    );
  });

  it("should handle down() when columns do not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    const before = getColumnNames(db, "user_settings");
    expect(before).not.toContain("telemetry_crash_reporting");
    expect(before).not.toContain("telemetry_usage_analytics");

    expect(() =>
      migration_20260302_192700_add_telemetry_settings.down(db),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    expect(after).not.toContain("telemetry_crash_reporting");
    expect(after).not.toContain("telemetry_usage_analytics");
  });

  it("should preserve existing user settings data after down() removes columns", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "UPDATE user_settings SET app_exit_action = 'minimize', telemetry_crash_reporting = 1 WHERE id = 1",
    ).run();

    migration_20260302_192700_add_telemetry_settings.down(db);

    const columns = getColumnNames(db, "user_settings");
    expect(columns).not.toContain("telemetry_crash_reporting");
    expect(columns).not.toContain("telemetry_usage_analytics");

    const row = db
      .prepare("SELECT app_exit_action FROM user_settings WHERE id = 1")
      .get() as { app_exit_action: string };
    expect(row.app_exit_action).toBe("minimize");
  });

  it("should allow re-applying migration after rollback", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    migration_20260302_192700_add_telemetry_settings.down(db);
    const afterDown = getColumnNames(db, "user_settings");
    expect(afterDown).not.toContain("telemetry_crash_reporting");
    expect(afterDown).not.toContain("telemetry_usage_analytics");

    migration_20260302_192700_add_telemetry_settings.up(db);
    const afterUp = getColumnNames(db, "user_settings");
    expect(afterUp).toContain("telemetry_crash_reporting");
    expect(afterUp).toContain("telemetry_usage_analytics");

    db.prepare(
      "UPDATE user_settings SET telemetry_crash_reporting = 1, telemetry_usage_analytics = 1 WHERE id = 1",
    ).run();
    const row = db
      .prepare(
        "SELECT telemetry_crash_reporting, telemetry_usage_analytics FROM user_settings WHERE id = 1",
      )
      .get() as {
      telemetry_crash_reporting: number;
      telemetry_usage_analytics: number;
    };
    expect(row.telemetry_crash_reporting).toBe(1);
    expect(row.telemetry_usage_analytics).toBe(1);
  });

  it("should default telemetry columns to 0 for existing users", () => {
    const db = getDb();
    createBaselineSchema(db);

    migration_20260302_192700_add_telemetry_settings.up(db);

    const row = db
      .prepare(
        "SELECT telemetry_crash_reporting, telemetry_usage_analytics FROM user_settings WHERE id = 1",
      )
      .get() as {
      telemetry_crash_reporting: number;
      telemetry_usage_analytics: number;
    };
    expect(row.telemetry_crash_reporting).toBe(0);
    expect(row.telemetry_usage_analytics).toBe(0);
  });
});
