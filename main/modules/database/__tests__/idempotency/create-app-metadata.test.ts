import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260412_125200_create_app_metadata } from "../../migrations/20260412_125200_create_app_metadata";
import {
  createBaselineSchema,
  getTableNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("create_app_metadata migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when app_metadata table already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const beforeId = (
      db
        .prepare("SELECT value FROM app_metadata WHERE key = 'device_id'")
        .get() as { value: string }
    ).value;

    expect(() =>
      migration_20260412_125200_create_app_metadata.up(db),
    ).not.toThrow();

    const afterId = (
      db
        .prepare("SELECT value FROM app_metadata WHERE key = 'device_id'")
        .get() as { value: string }
    ).value;

    expect(afterId).toBe(beforeId);
  });

  it("should handle down() when app_metadata table does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260412_125200_create_app_metadata.down(db),
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

    migration_20260412_125200_create_app_metadata.down(db);

    const row = db.prepare("SELECT id FROM leagues WHERE id = 'l1'").get() as
      | { id: string }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.id).toBe("l1");
  });

  it("should allow re-applying after rollback", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    migration_20260412_125200_create_app_metadata.down(db);
    expect(() =>
      migration_20260412_125200_create_app_metadata.up(db),
    ).not.toThrow();

    const tables = getTableNames(db);
    expect(tables).toContain("app_metadata");
  });
});
