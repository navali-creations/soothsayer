import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260223_010100_add_last_seen_app_version } from "../../migrations/20260223_010100_add_last_seen_app_version";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("last_seen_app_version migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should skip adding last_seen_app_version when column already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);

    runner.runMigrations(migrations);

    const before = getColumnNames(db, "user_settings");
    expect(before).toContain("last_seen_app_version");

    expect(() =>
      migration_20260223_010100_add_last_seen_app_version.up(db),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    const count = after.filter((c) => c === "last_seen_app_version").length;
    expect(count).toBe(1);
  });

  it("should handle down() when last_seen_app_version column does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    db.exec(`ALTER TABLE user_settings DROP COLUMN last_seen_app_version`);

    const before = getColumnNames(db, "user_settings");
    expect(before).not.toContain("last_seen_app_version");

    expect(() =>
      migration_20260223_010100_add_last_seen_app_version.down(db),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    expect(after).not.toContain("last_seen_app_version");
  });

  it("should preserve existing user settings data after down() removes last_seen_app_version", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "UPDATE user_settings SET app_exit_action = 'minimize', last_seen_app_version = '0.5.0' WHERE id = 1",
    ).run();

    migration_20260223_010100_add_last_seen_app_version.down(db);

    const columns = getColumnNames(db, "user_settings");
    expect(columns).not.toContain("last_seen_app_version");

    const row = db
      .prepare("SELECT app_exit_action FROM user_settings WHERE id = 1")
      .get() as { app_exit_action: string };
    expect(row.app_exit_action).toBe("minimize");
  });

  it("should allow re-applying last_seen_app_version migration after rollback", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    migration_20260223_010100_add_last_seen_app_version.down(db);
    const afterDown = getColumnNames(db, "user_settings");
    expect(afterDown).not.toContain("last_seen_app_version");

    migration_20260223_010100_add_last_seen_app_version.up(db);
    const afterUp = getColumnNames(db, "user_settings");
    expect(afterUp).toContain("last_seen_app_version");

    db.prepare(
      "UPDATE user_settings SET last_seen_app_version = '0.6.0' WHERE id = 1",
    ).run();
    const row = db
      .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
      .get() as { last_seen_app_version: string | null };
    expect(row.last_seen_app_version).toBe("0.6.0");
  });
});
