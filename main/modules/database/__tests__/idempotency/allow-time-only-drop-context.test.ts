import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migration_20261025_130000_add_card_drop_context } from "../../migrations/20261025_130000_add_card_drop_context";
import { migration_20261027_120000_allow_time_only_drop_context } from "../../migrations/20261027_120000_allow_time_only_drop_context";

describe("allow_time_only_drop_context migration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE leagues (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        game TEXT NOT NULL DEFAULT 'poe1',
        league_id TEXT NOT NULL REFERENCES leagues(id)
      );
      CREATE TABLE session_card_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        chaos_value REAL,
        divine_value REAL,
        dropped_at TEXT NOT NULL
      );
      INSERT INTO leagues (id, name) VALUES ('league-1', 'Keepers');
      INSERT INTO sessions (id, league_id) VALUES ('session-1', 'league-1');
    `);
    migration_20261025_130000_add_card_drop_context.up(db);
  });

  afterEach(() => db.close());

  it("makes location nullable, queues known time, and is idempotent", () => {
    const insertEvent = db.prepare(`
      INSERT INTO session_card_events (
        session_id, card_name, dropped_at, event_id, location,
        utc_offset_minutes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertEvent.run(
      "session-1",
      "The Scholar",
      "2026-03-14T09:26:12.000Z",
      "aaaaaaaa-0000-4000-8000-000000000001",
      null,
      60,
    );
    insertEvent.run(
      "session-1",
      "The Fortunate",
      "2026-03-14T09:30:00.000Z",
      "aaaaaaaa-0000-4000-8000-000000000099",
      "Atlas Hideout",
      60,
    );

    migration_20261027_120000_allow_time_only_drop_context.up(db);
    expect(() =>
      migration_20261027_120000_allow_time_only_drop_context.up(db),
    ).not.toThrow();

    const locationColumn = db
      .prepare("PRAGMA table_info(community_drop_event_outbox)")
      .all()
      .find((column) => (column as { name: string }).name === "location") as {
      notnull: number;
    };
    expect(locationColumn.notnull).toBe(0);
    expect(
      db.prepare("SELECT * FROM community_drop_event_outbox").all(),
    ).toEqual([
      expect.objectContaining({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        location: null,
        local_minute: 626,
        utc_offset_minutes: 60,
      }),
    ]);
  });

  it("preserves located events and restores the old constraint on rollback", () => {
    db.prepare(`
      INSERT INTO community_drop_event_outbox (
        event_id, session_id, game, scope, card_name, location,
        local_minute, utc_offset_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "aaaaaaaa-0000-4000-8000-000000000002",
      "session-1",
      "poe1",
      "Keepers",
      "The Scholar",
      "Atlas Hideout",
      626,
      60,
    );

    migration_20261027_120000_allow_time_only_drop_context.up(db);
    migration_20261027_120000_allow_time_only_drop_context.down(db);

    expect(
      db.prepare("SELECT location FROM community_drop_event_outbox").all(),
    ).toEqual([{ location: "Atlas Hideout" }]);
    const locationColumn = db
      .prepare("PRAGMA table_info(community_drop_event_outbox)")
      .all()
      .find((column) => (column as { name: string }).name === "location") as {
      notnull: number;
    };
    expect(locationColumn.notnull).toBe(1);
  });
});
