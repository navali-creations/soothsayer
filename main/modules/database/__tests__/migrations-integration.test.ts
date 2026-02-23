import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../migrations";
import { migration_20260213_204200_add_filter_tables_and_rarity_source } from "../migrations/20260213_204200_add_filter_tables_and_rarity_source";
import { migration_20260221_201500_add_prohibited_library } from "../migrations/20260221_201500_add_prohibited_library";
import { migration_20260223_010100_add_last_seen_app_version } from "../migrations/20260223_010100_add_last_seen_app_version";

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

  // Also drop filter tables since they didn't exist before either
  db.exec(`DROP TABLE IF EXISTS filter_card_rarities`);
  db.exec(`DROP TABLE IF EXISTS filter_metadata`);
}

/**
 * Creates the pre-filter baseline schema (what users who have audio but not filter support have).
 * Has audio columns in user_settings but NO filter tables and NO rarity_source/selected_filter_id columns.
 */
function createPreFilterSchema(db: Database.Database): void {
  // Create all tables normally first
  createBaselineSchema(db);

  // Drop filter tables to simulate a user who doesn't have them yet
  db.exec(`DROP TABLE IF EXISTS filter_card_rarities`);
  db.exec(`DROP TABLE IF EXISTS filter_metadata`);

  // Recreate user_settings WITH audio columns but WITHOUT filter columns
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

// ─── Expected final state ────────────────────────────────────────────────────

const EXPECTED_AUDIO_COLUMNS = [
  "audio_enabled",
  "audio_volume",
  "audio_rarity1_path",
  "audio_rarity2_path",
  "audio_rarity3_path",
];

const EXPECTED_FILTER_SETTINGS_COLUMNS = [
  "rarity_source",
  "selected_filter_id",
];

const EXPECTED_FILTER_TABLES = ["filter_metadata", "filter_card_rarities"];

const EXPECTED_LAST_SEEN_APP_VERSION_COLUMNS = ["last_seen_app_version"];

const EXPECTED_PROHIBITED_LIBRARY_TABLES = [
  "prohibited_library_card_weights",
  "prohibited_library_cache_metadata",
];

const EXPECTED_PL_CARD_WEIGHTS_COLUMNS = [
  "card_name",
  "game",
  "league",
  "weight",
  "rarity",
  "from_boss",
  "loaded_at",
  "created_at",
  "updated_at",
];

const EXPECTED_PL_CACHE_METADATA_COLUMNS = [
  "game",
  "league",
  "loaded_at",
  "app_version",
  "card_count",
  "created_at",
  "updated_at",
];

const EXPECTED_FILTER_METADATA_COLUMNS = [
  "id",
  "filter_type",
  "file_path",
  "filter_name",
  "last_update",
  "is_fully_parsed",
  "parsed_at",
  "created_at",
  "updated_at",
];

const EXPECTED_FILTER_CARD_RARITIES_COLUMNS = [
  "filter_id",
  "card_name",
  "rarity",
  "created_at",
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

    it("should have all filter settings columns after migrations", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).toContain(col);
      }
    });

    it("should have filter_metadata and filter_card_rarities tables after migrations", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const tables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(tables).toContain(table);
      }
    });

    it("should have correct columns in filter_metadata table", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "filter_metadata");
      expect(columns.sort()).toEqual(EXPECTED_FILTER_METADATA_COLUMNS.sort());
    });

    it("should have correct columns in filter_card_rarities table", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "filter_card_rarities");
      expect(columns.sort()).toEqual(
        EXPECTED_FILTER_CARD_RARITIES_COLUMNS.sort(),
      );
    });

    it("should have prohibited_library tables after migrations", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const tables = getTableNames(db);
      for (const table of EXPECTED_PROHIBITED_LIBRARY_TABLES) {
        expect(tables).toContain(table);
      }
    });

    it("should have correct columns in prohibited_library_card_weights table", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "prohibited_library_card_weights");
      expect(columns).toEqual(EXPECTED_PL_CARD_WEIGHTS_COLUMNS);
    });

    it("should have correct columns in prohibited_library_cache_metadata table", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "prohibited_library_cache_metadata");
      expect(columns).toEqual(EXPECTED_PL_CACHE_METADATA_COLUMNS);
    });

    it("should have from_boss column on divination_cards after migrations", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "divination_cards");
      expect(columns).toContain("from_boss");
    });

    it("should have last_seen_app_version column on user_settings after migrations", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_LAST_SEEN_APP_VERSION_COLUMNS) {
        expect(columns).toContain(col);
      }
    });

    it("should default last_seen_app_version to NULL on fresh install", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
        .get() as { last_seen_app_version: string | null };

      expect(row.last_seen_app_version).toBeNull();
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

    it("should store and retrieve last_seen_app_version after migration", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      db.prepare(
        "UPDATE user_settings SET last_seen_app_version = ? WHERE id = 1",
      ).run("0.5.0");

      const row = db
        .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
        .get() as { last_seen_app_version: string | null };

      expect(row.last_seen_app_version).toBe("0.5.0");
    });
  });

  // ─── Upgrade from Pre-Audio Version ────────────────────────────────────

  describe("upgrade (pre-audio schema + migrations)", () => {
    it("should run all migrations without errors on an older database", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations(migrations)).not.toThrow();
    });

    it("should have last_seen_app_version column after upgrade from pre-audio", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).toContain("last_seen_app_version");
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

    it("should also add filter tables and columns during pre-audio upgrade", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Filter tables should exist
      const tables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(tables).toContain(table);
      }

      // Filter settings columns should exist
      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).toContain(col);
      }
    });

    it("should default last_seen_app_version to NULL after pre-audio upgrade", () => {
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
        .get() as { last_seen_app_version: string | null };

      expect(row.last_seen_app_version).toBeNull();
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

  // ─── Upgrade from Pre-Filter Version (has audio, no filters) ───────────

  describe("upgrade (pre-filter schema + filter migration)", () => {
    it("should have last_seen_app_version column after upgrade from pre-filter", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).toContain("last_seen_app_version");
    });

    it("should run all migrations without errors on a pre-filter database", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations(migrations)).not.toThrow();
    });

    it("should create filter_metadata table", () => {
      createPreFilterSchema(db);

      // Verify table doesn't exist yet
      const beforeTables = getTableNames(db);
      expect(beforeTables).not.toContain("filter_metadata");

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify table now exists with correct columns
      const afterTables = getTableNames(db);
      expect(afterTables).toContain("filter_metadata");

      const columns = getColumnNames(db, "filter_metadata");
      expect(columns.sort()).toEqual(EXPECTED_FILTER_METADATA_COLUMNS.sort());
    });

    it("should create filter_card_rarities table", () => {
      createPreFilterSchema(db);

      // Verify table doesn't exist yet
      const beforeTables = getTableNames(db);
      expect(beforeTables).not.toContain("filter_card_rarities");

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify table now exists with correct columns
      const afterTables = getTableNames(db);
      expect(afterTables).toContain("filter_card_rarities");

      const columns = getColumnNames(db, "filter_card_rarities");
      expect(columns.sort()).toEqual(
        EXPECTED_FILTER_CARD_RARITIES_COLUMNS.sort(),
      );
    });

    it("should add rarity_source and selected_filter_id columns to user_settings", () => {
      createPreFilterSchema(db);

      // Verify columns don't exist yet
      const before = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(before).not.toContain(col);
      }

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify columns now exist
      const after = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(after).toContain(col);
      }
    });

    it("should set correct default values for rarity_source and selected_filter_id", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT rarity_source, selected_filter_id FROM user_settings WHERE id = 1",
        )
        .get() as {
        rarity_source: string;
        selected_filter_id: string | null;
      };

      expect(row.rarity_source).toBe("poe.ninja");
      expect(row.selected_filter_id).toBeNull();
    });

    it("should preserve existing user settings during filter upgrade", () => {
      createPreFilterSchema(db);

      db.prepare(
        "UPDATE user_settings SET app_exit_action = 'minimize', audio_volume = 0.8, poe1_selected_league = 'Keepers' WHERE id = 1",
      ).run();

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT app_exit_action, audio_volume, poe1_selected_league, rarity_source FROM user_settings WHERE id = 1",
        )
        .get() as {
        app_exit_action: string;
        audio_volume: number;
        poe1_selected_league: string;
        rarity_source: string;
      };

      expect(row.app_exit_action).toBe("minimize");
      expect(row.audio_volume).toBe(0.8);
      expect(row.poe1_selected_league).toBe("Keepers");
      expect(row.rarity_source).toBe("poe.ninja");
    });

    it("should enforce rarity_source CHECK constraint", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid values should work
      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'filter' WHERE id = 1",
          )
          .run(),
      ).not.toThrow();

      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'prohibited-library' WHERE id = 1",
          )
          .run(),
      ).not.toThrow();

      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'poe.ninja' WHERE id = 1",
          )
          .run(),
      ).not.toThrow();

      // Invalid value should throw
      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'invalid' WHERE id = 1",
          )
          .run(),
      ).toThrow();
    });

    it("should enforce filter_metadata CHECK constraints", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid filter_type values
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/to/filter.filter', 'Test Filter')",
          )
          .run(),
      ).not.toThrow();

      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f2', 'online', '/path/to/online-filter', 'Online Filter')",
          )
          .run(),
      ).not.toThrow();

      // Invalid filter_type should throw
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f3', 'custom', '/path/to/custom', 'Custom')",
          )
          .run(),
      ).toThrow();
    });

    it("should enforce filter_card_rarities rarity CHECK constraint", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Insert a filter first
      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Test')",
      ).run();

      // Valid rarity values (1-4)
      for (let rarity = 1; rarity <= 4; rarity++) {
        expect(() =>
          db
            .prepare(
              `INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Card ${rarity}', ${rarity})`,
            )
            .run(),
        ).not.toThrow();
      }

      // Invalid rarity values
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Bad Card 0', 0)",
          )
          .run(),
      ).toThrow();

      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Bad Card 5', 5)",
          )
          .run(),
      ).toThrow();
    });

    it("should cascade delete filter_card_rarities when filter_metadata is deleted", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Insert a filter and some card rarities
      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Test')",
      ).run();
      db.prepare(
        "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'The Doctor', 1)",
      ).run();
      db.prepare(
        "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Rain of Chaos', 4)",
      ).run();

      // Verify rarities exist
      const before = db
        .prepare(
          "SELECT COUNT(*) as count FROM filter_card_rarities WHERE filter_id = 'f1'",
        )
        .get() as { count: number };
      expect(before.count).toBe(2);

      // Delete the filter
      db.prepare("DELETE FROM filter_metadata WHERE id = 'f1'").run();

      // Rarities should be cascade deleted
      const after = db
        .prepare(
          "SELECT COUNT(*) as count FROM filter_card_rarities WHERE filter_id = 'f1'",
        )
        .get() as { count: number };
      expect(after.count).toBe(0);
    });

    it("should set selected_filter_id to NULL when referenced filter is deleted", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Insert a filter
      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Test')",
      ).run();

      // Set it as the selected filter
      db.prepare(
        "UPDATE user_settings SET selected_filter_id = 'f1', rarity_source = 'filter' WHERE id = 1",
      ).run();

      // Verify it's set
      const before = db
        .prepare("SELECT selected_filter_id FROM user_settings WHERE id = 1")
        .get() as { selected_filter_id: string | null };
      expect(before.selected_filter_id).toBe("f1");

      // Delete the filter
      db.prepare("DELETE FROM filter_metadata WHERE id = 'f1'").run();

      // selected_filter_id should be NULL (ON DELETE SET NULL)
      const after = db
        .prepare("SELECT selected_filter_id FROM user_settings WHERE id = 1")
        .get() as { selected_filter_id: string | null };
      expect(after.selected_filter_id).toBeNull();
    });

    it("should enforce unique file_path in filter_metadata", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Filter 1')",
      ).run();

      // Same file_path with different id should throw
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f2', 'local', '/path/filter.filter', 'Filter 2')",
          )
          .run(),
      ).toThrow();
    });
  });

  // ─── Rollback ──────────────────────────────────────────────────────────

  describe("rollback", () => {
    it("should successfully roll back prohibited library migration", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify tables exist before rollback
      const beforeTables = getTableNames(db);
      expect(beforeTables).toContain("prohibited_library_card_weights");
      expect(beforeTables).toContain("prohibited_library_cache_metadata");
      const beforeColumns = getColumnNames(db, "divination_cards");
      expect(beforeColumns).toContain("from_boss");

      // Find and rollback the prohibited library migration
      const plMigration = migrations.find((m) =>
        m.id.includes("add_prohibited_library"),
      )!;
      expect(() => runner.rollbackMigration(plMigration)).not.toThrow();

      // Verify tables are removed
      const afterTables = getTableNames(db);
      expect(afterTables).not.toContain("prohibited_library_card_weights");
      expect(afterTables).not.toContain("prohibited_library_cache_metadata");

      // Verify from_boss column is removed from divination_cards
      const afterColumns = getColumnNames(db, "divination_cards");
      expect(afterColumns).not.toContain("from_boss");
    });

    it("should allow re-applying prohibited library migration after rollback", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const plMigration = migrations.find((m) =>
        m.id.includes("add_prohibited_library"),
      )!;
      runner.rollbackMigration(plMigration);

      // Re-apply
      expect(() => runner.runMigrations([plMigration])).not.toThrow();

      const tables = getTableNames(db);
      expect(tables).toContain("prohibited_library_card_weights");
      expect(tables).toContain("prohibited_library_cache_metadata");

      const columns = getColumnNames(db, "divination_cards");
      expect(columns).toContain("from_boss");
    });

    it("should successfully roll back all migrations", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      for (const m of [...migrations].reverse()) {
        expect(() => runner.rollbackMigration(m)).not.toThrow();
      }

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(columns).not.toContain(col);
      }
    });

    it("should remove filter tables on rollback", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify tables exist after migration
      const beforeTables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(beforeTables).toContain(table);
      }

      // Rollback the filter migration (second migration)
      const filterMigration = migrations.find((m) =>
        m.id.includes("add_filter_tables"),
      );
      expect(filterMigration).toBeDefined();
      runner.rollbackMigration(filterMigration!);

      // Filter tables should be gone
      const afterTables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(afterTables).not.toContain(table);
      }

      // Filter settings columns should be gone
      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
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
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).toContain(col);
      }

      const tables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(tables).toContain(table);
      }
    });

    it("should allow re-applying filter migration after rollback", () => {
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);

      // Apply
      runner.runMigrations(migrations);

      // Rollback filter migration only
      const filterMigration = migrations.find((m) =>
        m.id.includes("add_filter_tables"),
      );
      expect(filterMigration).toBeDefined();
      runner.rollbackMigration(filterMigration!);

      // Re-apply
      expect(() => runner.runMigrations(migrations)).not.toThrow();

      const tables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(tables).toContain(table);
      }

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).toContain(col);
      }
    });
  });

  // ─── Schema Consistency ────────────────────────────────────────────────

  // ─── Prohibited Library-specific tests ─────────────────────────────

  describe("prohibited library migration", () => {
    it("should enforce rarity CHECK constraint on prohibited_library_card_weights", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid rarity (0-4) should work
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('The Doctor', 'poe1', 'Keepers', 100, 1, 0, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).not.toThrow();

      // Rarity 0 (unknown) should work
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('House of Mirrors', 'poe1', 'Keepers', 50, 0, 0, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).not.toThrow();

      // Rarity -1 should fail
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('The Apothecary', 'poe1', 'Keepers', 50, -1, 0, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).toThrow();

      // Rarity 5 should fail
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('Rain of Chaos', 'poe1', 'Keepers', 5000, 5, 0, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).toThrow();
    });

    it("should enforce game CHECK constraint on prohibited_library_card_weights", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('The Doctor', 'poe3', 'Keepers', 100, 1, 0, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).toThrow();
    });

    it("should enforce from_boss CHECK constraint on prohibited_library_card_weights", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid: 0 and 1
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('The Doctor', 'poe1', 'Keepers', 100, 1, 1, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).not.toThrow();

      // Invalid: 2
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('House of Mirrors', 'poe1', 'Keepers', 50, 1, 2, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).toThrow();
    });

    it("should enforce primary key (card_name, game, league) on prohibited_library_card_weights", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      db.prepare(
        `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
         VALUES ('The Doctor', 'poe1', 'Keepers', 100, 1, 0, '2026-02-21T00:00:00Z')`,
      ).run();

      // Same card, same game, same league → should fail
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('The Doctor', 'poe1', 'Keepers', 200, 2, 0, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).toThrow();

      // Same card, same game, different league → should succeed
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_card_weights (card_name, game, league, weight, rarity, from_boss, loaded_at)
             VALUES ('The Doctor', 'poe1', 'Dawn', 150, 1, 0, '2026-02-21T00:00:00Z')`,
          )
          .run(),
      ).not.toThrow();
    });

    it("should enforce game CHECK constraint on prohibited_library_cache_metadata", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_cache_metadata (game, league, loaded_at, app_version, card_count)
             VALUES ('poe1', 'Keepers', '2026-02-21T00:00:00Z', '1.0.0', 100)`,
          )
          .run(),
      ).not.toThrow();

      // Invalid game
      expect(() =>
        db
          .prepare(
            `INSERT INTO prohibited_library_cache_metadata (game, league, loaded_at, app_version, card_count)
             VALUES ('poe3', 'Keepers', '2026-02-21T00:00:00Z', '1.0.0', 100)`,
          )
          .run(),
      ).toThrow();
    });

    it("should enforce from_boss CHECK constraint on divination_cards", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid: 0
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, from_boss)
             VALUES ('poe1_the-doctor', 'The Doctor', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash1', 0)`,
          )
          .run(),
      ).not.toThrow();

      // Valid: 1
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, from_boss)
             VALUES ('poe1_house-of-mirrors', 'House of Mirrors', 2, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash2', 1)`,
          )
          .run(),
      ).not.toThrow();

      // Invalid: 2
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, from_boss)
             VALUES ('poe1_rain-of-chaos', 'Rain of Chaos', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash3', 2)`,
          )
          .run(),
      ).toThrow();
    });

    it("should default from_boss to 0 on divination_cards", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      db.prepare(
        `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash)
         VALUES ('poe1_the-doctor', 'The Doctor', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash1')`,
      ).run();

      const row = db
        .prepare(
          "SELECT from_boss FROM divination_cards WHERE id = 'poe1_the-doctor'",
        )
        .get() as { from_boss: number };
      expect(row.from_boss).toBe(0);
    });

    it("should preserve existing divination_cards data when adding from_boss", () => {
      createBaselineSchema(db);

      // Insert a card BEFORE the prohibited library migration runs
      // First run all migrations except the last one
      const prePLMigrations = migrations.filter(
        (m) => !m.id.includes("add_prohibited_library"),
      );
      const runner = new MigrationRunner(db);
      runner.runMigrations(prePLMigrations);

      db.prepare(
        `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash)
         VALUES ('poe1_the-doctor', 'The Doctor', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash1')`,
      ).run();

      // Now run the prohibited library migration
      const plMigration = migrations.find((m) =>
        m.id.includes("add_prohibited_library"),
      )!;
      runner.runMigrations([plMigration]);

      // Card should still exist with from_boss defaulted to 0
      const row = db
        .prepare(
          "SELECT id, name, stack_size, from_boss FROM divination_cards WHERE id = 'poe1_the-doctor'",
        )
        .get() as {
        id: string;
        name: string;
        stack_size: number;
        from_boss: number;
      };
      expect(row.id).toBe("poe1_the-doctor");
      expect(row.name).toBe("The Doctor");
      expect(row.stack_size).toBe(8);
      expect(row.from_boss).toBe(0);
    });
  });

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

      // Upgrade from pre-audio
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "user_settings").sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should produce the same user_settings columns whether fresh install or pre-filter upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "user_settings").sort();
      freshDb.close();

      // Upgrade from pre-filter
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreFilterSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "user_settings").sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should produce the same filter_metadata columns whether fresh install or pre-filter upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "filter_metadata").sort();
      freshDb.close();

      // Upgrade from pre-filter
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreFilterSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(
        upgradeDb,
        "filter_metadata",
      ).sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should produce the same filter_card_rarities columns whether fresh install or pre-filter upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(
        freshDb,
        "filter_card_rarities",
      ).sort();
      freshDb.close();

      // Upgrade from pre-filter
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreFilterSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(
        upgradeDb,
        "filter_card_rarities",
      ).sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should have the same tables whether fresh install or full upgrade path", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshTables = getTableNames(freshDb).sort();
      freshDb.close();

      // Upgrade from pre-audio (oldest upgrade path)
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeTables = getTableNames(upgradeDb).sort();
      upgradeDb.close();

      expect(freshTables).toEqual(upgradeTables);
    });

    it("should have prohibited_library tables in both fresh and upgrade paths", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshTables = getTableNames(freshDb);
      freshDb.close();

      // Upgrade from pre-audio
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeTables = getTableNames(upgradeDb);
      upgradeDb.close();

      for (const table of EXPECTED_PROHIBITED_LIBRARY_TABLES) {
        expect(freshTables).toContain(table);
        expect(upgradeTables).toContain(table);
      }
    });

    it("should produce the same prohibited_library_card_weights columns whether fresh or upgrade", () => {
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(
        freshDb,
        "prohibited_library_card_weights",
      );
      freshDb.close();

      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(
        upgradeDb,
        "prohibited_library_card_weights",
      );
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should produce the same prohibited_library_cache_metadata columns whether fresh or upgrade", () => {
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(
        freshDb,
        "prohibited_library_cache_metadata",
      );
      freshDb.close();

      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(
        upgradeDb,
        "prohibited_library_cache_metadata",
      );
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should have last_seen_app_version on user_settings in both fresh and upgrade paths", () => {
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "user_settings");
      freshDb.close();

      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "user_settings");
      upgradeDb.close();

      expect(freshColumns).toContain("last_seen_app_version");
      expect(upgradeColumns).toContain("last_seen_app_version");
    });

    it("should have from_boss on divination_cards in both fresh and upgrade paths", () => {
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "divination_cards");
      freshDb.close();

      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "divination_cards");
      upgradeDb.close();

      expect(freshColumns).toContain("from_boss");
      expect(upgradeColumns).toContain("from_boss");
    });
  });

  // ─── Idempotency / edge-case branches ──────────────────────────────────

  describe("filter migration idempotency", () => {
    it("should handle down() when selected_filter_id column does not exist", () => {
      createBaselineSchema(db);

      // Remove selected_filter_id from user_settings to simulate partial state
      db.exec(`
        ALTER TABLE user_settings DROP COLUMN selected_filter_id
      `);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).not.toContain("selected_filter_id");
      expect(columns).toContain("rarity_source");

      // down() should not throw even though selected_filter_id is absent
      expect(() =>
        migration_20260213_204200_add_filter_tables_and_rarity_source.down(db),
      ).not.toThrow();

      const afterColumns = getColumnNames(db, "user_settings");
      expect(afterColumns).not.toContain("selected_filter_id");
      expect(afterColumns).not.toContain("rarity_source");
    });

    it("should handle down() when rarity_source column does not exist", () => {
      createBaselineSchema(db);

      // Remove both filter-related columns to simulate pre-filter state
      db.exec(`
        ALTER TABLE user_settings DROP COLUMN selected_filter_id
      `);
      db.exec(`
        ALTER TABLE user_settings DROP COLUMN rarity_source
      `);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).not.toContain("rarity_source");
      expect(columns).not.toContain("selected_filter_id");

      // down() should not throw even though both columns are absent
      expect(() =>
        migration_20260213_204200_add_filter_tables_and_rarity_source.down(db),
      ).not.toThrow();
    });
  });

  describe("last_seen_app_version migration idempotency", () => {
    it("should skip adding last_seen_app_version when column already exists", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);

      // Run all migrations so last_seen_app_version is already present
      runner.runMigrations(migrations);

      const before = getColumnNames(db, "user_settings");
      expect(before).toContain("last_seen_app_version");

      // Calling up() again directly should not throw (idempotent)
      expect(() =>
        migration_20260223_010100_add_last_seen_app_version.up(db),
      ).not.toThrow();

      // last_seen_app_version should still be there exactly once
      const after = getColumnNames(db, "user_settings");
      const count = after.filter((c) => c === "last_seen_app_version").length;
      expect(count).toBe(1);
    });

    it("should handle down() when last_seen_app_version column does not exist", () => {
      createBaselineSchema(db);

      // Remove the column to simulate a state where migration was never applied
      // (baseline already has it, so drop it first)
      db.exec(`ALTER TABLE user_settings DROP COLUMN last_seen_app_version`);

      const before = getColumnNames(db, "user_settings");
      expect(before).not.toContain("last_seen_app_version");

      // down() should not throw even though column is absent
      expect(() =>
        migration_20260223_010100_add_last_seen_app_version.down(db),
      ).not.toThrow();

      const after = getColumnNames(db, "user_settings");
      expect(after).not.toContain("last_seen_app_version");
    });

    it("should preserve existing user settings data after down() removes last_seen_app_version", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Set some data
      db.prepare(
        "UPDATE user_settings SET app_exit_action = 'minimize', last_seen_app_version = '0.5.0' WHERE id = 1",
      ).run();

      // Roll back the migration
      migration_20260223_010100_add_last_seen_app_version.down(db);

      // Column should be gone
      const columns = getColumnNames(db, "user_settings");
      expect(columns).not.toContain("last_seen_app_version");

      // Other data should survive
      const row = db
        .prepare("SELECT app_exit_action FROM user_settings WHERE id = 1")
        .get() as { app_exit_action: string };
      expect(row.app_exit_action).toBe("minimize");
    });

    it("should allow re-applying last_seen_app_version migration after rollback", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Roll back
      migration_20260223_010100_add_last_seen_app_version.down(db);
      const afterDown = getColumnNames(db, "user_settings");
      expect(afterDown).not.toContain("last_seen_app_version");

      // Re-apply
      migration_20260223_010100_add_last_seen_app_version.up(db);
      const afterUp = getColumnNames(db, "user_settings");
      expect(afterUp).toContain("last_seen_app_version");

      // Should be writable
      db.prepare(
        "UPDATE user_settings SET last_seen_app_version = '0.6.0' WHERE id = 1",
      ).run();
      const row = db
        .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
        .get() as { last_seen_app_version: string | null };
      expect(row.last_seen_app_version).toBe("0.6.0");
    });
  });

  describe("prohibited library migration idempotency", () => {
    it("should skip adding from_boss when column already exists on divination_cards", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);

      // Run all migrations so from_boss is already present
      runner.runMigrations(migrations);

      const before = getColumnNames(db, "divination_cards");
      expect(before).toContain("from_boss");

      // Calling up() again directly should not throw (idempotent)
      expect(() =>
        migration_20260221_201500_add_prohibited_library.up(db),
      ).not.toThrow();

      // from_boss should still be there exactly once
      const after = getColumnNames(db, "divination_cards");
      const count = after.filter((c) => c === "from_boss").length;
      expect(count).toBe(1);
    });

    it("should handle down() when from_boss column does not exist on divination_cards", () => {
      createBaselineSchema(db);

      // Baseline schema does NOT have from_boss (it's added by the migration)
      const before = getColumnNames(db, "divination_cards");
      expect(before).not.toContain("from_boss");

      // down() should not throw even though from_boss is absent
      expect(() =>
        migration_20260221_201500_add_prohibited_library.down(db),
      ).not.toThrow();

      // Table should still exist and be intact
      const after = getColumnNames(db, "divination_cards");
      expect(after).not.toContain("from_boss");
      expect(after).toContain("name");
      expect(after).toContain("game");
    });

    it("should handle down() and preserve divination_cards data when from_boss is removed", () => {
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Insert a card with from_boss = 1
      db.prepare(
        "INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, game, data_hash, from_boss) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        "card-1",
        "The Doctor",
        8,
        "desc",
        "<span>reward</span>",
        "art.png",
        "poe1",
        "hash1",
        1,
      );

      db.prepare(
        "INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, game, data_hash, from_boss) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        "card-2",
        "Rain of Chaos",
        8,
        "desc",
        "<span>reward</span>",
        "art2.png",
        "poe1",
        "hash2",
        0,
      );

      migration_20260221_201500_add_prohibited_library.down(db);

      // Data should survive the table rebuild
      const rows = db
        .prepare(
          "SELECT name, stack_size, game FROM divination_cards ORDER BY name",
        )
        .all() as Array<{
        name: string;
        stack_size: number;
        game: string;
      }>;

      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe("Rain of Chaos");
      expect(rows[1].name).toBe("The Doctor");

      // from_boss column should be gone
      const columns = getColumnNames(db, "divination_cards");
      expect(columns).not.toContain("from_boss");
    });
  });
});
