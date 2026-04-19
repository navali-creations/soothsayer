import Database from "better-sqlite3";
import { afterEach, beforeEach } from "vitest";

// ─── Database setup helper ───────────────────────────────────────────────────

export function setupMigrationDb(): { getDb: () => Database.Database } {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    db.close();
  });

  return { getDb: () => db };
}

// ─── Query helpers ───────────────────────────────────────────────────────────

/**
 * Returns the column names for a given table.
 */
export function getColumnNames(db: Database.Database, table: string): string[] {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return columns.map((c) => c.name);
}

/**
 * Returns the names of all tables in the database (excluding internal SQLite tables).
 */
export function getTableNames(db: Database.Database): string[] {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return tables.map((t) => t.name);
}

/**
 * Returns the names of all indexes in the database (excluding internal SQLite indexes).
 * Optionally filtered by table name.
 */
export function getIndexNames(
  db: Database.Database,
  tableName?: string,
): string[] {
  let query =
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'";
  if (tableName) {
    query += ` AND tbl_name='${tableName}'`;
  }
  query += " ORDER BY name";
  const indexes = db.prepare(query).all() as { name: string }[];
  return indexes.map((i) => i.name);
}

// ─── Schema creation helpers ─────────────────────────────────────────────────

/**
 * Creates the current baseline schema (mirrors Database.service.ts initializeSchema).
 * This is what a fresh install gets before migrations run.
 */
export function createBaselineSchema(db: Database.Database): void {
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
export function createPreAudioSchema(db: Database.Database): void {
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
export function createPreFilterSchema(db: Database.Database): void {
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

export const EXPECTED_AUDIO_COLUMNS = [
  "audio_enabled",
  "audio_volume",
  "audio_rarity1_path",
  "audio_rarity2_path",
  "audio_rarity3_path",
];

export const EXPECTED_FILTER_SETTINGS_COLUMNS = [
  "rarity_source",
  "selected_filter_id",
];

export const EXPECTED_FILTER_TABLES = [
  "filter_metadata",
  "filter_card_rarities",
];

export const EXPECTED_LAST_SEEN_APP_VERSION_COLUMNS = ["last_seen_app_version"];

export const EXPECTED_AVAILABILITY_COLUMNS = [
  "game",
  "league",
  "card_name",
  "from_boss",
  "is_disabled",
  "created_at",
  "updated_at",
  "weight",
];

export const EXPECTED_FILTER_METADATA_COLUMNS = [
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

export const EXPECTED_FILTER_CARD_RARITIES_COLUMNS = [
  "filter_id",
  "card_name",
  "rarity",
  "created_at",
];

export const EXPECTED_SESSION_CARD_EVENTS_COLUMNS = [
  "id",
  "session_id",
  "card_name",
  "chaos_value",
  "divine_value",
  "dropped_at",
];

export const EXPECTED_SESSION_CARD_EVENTS_INDEXES = [
  "idx_session_card_events_session",
];
