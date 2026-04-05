import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: Remove unnecessary AUTOINCREMENT from 6 tables
 *
 * AUTOINCREMENT forces SQLite to maintain the `sqlite_sequence` table and
 * prevents rowid reuse. For tables where rowid reuse is acceptable (all 6
 * below), plain `INTEGER PRIMARY KEY` is faster — especially on the hot-path
 * card-drop transaction which INSERTs into several of these tables.
 *
 * SQLite doesn't support `ALTER TABLE ... DROP AUTOINCREMENT`, so each table
 * is rebuilt using the create → copy → drop → rename pattern.
 *
 * Because test baseline schemas may have extra columns (e.g. `created_at`,
 * `updated_at`, `stack_size`) that the production schema has since dropped,
 * we dynamically read the column names from both the source and destination
 * tables and only copy the intersection. This avoids "N columns but M values
 * were supplied" errors when running against older schema variants.
 */

const MIGRATION_ID = "20260405_114200_remove_autoincrement";

// ─── Target table definitions (without AUTOINCREMENT) ──────────────────────

interface TableDef {
  name: string;
  createSql: string;
  indexes: string[];
}

const TABLES: TableDef[] = [
  {
    name: "snapshot_card_prices",
    createSql: `
      CREATE TABLE snapshot_card_prices_new (
        id INTEGER PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
        chaos_value REAL NOT NULL,
        divine_value REAL NOT NULL,
        confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence IN (1, 2, 3)),
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
        UNIQUE(snapshot_id, card_name, price_source)
      )`,
    indexes: [
      "CREATE INDEX idx_snapshot_prices_snapshot ON snapshot_card_prices(snapshot_id)",
    ],
  },
  {
    name: "session_cards",
    createSql: `
      CREATE TABLE session_cards_new (
        id INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        hide_price_exchange INTEGER NOT NULL DEFAULT 0,
        hide_price_stash INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        UNIQUE(session_id, card_name)
      )`,
    indexes: [
      "CREATE INDEX idx_session_cards_session ON session_cards(session_id)",
      "CREATE INDEX idx_session_cards_name ON session_cards(card_name)",
    ],
  },
  {
    name: "session_card_events",
    createSql: `
      CREATE TABLE session_card_events_new (
        id INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        chaos_value REAL,
        divine_value REAL,
        dropped_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,
    indexes: [
      "CREATE INDEX idx_session_card_events_session ON session_card_events(session_id, dropped_at ASC)",
    ],
  },
  {
    name: "cards",
    createSql: `
      CREATE TABLE cards_new (
        id INTEGER PRIMARY KEY,
        game TEXT NOT NULL,
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT,
        UNIQUE(game, scope, card_name)
      )`,
    indexes: ["CREATE INDEX idx_cards_game_scope ON cards(game, scope)"],
  },
  {
    name: "card_price_history_cache",
    createSql: `
      CREATE TABLE card_price_history_cache_new (
        id INTEGER PRIMARY KEY,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        league TEXT NOT NULL,
        details_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        response_data TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, league, details_id)
      )`,
    indexes: [
      "CREATE INDEX idx_card_price_cache_lookup ON card_price_history_cache(game, league, details_id)",
    ],
  },
  {
    name: "csv_export_snapshots",
    createSql: `
      CREATE TABLE csv_export_snapshots_new (
        id INTEGER PRIMARY KEY,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        total_count INTEGER NOT NULL DEFAULT 0,
        exported_at TEXT NOT NULL,
        integrity_status TEXT CHECK(integrity_status IN ('pass', 'warn', 'fail') OR integrity_status IS NULL),
        integrity_details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, scope, card_name)
      )`,
    indexes: [
      "CREATE INDEX idx_csv_export_snapshots_lookup ON csv_export_snapshots(game, scope)",
    ],
  },
];

// ─── Reverse definitions (with AUTOINCREMENT, for rollback) ────────────────

const TABLES_ROLLBACK: TableDef[] = [
  {
    name: "snapshot_card_prices",
    createSql: `
      CREATE TABLE snapshot_card_prices_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
        chaos_value REAL NOT NULL,
        divine_value REAL NOT NULL,
        confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence IN (1, 2, 3)),
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
        UNIQUE(snapshot_id, card_name, price_source)
      )`,
    indexes: [
      "CREATE INDEX idx_snapshot_prices_snapshot ON snapshot_card_prices(snapshot_id)",
    ],
  },
  {
    name: "session_cards",
    createSql: `
      CREATE TABLE session_cards_new (
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
      )`,
    indexes: [
      "CREATE INDEX idx_session_cards_session ON session_cards(session_id)",
      "CREATE INDEX idx_session_cards_name ON session_cards(card_name)",
    ],
  },
  {
    name: "session_card_events",
    createSql: `
      CREATE TABLE session_card_events_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        chaos_value REAL,
        divine_value REAL,
        dropped_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,
    indexes: [
      "CREATE INDEX idx_session_card_events_session ON session_card_events(session_id, dropped_at ASC)",
    ],
  },
  {
    name: "cards",
    createSql: `
      CREATE TABLE cards_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT NOT NULL,
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        last_updated TEXT,
        UNIQUE(game, scope, card_name)
      )`,
    indexes: ["CREATE INDEX idx_cards_game_scope ON cards(game, scope)"],
  },
  {
    name: "card_price_history_cache",
    createSql: `
      CREATE TABLE card_price_history_cache_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        league TEXT NOT NULL,
        details_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        response_data TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, league, details_id)
      )`,
    indexes: [
      "CREATE INDEX idx_card_price_cache_lookup ON card_price_history_cache(game, league, details_id)",
    ],
  },
  {
    name: "csv_export_snapshots",
    createSql: `
      CREATE TABLE csv_export_snapshots_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        total_count INTEGER NOT NULL DEFAULT 0,
        exported_at TEXT NOT NULL,
        integrity_status TEXT CHECK(integrity_status IN ('pass', 'warn', 'fail') OR integrity_status IS NULL),
        integrity_details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, scope, card_name)
      )`,
    indexes: [
      "CREATE INDEX idx_csv_export_snapshots_lookup ON csv_export_snapshots(game, scope)",
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Read column names from a table via PRAGMA table_info.
 */
function getColumnNames(db: Database.Database, tableName: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as {
    name: string;
  }[];
  return rows.map((r) => r.name);
}

/**
 * Drop all indexes that reference a table. We query sqlite_master to find
 * them dynamically so we don't miss any that exist in older schema variants.
 */
function dropIndexesForTable(db: Database.Database, tableName: string): void {
  const indexes = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'`,
    )
    .all(tableName) as { name: string }[];

  for (const idx of indexes) {
    db.exec(`DROP INDEX IF EXISTS "${idx.name}"`);
  }
}

/**
 * Rebuild a single table:
 *   1. Drop existing indexes
 *   2. Create the new table (with _new suffix)
 *   3. Copy data — only columns present in BOTH old and new tables
 *   4. Drop old table
 *   5. Rename new → original
 *   6. Recreate indexes
 */
function rebuildTable(db: Database.Database, def: TableDef): void {
  const oldTable = def.name;
  const newTable = `${def.name}_new`;

  // 1. Drop indexes on the old table
  dropIndexesForTable(db, oldTable);

  // 2. Create the new table
  db.exec(def.createSql);

  // 3. Determine which columns to copy (intersection of old ∩ new)
  const oldCols = new Set(getColumnNames(db, oldTable));
  const newCols = getColumnNames(db, newTable);
  const sharedCols = newCols.filter((col) => oldCols.has(col));

  if (sharedCols.length > 0) {
    const colList = sharedCols.map((c) => `"${c}"`).join(", ");
    db.exec(
      `INSERT INTO "${newTable}" (${colList}) SELECT ${colList} FROM "${oldTable}"`,
    );
  }

  // 4. Drop old table
  db.exec(`DROP TABLE "${oldTable}"`);

  // 5. Rename new → original
  db.exec(`ALTER TABLE "${newTable}" RENAME TO "${oldTable}"`);

  // 6. Recreate indexes
  for (const idxSql of def.indexes) {
    db.exec(idxSql);
  }
}

// ─── Migration ─────────────────────────────────────────────────────────────

export const migration_20260405_114200_remove_autoincrement: Migration = {
  id: MIGRATION_ID,
  description: "Remove unnecessary AUTOINCREMENT from 6 tables",

  up(db: Database.Database): void {
    for (const tableDef of TABLES) {
      // Skip tables that don't exist yet (e.g. csv_export_snapshots may not
      // exist if an earlier migration hasn't run in this particular DB).
      const exists = db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
        )
        .get(tableDef.name);

      if (!exists) continue;

      rebuildTable(db, tableDef);
    }

    // Clean up sqlite_sequence rows for the migrated tables.
    // Without AUTOINCREMENT these entries are no longer needed.
    // The sqlite_sequence table itself only exists if at least one
    // AUTOINCREMENT table was ever created in this database.
    const seqExists = db
      .prepare(
        `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`,
      )
      .get();

    if (seqExists) {
      const names = TABLES.map((t) => `'${t.name}'`).join(", ");
      db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${names})`);
    }
  },

  down(db: Database.Database): void {
    for (const tableDef of TABLES_ROLLBACK) {
      const exists = db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
        )
        .get(tableDef.name);

      if (!exists) continue;

      rebuildTable(db, tableDef);
    }

    // Re-insert sqlite_sequence rows for tables that now use AUTOINCREMENT
    // again. Seed each with the current max id so SQLite won't reuse ids.
    for (const tableDef of TABLES_ROLLBACK) {
      const exists = db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
        )
        .get(tableDef.name);

      if (!exists) continue;

      const row = db
        .prepare(
          `SELECT COALESCE(MAX(id), 0) AS max_id FROM "${tableDef.name}"`,
        )
        .get() as { max_id: number };

      db.prepare(
        `INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)`,
      ).run(tableDef.name, row.max_id);
    }
  },
};
