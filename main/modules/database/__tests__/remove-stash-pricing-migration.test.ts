import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migration_20260625_120000_remove_stash_pricing as migration } from "../migrations/20260625_120000_remove_stash_pricing";

function getColumnNames(db: Database.Database, table: string): string[] {
  return (
    db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]
  ).map((row) => row.name);
}

function createCommonTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT NOT NULL
    );

    INSERT INTO leagues (id, name, game)
    VALUES ('league-1', 'Mirage', 'poe1');

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      league_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0
    );

    INSERT INTO sessions (id, game, league_id, started_at, total_count)
    VALUES ('session-1', 'poe1', 'league-1', '2026-05-01T10:00:00Z', 10);
  `);
}

function createLegacyStashSchema(db: Database.Database): void {
  createCommonTables(db);

  db.exec(`
    CREATE TABLE snapshots (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      exchange_chaos_to_divine REAL NOT NULL,
      stash_chaos_to_divine REAL NOT NULL,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO snapshots (
      id, league_id, fetched_at, exchange_chaos_to_divine,
      stash_chaos_to_divine, stacked_deck_chaos_cost
    )
    VALUES ('snapshot-1', 'league-1', '2026-05-01T10:00:00Z', 200, 195, 3);

    CREATE TABLE snapshot_card_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
      chaos_value REAL NOT NULL,
      divine_value REAL NOT NULL,
      confidence INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(snapshot_id, card_name, price_source)
    );

    INSERT INTO snapshot_card_prices (
      snapshot_id, card_name, price_source, chaos_value, divine_value, confidence
    )
    VALUES
      ('snapshot-1', 'The Doctor', 'exchange', 100, 0.5, 1),
      ('snapshot-1', 'The Doctor', 'stash', 90, 0.45, 3);

    CREATE TABLE session_cards (
      id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      hide_price_exchange INTEGER NOT NULL DEFAULT 0,
      hide_price_stash INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      UNIQUE(session_id, card_name)
    );

    INSERT INTO session_cards (
      id, session_id, card_name, count, hide_price_exchange,
      hide_price_stash, first_seen_at, last_seen_at
    )
    VALUES (
      1, 'session-1', 'The Doctor', 2, 1, 0,
      '2026-05-01T10:00:00Z', '2026-05-01T10:00:00Z'
    );

    CREATE TABLE session_summaries (
      session_id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      total_decks_opened INTEGER NOT NULL,
      total_exchange_value REAL NOT NULL DEFAULT 0,
      total_stash_value REAL NOT NULL DEFAULT 0,
      total_exchange_net_profit REAL NOT NULL DEFAULT 0,
      total_stash_net_profit REAL NOT NULL DEFAULT 0,
      exchange_chaos_to_divine REAL NOT NULL DEFAULT 0,
      stash_chaos_to_divine REAL NOT NULL DEFAULT 0,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO session_summaries (
      session_id, game, league, started_at, ended_at, duration_minutes,
      total_decks_opened, total_exchange_value, total_stash_value,
      total_exchange_net_profit, total_stash_net_profit,
      exchange_chaos_to_divine, stash_chaos_to_divine,
      stacked_deck_chaos_cost
    )
    VALUES (
      'session-1', 'poe1', 'Mirage', '2026-05-01T10:00:00Z',
      '2026-05-01T10:10:00Z', 10, 10, 300, 250, 270, 220, 200, 195, 3
    );
  `);
}

function createMinimalLegacySchema(db: Database.Database): void {
  createCommonTables(db);

  db.exec(`
    CREATE TABLE snapshots (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      exchange_chaos_to_divine REAL NOT NULL,
      stash_chaos_to_divine REAL NOT NULL
    );

    INSERT INTO snapshots (
      id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine
    )
    VALUES ('snapshot-1', 'league-1', '2026-05-01T10:00:00Z', 200, 195);

    CREATE TABLE session_summaries (
      session_id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      total_decks_opened INTEGER NOT NULL,
      total_exchange_value REAL NOT NULL DEFAULT 0,
      exchange_chaos_to_divine REAL NOT NULL DEFAULT 0
    );

    INSERT INTO session_summaries (
      session_id, game, league, started_at, ended_at, duration_minutes,
      total_decks_opened, total_exchange_value, exchange_chaos_to_divine
    )
    VALUES (
      'session-1', 'poe1', 'Mirage', '2026-05-01T10:00:00Z',
      '2026-05-01T10:10:00Z', 10, 10, 300, 200
    );
  `);
}

describe("remove stash pricing migration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    db.close();
  });

  it("rebuilds legacy stash tables as exchange-only tables", () => {
    createLegacyStashSchema(db);

    expect(() => migration.up(db)).not.toThrow();

    expect(getColumnNames(db, "snapshots")).toEqual(
      expect.arrayContaining([
        "id",
        "league_id",
        "fetched_at",
        "chaos_to_divine_ratio",
        "stacked_deck_chaos_cost",
        "stacked_deck_max_volume_rate",
        "created_at",
      ]),
    );
    expect(getColumnNames(db, "snapshots")).not.toContain(
      "stash_chaos_to_divine",
    );
    expect(getColumnNames(db, "snapshot_card_prices")).not.toContain(
      "price_source",
    );
    expect(getColumnNames(db, "session_cards")).not.toContain(
      "hide_price_stash",
    );
    expect(getColumnNames(db, "session_summaries")).not.toContain(
      "total_stash_value",
    );

    expect(
      db
        .prepare("SELECT chaos_to_divine_ratio FROM snapshots WHERE id = ?")
        .get("snapshot-1"),
    ).toEqual({ chaos_to_divine_ratio: 200 });
    expect(
      db
        .prepare("SELECT card_name, chaos_value FROM snapshot_card_prices")
        .all(),
    ).toEqual([{ card_name: "The Doctor", chaos_value: 100 }]);
    expect(db.prepare("SELECT hide_price FROM session_cards").get()).toEqual({
      hide_price: 1,
    });
    expect(
      db
        .prepare(
          "SELECT total_value, net_profit, chaos_to_divine_ratio FROM session_summaries",
        )
        .get(),
    ).toEqual({
      total_value: 300,
      net_profit: 270,
      chaos_to_divine_ratio: 200,
    });
  });

  it("uses defaults for target columns missing from old schemas", () => {
    createMinimalLegacySchema(db);

    expect(() => migration.up(db)).not.toThrow();

    expect(
      db
        .prepare(
          "SELECT chaos_to_divine_ratio, stacked_deck_chaos_cost, stacked_deck_max_volume_rate, created_at FROM snapshots",
        )
        .get(),
    ).toEqual({
      chaos_to_divine_ratio: 200,
      stacked_deck_chaos_cost: 0,
      stacked_deck_max_volume_rate: null,
      created_at: expect.any(String),
    });
    expect(
      db
        .prepare(
          "SELECT total_value, net_profit, chaos_to_divine_ratio, stacked_deck_chaos_cost, created_at FROM session_summaries",
        )
        .get(),
    ).toEqual({
      total_value: 300,
      net_profit: null,
      chaos_to_divine_ratio: 200,
      stacked_deck_chaos_cost: 0,
      created_at: expect.any(String),
    });
  });

  it("is safe to run again after the schema has already been rebuilt", () => {
    createLegacyStashSchema(db);

    migration.up(db);

    expect(() => migration.up(db)).not.toThrow();
    expect(
      db.prepare("SELECT COUNT(*) as count FROM snapshot_card_prices").get(),
    ).toEqual({ count: 1 });
  });
});
