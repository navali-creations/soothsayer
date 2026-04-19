import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260420_120000_add_community_uploads_enabled } from "../../migrations/20260420_120000_add_community_uploads_enabled";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("add_community_uploads_enabled migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when column already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260420_120000_add_community_uploads_enabled.up(db),
    ).not.toThrow();

    const columns = getColumnNames(db, "user_settings");
    expect(columns).toContain("community_uploads_enabled");
  });

  it("should handle down() when column does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260420_120000_add_community_uploads_enabled.down(db),
    ).not.toThrow();
  });

  it("should preserve data in other tables after down()", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "INSERT INTO leagues (id, name, game) VALUES ('l1', 'Test', 'poe1')",
    ).run();

    migration_20260420_120000_add_community_uploads_enabled.down(db);

    const row = db.prepare("SELECT id FROM leagues WHERE id = 'l1'").get() as
      | { id: string }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.id).toBe("l1");

    const columns = getColumnNames(db, "user_settings");
    expect(columns).not.toContain("community_uploads_enabled");
  });

  it("should allow re-applying after rollback", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    migration_20260420_120000_add_community_uploads_enabled.down(db);
    expect(() =>
      migration_20260420_120000_add_community_uploads_enabled.up(db),
    ).not.toThrow();

    const columns = getColumnNames(db, "user_settings");
    expect(columns).toContain("community_uploads_enabled");
  });
});
