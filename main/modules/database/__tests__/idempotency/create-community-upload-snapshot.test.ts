import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260622_120000_create_community_upload_snapshot } from "../../migrations/20260622_120000_create_community_upload_snapshot";
import {
  createBaselineSchema,
  getTableNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("create_community_upload_snapshot migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle up() when table already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      migration_20260622_120000_create_community_upload_snapshot.up(db),
    ).not.toThrow();
  });

  it("should handle down() when table does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);
    expect(() =>
      migration_20260622_120000_create_community_upload_snapshot.down(db),
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

    migration_20260622_120000_create_community_upload_snapshot.down(db);

    const row = db.prepare("SELECT id FROM leagues WHERE id = 'l1'").get() as
      | { id: string }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.id).toBe("l1");

    const tables = getTableNames(db);
    expect(tables).not.toContain("community_upload_snapshot");
  });

  it("should allow re-applying after rollback", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    migration_20260622_120000_create_community_upload_snapshot.down(db);
    expect(() =>
      migration_20260622_120000_create_community_upload_snapshot.up(db),
    ).not.toThrow();

    const tables = getTableNames(db);
    expect(tables).toContain("community_upload_snapshot");
  });
});
