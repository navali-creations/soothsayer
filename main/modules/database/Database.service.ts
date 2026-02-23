import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { app } from "electron";
import { Kysely, SqliteDialect } from "kysely";

import type { Database as DatabaseSchema } from "./Database.types";
import { MigrationRunner, migrations } from "./migrations";

/**
 * Core database service that manages the SQLite connection
 * and provides common database utilities
 */
class DatabaseService {
  private static _instance: DatabaseService;
  private db: Database.Database;
  private kysely: Kysely<DatabaseSchema>;
  private dbPath: string;
  private migrationRunner: MigrationRunner;

  static getInstance(): DatabaseService {
    if (!DatabaseService._instance) {
      DatabaseService._instance = new DatabaseService();
    }
    return DatabaseService._instance;
  }

  private constructor() {
    // Store database in user data directory
    const userDataPath = app.getPath("userData");

    // Three-tier database naming:
    //   soothsayer.local.db  — local Supabase (localhost/127.0.0.1)
    //   soothsayer.db        — dev with production Supabase credentials
    //   soothsayer.prod.db   — packaged release build
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const isLocalSupabase =
      supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

    let dbFilename: string;
    if (isLocalSupabase) {
      dbFilename = "soothsayer.local.db";
    } else if (app.isPackaged) {
      dbFilename = "soothsayer.prod.db";
    } else {
      dbFilename = "soothsayer.db";
    }

    this.dbPath = path.join(userDataPath, dbFilename);

    const isNewDb = !fs.existsSync(this.dbPath);
    console.log(
      `[Database] Using database: ${dbFilename} (packaged: ${app.isPackaged}, localSupabase: ${isLocalSupabase}, newDb: ${isNewDb})`,
    );
    if (isNewDb) {
      console.warn(
        `[Database] ⚠️ Creating fresh database at ${this.dbPath} — all settings will use defaults (league=Standard, clientPath=null)`,
      );
    }

    // Initialize database connection
    this.db = new Database(this.dbPath, {
      // verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
    });

    // Enable WAL mode for better performance
    this.db.pragma("journal_mode = WAL");

    // Enable foreign keys
    this.db.pragma("foreign_keys = ON");

    // Initialize Kysely with the same database instance
    this.kysely = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: this.db,
      }),
    });

    // Initialize schema (for initial table creation)
    this.initializeSchema();

    // Initialize migration runner and run pending migrations
    this.migrationRunner = new MigrationRunner(this.db);
    this.runMigrations();
  }

  /**
   * Run all pending migrations
   */
  private runMigrations(): void {
    try {
      this.migrationRunner.runMigrations(migrations);
    } catch (error) {
      console.error("[Database] Migration failed:", error);
      throw error;
    }
  }

  private initializeSchema(): void {
    // Create tables in a transaction for atomicity
    const transaction = this.db.transaction(() => {
      // ═══════════════════════════════════════════════════════════════
      // GLOBAL STATS
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS global_stats (
          key TEXT PRIMARY KEY,
          value INTEGER NOT NULL
        )
      `);

      // Initialize global stats if empty
      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM global_stats")
        .get() as { count: number };

      if (count.count === 0) {
        this.db
          .prepare(
            "INSERT INTO global_stats (key, value) VALUES ('totalStackedDecksOpened', 0)",
          )
          .run();
      }

      // ═══════════════════════════════════════════════════════════════
      // LEAGUES METADATA
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
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

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_leagues_game_name
        ON leagues(game, name)
      `);

      // ═══════════════════════════════════════════════════════════════
      // PRICE SNAPSHOTS (reusable across sessions)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
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

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_snapshots_league_fetched
        ON snapshots(league_id, fetched_at DESC)
      `);

      // ═══════════════════════════════════════════════════════════════
      // SNAPSHOT CARD PRICES (normalized for analytics)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS snapshot_card_prices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
          chaos_value REAL NOT NULL,
          divine_value REAL NOT NULL,
          confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence IN (1, 2, 3)),
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
          UNIQUE(snapshot_id, card_name, price_source)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_snapshot_prices_snapshot
        ON snapshot_card_prices(snapshot_id)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_snapshot_prices_card
        ON snapshot_card_prices(card_name, price_source)
      `);

      // ═══════════════════════════════════════════════════════════════
      // SESSIONS
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
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
          FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE SET NULL
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_game
        ON sessions(game)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_league
        ON sessions(league_id)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_active
        ON sessions(is_active)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_started
        ON sessions(started_at DESC)
      `);

      // ═══════════════════════════════════════════════════════════════
      // SESSION CARDS
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS session_cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          hide_price_exchange INTEGER NOT NULL DEFAULT 0,
          hide_price_stash INTEGER NOT NULL DEFAULT 0,
          first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          UNIQUE(session_id, card_name)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_session_cards_session
        ON session_cards(session_id)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_session_cards_name
        ON session_cards(card_name)
      `);

      // ═══════════════════════════════════════════════════════════════
      // SESSION SUMMARIES (pre-calculated for performance)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS session_summaries (
          session_id TEXT PRIMARY KEY,
          game TEXT NOT NULL,
          league TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          total_decks_opened INTEGER NOT NULL,
          total_exchange_value REAL NOT NULL,
          total_stash_value REAL NOT NULL,
          exchange_chaos_to_divine REAL NOT NULL,
          stash_chaos_to_divine REAL NOT NULL,
          stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
          total_exchange_net_profit REAL,
          total_stash_net_profit REAL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_session_summaries_game
        ON session_summaries(game)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_session_summaries_league
        ON session_summaries(league)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_session_summaries_started
        ON session_summaries(started_at DESC)
      `);

      // ═══════════════════════════════════════════════════════════════
      // PROCESSED IDS (prevent duplicates)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS processed_ids (
          game TEXT NOT NULL,
          scope TEXT NOT NULL,
          processed_id TEXT NOT NULL,
          card_name TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (game, scope, processed_id)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_processed_ids_game_scope
        ON processed_ids(game, scope)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_processed_ids_recent_drops
        ON processed_ids(game, scope, created_at DESC)
      `);

      // ═══════════════════════════════════════════════════════════════
      // CARDS (aggregate stats for quick access)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game TEXT NOT NULL,
          scope TEXT NOT NULL,
          card_name TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          last_updated TEXT,
          UNIQUE(game, scope, card_name)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cards_game_scope
        ON cards(game, scope)
      `);

      // ═══════════════════════════════════════════════════════════════
      // DIVINATION CARDS (static reference data from JSON)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
      CREATE TABLE IF NOT EXISTS divination_cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        stack_size INTEGER NOT NULL,
        description TEXT NOT NULL,
        reward_html TEXT NOT NULL,
        art_src TEXT NOT NULL,
        flavour_html TEXT,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        data_hash TEXT NOT NULL,
        from_boss INTEGER NOT NULL DEFAULT 0 CHECK(from_boss IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, name)
      )
    `);

      this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_game_name
      ON divination_cards(game, name)
    `);

      this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_name
      ON divination_cards(name)
    `);

      this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_stack_size
      ON divination_cards(stack_size)
    `);

      // ═══════════════════════════════════════════════════════════════
      // DIVINATION CARD RARITIES (league-specific rarity data)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS divination_card_rarities (
          game TEXT NOT NULL,
          league TEXT NOT NULL,
          card_name TEXT NOT NULL,
          rarity INTEGER NOT NULL CHECK(rarity >= 0 AND rarity <= 4),
          override_rarity INTEGER CHECK(override_rarity IS NULL OR (override_rarity >= 0 AND override_rarity <= 4)),
          last_updated TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (game, league, card_name)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
        ON divination_card_rarities(game, league)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
        ON divination_card_rarities(card_name)
      `);

      // ═══════════════════════════════════════════════════════════════
      // POE LEAGUES CACHE (cached from Supabase for offline use)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
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

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_poe_leagues_cache_game
        ON poe_leagues_cache (game)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_poe_leagues_cache_game_active
        ON poe_leagues_cache (game, is_active)
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS poe_leagues_cache_metadata (
          game TEXT NOT NULL PRIMARY KEY CHECK (game IN ('poe1', 'poe2')),
          last_fetched_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // ═══════════════════════════════════════════════════════════════
      // FILTER METADATA (discovered filter files)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
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

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_metadata_type
        ON filter_metadata(filter_type)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_metadata_file_path
        ON filter_metadata(file_path)
      `);

      // ═══════════════════════════════════════════════════════════════
      // PROHIBITED LIBRARY CARD WEIGHTS (empirical drop weights from CSV)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS prohibited_library_card_weights (
          card_name   TEXT    NOT NULL,
          game        TEXT    NOT NULL CHECK(game IN ('poe1', 'poe2')),
          league      TEXT    NOT NULL,
          weight      INTEGER NOT NULL,
          rarity      INTEGER NOT NULL CHECK(rarity BETWEEN 0 AND 4),
          from_boss   INTEGER NOT NULL DEFAULT 0 CHECK(from_boss IN (0, 1)),
          loaded_at   TEXT    NOT NULL,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (card_name, game, league)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pl_card_weights_game_league
        ON prohibited_library_card_weights(game, league)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pl_card_weights_card_name
        ON prohibited_library_card_weights(card_name)
      `);

      // ═══════════════════════════════════════════════════════════════
      // PROHIBITED LIBRARY CACHE METADATA (tracks CSV parse state)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS prohibited_library_cache_metadata (
          game        TEXT NOT NULL PRIMARY KEY CHECK(game IN ('poe1', 'poe2')),
          league      TEXT NOT NULL,
          loaded_at   TEXT NOT NULL,
          app_version TEXT NOT NULL,
          card_count  INTEGER NOT NULL,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // ═══════════════════════════════════════════════════════════════
      // FILTER CARD RARITIES (per-filter card-to-rarity mappings)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS filter_card_rarities (
          filter_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (filter_id, card_name),
          FOREIGN KEY (filter_id) REFERENCES filter_metadata(id) ON DELETE CASCADE
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_card_rarities_filter
        ON filter_card_rarities(filter_id)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_filter_card_rarities_card
        ON filter_card_rarities(card_name)
      `);

      // ═══════════════════════════════════════════════════════════════
      // USER SETTINGS (single row table for application settings)
      // ═══════════════════════════════════════════════════════════════
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY CHECK(id = 1),

          -- App settings
          app_exit_action TEXT NOT NULL DEFAULT 'exit' CHECK(app_exit_action IN ('exit', 'minimize')),
          app_open_at_login INTEGER NOT NULL DEFAULT 0,
          app_open_at_login_minimized INTEGER NOT NULL DEFAULT 0,

          -- Onboarding settings
          onboarding_dismissed_beacons TEXT NOT NULL DEFAULT '[]',

          -- Overlay settings
          overlay_bounds TEXT,

          -- PoE1 settings
          poe1_client_txt_path TEXT,
          poe1_selected_league TEXT NOT NULL DEFAULT 'Standard',
          poe1_price_source TEXT NOT NULL DEFAULT 'exchange' CHECK(poe1_price_source IN ('exchange', 'stash')),

          -- PoE2 settings
          poe2_client_txt_path TEXT,
          poe2_selected_league TEXT NOT NULL DEFAULT 'Standard',
          poe2_price_source TEXT NOT NULL DEFAULT 'exchange' CHECK(poe2_price_source IN ('exchange', 'stash')),

          -- Game selection
          selected_game TEXT NOT NULL DEFAULT 'poe1' CHECK(selected_game IN ('poe1', 'poe2')),
          installed_games TEXT NOT NULL DEFAULT '["poe1"]',

          -- Setup and onboarding
          setup_completed INTEGER NOT NULL DEFAULT 0,
          setup_step INTEGER NOT NULL DEFAULT 0 CHECK(setup_step >= 0 AND setup_step <= 3),
          setup_version INTEGER NOT NULL DEFAULT 1,

          -- Audio settings
          audio_enabled INTEGER NOT NULL DEFAULT 1,
          audio_volume REAL NOT NULL DEFAULT 0.5,
          audio_rarity1_path TEXT,
          audio_rarity2_path TEXT,
          audio_rarity3_path TEXT,

          -- Filter / rarity source settings
          rarity_source TEXT NOT NULL DEFAULT 'poe.ninja' CHECK(rarity_source IN ('poe.ninja', 'filter', 'prohibited-library')),
          selected_filter_id TEXT REFERENCES filter_metadata(id) ON DELETE SET NULL,

          -- Post-update detection
          last_seen_app_version TEXT,

          -- Metadata
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Initialize settings row if it doesn't exist
      this.db.exec(`
        INSERT OR IGNORE INTO user_settings (id) VALUES (1)
      `);
    });

    transaction();
  }

  /**
   * Get the raw better-sqlite3 database instance
   * Use sparingly - prefer using Kysely for type safety
   */
  public getDb(): Database.Database {
    return this.db;
  }

  /**
   * Get the Kysely query builder
   * This is the preferred way to interact with the database
   */
  public getKysely(): Kysely<DatabaseSchema> {
    return this.kysely;
  }

  /**
   * Create a transaction using Kysely
   */
  public async transaction<T>(
    callback: (trx: Kysely<DatabaseSchema>) => Promise<T>,
  ): Promise<T> {
    const transaction = await this.kysely.transaction().execute(callback);
    return transaction;
  }

  /**
   * Close the database connection
   */
  public close(): void {
    this.kysely.destroy();
    this.db.close();
  }

  /**
   * Get the path to the database file
   */
  public getPath(): string {
    return this.dbPath;
  }

  /**
   * Optimize the database
   */
  public optimize(): void {
    this.db.pragma("optimize");
  }

  /**
   * Get the migration runner instance
   * Useful for debugging or manual migration management
   */
  public getMigrationRunner(): MigrationRunner {
    return this.migrationRunner;
  }

  /**
   * Reset the entire database
   * ⚠️ WARNING: This will delete ALL data!
   */
  public reset(): void {
    // Close the database connection
    this.kysely.destroy();
    this.db.close();

    // Delete the database file
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }

    // Delete WAL and SHM files if they exist
    const walPath = `${this.dbPath}-wal`;
    const shmPath = `${this.dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Reinitialize the database
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    // Reinitialize Kysely
    this.kysely = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: this.db,
      }),
    });

    this.initializeSchema();

    // Reinitialize migration runner and run migrations
    this.migrationRunner = new MigrationRunner(this.db);
    this.runMigrations();
  }
}

export { DatabaseService };
