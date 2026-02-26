import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

import type { Database as DatabaseSchema } from "~/main/modules/database";
import type { Confidence, KnownRarity, Rarity } from "~/types/data-stores";

/**
 * Result from creating a test database.
 * Provides both the raw better-sqlite3 instance and the typed Kysely query builder.
 */
export interface TestDatabase {
  /** Raw better-sqlite3 database instance (in-memory) */
  db: Database.Database;
  /** Typed Kysely query builder */
  kysely: Kysely<DatabaseSchema>;
  /** Cleanly close the database and destroy the Kysely instance */
  close: () => Promise<void>;
}

/**
 * Initialize the full application schema on an in-memory database.
 * This mirrors Database.service.ts `initializeSchema()` exactly.
 */
function initializeSchema(db: Database.Database): void {
  const transaction = db.transaction(() => {
    // ═══════════════════════════════════════════════════════════════
    // GLOBAL STATS
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
      CREATE TABLE IF NOT EXISTS global_stats (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      )
    `);

    const count = db
      .prepare("SELECT COUNT(*) as count FROM global_stats")
      .get() as { count: number };

    if (count.count === 0) {
      db.prepare(
        "INSERT INTO global_stats (key, value) VALUES ('totalStackedDecksOpened', 0)",
      ).run();
    }

    // ═══════════════════════════════════════════════════════════════
    // LEAGUES METADATA
    // ═══════════════════════════════════════════════════════════════
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
      CREATE INDEX IF NOT EXISTS idx_leagues_game_name
      ON leagues(game, name)
    `);

    // ═══════════════════════════════════════════════════════════════
    // PRICE SNAPSHOTS
    // ═══════════════════════════════════════════════════════════════
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
      CREATE INDEX IF NOT EXISTS idx_snapshots_league_fetched
      ON snapshots(league_id, fetched_at DESC)
    `);

    // ═══════════════════════════════════════════════════════════════
    // SNAPSHOT CARD PRICES
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_snapshot_prices_snapshot
      ON snapshot_card_prices(snapshot_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_snapshot_prices_card
      ON snapshot_card_prices(card_name, price_source)
    `);

    // ═══════════════════════════════════════════════════════════════
    // SESSIONS
    // ═══════════════════════════════════════════════════════════════
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
        FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_game
      ON sessions(game)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_league
      ON sessions(league_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_active
      ON sessions(is_active)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_started
      ON sessions(started_at DESC)
    `);

    // ═══════════════════════════════════════════════════════════════
    // SESSION CARDS
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_cards_session
      ON session_cards(session_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_cards_name
      ON session_cards(card_name)
    `);

    // ═══════════════════════════════════════════════════════════════
    // SESSION SUMMARIES
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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

    // ═══════════════════════════════════════════════════════════════
    // PROCESSED IDS
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
      CREATE TABLE IF NOT EXISTS processed_ids (
        game TEXT NOT NULL,
        scope TEXT NOT NULL,
        processed_id TEXT NOT NULL,
        card_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (game, scope, processed_id)
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_processed_ids_game_scope
      ON processed_ids(game, scope)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_processed_ids_recent_drops
      ON processed_ids(game, scope, created_at DESC)
    `);

    // ═══════════════════════════════════════════════════════════════
    // CARDS (aggregate stats)
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cards_game_scope
      ON cards(game, scope)
    `);

    // ═══════════════════════════════════════════════════════════════
    // DIVINATION CARDS (static reference data)
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_game_name
      ON divination_cards(game, name)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_name
      ON divination_cards(name)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_stack_size
      ON divination_cards(stack_size)
    `);

    // ═══════════════════════════════════════════════════════════════
    // DIVINATION CARD RARITIES
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
      ON divination_card_rarities(game, league)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
      ON divination_card_rarities(card_name)
    `);

    // ═══════════════════════════════════════════════════════════════
    // POE LEAGUES CACHE
    // ═══════════════════════════════════════════════════════════════
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
      CREATE INDEX IF NOT EXISTS idx_poe_leagues_cache_game
      ON poe_leagues_cache (game)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_poe_leagues_cache_game_active
      ON poe_leagues_cache (game, is_active)
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS poe_leagues_cache_metadata (
        game TEXT NOT NULL PRIMARY KEY CHECK (game IN ('poe1', 'poe2')),
        last_fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ═══════════════════════════════════════════════════════════════
    // FILTER METADATA
    // ═══════════════════════════════════════════════════════════════
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
      CREATE INDEX IF NOT EXISTS idx_filter_metadata_type
      ON filter_metadata(filter_type)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_filter_metadata_file_path
      ON filter_metadata(file_path)
    `);

    // ═══════════════════════════════════════════════════════════════
    // FILTER CARD RARITIES
    // ═══════════════════════════════════════════════════════════════
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
      CREATE INDEX IF NOT EXISTS idx_filter_card_rarities_filter
      ON filter_card_rarities(filter_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_filter_card_rarities_card
      ON filter_card_rarities(card_name)
    `);

    // ═══════════════════════════════════════════════════════════════
    // USER SETTINGS
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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
        rarity_source TEXT NOT NULL DEFAULT 'poe.ninja'
          CHECK(rarity_source IN ('poe.ninja', 'filter', 'prohibited-library')),
        selected_filter_id TEXT REFERENCES filter_metadata(id) ON DELETE SET NULL,

        -- Post-update detection
        last_seen_app_version TEXT,

        -- Overlay customization
        overlay_font_size REAL NOT NULL DEFAULT 1.0,
        overlay_toolbar_font_size REAL NOT NULL DEFAULT 1.0,

        -- Main window position persistence
        main_window_bounds TEXT,

        -- Metadata
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      INSERT OR IGNORE INTO user_settings (id) VALUES (1)
    `);

    // ═══════════════════════════════════════════════════════════════
    // PROHIBITED LIBRARY CARD WEIGHTS
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pl_card_weights_game_league
      ON prohibited_library_card_weights(game, league)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pl_card_weights_card_name
      ON prohibited_library_card_weights(card_name)
    `);

    // ═══════════════════════════════════════════════════════════════
    // PROHIBITED LIBRARY CACHE METADATA
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
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
    // MIGRATIONS TABLE (used by MigrationRunner)
    // ═══════════════════════════════════════════════════════════════
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  });

  transaction();
}

