import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../migrations";

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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`INSERT OR IGNORE INTO user_settings (id) VALUES (1)`);
}

/**
 * Creates the pre-audio baseline schema (what users on older versions have).
 * This is the same as createBaselineSchema but WITHOUT the audio columns
 * in user_settings, simulating a database from before the audio feature.
 */
function createPreAudioSchema(db: Database.Database): void {
  // Create all tables normally first
  createBaselineSchema(db);

  // Recreate user_settings WITHOUT audio columns to simulate an older version
  db.exec(`DROP TABLE user_settings`);
  db.exec(`
    CREATE TABLE user_settings (
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`INSERT OR IGNORE INTO user_settings (id) VALUES (1)`);
}

// ─── Expected final state ────────────────────────────────────────────────────

const EXPECTED_AUDIO_COLUMNS = [
  "audio_enabled",
  "audio_volume",
  "audio_rarity1_path",
  "audio_rarity2_path",
  "audio_rarity3_path",
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Migrations Integration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    db.close();
  });

  // ─── Fresh Install ───────────────────────────────────────────────────────

  describe("fresh install (baseline schema + migrations)", () => {
    it("should run all migrations without errors on a fresh database", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations(migrations)).not.toThrow();
    });

    it("should have all audio columns after migrations", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(columns).toContain(col);
      }
    });

    it("should record all migrations as applied", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const applied = runner.listAppliedMigrations();
      expect(applied).toHaveLength(migrations.length);

      for (const migration of migrations) {
        expect(applied.some((a) => a.includes(migration.id))).toBe(true);
      }
    });

    it("should be idempotent — running migrations twice does not throw", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);

      runner.runMigrations(migrations);
      expect(() => runner.runMigrations(migrations)).not.toThrow();

      const applied = runner.listAppliedMigrations();
      expect(applied).toHaveLength(migrations.length);
    });

    it("should preserve existing user settings data", () => {
      createBaselineSchema(db);

      // Simulate a user who has already configured settings
      db.prepare(
        "UPDATE user_settings SET app_exit_action = 'minimize', selected_game = 'poe1' WHERE id = 1",
      ).run();

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT app_exit_action, selected_game FROM user_settings WHERE id = 1",
        )
        .get() as { app_exit_action: string; selected_game: string };

      expect(row.app_exit_action).toBe("minimize");
      expect(row.selected_game).toBe("poe1");
    });
  });

  // ─── Upgrade from Previous Version ─────────────────────────────────────

  describe("upgrade (pre-audio schema + migrations)", () => {
    it("should run all migrations without errors on an older database", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations(migrations)).not.toThrow();
    });

    it("should add all audio columns to user_settings", () => {
      createPreAudioSchema(db);

      // Verify columns don't exist yet
      const before = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(before).not.toContain(col);
      }

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify columns now exist
      const after = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(after).toContain(col);
      }
    });

    it("should set correct default values for new audio columns", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT audio_enabled, audio_volume, audio_rarity1_path, audio_rarity2_path, audio_rarity3_path FROM user_settings WHERE id = 1",
        )
        .get() as {
        audio_enabled: number;
        audio_volume: number;
        audio_rarity1_path: string | null;
        audio_rarity2_path: string | null;
        audio_rarity3_path: string | null;
      };

      expect(row.audio_enabled).toBe(1);
      expect(row.audio_volume).toBe(0.5);
      expect(row.audio_rarity1_path).toBeNull();
      expect(row.audio_rarity2_path).toBeNull();
      expect(row.audio_rarity3_path).toBeNull();
    });

    it("should preserve existing user settings during upgrade", () => {
      createPreAudioSchema(db);

      db.prepare(
        "UPDATE user_settings SET app_exit_action = 'minimize', poe1_selected_league = 'Settlers' WHERE id = 1",
      ).run();

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT app_exit_action, poe1_selected_league, audio_enabled FROM user_settings WHERE id = 1",
        )
        .get() as {
        app_exit_action: string;
        poe1_selected_league: string;
        audio_enabled: number;
      };

      expect(row.app_exit_action).toBe("minimize");
      expect(row.poe1_selected_league).toBe("Settlers");
      expect(row.audio_enabled).toBe(1);
    });
  });

  // ─── Rollback ──────────────────────────────────────────────────────────

  describe("rollback", () => {
    it("should successfully roll back all migrations", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      for (const migration of [...migrations].reverse()) {
        expect(() => runner.rollbackMigration(migration)).not.toThrow();
      }

      // Audio columns should be gone
      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(columns).not.toContain(col);
      }
    });

    it("should allow re-applying migrations after rollback", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);

      // Apply
      runner.runMigrations(migrations);

      // Rollback all
      for (const migration of [...migrations].reverse()) {
        runner.rollbackMigration(migration);
      }

      // Re-apply
      expect(() => runner.runMigrations(migrations)).not.toThrow();

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(columns).toContain(col);
      }
    });
  });

  // ─── Schema Consistency ────────────────────────────────────────────────

  describe("schema consistency", () => {
    it("should produce the same user_settings columns whether fresh install or upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "user_settings").sort();
      freshDb.close();

      // Upgrade
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "user_settings").sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });
  });
});
