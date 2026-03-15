import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../migrations";
import { migration_20260314_131100_add_csv_export_snapshots } from "../migrations/20260314_131100_add_csv_export_snapshots";

/**
 * Returns the column names for a given table.
 */
function getColumnNames(db: Database.Database, table: string): string[] {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return columns.map((c) => c.name);
}

/**
 * Returns the names of all tables in the database (excluding internal SQLite tables).
 */
function getTableNames(db: Database.Database): string[] {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return tables.map((t) => t.name);
}

/**
 * Returns the names of all indexes in the database (excluding internal SQLite indexes).
 */
function getIndexNames(db: Database.Database): string[] {
  const indexes = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return indexes.map((i) => i.name);
}

/**
 * Creates the current baseline schema (mirrors Database.service.ts initializeSchema).
 * This is what a fresh install gets before migrations run.
 */
function createBaselineSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS global_stats (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO global_stats (key, value) VALUES ('totalStackedDecksOpened', 0)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      exchange_chaos_to_divine REAL NOT NULL,
      stash_chaos_to_divine REAL NOT NULL,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot_card_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
      chaos_value REAL NOT NULL,
      divine_value REAL NOT NULL,
      stack_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      UNIQUE(snapshot_id, card_name, price_source)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      league_id TEXT NOT NULL,
      snapshot_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      total_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      hide_price_exchange INTEGER NOT NULL DEFAULT 0,
      hide_price_stash INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE(session_id, card_name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
      scope TEXT NOT NULL CHECK(scope IN ('all-time', 'league')),
      card_name TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game, scope, card_name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_summaries (
      session_id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_minutes REAL NOT NULL DEFAULT 0,
      total_decks_opened INTEGER NOT NULL DEFAULT 0,
      total_exchange_value REAL NOT NULL DEFAULT 0,
      total_stash_value REAL NOT NULL DEFAULT 0,
      total_exchange_net_profit REAL NOT NULL DEFAULT 0,
      total_stash_net_profit REAL NOT NULL DEFAULT 0,
      exchange_chaos_to_divine REAL NOT NULL DEFAULT 0,
      stash_chaos_to_divine REAL NOT NULL DEFAULT 0,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS divination_cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stack_size INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      reward_html TEXT,
      art_src TEXT,
      flavour_html TEXT,
      game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
      data_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS divination_card_rarities (
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      card_name TEXT NOT NULL,
      rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (game, league, card_name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS poe_leagues_cache (
      id TEXT NOT NULL,
      game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
      league_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_at TEXT,
      end_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT,
      fetched_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (game, league_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS poe_leagues_cache_metadata (
      game TEXT NOT NULL PRIMARY KEY CHECK (game IN ('poe1', 'poe2')),
      last_fetched_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS filter_metadata (
      id TEXT PRIMARY KEY,
      filter_type TEXT NOT NULL CHECK(filter_type IN ('local', 'online')),
      file_path TEXT NOT NULL UNIQUE,
      filter_name TEXT NOT NULL,
      last_update TEXT,
      is_fully_parsed INTEGER NOT NULL DEFAULT 0,
      parsed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS filter_card_rarities (
      filter_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (filter_id, card_name),
      FOREIGN KEY (filter_id) REFERENCES filter_metadata(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      app_exit_action TEXT NOT NULL DEFAULT 'exit' CHECK(app_exit_action IN ('exit', 'minimize')),
      app_open_at_login INTEGER NOT NULL DEFAULT 0,
      app_open_at_login_minimized INTEGER NOT NULL DEFAULT 0,
      onboarding_dismissed_beacons TEXT NOT NULL DEFAULT '[]',
      overlay_bounds TEXT,
      poe1_client_txt_path TEXT,
      poe1_selected_league TEXT NOT NULL DEFAULT 'Standard',
      poe1_price_source TEXT NOT NULL DEFAULT 'exchange' CHECK(poe1_price_source IN ('exchange', 'stash')),
      poe2_client_txt_path TEXT,
      poe2_selected_league TEXT NOT NULL DEFAULT 'Standard',
      poe2_price_source TEXT NOT NULL DEFAULT 'stash' CHECK(poe2_price_source IN ('exchange', 'stash')),
      selected_game TEXT NOT NULL DEFAULT 'poe1' CHECK(selected_game IN ('poe1', 'poe2')),
      installed_games TEXT NOT NULL DEFAULT '["poe1"]',
      setup_completed INTEGER NOT NULL DEFAULT 0,
      setup_step INTEGER NOT NULL DEFAULT 0 CHECK(setup_step >= 0 AND setup_step <= 3),
      setup_version INTEGER NOT NULL DEFAULT 1,
      audio_enabled INTEGER NOT NULL DEFAULT 1,
      audio_volume REAL NOT NULL DEFAULT 0.5,
      audio_rarity1_path TEXT,
      audio_rarity2_path TEXT,
      audio_rarity3_path TEXT,
      rarity_source TEXT NOT NULL DEFAULT 'poe.ninja' CHECK(rarity_source IN ('poe.ninja', 'filter', 'prohibited-library')),
      selected_filter_id TEXT REFERENCES filter_metadata(id) ON DELETE SET NULL,
      last_seen_app_version TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`INSERT OR IGNORE INTO user_settings (id) VALUES (1)`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("csv_export_snapshots migration (20260314_131100)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    db.close();
  });

  // ─── up() ──────────────────────────────────────────────────────────────

  describe("up()", () => {
    it("should create csv_export_snapshots table", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const tables = getTableNames(db);
      expect(tables).toContain("csv_export_snapshots");
    });

    it("should have correct columns on csv_export_snapshots", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "csv_export_snapshots");
      expect(columns).toEqual([
        "id",
        "game",
        "scope",
        "card_name",
        "count",
        "total_count",
        "exported_at",
        "integrity_status",
        "integrity_details",
        "created_at",
        "updated_at",
      ]);
    });

    it("should create index on csv_export_snapshots", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const indexes = getIndexNames(db);
      expect(indexes).toContain("idx_csv_export_snapshots_lookup");
    });

    it("should add csv_export_path column to user_settings", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).toContain("csv_export_path");
    });

    it("should enforce game CHECK constraint", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      expect(() => {
        db.prepare(
          "INSERT INTO csv_export_snapshots (game, scope, card_name, count, total_count, exported_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run("poe3", "all-time", "The Doctor", 5, 100, "2025-01-01T00:00:00Z");
      }).toThrow();
    });

    it("should enforce integrity_status CHECK constraint", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      expect(() => {
        db.prepare(
          "INSERT INTO csv_export_snapshots (game, scope, card_name, count, total_count, exported_at, integrity_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run("poe1", "all-time", "The Doctor", 5, 100, "2025-01-01T00:00:00Z", "invalid");
      }).toThrow();
    });

    it("should allow NULL integrity_status", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      expect(() => {
        db.prepare(
          "INSERT INTO csv_export_snapshots (game, scope, card_name, count, total_count, exported_at, integrity_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run("poe1", "all-time", "The Doctor", 5, 100, "2025-01-01T00:00:00Z", null);
      }).not.toThrow();
    });

    it("should enforce UNIQUE(game, scope, card_name)", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      db.prepare(
        "INSERT INTO csv_export_snapshots (game, scope, card_name, count, total_count, exported_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("poe1", "all-time", "The Doctor", 5, 100, "2025-01-01T00:00:00Z");

      expect(() => {
        db.prepare(
          "INSERT INTO csv_export_snapshots (game, scope, card_name, count, total_count, exported_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run("poe1", "all-time", "The Doctor", 10, 200, "2025-01-02T00:00:00Z");
      }).toThrow();
    });

    it("should allow inserting and reading back data", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      db.prepare(
        "INSERT INTO csv_export_snapshots (game, scope, card_name, count, total_count, exported_at, integrity_status, integrity_details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run("poe1", "all-time", "The Doctor", 5, 100, "2025-01-01T00:00:00Z", "pass", '{"check":"ok"}');

      const row = db
        .prepare("SELECT * FROM csv_export_snapshots WHERE card_name = ?")
        .get("The Doctor") as Record<string, unknown>;

      expect(row.game).toBe("poe1");
      expect(row.scope).toBe("all-time");
      expect(row.card_name).toBe("The Doctor");
      expect(row.count).toBe(5);
      expect(row.total_count).toBe(100);
      expect(row.exported_at).toBe("2025-01-01T00:00:00Z");
      expect(row.integrity_status).toBe("pass");
      expect(row.integrity_details).toBe('{"check":"ok"}');
      expect(row.id).toBeDefined();
      expect(row.created_at).toBeDefined();
      expect(row.updated_at).toBeDefined();
    });
  });

  // ─── down() ────────────────────────────────────────────────────────────

  describe("down()", () => {
    it("should drop csv_export_snapshots table", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      const beforeTables = getTableNames(db);
      expect(beforeTables).toContain("csv_export_snapshots");

      migration_20260314_131100_add_csv_export_snapshots.down(db);

      const afterTables = getTableNames(db);
      expect(afterTables).not.toContain("csv_export_snapshots");
    });

    it("should drop the index", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      const beforeIndexes = getIndexNames(db);
      expect(beforeIndexes).toContain("idx_csv_export_snapshots_lookup");

      migration_20260314_131100_add_csv_export_snapshots.down(db);

      const afterIndexes = getIndexNames(db);
      expect(afterIndexes).not.toContain("idx_csv_export_snapshots_lookup");
    });

    it("should remove csv_export_path from user_settings", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      const beforeColumns = getColumnNames(db, "user_settings");
      expect(beforeColumns).toContain("csv_export_path");

      migration_20260314_131100_add_csv_export_snapshots.down(db);

      const afterColumns = getColumnNames(db, "user_settings");
      expect(afterColumns).not.toContain("csv_export_path");
    });

    it("should preserve other user_settings data after rollback", () => {
      createBaselineSchema(db);

      db.prepare(
        "UPDATE user_settings SET selected_game = ?, poe1_selected_league = ? WHERE id = 1",
      ).run("poe2", "Settlers");

      migration_20260314_131100_add_csv_export_snapshots.up(db);
      migration_20260314_131100_add_csv_export_snapshots.down(db);

      const row = db
        .prepare(
          "SELECT selected_game, poe1_selected_league FROM user_settings WHERE id = 1",
        )
        .get() as { selected_game: string; poe1_selected_league: string };

      expect(row.selected_game).toBe("poe2");
      expect(row.poe1_selected_league).toBe("Settlers");
    });
  });

  // ─── Idempotency ──────────────────────────────────────────────────────

  describe("idempotency", () => {
    it("should not throw when table already exists", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      expect(() => {
        migration_20260314_131100_add_csv_export_snapshots.up(db);
      }).not.toThrow();
    });

    it("should not throw when csv_export_path column already exists", () => {
      createBaselineSchema(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).toContain("csv_export_path");

      // Running up() again should not throw even though the column exists
      expect(() => {
        migration_20260314_131100_add_csv_export_snapshots.up(db);
      }).not.toThrow();

      const afterColumns = getColumnNames(db, "user_settings");
      expect(afterColumns).toContain("csv_export_path");
    });

    it("should handle down() when table does not exist", () => {
      createBaselineSchema(db);

      // down() without prior up() should not throw
      expect(() => {
        migration_20260314_131100_add_csv_export_snapshots.down(db);
      }).not.toThrow();
    });

    it("should allow re-applying migration after rollback", () => {
      createBaselineSchema(db);

      migration_20260314_131100_add_csv_export_snapshots.up(db);
      migration_20260314_131100_add_csv_export_snapshots.down(db);
      migration_20260314_131100_add_csv_export_snapshots.up(db);

      const tables = getTableNames(db);
      expect(tables).toContain("csv_export_snapshots");

      const columns = getColumnNames(db, "user_settings");
      expect(columns).toContain("csv_export_path");

      const indexes = getIndexNames(db);
      expect(indexes).toContain("idx_csv_export_snapshots_lookup");
    });
  });

  // ─── Round-trip ────────────────────────────────────────────────────────

  describe("round-trip", () => {
    it("should allow applying, rolling back, and re-applying", () => {
      createBaselineSchema(db);

      // First apply
      migration_20260314_131100_add_csv_export_snapshots.up(db);
      expect(getTableNames(db)).toContain("csv_export_snapshots");
      expect(getColumnNames(db, "user_settings")).toContain("csv_export_path");

      // Roll back
      migration_20260314_131100_add_csv_export_snapshots.down(db);
      expect(getTableNames(db)).not.toContain("csv_export_snapshots");
      expect(getColumnNames(db, "user_settings")).not.toContain("csv_export_path");

      // Re-apply
      migration_20260314_131100_add_csv_export_snapshots.up(db);
      expect(getTableNames(db)).toContain("csv_export_snapshots");
      expect(getColumnNames(db, "user_settings")).toContain("csv_export_path");
      expect(getIndexNames(db)).toContain("idx_csv_export_snapshots_lookup");

      // Verify we can still insert data after round-trip
      expect(() => {
        db.prepare(
          "INSERT INTO csv_export_snapshots (game, scope, card_name, count, total_count, exported_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run("poe2", "league", "House of Mirrors", 2, 50, "2025-03-14T12:00:00Z");
      }).not.toThrow();

      const row = db
        .prepare("SELECT * FROM csv_export_snapshots WHERE card_name = ?")
        .get("House of Mirrors") as Record<string, unknown>;

      expect(row.game).toBe("poe2");
      expect(row.scope).toBe("league");
      expect(row.count).toBe(2);
      expect(row.total_count).toBe(50);
    });
  });

  // ─── Integration with MigrationRunner ──────────────────────────────────

  describe("integration with MigrationRunner", () => {
    it("should apply via MigrationRunner", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const tables = getTableNames(db);
      expect(tables).toContain("csv_export_snapshots");

      const columns = getColumnNames(db, "csv_export_snapshots");
      expect(columns).toEqual([
        "id",
        "game",
        "scope",
        "card_name",
        "count",
        "total_count",
        "exported_at",
        "integrity_status",
        "integrity_details",
        "created_at",
        "updated_at",
      ]);

      const indexes = getIndexNames(db);
      expect(indexes).toContain("idx_csv_export_snapshots_lookup");

      const settingsColumns = getColumnNames(db, "user_settings");
      expect(settingsColumns).toContain("csv_export_path");
    });

    it("should be recorded as applied", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const applied = db
        .prepare("SELECT id FROM migrations ORDER BY id ASC")
        .all() as { id: string }[];
      const appliedIds = applied.map((r) => r.id);

      expect(appliedIds).toContain("20260314_131100_add_csv_export_snapshots");
    });

    it("should be idempotent via MigrationRunner", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations(migrations)).not.toThrow();
      expect(() => runner.runMigrations(migrations)).not.toThrow();

      const applied = db
        .prepare("SELECT id FROM migrations WHERE id = ?")
        .all("20260314_131100_add_csv_export_snapshots") as { id: string }[];

      expect(applied).toHaveLength(1);
    });
  });
});
