import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260225_230000_add_overlay_font_size_and_main_window_bounds } from "../../migrations/20260225_230000_add_overlay_font_size_and_main_window_bounds";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("overlay_font_size and main_window_bounds migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should skip adding columns when they already exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const before = getColumnNames(db, "user_settings");
    expect(before).toContain("overlay_font_size");
    expect(before).toContain("main_window_bounds");

    expect(() =>
      migration_20260225_230000_add_overlay_font_size_and_main_window_bounds.up(
        db,
      ),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    expect(after.filter((c) => c === "overlay_font_size").length).toBe(1);
    expect(after.filter((c) => c === "main_window_bounds").length).toBe(1);
  });

  it("should handle down() when columns do not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    const before = getColumnNames(db, "user_settings");
    expect(before).not.toContain("overlay_font_size");
    expect(before).not.toContain("main_window_bounds");

    expect(() =>
      migration_20260225_230000_add_overlay_font_size_and_main_window_bounds.down(
        db,
      ),
    ).not.toThrow();

    const after = getColumnNames(db, "user_settings");
    expect(after).not.toContain("overlay_font_size");
    expect(after).not.toContain("main_window_bounds");
  });

  it("should preserve existing user settings data after down() removes columns", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "UPDATE user_settings SET app_exit_action = 'minimize', overlay_font_size = 1.5 WHERE id = 1",
    ).run();

    migration_20260225_230000_add_overlay_font_size_and_main_window_bounds.down(
      db,
    );

    const columns = getColumnNames(db, "user_settings");
    expect(columns).not.toContain("overlay_font_size");
    expect(columns).not.toContain("main_window_bounds");

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

    migration_20260225_230000_add_overlay_font_size_and_main_window_bounds.down(
      db,
    );
    const afterDown = getColumnNames(db, "user_settings");
    expect(afterDown).not.toContain("overlay_font_size");
    expect(afterDown).not.toContain("main_window_bounds");

    migration_20260225_230000_add_overlay_font_size_and_main_window_bounds.up(
      db,
    );
    const afterUp = getColumnNames(db, "user_settings");
    expect(afterUp).toContain("overlay_font_size");
    expect(afterUp).toContain("main_window_bounds");

    db.prepare(
      "UPDATE user_settings SET overlay_font_size = 2.0 WHERE id = 1",
    ).run();
    const row = db
      .prepare("SELECT overlay_font_size FROM user_settings WHERE id = 1")
      .get() as { overlay_font_size: number };
    expect(row.overlay_font_size).toBe(2.0);
  });
});
