import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260408_190000_drop_prohibited_library_tables } from "../../migrations/20260408_190000_drop_prohibited_library_tables";
import {
  createBaselineSchema,
  getTableNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("drop_prohibited_library_tables migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when tables already dropped", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260408_190000_drop_prohibited_library_tables.up(db),
    ).not.toThrow();
  });

  it("should handle down() when tables do not exist (re-creates them)", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260408_190000_drop_prohibited_library_tables.down(db),
    ).not.toThrow();

    const tables = getTableNames(db);
    expect(tables).toContain("prohibited_library_card_weights");
    expect(tables).toContain("prohibited_library_cache_metadata");
  });

  it("should preserve data in other tables after down()", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "INSERT INTO leagues (id, name, game) VALUES ('l1', 'Test', 'poe1')",
    ).run();

    migration_20260408_190000_drop_prohibited_library_tables.down(db);

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

    migration_20260408_190000_drop_prohibited_library_tables.down(db);
    expect(() =>
      migration_20260408_190000_drop_prohibited_library_tables.up(db),
    ).not.toThrow();

    const tables = getTableNames(db);
    expect(tables).not.toContain("prohibited_library_card_weights");
    expect(tables).not.toContain("prohibited_library_cache_metadata");
  });
});
