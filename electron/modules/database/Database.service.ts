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
    this.dbPath = path.join(userDataPath, "soothsayer.db");

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
          stack_size INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      // Note: rarity field will be migrated to separate table
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
        rarity INTEGER NOT NULL DEFAULT 4,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        data_hash TEXT NOT NULL,
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
          poe2_price_source TEXT NOT NULL DEFAULT 'stash' CHECK(poe2_price_source IN ('exchange', 'stash')),

          -- Game selection
          selected_game TEXT NOT NULL DEFAULT 'poe1' CHECK(selected_game IN ('poe1', 'poe2')),

          -- Setup and onboarding
          setup_completed INTEGER NOT NULL DEFAULT 0,
          setup_step INTEGER NOT NULL DEFAULT 0 CHECK(setup_step >= 0 AND setup_step <= 3),
          setup_version INTEGER NOT NULL DEFAULT 1,

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
    const fs = require("node:fs");

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
