import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260410_010600_index_optimization_cleanup } from "../../migrations/20260410_010600_index_optimization_cleanup";
import { createBaselineSchema, setupMigrationDb } from "../migrations-shared";

describe("index_optimization_cleanup migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when indexes already exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260410_010600_index_optimization_cleanup.up(db),
    ).not.toThrow();
  });

  it("should handle down() when indexes do not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    // Remove the indexes this migration created, then call down() again
    // — it should not throw even though the indexes are already gone
    migration_20260410_010600_index_optimization_cleanup.down(db);
    expect(() =>
      migration_20260410_010600_index_optimization_cleanup.down(db),
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

    migration_20260410_010600_index_optimization_cleanup.down(db);

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

    migration_20260410_010600_index_optimization_cleanup.down(db);
    expect(() =>
      migration_20260410_010600_index_optimization_cleanup.up(db),
    ).not.toThrow();
  });
});