/**
 * Create an in-memory test database with the full application schema.
 *
 * Each call returns a completely isolated database — no test interference.
 *
 * @example
 * ```ts
 * let testDb: TestDatabase;
 *
 * beforeEach(() => {
 *   testDb = createTestDatabase();
 * });
 *
 * afterEach(async () => {
 *   await testDb.close();
 * });
 *
 * it('should insert a card', async () => {
 *   const repo = new DataStoreRepository(testDb.kysely);
 *   await repo.upsertCard({ game: 'poe1', scope: 'all-time', cardName: 'The Doctor', timestamp: new Date().toISOString() });
 *   const cards = await repo.getCardsByScope('poe1', 'all-time');
 *   expect(cards).toHaveLength(1);
 * });
 * ```
 */
export function createTestDatabase(): TestDatabase {
  const db = new Database(":memory:");

  // Match production pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Apply the full schema
  initializeSchema(db);

  // Create Kysely instance
  const kysely = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: db,
    }),
  });

  return {
    db,
    kysely,
    close: async () => {
      await kysely.destroy();
      db.close();
    },
  };
}

// ─── Seed Data Helpers ─────────────────────────────────────────────────────────

/**
 * Insert a league into the test database and return its ID.
 */
export async function seedLeague(
  kysely: Kysely<DatabaseSchema>,
  options: {
    id?: string;
    game?: "poe1" | "poe2";
    name?: string;
    startDate?: string;
  } = {},
): Promise<string> {
  const id = options.id ?? crypto.randomUUID();
  const game = options.game ?? "poe1";
  const name = options.name ?? "Settlers";

  await kysely
    .insertInto("leagues")
    .values({
      id,
      game,
      name,
      start_date: options.startDate ?? "2025-01-01T00:00:00Z",
    })
    .execute();

  return id;
}

/**
 * Insert a snapshot with card prices into the test database.
 */
