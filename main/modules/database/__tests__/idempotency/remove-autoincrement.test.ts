import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260405_114200_remove_autoincrement } from "../../migrations/20260405_114200_remove_autoincrement";
import { createBaselineSchema, setupMigrationDb } from "../migrations-shared";

describe("remove_autoincrement migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when already applied", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260405_114200_remove_autoincrement.up(db),
    ).not.toThrow();
  });

  it("should handle down() when tables do not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260405_114200_remove_autoincrement.down(db),
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

    migration_20260405_114200_remove_autoincrement.down(db);

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

    migration_20260405_114200_remove_autoincrement.down(db);
    expect(() =>
      migration_20260405_114200_remove_autoincrement.up(db),
    ).not.toThrow();
  });
});
