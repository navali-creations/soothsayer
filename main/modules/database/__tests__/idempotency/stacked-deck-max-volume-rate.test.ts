import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260227_182400_add_stacked_deck_max_volume_rate } from "../../migrations/20260227_182400_add_stacked_deck_max_volume_rate";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("stacked_deck_max_volume_rate migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should skip adding column when it already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const before = getColumnNames(db, "snapshots");
    expect(before).toContain("stacked_deck_max_volume_rate");

    expect(() =>
      migration_20260227_182400_add_stacked_deck_max_volume_rate.up(db),
    ).not.toThrow();

    const after = getColumnNames(db, "snapshots");
    expect(
      after.filter((c) => c === "stacked_deck_max_volume_rate").length,
    ).toBe(1);
  });

  it("should handle down() when column does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    const before = getColumnNames(db, "snapshots");
    expect(before).not.toContain("stacked_deck_max_volume_rate");

    expect(() =>
      migration_20260227_182400_add_stacked_deck_max_volume_rate.down(db),
    ).not.toThrow();

    const after = getColumnNames(db, "snapshots");
    expect(after).not.toContain("stacked_deck_max_volume_rate");
  });

  it("should preserve existing snapshot data after down() removes column", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare("INSERT INTO leagues (id, name, game) VALUES (?, ?, ?)").run(
      "league-1",
      "Settlers",
      "poe1",
    );

    db.prepare(
      "INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, stacked_deck_chaos_cost, stacked_deck_max_volume_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("snap-1", "league-1", "2026-01-01T00:00:00Z", 150, 145, 3.5, 42);

    migration_20260227_182400_add_stacked_deck_max_volume_rate.down(db);

    const columns = getColumnNames(db, "snapshots");
    expect(columns).not.toContain("stacked_deck_max_volume_rate");

    const row = db
      .prepare("SELECT id, stacked_deck_chaos_cost FROM snapshots WHERE id = ?")
      .get("snap-1") as { id: string; stacked_deck_chaos_cost: number };
    expect(row.id).toBe("snap-1");
    expect(row.stacked_deck_chaos_cost).toBe(3.5);
  });

  it("should allow re-applying migration after rollback", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    migration_20260227_182400_add_stacked_deck_max_volume_rate.down(db);
    const afterDown = getColumnNames(db, "snapshots");
    expect(afterDown).not.toContain("stacked_deck_max_volume_rate");

    migration_20260227_182400_add_stacked_deck_max_volume_rate.up(db);
    const afterUp = getColumnNames(db, "snapshots");
    expect(afterUp).toContain("stacked_deck_max_volume_rate");
  });
});
