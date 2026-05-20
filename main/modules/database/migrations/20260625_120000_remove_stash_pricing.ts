import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

const MIGRATION_ID = "20260625_120000_remove_stash_pricing";

function getColumnNames(db: Database.Database, tableName: string): string[] {
  return (
    db.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[]
  ).map((row) => row.name);
}

function hasTable(db: Database.Database, tableName: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function dropIndexesForTable(db: Database.Database, tableName: string): void {
  const indexes = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'",
    )
    .all(tableName) as { name: string }[];

  for (const index of indexes) {
    db.exec(`DROP INDEX IF EXISTS "${index.name}"`);
  }
}

function selectColumnOrFallback(
  tableName: string,
  column: string,
  columns: Set<string>,
  fallbacks: Record<string, string>,
): string {
  if (columns.has(column)) return `"${column}"`;
  const fallback = fallbacks[column];
  if (fallback !== undefined) return fallback;
  throw new Error(
    `Cannot rebuild ${tableName}: missing source column "${column}"`,
  );
}

function rebuildSnapshots(db: Database.Database): void {
  if (!hasTable(db, "snapshots")) return;
  let columns = new Set(getColumnNames(db, "snapshots"));
  dropIndexesForTable(db, "snapshots");

  if (!columns.has("chaos_to_divine_ratio")) {
    if (columns.has("exchange_chaos_to_divine")) {
      db.exec(`
        ALTER TABLE snapshots
        RENAME COLUMN exchange_chaos_to_divine TO chaos_to_divine_ratio
      `);
    } else {
      db.exec(`
        ALTER TABLE snapshots
        ADD COLUMN chaos_to_divine_ratio REAL NOT NULL DEFAULT 0
      `);
    }
    columns = new Set(getColumnNames(db, "snapshots"));
  }

  if (!columns.has("stacked_deck_chaos_cost")) {
    db.exec(`
      ALTER TABLE snapshots
      ADD COLUMN stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0
    `);
    columns = new Set(getColumnNames(db, "snapshots"));
  }

  if (!columns.has("stacked_deck_max_volume_rate")) {
    db.exec(`
      ALTER TABLE snapshots
      ADD COLUMN stacked_deck_max_volume_rate REAL DEFAULT NULL
    `);
    columns = new Set(getColumnNames(db, "snapshots"));
  }

  if (!columns.has("created_at")) {
    db.exec("ALTER TABLE snapshots ADD COLUMN created_at TEXT");
    db.exec(`
      UPDATE snapshots
      SET created_at = datetime('now')
      WHERE created_at IS NULL
    `);
    columns = new Set(getColumnNames(db, "snapshots"));
  }

  if (columns.has("exchange_chaos_to_divine")) {
    db.exec("ALTER TABLE snapshots DROP COLUMN exchange_chaos_to_divine");
    columns = new Set(getColumnNames(db, "snapshots"));
  }

  if (columns.has("stash_chaos_to_divine")) {
    db.exec("ALTER TABLE snapshots DROP COLUMN stash_chaos_to_divine");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_league_fetched
    ON snapshots(league_id, fetched_at DESC)
  `);
}

function rebuildSnapshotCardPrices(db: Database.Database): void {
  if (!hasTable(db, "snapshot_card_prices")) return;
  const columns = new Set(getColumnNames(db, "snapshot_card_prices"));
  const needsRebuild =
    columns.has("price_source") ||
    columns.has("stack_size") ||
    columns.has("created_at");
  if (!needsRebuild) return;

  dropIndexesForTable(db, "snapshot_card_prices");
  db.exec(`
    CREATE TABLE snapshot_card_prices_new (
      id INTEGER PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      chaos_value REAL NOT NULL,
      divine_value REAL NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence IN (1, 2, 3)),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      UNIQUE(snapshot_id, card_name)
    )
  `);

  const whereClause = columns.has("price_source")
    ? "WHERE price_source = 'exchange'"
    : "";
  const confidenceExpr = columns.has("confidence")
    ? "COALESCE(confidence, 1)"
    : "1";

  db.exec(`
    INSERT OR IGNORE INTO snapshot_card_prices_new (
      id, snapshot_id, card_name, chaos_value, divine_value, confidence
    )
    SELECT id, snapshot_id, card_name, chaos_value, divine_value, ${confidenceExpr}
    FROM snapshot_card_prices
    ${whereClause}
  `);

  db.exec("DROP TABLE snapshot_card_prices");
  db.exec(
    "ALTER TABLE snapshot_card_prices_new RENAME TO snapshot_card_prices",
  );
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshot_prices_snapshot
    ON snapshot_card_prices(snapshot_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshot_prices_card
    ON snapshot_card_prices(card_name)
  `);
}

