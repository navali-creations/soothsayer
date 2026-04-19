import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260226_134100_add_overlay_toolbar_font_size } from "../../migrations/20260226_134100_add_overlay_toolbar_font_size";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("overlay_toolbar_font_size migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should skip adding column when it already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const before = getColumnNames(db, "user_settings");
    expect(before).toContain("overlay_toolbar_font_size");

    expect(() =>
      migration_20260226_134100_add_overlay_toolbar_font_size.up(db),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    expect(after.filter((c) => c === "overlay_toolbar_font_size").length).toBe(
      1,
    );
  });

  it("should handle down() when column does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    const before = getColumnNames(db, "user_settings");
    expect(before).not.toContain("overlay_toolbar_font_size");

    expect(() =>
      migration_20260226_134100_add_overlay_toolbar_font_size.down(db),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    expect(after).not.toContain("overlay_toolbar_font_size");
  });

  it("should preserve existing user settings data after down() removes column", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "UPDATE user_settings SET app_exit_action = 'minimize', overlay_toolbar_font_size = 1.8 WHERE id = 1",
    ).run();

    migration_20260226_134100_add_overlay_toolbar_font_size.down(db);

    const columns = getColumnNames(db, "user_settings");
    expect(columns).not.toContain("overlay_toolbar_font_size");

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

    migration_20260226_134100_add_overlay_toolbar_font_size.down(db);
    const afterDown = getColumnNames(db, "user_settings");
    expect(afterDown).not.toContain("overlay_toolbar_font_size");

    migration_20260226_134100_add_overlay_toolbar_font_size.up(db);
    const afterUp = getColumnNames(db, "user_settings");
    expect(afterUp).toContain("overlay_toolbar_font_size");

    db.prepare(
      "UPDATE user_settings SET overlay_toolbar_font_size = 0.75 WHERE id = 1",
    ).run();
    const row = db
      .prepare(
        "SELECT overlay_toolbar_font_size FROM user_settings WHERE id = 1",
      )
      .get() as { overlay_toolbar_font_size: number };
    expect(row.overlay_toolbar_font_size).toBe(0.75);
  });
});
