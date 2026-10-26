import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migration_20261025_130000_add_card_drop_context } from "../../migrations/20261025_130000_add_card_drop_context";

describe("add_card_drop_context migration idempotency", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE leagues (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
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
      )
    `);
    db.prepare("INSERT INTO leagues (id, name) VALUES (?, ?)").run(
      "league-1",
      "Keepers",
    );
  });

  afterEach(() => {
    db.close();
  });

  it("adds event context columns and retry outbox exactly once", () => {
    migration_20261025_130000_add_card_drop_context.up(db);

    expect(() =>
      migration_20261025_130000_add_card_drop_context.up(db),
    ).not.toThrow();

    const eventColumns = db
      .prepare("PRAGMA table_info(session_card_events)")
      .all() as { name: string }[];
    expect(eventColumns.map(({ name }) => name)).toEqual([
      "id",
      "session_id",
      "card_name",
      "chaos_value",
      "divine_value",
      "dropped_at",
      "event_id",
      "source_event_id",
      "location",
      "utc_offset_minutes",
    ]);

    const outboxColumns = db
      .prepare("PRAGMA table_info(community_drop_event_outbox)")
      .all() as { name: string }[];
    expect(outboxColumns.map(({ name }) => name)).toEqual([
      "event_id",
      "session_id",
      "game",
      "scope",
      "card_name",
      "location",
      "local_minute",
      "utc_offset_minutes",
      "created_at",
    ]);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'community_drop_event_upload_state'",
        )
        .get(),
    ).toEqual({ name: "community_drop_event_upload_state" });
  });

  it("backfills stable unique event IDs for existing rows", () => {
    db.prepare("INSERT INTO sessions (id, league_id) VALUES (?, ?)").run(
      "session-1",
      "league-1",
    );
    db.prepare(
      "INSERT INTO session_card_events (session_id, card_name, dropped_at) VALUES (?, ?, ?), (?, ?, ?)",
    ).run(
      "session-1",
      "The Scholar",
      "2026-03-14T09:26:12.000Z",
      "session-1",
      "Rain of Chaos",
      "2026-03-14T09:27:12.000Z",
    );

    migration_20261025_130000_add_card_drop_context.up(db);
    const firstRun = db
      .prepare("SELECT id, event_id FROM session_card_events ORDER BY id")
      .all() as { id: number; event_id: string }[];
    migration_20261025_130000_add_card_drop_context.up(db);
    const secondRun = db
      .prepare("SELECT id, event_id FROM session_card_events ORDER BY id")
      .all() as { id: number; event_id: string }[];

    expect(firstRun).toEqual(secondRun);
    expect(new Set(firstRun.map(({ event_id }) => event_id)).size).toBe(2);
    for (const { event_id } of firstRun) {
      expect(event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("enforces event context bounds and uniqueness", () => {
    migration_20261025_130000_add_card_drop_context.up(db);

    db.prepare("INSERT INTO sessions (id, league_id) VALUES (?, ?)").run(
      "session-1",
      "league-1",
    );

    const insert = db.prepare(`
      INSERT INTO community_drop_event_outbox (
        event_id, session_id, game, scope, card_name, location, local_minute, utc_offset_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      "event-1",
      "session-1",
      "poe1",
      "Keepers",
      "The Scholar",
      "Hideout",
      626,
      60,
    );

    expect(() =>
      insert.run(
        "event-1",
        "session-1",
        "poe1",
        "Keepers",
        "The Scholar",
        "Hideout",
        626,
        60,
      ),
    ).toThrow();
    expect(() =>
      insert.run(
        "event-2",
        "session-1",
        "poe1",
        "Keepers",
        "The Scholar",
        "Hideout",
        1440,
        60,
      ),
    ).toThrow();
    expect(() =>
      insert.run(
        "event-3",
        "session-1",
        "poe1",
        "Keepers",
        "The Scholar",
        "Hideout",
        626,
        841,
      ),
    ).toThrow();
  });

  it("queues existing valid context without duplicating it on rerun", () => {
    db.prepare("INSERT INTO sessions (id, league_id) VALUES (?, ?)").run(
      "session-1",
      "league-1",
    );
    migration_20261025_130000_add_card_drop_context.up(db);
    db.prepare(`
      INSERT INTO session_card_events (
        session_id, card_name, dropped_at, event_id, location, utc_offset_minutes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "session-1",
      "The Scholar",
      "2026-03-14T09:26:12.000Z",
      "aaaaaaaa-0000-4000-8000-000000000001",
      "Atlas Hideout",
      60,
    );

    migration_20261025_130000_add_card_drop_context.up(db);
    migration_20261025_130000_add_card_drop_context.up(db);

    expect(
      db.prepare("SELECT * FROM community_drop_event_outbox").all(),
    ).toEqual([
      expect.objectContaining({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "session-1",
        game: "poe1",
        scope: "Keepers",
        local_minute: 626,
      }),
    ]);
  });

  it("upgrades the draft outbox schema without losing events or retry state", () => {
    db.prepare("INSERT INTO sessions (id, league_id) VALUES (?, ?)").run(
      "session-1",
      "league-1",
    );
    db.exec(`
      ALTER TABLE session_card_events ADD COLUMN event_id TEXT;
      ALTER TABLE session_card_events ADD COLUMN source_event_id TEXT;
      ALTER TABLE session_card_events ADD COLUMN location TEXT;
      ALTER TABLE session_card_events ADD COLUMN utc_offset_minutes INTEGER;

      CREATE TABLE community_drop_event_outbox (
        event_id TEXT PRIMARY KEY,
        game TEXT NOT NULL,
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        location TEXT NOT NULL,
        local_minute INTEGER NOT NULL,
        utc_offset_minutes INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_community_drop_event_outbox_pending
      ON community_drop_event_outbox(game, scope, created_at);
    `);
    db.prepare(`
      INSERT INTO session_card_events (
        session_id, card_name, dropped_at, event_id, location, utc_offset_minutes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "session-1",
      "The Scholar",
      "2026-03-14T09:26:12.000Z",
      "aaaaaaaa-0000-4000-8000-000000000001",
      "Atlas Hideout",
      60,
    );
    db.prepare(`
      INSERT INTO community_drop_event_outbox (
        event_id, game, scope, card_name, location, local_minute,
        utc_offset_minutes, attempts, last_error, next_attempt_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "aaaaaaaa-0000-4000-8000-000000000001",
      "poe1",
      "Keepers",
      "The Scholar",
      "Atlas Hideout",
      626,
      60,
      2,
      "temporary failure",
      "2026-03-14T10:00:00.000Z",
      "2026-03-14T09:26:12.000Z",
    );

    migration_20261025_130000_add_card_drop_context.up(db);

    expect(
      db.prepare("SELECT * FROM community_drop_event_outbox").all(),
    ).toEqual([
      {
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "session-1",
        game: "poe1",
        scope: "Keepers",
        card_name: "The Scholar",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
        created_at: "2026-03-14T09:26:12.000Z",
      },
    ]);
    expect(
      db.prepare("SELECT * FROM community_drop_event_upload_state").all(),
    ).toEqual([
      {
        game: "poe1",
        scope: "Keepers",
        attempts: 2,
        last_error: "temporary failure",
        next_attempt_at: "2026-03-14T10:00:00.000Z",
      },
    ]);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'community_drop_event_outbox_draft'",
        )
        .get(),
    ).toBeUndefined();
  });

  it("rejects a draft outbox event that cannot be mapped to a session", () => {
    db.exec(`
      CREATE TABLE community_drop_event_outbox (
        event_id TEXT PRIMARY KEY,
        game TEXT NOT NULL,
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        location TEXT NOT NULL,
        local_minute INTEGER NOT NULL,
        utc_offset_minutes INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    db.prepare(`
      INSERT INTO community_drop_event_outbox (
        event_id, game, scope, card_name, location, local_minute,
        utc_offset_minutes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "missing-event",
      "poe1",
      "Keepers",
      "The Scholar",
      "Atlas Hideout",
      626,
      60,
      "2026-03-14T09:26:12.000Z",
    );

    expect(() =>
      migration_20261025_130000_add_card_drop_context.up(db),
    ).toThrow(
      "Cannot migrate draft card-drop outbox: 1 event(s) have no matching session",
    );
  });

  it("removes the outbox and indexes safely", () => {
    migration_20261025_130000_add_card_drop_context.up(db);
    migration_20261025_130000_add_card_drop_context.down(db);

    expect(() =>
      migration_20261025_130000_add_card_drop_context.down(db),
    ).not.toThrow();
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'community_drop_event_outbox'",
      )
      .get();
    expect(table).toBeUndefined();
  });
});