export async function seedSnapshot(
  kysely: Kysely<DatabaseSchema>,
  options: {
    id?: string;
    leagueId: string;
    fetchedAt?: string;
    exchangeChaosToDivine?: number;
    stashChaosToDivine?: number;
    stackedDeckChaosCost?: number;
    cardPrices?: Array<{
      cardName: string;
      priceSource: "exchange" | "stash";
      chaosValue: number;
      divineValue: number;
      confidence?: Confidence;
    }>;
  },
): Promise<string> {
  const id = options.id ?? crypto.randomUUID();

  await kysely
    .insertInto("snapshots")
    .values({
      id,
      league_id: options.leagueId,
      fetched_at: options.fetchedAt ?? new Date().toISOString(),
      exchange_chaos_to_divine: options.exchangeChaosToDivine ?? 200,
      stash_chaos_to_divine: options.stashChaosToDivine ?? 195,
      stacked_deck_chaos_cost: options.stackedDeckChaosCost ?? 3,
    })
    .execute();

  if (options.cardPrices && options.cardPrices.length > 0) {
    await kysely
      .insertInto("snapshot_card_prices")
      .values(
        options.cardPrices.map((cp) => ({
          snapshot_id: id,
          card_name: cp.cardName,
          price_source: cp.priceSource,
          chaos_value: cp.chaosValue,
          divine_value: cp.divineValue,
          confidence: cp.confidence ?? 1,
        })),
      )
      .execute();
  }

  return id;
}

/**
 * Insert a session into the test database.
 */
export async function seedSession(
  kysely: Kysely<DatabaseSchema>,
  options: {
    id?: string;
    game?: "poe1" | "poe2";
    leagueId: string;
    snapshotId?: string;
    startedAt?: string;
    endedAt?: string | null;
    totalCount?: number;
    isActive?: boolean;
  },
): Promise<string> {
  const id = options.id ?? crypto.randomUUID();

  await kysely
    .insertInto("sessions")
    .values({
      id,
      game: options.game ?? "poe1",
      league_id: options.leagueId,
      snapshot_id: options.snapshotId ?? null,
      started_at: options.startedAt ?? new Date().toISOString(),
      ended_at: options.endedAt ?? null,
      total_count: options.totalCount ?? 0,
      is_active: options.isActive === false ? 0 : 1,
    })
    .execute();

  return id;
}

/**
 * Insert session cards into the test database.
 */
export async function seedSessionCards(
  kysely: Kysely<DatabaseSchema>,
  sessionId: string,
  cards: Array<{
    cardName: string;
    count: number;
    hidePriceExchange?: boolean;
    hidePriceStash?: boolean;
  }>,
): Promise<void> {
  if (cards.length === 0) return;

  const now = new Date().toISOString();

  await kysely
    .insertInto("session_cards")
    .values(
      cards.map((card) => ({
        session_id: sessionId,
        card_name: card.cardName,
        count: card.count,
        hide_price_exchange: card.hidePriceExchange ? 1 : 0,
        hide_price_stash: card.hidePriceStash ? 1 : 0,
        first_seen_at: now,
        last_seen_at: now,
      })),
    )
    .execute();
}

/**
 * Insert card stats (the `cards` aggregate table) into the test database.
 */
export async function seedCards(
  kysely: Kysely<DatabaseSchema>,
  entries: Array<{
    game?: "poe1" | "poe2";
    scope: string;
    cardName: string;
    count: number;
    lastUpdated?: string;
  }>,
): Promise<void> {
  if (entries.length === 0) return;

  await kysely
    .insertInto("cards")
    .values(
      entries.map((e) => ({
        game: e.game ?? "poe1",
        scope: e.scope,
        card_name: e.cardName,
        count: e.count,
        last_updated: e.lastUpdated ?? new Date().toISOString(),
      })),
    )
    .execute();
}

/**
 * Insert a divination card into the reference data table.
 */
export async function seedDivinationCard(
  kysely: Kysely<DatabaseSchema>,
  options: {
    game?: "poe1" | "poe2";
    name: string;
    stackSize?: number;
    description?: string;
    rewardHtml?: string;
    artSrc?: string;
    flavourHtml?: string;
    dataHash?: string;
  },
): Promise<string> {
  const game = options.game ?? "poe1";
  const slug = options.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id = `${game}_${slug}`;

  await kysely
    .insertInto("divination_cards")
    .values({
      id,
      game,
      name: options.name,
      stack_size: options.stackSize ?? 1,
      description: options.description ?? "Test card description",
      reward_html: options.rewardHtml ?? "<span>Reward</span>",
      art_src: options.artSrc ?? "https://example.com/art.png",
      flavour_html: options.flavourHtml ?? "<i>Flavour text</i>",
      data_hash: options.dataHash ?? "testhash123",
    })
    .execute();

  return id;
}

