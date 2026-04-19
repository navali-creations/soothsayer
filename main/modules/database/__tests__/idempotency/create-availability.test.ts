import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260408_160000_create_availability_and_drop_from_boss } from "../../migrations/20260408_160000_create_availability_and_drop_from_boss";
import { createBaselineSchema, setupMigrationDb } from "../migrations-shared";

describe("create_availability_and_drop_from_boss migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when availability table already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260408_160000_create_availability_and_drop_from_boss.up(db),
    ).not.toThrow();
  });

  it("should handle down() when availability table does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260408_160000_create_availability_and_drop_from_boss.down(db),
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

    migration_20260408_160000_create_availability_and_drop_from_boss.down(db);

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

    migration_20260408_160000_create_availability_and_drop_from_boss.down(db);
    expect(() =>
      migration_20260408_160000_create_availability_and_drop_from_boss.up(db),
    ).not.toThrow();
  });
});
