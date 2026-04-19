import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260408_170000_add_weight_to_availability } from "../../migrations/20260408_170000_add_weight_to_availability";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("add_weight_to_availability migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when weight column already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260408_170000_add_weight_to_availability.up(db),
    ).not.toThrow();

    const columns = getColumnNames(db, "divination_card_availability");
    expect(columns).toContain("weight");
  });

  it("should handle down() when weight column does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260408_170000_add_weight_to_availability.down(db),
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

    migration_20260408_170000_add_weight_to_availability.down(db);

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

    migration_20260408_170000_add_weight_to_availability.down(db);
    expect(() =>
      migration_20260408_170000_add_weight_to_availability.up(db),
    ).not.toThrow();

    const columns = getColumnNames(db, "divination_card_availability");
    expect(columns).toContain("weight");
  });
});