/**
 * Insert divination card rarities into the test database.
 */
export async function seedDivinationCardRarity(
  kysely: Kysely<DatabaseSchema>,
  options: {
    game?: "poe1" | "poe2";
    league: string;
    cardName: string;
    rarity: Rarity;
  },
): Promise<void> {
  await kysely
    .insertInto("divination_card_rarities")
    .values({
      game: options.game ?? "poe1",
      league: options.league,
      card_name: options.cardName,
      rarity: options.rarity,
    })
    .execute();
}

/**
 * Insert a session summary into the test database.
 */
export async function seedSessionSummary(
  kysely: Kysely<DatabaseSchema>,
  options: {
    sessionId: string;
    game?: "poe1" | "poe2";
    league?: string;
    startedAt?: string;
    endedAt?: string;
    durationMinutes?: number;
    totalDecksOpened?: number;
    totalExchangeValue?: number;
    totalStashValue?: number;
    totalExchangeNetProfit?: number | null;
    totalStashNetProfit?: number | null;
    exchangeChaosToDivine?: number;
    stashChaosToDivine?: number;
    stackedDeckChaosCost?: number;
  },
): Promise<void> {
  await kysely
    .insertInto("session_summaries")
    .values({
      session_id: options.sessionId,
      game: options.game ?? "poe1",
      league: options.league ?? "Settlers",
      started_at: options.startedAt ?? "2025-01-01T10:00:00Z",
      ended_at: options.endedAt ?? "2025-01-01T11:00:00Z",
      duration_minutes: options.durationMinutes ?? 60,
      total_decks_opened: options.totalDecksOpened ?? 100,
      total_exchange_value: options.totalExchangeValue ?? 500,
      total_stash_value: options.totalStashValue ?? 480,
      total_exchange_net_profit: options.totalExchangeNetProfit ?? 200,
      total_stash_net_profit: options.totalStashNetProfit ?? 180,
      exchange_chaos_to_divine: options.exchangeChaosToDivine ?? 200,
      stash_chaos_to_divine: options.stashChaosToDivine ?? 195,
      stacked_deck_chaos_cost: options.stackedDeckChaosCost ?? 3,
    })
    .execute();
}

/**
 * Insert filter metadata into the test database.
 * Returns the filter ID.
 */
export async function seedFilterMetadata(
  kysely: Kysely<DatabaseSchema>,
  options: {
    id: string;
    filterType?: "local" | "online";
    filePath: string;
    filterName: string;
    lastUpdate?: string | null;
    isFullyParsed?: boolean;
    parsedAt?: string | null;
  },
): Promise<string> {
  await kysely
    .insertInto("filter_metadata")
    .values({
      id: options.id,
      filter_type: options.filterType ?? "local",
      file_path: options.filePath,
      filter_name: options.filterName,
      last_update: options.lastUpdate ?? null,
      is_fully_parsed: options.isFullyParsed ? 1 : 0,
      parsed_at: options.parsedAt ?? null,
    })
    .execute();

  return options.id;
}

/**
 * Insert a filter card rarity into the test database.
 * The filter must already exist in filter_metadata (foreign key constraint).
 */
export async function seedFilterCardRarity(
  kysely: Kysely<DatabaseSchema>,
  options: {
    filterId: string;
    cardName: string;
    rarity: KnownRarity;
  },
): Promise<void> {
  await kysely
    .insertInto("filter_card_rarities")
    .values({
      filter_id: options.filterId,
      card_name: options.cardName,
      rarity: options.rarity,
    })
    .execute();
}

/**
 * Bulk insert filter card rarities into the test database.
 * Convenience wrapper around seedFilterCardRarity for multiple cards.
 */
export async function seedFilterCardRarities(
  kysely: Kysely<DatabaseSchema>,
  filterId: string,
  rarities: Array<{ cardName: string; rarity: KnownRarity }>,
): Promise<void> {
  for (const entry of rarities) {
    await seedFilterCardRarity(kysely, {
      filterId,
      cardName: entry.cardName,
      rarity: entry.rarity,
    });
  }
}
