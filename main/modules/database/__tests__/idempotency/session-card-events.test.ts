import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../../migrations";
import { migration_20260331_225900_create_session_card_events } from "../../migrations/20260331_225900_create_session_card_events";
import {
  createBaselineSchema,
  EXPECTED_SESSION_CARD_EVENTS_COLUMNS,
  getColumnNames,
  getIndexNames,
  getTableNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("session_card_events migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should skip creating table when it already exists", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    const before = getTableNames(db);
    expect(before).toContain("session_card_events");

    expect(() =>
      migration_20260331_225900_create_session_card_events.up(db),
    ).not.toThrow();

    const after = getTableNames(db);
    expect(after).toContain("session_card_events");
  });

  it("should handle down() when table does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    const before = getTableNames(db);
    expect(before).not.toContain("session_card_events");

    expect(() =>
      migration_20260331_225900_create_session_card_events.down(db),
    ).not.toThrow();

    const after = getTableNames(db);
    expect(after).not.toContain("session_card_events");
  });

  it("should create table with correct columns", () => {
    const db = getDb();
    createBaselineSchema(db);

    migration_20260331_225900_create_session_card_events.up(db);

    const columns = getColumnNames(db, "session_card_events");
    expect(columns.sort()).toEqual(EXPECTED_SESSION_CARD_EVENTS_COLUMNS.sort());
  });

  it("should create index", () => {
    const db = getDb();
    createBaselineSchema(db);

    migration_20260331_225900_create_session_card_events.up(db);

    const indexes = getIndexNames(db, "session_card_events");
    expect(indexes).toContain("idx_session_card_events_session");
  });

  it("should remove table and indexes on down()", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(getTableNames(db)).toContain("session_card_events");
    expect(getIndexNames(db, "session_card_events")).toHaveLength(1);

    migration_20260331_225900_create_session_card_events.down(db);

    expect(getTableNames(db)).not.toContain("session_card_events");
    expect(getIndexNames(db, "session_card_events")).toHaveLength(0);
  });

  it("should allow re-applying migration after rollback", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    migration_20260331_225900_create_session_card_events.down(db);
    expect(getTableNames(db)).not.toContain("session_card_events");

    migration_20260331_225900_create_session_card_events.up(db);
    expect(getTableNames(db)).toContain("session_card_events");

    const columns = getColumnNames(db, "session_card_events");
    expect(columns.sort()).toEqual(EXPECTED_SESSION_CARD_EVENTS_COLUMNS.sort());
  });

  it("should preserve data in other tables after down()", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "INSERT INTO leagues (id, name, game) VALUES ('l1', 'Test', 'poe1')",
    ).run();
    db.prepare(
      "INSERT INTO sessions (id, game, league_id, started_at) VALUES ('s1', 'poe1', 'l1', datetime('now'))",
    ).run();

    migration_20260331_225900_create_session_card_events.down(db);

    const session = db
      .prepare("SELECT id FROM sessions WHERE id = 's1'")
      .get() as { id: string } | undefined;
    expect(session).toBeDefined();
    expect(session!.id).toBe("s1");
  });

  it("should enforce foreign key constraint on session_id", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    expect(() =>
      db
        .prepare(
          "INSERT INTO session_card_events (session_id, card_name, dropped_at) VALUES ('nonexistent', 'Card', datetime('now'))",
        )
        .run(),
    ).toThrow();
  });

  it("should cascade delete when parent session is deleted", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "INSERT INTO leagues (id, name, game) VALUES ('l1', 'Test', 'poe1')",
    ).run();
    db.prepare(
      "INSERT INTO sessions (id, game, league_id, started_at) VALUES ('s1', 'poe1', 'l1', datetime('now'))",
    ).run();
    db.prepare(
      "INSERT INTO session_card_events (session_id, card_name, chaos_value, dropped_at) VALUES ('s1', 'The Doctor', 5000, datetime('now'))",
    ).run();

    const before = db
      .prepare(
        "SELECT COUNT(*) as count FROM session_card_events WHERE session_id = 's1'",
      )
      .get() as { count: number };
    expect(before.count).toBe(1);

    db.prepare("DELETE FROM sessions WHERE id = 's1'").run();

    const after = db
      .prepare(
        "SELECT COUNT(*) as count FROM session_card_events WHERE session_id = 's1'",
      )
      .get() as { count: number };
    expect(after.count).toBe(0);
  });

  it("should allow inserting valid card events with all fields", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "INSERT INTO leagues (id, name, game) VALUES ('l1', 'Test', 'poe1')",
    ).run();
    db.prepare(
      "INSERT INTO sessions (id, game, league_id, started_at) VALUES ('s1', 'poe1', 'l1', datetime('now'))",
    ).run();

    db.prepare(
      "INSERT INTO session_card_events (session_id, card_name, chaos_value, divine_value, dropped_at) VALUES ('s1', 'The Doctor', 5000.5, 25.025, '2025-03-31T12:00:00Z')",
    ).run();

    const row = db
      .prepare("SELECT * FROM session_card_events WHERE session_id = 's1'")
      .get() as any;

    expect(row.session_id).toBe("s1");
    expect(row.card_name).toBe("The Doctor");
    expect(row.chaos_value).toBeCloseTo(5000.5);
    expect(row.divine_value).toBeCloseTo(25.025);
    expect(row.dropped_at).toBe("2025-03-31T12:00:00Z");
  });

  it("should allow null chaos_value and divine_value", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "INSERT INTO leagues (id, name, game) VALUES ('l1', 'Test', 'poe1')",
    ).run();
    db.prepare(
      "INSERT INTO sessions (id, game, league_id, started_at) VALUES ('s1', 'poe1', 'l1', datetime('now'))",
    ).run();

    expect(() =>
      db
        .prepare(
          "INSERT INTO session_card_events (session_id, card_name, dropped_at) VALUES ('s1', 'Rain of Chaos', datetime('now'))",
        )
        .run(),
    ).not.toThrow();

    const row = db
      .prepare(
        "SELECT chaos_value, divine_value FROM session_card_events WHERE session_id = 's1'",
      )
      .get() as any;

    expect(row.chaos_value).toBeNull();
    expect(row.divine_value).toBeNull();
  });

  it("should auto-increment the id column", () => {
    const db = getDb();
    createBaselineSchema(db);
    const runner = new MigrationRunner(db);
    runner.runMigrations(migrations);

    db.prepare(
      "INSERT INTO leagues (id, name, game) VALUES ('l1', 'Test', 'poe1')",
    ).run();
    db.prepare(
      "INSERT INTO sessions (id, game, league_id, started_at) VALUES ('s1', 'poe1', 'l1', datetime('now'))",
    ).run();

    db.prepare(
      "INSERT INTO session_card_events (session_id, card_name, dropped_at) VALUES ('s1', 'Card1', datetime('now'))",
    ).run();
    db.prepare(
      "INSERT INTO session_card_events (session_id, card_name, dropped_at) VALUES ('s1', 'Card2', datetime('now'))",
    ).run();

    const rows = db
      .prepare("SELECT id FROM session_card_events ORDER BY id")
      .all() as { id: number }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(1);
    expect(rows[1].id).toBe(2);
  });
});
