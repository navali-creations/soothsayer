import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260418_140800_create_dismissed_banners } from "../../migrations/20260418_140800_create_dismissed_banners";
import {
  createBaselineSchema,
  getTableNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("create_dismissed_banners migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when dismissed_banners table already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260418_140800_create_dismissed_banners.up(db),
    ).not.toThrow();
  });

  it("should handle down() when dismissed_banners table does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260418_140800_create_dismissed_banners.down(db),
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

    migration_20260418_140800_create_dismissed_banners.down(db);

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

    migration_20260418_140800_create_dismissed_banners.down(db);
    expect(() =>
      migration_20260418_140800_create_dismissed_banners.up(db),
    ).not.toThrow();

    const tables = getTableNames(db);
    expect(tables).toContain("dismissed_banners");
  });
});