function rebuildSessionCards(db: Database.Database): void {
  if (!hasTable(db, "session_cards")) return;
  const columns = new Set(getColumnNames(db, "session_cards"));
  const needsRebuild =
    !columns.has("hide_price") ||
    columns.has("hide_price_exchange") ||
    columns.has("hide_price_stash");
  if (!needsRebuild) return;

  dropIndexesForTable(db, "session_cards");
  db.exec(`
    CREATE TABLE session_cards_new (
      id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      hide_price INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE(session_id, card_name)
    )
  `);

  const hideExpr = columns.has("hide_price")
    ? "hide_price"
    : columns.has("hide_price_exchange")
      ? "COALESCE(hide_price_exchange, 0)"
      : "0";
  const firstSeenExpr = columns.has("first_seen_at")
    ? "first_seen_at"
    : "datetime('now')";
  const lastSeenExpr = columns.has("last_seen_at")
    ? "last_seen_at"
    : "datetime('now')";

  db.exec(`
    INSERT INTO session_cards_new (
      id, session_id, card_name, count, hide_price, first_seen_at, last_seen_at
    )
    SELECT id, session_id, card_name, count, ${hideExpr}, ${firstSeenExpr}, ${lastSeenExpr}
    FROM session_cards
  `);

  db.exec("DROP TABLE session_cards");
  db.exec("ALTER TABLE session_cards_new RENAME TO session_cards");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_cards_session
    ON session_cards(session_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_cards_name
    ON session_cards(card_name)
  `);
}

function rebuildSessionSummaries(db: Database.Database): void {
  if (!hasTable(db, "session_summaries")) return;
  const columns = new Set(getColumnNames(db, "session_summaries"));
  const needsRebuild =
    !columns.has("total_value") ||
    !columns.has("net_profit") ||
    !columns.has("chaos_to_divine_ratio") ||
    columns.has("total_exchange_value") ||
    columns.has("total_exchange_net_profit") ||
    columns.has("exchange_chaos_to_divine") ||
    columns.has("total_stash_value") ||
    columns.has("total_stash_net_profit") ||
    columns.has("stash_chaos_to_divine");
  if (!needsRebuild) return;

  dropIndexesForTable(db, "session_summaries");
  db.exec(`
    CREATE TABLE session_summaries_new (
      session_id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      total_decks_opened INTEGER NOT NULL,
      total_value REAL NOT NULL,
      chaos_to_divine_ratio REAL NOT NULL,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      net_profit REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  const targetColumns = getColumnNames(db, "session_summaries_new");
  const insertColumns = targetColumns.map((column) => `"${column}"`).join(", ");
  const fallbackColumns: Record<string, string> = {
    total_value: columns.has("total_exchange_value")
      ? '"total_exchange_value"'
      : "0",
    net_profit: columns.has("total_exchange_net_profit")
      ? '"total_exchange_net_profit"'
      : "NULL",
    chaos_to_divine_ratio: columns.has("exchange_chaos_to_divine")
      ? '"exchange_chaos_to_divine"'
      : "0",
    stacked_deck_chaos_cost: "0",
    created_at: "datetime('now')",
  };
  const selectList = targetColumns
    .map((column) =>
      selectColumnOrFallback(
        "session_summaries",
        column,
        columns,
        fallbackColumns,
      ),
    )
    .join(", ");

  db.exec(`
    INSERT INTO session_summaries_new (${insertColumns})
    SELECT ${selectList}
    FROM session_summaries
  `);
  db.exec("DROP TABLE session_summaries");
  db.exec("ALTER TABLE session_summaries_new RENAME TO session_summaries");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_summaries_game
    ON session_summaries(game)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_summaries_league
    ON session_summaries(league)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_summaries_started
    ON session_summaries(started_at DESC)
  `);
}

function rebuildUserSettings(db: Database.Database): void {
  if (!hasTable(db, "user_settings")) return;
  const columns = new Set(getColumnNames(db, "user_settings"));
  if (!columns.has("poe1_price_source") && !columns.has("poe2_price_source")) {
    return;
  }

  const tableSql = (
    db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_settings'",
      )
      .get() as { sql: string }
  ).sql;

  const createSql = tableSql
    .replace(/^CREATE TABLE user_settings/i, "CREATE TABLE user_settings_new")
    .replace(
      /,\s*poe1_price_source TEXT NOT NULL DEFAULT 'exchange' CHECK\(poe1_price_source IN \('exchange', 'stash'\)\)/,
      "",
    )
    .replace(
      /,\s*poe2_price_source TEXT NOT NULL DEFAULT 'exchange' CHECK\(poe2_price_source IN \('exchange', 'stash'\)\)/,
      "",
    )
    .replace(
      /,\s*poe2_price_source TEXT NOT NULL DEFAULT 'stash' CHECK\(poe2_price_source IN \('exchange', 'stash'\)\)/,
      "",
    );

  db.exec(createSql);

  const targetColumns = getColumnNames(db, "user_settings_new");
  const sourceColumns = getColumnNames(db, "user_settings");
  const sourceSet = new Set(sourceColumns);
  const insertColumns = targetColumns.map((column) => `"${column}"`).join(", ");
  const selectList = targetColumns
    .map((column) => (sourceSet.has(column) ? `"${column}"` : "NULL"))
    .join(", ");

  db.exec(`
    INSERT INTO user_settings_new (${insertColumns})
    SELECT ${selectList}
    FROM user_settings
  `);
  db.exec("DROP TABLE user_settings");
  db.exec("ALTER TABLE user_settings_new RENAME TO user_settings");
}

export const migration_20260625_120000_remove_stash_pricing: Migration = {
  id: MIGRATION_ID,
  description: "remove stash pricing schema and settings",

  up(db: Database.Database): void {
    rebuildSnapshotCardPrices(db);
    rebuildSnapshots(db);
    rebuildSessionCards(db);
    rebuildSessionSummaries(db);
    rebuildUserSettings(db);
  },

  down(): void {
    // Intentional no-op: this feature removal must not recreate retired pricing schema.
  },
};
