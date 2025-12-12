import path from "node:path";
import { app } from "electron";
import Database from "better-sqlite3";

/**
 * Core database service that manages the SQLite connection
 * and provides common database utilities
 */
class DatabaseService {
  private static _instance: DatabaseService;
  private db: Database.Database;
  private dbPath: string;

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

    // Initialize schema
    this.initializeSchema();
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
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (game, scope, processed_id)
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_processed_ids_game_scope
        ON processed_ids(game, scope)
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
    });

    transaction();
  }

  /**
   * Get the database instance
   */
  public getDb(): Database.Database {
    return this.db;
  }

  /**
   * Execute a transaction
   */
  public transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * Close the database connection
   */
  public close(): void {
    this.db.close();
  }

  /**
   * Get database path
   */
  public getPath(): string {
    return this.dbPath;
  }

  /**
   * Optimize database (vacuum, analyze)
   */
  public optimize(): void {
    this.db.exec("VACUUM");
    this.db.exec("ANALYZE");
  }

  /**
   * Reset database (wipe all data and recreate schema)
   * WARNING: This deletes ALL data!
   */
  public reset(): void {
    const fs = require("fs");

    // Close the database connection
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
    this.initializeSchema();

    // Reset the singleton instance to force reinitialization of all services
    DatabaseService._instance = null as any;

    console.log("[Database] Database reset completed");
  }
}

export { DatabaseService };
