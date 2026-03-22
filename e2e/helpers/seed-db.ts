/**
 * E2E Database Seeding Helpers
 *
 * Utilities to seed the Electron app's SQLite database with the minimal data
 * required for e2e test flows that depend on leagues, snapshots, or other
 * main-process state.
 *
 * These helpers use the test-only IPC channels `e2e:db-exec` and `e2e:db-query`
 * that are registered by `DatabaseService` when the `E2E_TESTING` env var is
 * set to `"true"`. The channels are invoked from the renderer process via
 * `page.evaluate` → `window.electron.ipcRenderer.invoke(...)`.
 *
 * Every write uses `INSERT OR IGNORE` so helpers are idempotent — safe to call
 * multiple times with the same IDs.
 *
 * Includes helpers for simulating card drops during an active session
 * ({@link injectCardDrop}, {@link injectCardDrops}) which write directly to
 * `session_cards`, `processed_ids`, and `sessions.total_count`.
 *
 * @module e2e/helpers/seed-db
 */

import type { ElectronApplication, Page } from "@playwright/test";

import type { CardPriceHistoryFixture } from "../fixtures/poe-ninja-fixture";
import type { RarityInsightsCardFixture } from "../fixtures/rarity-insights-fixture";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeedLeagueOptions {
  /** Unique league ID. Defaults to `"poe1_standard"`. */
  id?: string;
  /** Game type. Defaults to `"poe1"`. */
  game?: string;
  /** League display name. Defaults to `"Standard"`. */
  name?: string;
  /** ISO start date string. Defaults to `"2013-01-23T00:00:00.000Z"`. */
  startDate?: string;
}

export interface SeedSnapshotOptions {
  /** Unique snapshot ID. Defaults to `"e2e-snapshot-001"`. */
  id?: string;
  /** League ID this snapshot belongs to. Defaults to `"poe1_standard"`. */
  leagueId?: string;
  /** ISO timestamp of when the snapshot was fetched. Defaults to now. */
  fetchedAt?: string;
  /** Chaos-to-divine exchange ratio. Defaults to `150`. */
  exchangeChaosToDivine?: number;
  /** Stash chaos-to-divine ratio. Defaults to `150`. */
  stashChaosToDivine?: number;
  /** Stacked deck chaos cost. Defaults to `1`. */
  stackedDeckChaosCost?: number;
}

export interface SeedCardRarityOptions {
  /** Game type. Defaults to `"poe1"`. */
  game?: string;
  /** League name. Defaults to `"Standard"`. */
  league?: string;
  /** The divination card name (must match a name in `divination_cards`). */
  cardName: string;
  /** Rarity tier: 0 = unknown, 1 = extremely rare, 2 = rare, 3 = less common, 4 = common. */
  rarity: number;
}

export interface SeedSnapshotCardPriceOptions {
  snapshotId: string;
  cardName: string;
  priceSource?: "exchange" | "stash";
  chaosValue?: number;
  divineValue?: number;
  confidence?: number;
}

// ─── Card Drop Injection Types ────────────────────────────────────────────────

export interface InjectCardDropOptions {
  /** The active session's ID (from `session.getInfo()`). */
  sessionId: string;
  /** Game type. Defaults to `"poe1"`. */
  game?: string;
  /** The card name to inject. */
  cardName: string;
  /**
   * A unique processed-ID string for duplicate-detection.
   * Defaults to a generated value based on timestamp + random suffix.
   */
  processedId?: string;
  /** ISO timestamp for the drop. Defaults to `new Date().toISOString()`. */
  timestamp?: string;
}

// ─── Internal: IPC wrappers ───────────────────────────────────────────────────

/**
 * Execute a write SQL statement (INSERT, UPDATE, DELETE) via the test-only
 * `e2e:db-exec` IPC channel exposed by `DatabaseService`.
 *
 * The channel calls `db.prepare(sql).run(...params)` in the main process and
 * returns `{ changes, lastInsertRowid }`.
 */
async function dbExec(
  page: Page,
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
  return page.evaluate(
    async ({ sql, params }) => {
      // The preload script exposes ipcRenderer on window.electron
      const electron = (window as any).electron;

      // Prefer the raw ipcRenderer if available (some preload setups expose it)
      if (electron?.ipcRenderer?.invoke) {
        return electron.ipcRenderer.invoke("e2e:db-exec", sql, params);
      }

      // Fallback: try a generic invoke helper if the preload exposes one
      throw new Error(
        "window.electron.ipcRenderer.invoke is not available — " +
          "ensure the preload script exposes ipcRenderer for e2e testing",
      );
    },
    { sql, params },
  );
}

/**
 * Execute a read SQL statement (SELECT) via the test-only `e2e:db-query` IPC
 * channel exposed by `DatabaseService`.
 *
 * The channel calls `db.prepare(sql).all(...params)` in the main process and
 * returns the result rows.
 */
async function dbQuery<T = Record<string, unknown>>(
  page: Page,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return page.evaluate(
    async ({ sql, params }) => {
      const electron = (window as any).electron;

      if (electron?.ipcRenderer?.invoke) {
        return electron.ipcRenderer.invoke("e2e:db-query", sql, params);
      }

      throw new Error(
        "window.electron.ipcRenderer.invoke is not available — " +
          "ensure the preload script exposes ipcRenderer for e2e testing",
      );
    },
    { sql, params },
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Seed a league row into the `leagues` table.
 *
 * Uses `INSERT OR IGNORE` so it's safe to call multiple times with the same ID.
 */
export async function seedLeague(
  page: Page,
  options: SeedLeagueOptions = {},
): Promise<string> {
  const {
    id = "poe1_standard",
    game = "poe1",
    name = "Standard",
    startDate = "2013-01-23T00:00:00.000Z",
  } = options;

  // Use INSERT OR REPLACE to guarantee the row exists. Plain INSERT OR IGNORE
  // silently skips on UNIQUE conflicts but that means the row might be missing
  // if a prior DELETE removed it — REPLACE ensures the row is always present.
  await dbExec(
    page,
    `INSERT OR REPLACE INTO leagues (id, game, name, start_date)
     VALUES (?, ?, ?, ?)`,
    [id, game, name, startDate],
  );

  return id;
}

/**
 * Seed a league row into the `poe_leagues_cache` table.
 *
 * This is the table that `PoeLeaguesService` reads from via
 * `PoeLeaguesRepository.getActiveLeaguesByGame()`.  The `seedLeague`
 * helper seeds the separate `leagues` table used by the snapshot
 * pipeline — it does NOT affect the league dropdown in the UI.
 *
 * Uses `INSERT OR REPLACE` (keyed on `(game, league_id)`) so it's
 * safe to call multiple times with the same game + leagueId.
 */
export async function seedLeagueCache(
  page: Page,
  options: {
    game?: string;
    leagueId?: string;
    name?: string;
    startAt?: string | null;
    endAt?: string | null;
  } = {},
): Promise<string> {
  const {
    game = "poe1",
    leagueId = "Standard",
    name = leagueId,
    startAt = null,
    endAt = null,
  } = options;

  const now = new Date().toISOString();
  const id = `${game}_${leagueId}`;

  await dbExec(
    page,
    `INSERT OR REPLACE INTO poe_leagues_cache
       (id, game, league_id, name, start_at, end_at, is_active, updated_at, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, game, leagueId, name, startAt, endAt, now, now],
  );

  // Also upsert the cache metadata so fetchLeagues() sees a fresh cache
  // and doesn't try to call Supabase (which would fail in E2E).
  await dbExec(
    page,
    `INSERT OR REPLACE INTO poe_leagues_cache_metadata (game, last_fetched_at)
     VALUES (?, ?)`,
    [game, now],
  );

  return id;
}

/**
 * Seed a snapshot row into the `snapshots` table.
 *
 * Uses `INSERT OR IGNORE` so it's safe to call multiple times.
 * Requires a league to exist first (call {@link seedLeague} beforehand).
 */
export async function seedSnapshot(
  page: Page,
  options: SeedSnapshotOptions = {},
): Promise<string> {
  const {
    id = "e2e-snapshot-001",
    leagueId = "poe1_standard",
    fetchedAt = new Date().toISOString(),
    exchangeChaosToDivine = 150,
    stashChaosToDivine = 150,
    stackedDeckChaosCost = 1,
  } = options;

  // Guard: INSERT OR IGNORE does NOT handle FOREIGN KEY violations in SQLite —
  // only UNIQUE / CHECK / NOT NULL.  Verify the league row exists first and
  // seed it if missing to avoid a hard FK error.
  const leagueRows = await dbQuery<{ id: string }>(
    page,
    `SELECT id FROM leagues WHERE id = ?`,
    [leagueId],
  );

  if (leagueRows.length === 0) {
    // Derive game and name from the leagueId convention "game_name"
    const underscoreIdx = leagueId.indexOf("_");
    const game = underscoreIdx > 0 ? leagueId.slice(0, underscoreIdx) : "poe1";
    const name =
      underscoreIdx > 0
        ? leagueId
            .slice(underscoreIdx + 1)
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : leagueId;

    await seedLeague(page, { id: leagueId, game, name });
  }

  await dbExec(
    page,
    `INSERT OR IGNORE INTO snapshots
       (id, league_id, fetched_at, exchange_chaos_to_divine,
        stash_chaos_to_divine, stacked_deck_chaos_cost,
        stacked_deck_max_volume_rate)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      leagueId,
      fetchedAt,
      exchangeChaosToDivine,
      stashChaosToDivine,
      stackedDeckChaosCost,
    ],
  );

  return id;
}

/**
 * Seed one or more card prices into the `snapshot_card_prices` table.
 *
 * Requires a snapshot to exist first (call {@link seedSnapshot} beforehand).
 */
export async function seedSnapshotCardPrices(
  page: Page,
  prices: SeedSnapshotCardPriceOptions[],
): Promise<void> {
  for (const p of prices) {
    await dbExec(
      page,
      `INSERT OR IGNORE INTO snapshot_card_prices
         (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        p.snapshotId,
        p.cardName,
        p.priceSource ?? "exchange",
        p.chaosValue ?? 10,
        p.divineValue ?? 0.07,
        p.confidence ?? 1,
      ],
    );
  }
}

/**
 * Seed divination card rarities for the given cards.
 *
 * This populates the `divination_card_rarities` table so the rarity filter
 * dropdown on the Cards page actually finds cards.
 */
export async function seedCardRarities(
  page: Page,
  rarities: SeedCardRarityOptions[],
): Promise<void> {
  for (const r of rarities) {
    await dbExec(
      page,
      `INSERT OR REPLACE INTO divination_card_rarities
         (game, league, card_name, rarity, last_updated)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [r.game ?? "poe1", r.league ?? "Standard", r.cardName, r.rarity],
    );
  }
}

// ─── Composite Seeders ────────────────────────────────────────────────────────

/**
 * Seed the minimum data required for a session to start successfully:
 * - A league row (`poe1/Standard` by default)
 * - A snapshot row linked to that league
 * - A handful of card prices so the session has *some* price data
 *
 * Returns the league ID and snapshot ID for further use.
 *
 * @example
 * ```ts
 * const { leagueId, snapshotId } = await seedSessionPrerequisites(page);
 * await callElectronAPI(page, "session", "start", "poe1", "Standard");
 * ```
 */
export async function seedSessionPrerequisites(
  page: Page,
  options: {
    game?: string;
    leagueName?: string;
    leagueId?: string;
    snapshotId?: string;
  } = {},
): Promise<{ leagueId: string; snapshotId: string }> {
  const game = options.game ?? "poe1";
  const leagueName = options.leagueName ?? "Standard";
  const leagueId =
    options.leagueId ??
    `${game}_${leagueName.toLowerCase().replace(/\s+/g, "-")}`;
  const snapshotId = options.snapshotId ?? `e2e-snapshot-${Date.now()}`;

  // 1. Seed the league
  await seedLeague(page, { id: leagueId, game, name: leagueName });

  // 2. Seed a snapshot
  await seedSnapshot(page, { id: snapshotId, leagueId });

  // 3. Seed a few representative card prices so the session has price data
  const sampleCards: SeedSnapshotCardPriceOptions[] = [
    {
      snapshotId,
      cardName: "The Doctor",
      chaosValue: 1250,
      divineValue: 8.5,
    },
    { snapshotId, cardName: "Humility", chaosValue: 1.5, divineValue: 0.01 },
    {
      snapshotId,
      cardName: "Rain of Chaos",
      chaosValue: 0.5,
      divineValue: 0.003,
    },
    {
      snapshotId,
      cardName: "House of Mirrors",
      chaosValue: 25000,
      divineValue: 165,
    },
    { snapshotId, cardName: "The Nurse", chaosValue: 150, divineValue: 1.0 },
    {
      snapshotId,
      cardName: "The Wretched",
      chaosValue: 2,
      divineValue: 0.013,
    },
    {
      snapshotId,
      cardName: "The Enlightened",
      chaosValue: 45,
      divineValue: 0.3,
    },
    {
      snapshotId,
      cardName: "Carrion Crow",
      chaosValue: 0.2,
      divineValue: 0.001,
    },
    // Low confidence cards (confidence=3) — stash-only pricing, no exchange data.
    // These ensure the "Hide low confidence prices" checkbox renders in the UI.
    {
      snapshotId,
      cardName: "Sambodhi's Wisdom",
      chaosValue: 300,
      divineValue: 2.0,
      confidence: 3,
    },
    {
      snapshotId,
      cardName: "Heterochromia",
      chaosValue: 85,
      divineValue: 0.57,
      confidence: 3,
    },
  ];

  await seedSnapshotCardPrices(page, sampleCards);

  return { leagueId, snapshotId };
}

// ─── Session Seeders ──────────────────────────────────────────────────────────

export interface SeedCompletedSessionOptions {
  /** Unique session ID. Defaults to a generated ID. */
  id?: string;
  /** Game type. Defaults to `"poe1"`. */
  game?: string;
  /** League ID (must match a seeded league row). Defaults to `"poe1_standard"`. */
  leagueId?: string;
  /** Snapshot ID. Defaults to `null`. */
  snapshotId?: string | null;
  /** ISO start timestamp. Defaults to 4 hours ago. */
  startedAt?: string;
  /** ISO end timestamp. Defaults to now. */
  endedAt?: string;
  /** Total card count. Overridden by the sum of card drops if provided. */
  totalCount?: number;
  /** Card drops to seed into `session_cards`. */
  cards?: Array<{
    cardName: string;
    count: number;
  }>;
}

/**
 * Seed a completed session row into the `sessions` table along with its
 * `session_cards` entries.
 *
 * This creates a fully self-contained session that will appear in the
 * Sessions history list. Prerequisites (league, snapshot) should be seeded
 * separately via {@link seedSessionPrerequisites} if not already present.
 *
 * Uses `INSERT OR IGNORE` so it's safe to call multiple times with the
 * same session ID.
 */
export async function seedCompletedSession(
  page: Page,
  options: SeedCompletedSessionOptions = {},
): Promise<string> {
  const now = new Date();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const {
    id = `e2e-session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    game = "poe1",
    leagueId = "poe1_standard",
    snapshotId = null,
    startedAt = fourHoursAgo.toISOString(),
    endedAt = now.toISOString(),
    cards = [
      { cardName: "The Doctor", count: 1 },
      { cardName: "Humility", count: 12 },
      { cardName: "Rain of Chaos", count: 35 },
      { cardName: "Carrion Crow", count: 50 },
    ],
  } = options;

  const totalCount =
    options.totalCount ?? cards.reduce((sum, c) => sum + c.count, 0);

  // Insert the session row
  await dbExec(
    page,
    `INSERT OR IGNORE INTO sessions
       (id, game, league_id, snapshot_id, started_at, ended_at, total_count, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, game, leagueId, snapshotId, startedAt, endedAt, totalCount],
  );

  // Insert session card rows
  for (const card of cards) {
    await dbExec(
      page,
      `INSERT OR IGNORE INTO session_cards
         (session_id, card_name, count, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, card.cardName, card.count, startedAt, endedAt],
    );
  }

  return id;
}

/**
 * Seed multiple completed sessions at once.
 *
 * A convenience wrapper around {@link seedCompletedSession} for tests that
 * need several sessions in the history (e.g. to test pagination, filtering,
 * or the sessions grid).
 */
export async function seedMultipleCompletedSessions(
  page: Page,
  sessions: SeedCompletedSessionOptions[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const session of sessions) {
    const id = await seedCompletedSession(page, session);
    ids.push(id);
  }
  return ids;
}

// ─── Card Drop Injection ──────────────────────────────────────────────────────

/**
 * Inject a single card drop into an **active** session.
 *
 * This simulates what `CurrentSessionService.addCard()` does in the main
 * process by writing directly to the three DB tables it touches:
 *
 * 1. `session_cards` — upsert the card row (increment count if it exists)
 * 2. `processed_ids` — insert a processed-ID row so `getRecentDrops()` picks it up
 * 3. `sessions` — recompute `total_count` from `session_cards`
 *
 * **Important**: this bypasses the in-memory `processedIds` Sets in the main
 * process. The main process will still consider these IDs as "new" if they
 * appear in a log file later. For E2E purposes this is fine because we never
 * feed the same IDs through the real log-reader pipeline.
 *
 * @returns The processed ID that was used (useful for assertions).
 */
export async function injectCardDrop(
  page: Page,
  options: InjectCardDropOptions,
): Promise<string> {
  const {
    sessionId,
    game = "poe1",
    cardName,
    processedId = `e2e-drop-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    timestamp = new Date().toISOString(),
  } = options;

  // 1. Upsert into session_cards (mirrors CurrentSessionRepository.incrementCardCount)
  await dbExec(
    page,
    `INSERT INTO session_cards (session_id, card_name, count, first_seen_at, last_seen_at, hide_price_exchange, hide_price_stash)
     VALUES (?, ?, 1, ?, ?, 0, 0)
     ON CONFLICT(session_id, card_name) DO UPDATE SET
       count = count + 1,
       last_seen_at = ?`,
    [sessionId, cardName, timestamp, timestamp, timestamp],
  );

  // 2. Insert into processed_ids so getRecentDrops() returns this card
  await dbExec(
    page,
    `INSERT OR IGNORE INTO processed_ids (game, scope, processed_id, card_name, created_at)
     VALUES (?, 'global', ?, ?, ?)`,
    [game, processedId, cardName, timestamp],
  );

  // 3. Recompute sessions.total_count from the actual session_cards rows
  await dbExec(
    page,
    `UPDATE sessions
     SET total_count = (
       SELECT COALESCE(SUM(count), 0) FROM session_cards WHERE session_id = ?
     )
     WHERE id = ?`,
    [sessionId, sessionId],
  );

  return processedId;
}

/**
 * Inject multiple card drops into an active session, optionally with a delay
 * between each drop to simulate realistic timing.
 *
 * After all drops are written to the database, this function emits a
 * `session:data-updated` event to the renderer so the Zustand store (and
 * therefore the UI table and overlay) reflects the new card data. Without
 * this step the DB is updated but the renderer store is never notified
 * because `injectCardDrop` bypasses `CurrentSessionService.addCard()`.
 *
 * @param page       - Playwright Page
 * @param sessionId  - The active session ID
 * @param drops      - Array of card names (or full options) to inject
 * @param options.delayMs    - Milliseconds to wait between each drop (default: 0)
 * @param options.game       - Game type (default: "poe1")
 * @param options.app        - ElectronApplication instance. When provided the
 *                             function emits `session:data-updated` to the
 *                             renderer after all drops are written, keeping
 *                             the UI in sync. If omitted the DB is updated
 *                             but the renderer store will NOT reflect the
 *                             new data until something else triggers a refresh.
 *
 * @returns Array of processed IDs that were used
 *
 * @example
 * ```ts
 * // Quick burst of 5 cards (with UI sync)
 * await injectCardDrops(page, sessionId, [
 *   "The Doctor", "Humility", "Rain of Chaos", "The Nurse", "Carrion Crow"
 * ], { app });
 *
 * // Throttled drops every 100ms
 * await injectCardDrops(page, sessionId, [
 *   "The Doctor", "Humility", "Rain of Chaos"
 * ], { delayMs: 100, app });
 *
 * // With full options per drop
 * await injectCardDrops(page, sessionId, [
 *   { cardName: "The Doctor", timestamp: "2025-01-01T00:00:00Z" },
 *   { cardName: "Humility" },
 * ], { app });
 * ```
 */
export async function injectCardDrops(
  page: Page,
  sessionId: string,
  drops: Array<string | Omit<InjectCardDropOptions, "sessionId">>,
  options: { delayMs?: number; game?: string; app?: ElectronApplication } = {},
): Promise<string[]> {
  const { delayMs = 0, game = "poe1", app } = options;
  const processedIds: string[] = [];

  for (let i = 0; i < drops.length; i++) {
    const drop = drops[i];
    const dropOptions: InjectCardDropOptions =
      typeof drop === "string"
        ? { sessionId, game, cardName: drop }
        : { ...drop, sessionId, game: drop.game ?? game };

    const pid = await injectCardDrop(page, dropOptions);
    processedIds.push(pid);

    if (delayMs > 0 && i < drops.length - 1) {
      await page.waitForTimeout(delayMs);
    }
  }

  // Notify the renderer store so the UI table / overlay updates.
  // injectCardDrop writes directly to SQLite, bypassing
  // CurrentSessionService.addCard() which normally emits
  // "session:data-updated". We replicate that event here.
  if (app) {
    await emitSessionDataUpdate(page, app, game);
  }

  return processedIds;
}

// ─── Renderer Store Sync ──────────────────────────────────────────────────────

/**
 * Emit a `session:data-updated` IPC event to the renderer, replicating
 * what `CurrentSessionService.emitSessionDataUpdate()` does in the main
 * process after every real card drop.
 *
 * This queries the current session via the existing `session.getCurrent`
 * IPC channel (which reads from SQLite) and broadcasts the result to all
 * BrowserWindows so the Zustand store picks it up and re-renders the
 * Current Session table and overlay.
 *
 * Call this after using `injectCardDrop` / `injectCardDrops` with raw
 * DB writes so the renderer stays in sync.
 *
 * @param page - Playwright Page (renderer)
 * @param app  - Playwright ElectronApplication (main process)
 * @param game - Game type whose session data to broadcast (default: "poe1")
 */
export async function emitSessionDataUpdate(
  page: Page,
  app: ElectronApplication,
  game: string = "poe1",
): Promise<void> {
  // 1. Read current session data from the DB via the existing IPC channel
  const sessionData = await page.evaluate(
    async ({ game }) => {
      const electron = (window as any).electron;
      if (electron?.session?.getCurrent) {
        return electron.session.getCurrent(game);
      }
      return null;
    },
    { game },
  );

  // 2. Broadcast to all renderer windows (mirrors emitSessionDataUpdate)
  await app.evaluate(
    ({ BrowserWindow }, { game, data }) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send("session:data-updated", { game, data });
        }
      }
    },
    { game, data: sessionData },
  );

  // 3. Give the renderer a tick to process the IPC event and re-render
  await page.waitForTimeout(100);
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Check whether a league row already exists in the database.
 */
export async function hasLeague(
  page: Page,
  game: string,
  leagueName: string,
): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    page,
    `SELECT id FROM leagues WHERE game = ? AND name = ?`,
    [game, leagueName],
  );
  return rows.length > 0;
}

/**
 * Check whether at least one snapshot row exists for a given league.
 */
export async function hasSnapshot(
  page: Page,
  leagueId: string,
): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    page,
    `SELECT id FROM snapshots WHERE league_id = ?`,
    [leagueId],
  );
  return rows.length > 0;
}

// ─── Multi-League Seeder ──────────────────────────────────────────────────────

/**
 * Seed multiple leagues with their snapshots and card prices.
 *
 * This is a convenience wrapper around {@link seedSessionPrerequisites} for
 * tests that need more than one league (e.g. starting sessions with different
 * leagues to verify they appear separately in session history).
 *
 * @example
 * ```ts
 * const leagues = await seedMultipleLeagues(page, [
 *   { game: "poe1", leagueName: "Standard" },
 *   { game: "poe1", leagueName: "Settlers of Kalguur" },
 * ]);
 * ```
 */
export async function seedMultipleLeagues(
  page: Page,
  leagues: Array<{
    game?: string;
    leagueName: string;
    leagueId?: string;
    snapshotId?: string;
  }>,
): Promise<
  Array<{ leagueId: string; snapshotId: string; leagueName: string }>
> {
  const results: Array<{
    leagueId: string;
    snapshotId: string;
    leagueName: string;
  }> = [];

  for (const league of leagues) {
    const { leagueId, snapshotId } = await seedSessionPrerequisites(page, {
      game: league.game,
      leagueName: league.leagueName,
      leagueId: league.leagueId,
      snapshotId: league.snapshotId,
    });
    results.push({ leagueId, snapshotId, leagueName: league.leagueName });
  }

  return results;
}

// ─── Price History Cache Seeding ──────────────────────────────────────────────

/**
 * Seed the `card_price_history_cache` table with a pre-built price history
 * fixture so that `CardDetailsService.getPriceHistory()` returns cached data
 * instead of hitting poe.ninja over the network.
 *
 * The `fetched_at` timestamp is set to "now" so the 30-minute cache TTL
 * check in `CardDetailsRepository.isCacheStale()` will treat the entry as
 * fresh. The `response_data` column stores the full `CardPriceHistoryDTO`
 * JSON blob — exactly the same shape that `getPriceHistory()` would persist
 * after a real poe.ninja fetch.
 *
 * Uses `INSERT OR REPLACE` (via the UNIQUE constraint on game+league+details_id)
 * so it's safe to call multiple times.
 *
 * @param page - Playwright Page (renderer) with access to the e2e:db-exec IPC channel
 * @param fixture - A `CardPriceHistoryFixture` from `e2e/fixtures/poe-ninja-fixture.ts`
 */
export async function seedPriceHistoryCache(
  page: Page,
  fixture: CardPriceHistoryFixture,
): Promise<void> {
  const now = new Date().toISOString();

  // Override fetchedAt to "now" so the cache is considered fresh (within TTL)
  const responseData: CardPriceHistoryFixture = {
    ...fixture,
    fetchedAt: now,
    isFromCache: true,
  };

  await dbExec(
    page,
    `INSERT OR REPLACE INTO card_price_history_cache
       (game, league, details_id, card_name, response_data, fetched_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fixture.game,
      fixture.league,
      fixture.detailsId,
      fixture.cardName,
      JSON.stringify(responseData),
      now,
      now,
      now,
    ],
  );
}

/**
 * Seed price history cache for multiple cards at once.
 *
 * @param page - Playwright Page
 * @param fixtures - Array of `CardPriceHistoryFixture` entries to seed
 */
export async function seedPriceHistoryCacheBatch(
  page: Page,
  fixtures: CardPriceHistoryFixture[],
): Promise<void> {
  for (const fixture of fixtures) {
    await seedPriceHistoryCache(page, fixture);
  }
}

// ─── Rarity Insights Composite Seeder ─────────────────────────────────────────

export interface SeedRarityInsightsOptions {
  /** Game type. Defaults to `"poe1"`. */
  game?: string;
  /** League name. Defaults to `"Standard"`. */
  league?: string;
  /** PL league label (as stored in prohibited_library_card_weights). Defaults to `league`. */
  plLeague?: string;
  /** Filter 1 ID. Defaults to `"e2e-filter-001"`. */
  filter1Id?: string;
  /** Filter 1 display name. Defaults to `"NeverSink's Semi-Strict"`. */
  filter1Name?: string;
  /** Filter 1 file path. Defaults to a synthetic path. */
  filter1Path?: string;
  /** Filter 2 ID. Defaults to `"e2e-filter-002"`. */
  filter2Id?: string;
  /** Filter 2 display name. Defaults to `"FilterBlade Uber-Strict"`. */
  filter2Name?: string;
  /** Filter 2 file path. Defaults to a synthetic path. */
  filter2Path?: string;
}

/**
 * Seed the complete Rarity Insights fixture data into the database.
 *
 * This is a composite seeder that populates:
 * 1. `divination_cards` — card metadata with `from_boss` flags
 * 2. `divination_card_rarities` — poe.ninja-derived rarities
 * 3. `prohibited_library_card_weights` — Prohibited Library weights + rarities
 * 4. `prohibited_library_cache_metadata` — marks PL data as loaded
 *
 * **Steps 5 & 6 are intentionally deferred:**
 * 5. `filter_metadata` — seeded later by `injectSeededFilters()`
 * 6. `filter_card_rarities` — seeded later by `injectSeededFilters()`
 *
 * Filter data is NOT seeded here because the Rarity Insights page auto-scans
 * filter directories on mount.  The scan's cleanup phase
 * (`deleteNotInFilePaths([])`) cascade-deletes all `filter_metadata` rows.
 * If we seed here, the scan races with the inserts, causing FK violations.
 * Instead, `injectSeededFilters()` waits for the scan to finish, then seeds.
 *
 * All writes use `INSERT OR REPLACE` / `INSERT OR IGNORE` for idempotency.
 *
 * @param page - Playwright Page (renderer) with access to e2e:db-exec IPC
 * @param cards - Array of `RarityInsightsCardFixture` entries
 * @param options - Optional overrides for game, league, etc.
 */
export async function seedRarityInsightsData(
  page: Page,
  cards: RarityInsightsCardFixture[],
  options: SeedRarityInsightsOptions = {},
): Promise<void> {
  const { game = "poe1", league = "Standard", plLeague = league } = options;

  const now = new Date().toISOString();

  // Retrieve the real app version so the PL cache metadata matches what
  // `ProhibitedLibraryService.ensureLoaded()` expects.  When the seeded
  // `app_version` matches the running version the service treats the data
  // as up-to-date and skips re-parsing the bundled CSV — which would
  // overwrite the fixture PL weights with production CSV data.
  const appVersion: string = await page.evaluate(() =>
    (window as any).electron.app.getVersion(),
  );

  // ── 1. Seed divination_cards ───────────────────────────────────────────
  for (const card of cards) {
    await dbExec(
      page,
      `INSERT OR REPLACE INTO divination_cards
         (id, name, stack_size, description, reward_html, art_src, flavour_html,
          game, data_hash, from_boss, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        card.name,
        card.stackSize,
        card.description,
        card.rewardHtml,
        card.artSrc,
        card.flavourHtml,
        card.game,
        card.dataHash,
        card.fromBoss ? 1 : 0,
        now,
        now,
      ],
    );
  }

  // ── 2. Seed divination_card_rarities (poe.ninja derived) ──────────────
  for (const card of cards) {
    await dbExec(
      page,
      `INSERT OR REPLACE INTO divination_card_rarities
         (game, league, card_name, rarity, last_updated)
       VALUES (?, ?, ?, ?, ?)`,
      [game, league, card.name, card.poeNinjaRarity, now],
    );
  }

  // ── 2b. Backfill divination_card_rarities for non-fixture bundled cards ─
  //
  // The bundled cards.json seeds ~382 cards into `divination_cards` on app
  // startup.  Without a `divination_card_rarities` row, `getAllByGame()`
  // returns `card.rarity = 0` (Unknown) for these cards.
  //
  // Meanwhile, `seedFilterData()` backfills `filter_card_rarities` with
  // rarity 4 (Common) for non-fixture cards (since filter rarities are
  // constrained to 1-4 and 0/Unknown maps to 4).
  //
  // The `getDifferences()` comparison checks `filterRarity !== ninjaRarity`.
  // Without this backfill: filterRarity=4 vs ninjaRarity=0 → false diff for
  // every non-fixture card, causing "Show differences only" to show ~382
  // cards instead of just the intentional fixture diffs.
  //
  // Fix: set poe.ninja rarity to 4 (Common) for every non-fixture card so
  // both sides agree (4 === 4 → no diff).
  const fixtureCardNames = new Set(cards.map((c) => c.name));
  const bundledCards = await dbQuery<{ name: string }>(
    page,
    `SELECT name FROM divination_cards WHERE game = ?`,
    [game],
  );

  for (const row of bundledCards) {
    if (fixtureCardNames.has(row.name)) continue;
    await dbExec(
      page,
      `INSERT OR IGNORE INTO divination_card_rarities
         (game, league, card_name, rarity, last_updated)
       VALUES (?, ?, ?, 4, ?)`,
      [game, league, row.name, now],
    );
  }

  // ── 3. Seed prohibited_library_card_weights ───────────────────────────
  for (const card of cards) {
    if (card.plWeight == null || card.plRarity == null) continue;
    await dbExec(
      page,
      `INSERT OR REPLACE INTO prohibited_library_card_weights
         (card_name, game, league, weight, rarity, from_boss, loaded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.name,
        game,
        plLeague,
        card.plWeight,
        card.plRarity,
        card.plFromBoss ? 1 : 0,
        now,
        now,
        now,
      ],
    );
  }

  // ── 4. Seed prohibited_library_cache_metadata ─────────────────────────
  //    Marks PL data as loaded so the app doesn't try to re-parse the CSV.
  await dbExec(
    page,
    `INSERT OR REPLACE INTO prohibited_library_cache_metadata
       (game, league, loaded_at, app_version, card_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      game,
      plLeague,
      now,
      appVersion,
      cards.filter((c) => c.plWeight != null).length,
      now,
      now,
    ],
  );

  // ── 5 & 6. filter_metadata + filter_card_rarities ─────────────────────
  // In E2E mode the filesystem auto-scan is disabled (see store hydrate()),
  // so these rows won't be cascade-deleted.  Seed them upfront alongside
  // everything else.
  await seedFilterData(page, cards);
}

// ─── Filter Data Seeder (steps 5 + 6, extracted) ─────────────────────────────

export interface SeedFilterDataOptions {
  filter1Id?: string;
  filter1Name?: string;
  filter1Path?: string;
  filter2Id?: string;
  filter2Name?: string;
  filter2Path?: string;
}

/**
 * Seed `filter_metadata` and `filter_card_rarities` into the database.
 *
 * Extracted from `seedRarityInsightsData` so it can be **re-called** after the
 * Rarity Insights page's auto-scan completes.  The auto-scan discovers 0
 * filters on CI (the fixture file paths don't exist on disk) and its cleanup
 * phase (`deleteNotInFilePaths([])`) cascades-deletes all `filter_metadata`
 * rows — taking `filter_card_rarities` with them.  By re-seeding after the
 * scan, `syncAvailableFiltersToStore` always finds the expected rows.
 */
export async function seedFilterData(
  page: Page,
  cards: RarityInsightsCardFixture[],
  options: SeedFilterDataOptions = {},
): Promise<void> {
  const {
    filter1Id = "e2e-filter-001",
    filter1Name = "NeverSink's Semi-Strict",
    filter1Path = "C:\\Users\\e2e\\Documents\\My Games\\Path of Exile\\NeverSink-SemiStrict.filter",
    filter2Id = "e2e-filter-002",
    filter2Name = "FilterBlade Uber-Strict",
    filter2Path = "C:\\Users\\e2e\\Documents\\My Games\\Path of Exile\\FilterBlade-UberStrict.filter",
  } = options;

  const now = new Date().toISOString();

  // ── filter_metadata (two mock filters, fully parsed) ──────────────────
  await dbExec(
    page,
    `INSERT OR REPLACE INTO filter_metadata
       (id, filter_type, file_path, filter_name, last_update, is_fully_parsed, parsed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [filter1Id, "local", filter1Path, filter1Name, now, now, now, now],
  );

  await dbExec(
    page,
    `INSERT OR REPLACE INTO filter_metadata
       (id, filter_type, file_path, filter_name, last_update, is_fully_parsed, parsed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [filter2Id, "online", filter2Path, filter2Name, now, now, now, now],
  );

  // ── filter_card_rarities (fixture cards with intentional diffs) ───────
  const fixtureCardNames = new Set(cards.map((c) => c.name));

  for (const card of cards) {
    if (card.filter1Rarity != null) {
      await dbExec(
        page,
        `INSERT OR REPLACE INTO filter_card_rarities
           (filter_id, card_name, rarity, created_at)
         VALUES (?, ?, ?, ?)`,
        [filter1Id, card.name, card.filter1Rarity, now],
      );
    }
    if (card.filter2Rarity != null) {
      await dbExec(
        page,
        `INSERT OR REPLACE INTO filter_card_rarities
           (filter_id, card_name, rarity, created_at)
         VALUES (?, ?, ?, ?)`,
        [filter2Id, card.name, card.filter2Rarity, now],
      );
    }
  }

  // ── Backfill filter_card_rarities for non-fixture cards ───────────────
  //
  // The bundled cards.json seeds ~382 cards into `divination_cards` on app
  // startup.  If we only seed filter rarities for the 12 fixture cards,
  // `getDifferences()` in the comparison slice defaults every missing card
  // to rarity 4 (Common).  For most non-fixture cards whose poe.ninja
  // rarity ≠ 4, this creates a false "difference" — so "Show differences
  // only" shows nearly ALL cards instead of just the intentional diffs.
  //
  // Fix: for every non-fixture card in `divination_cards`, seed a
  // `filter_card_rarities` row that matches its poe.ninja rarity (from
  // `divination_card_rarities`).  Cards with no poe.ninja row or rarity 0
  // default to 4 (Common).  This ensures only the 12 fixture cards with
  // intentionally mismatched rarities appear as differences.
  const nonFixtureCards = await dbQuery<{
    card_name: string;
    rarity: number | null;
  }>(
    page,
    `SELECT dc.name AS card_name,
            COALESCE(dcr.rarity, 0) AS rarity
       FROM divination_cards dc
       LEFT JOIN divination_card_rarities dcr
         ON dcr.card_name = dc.name
        AND dcr.game = 'poe1'
        AND dcr.league = 'Standard'
      WHERE dc.game = 'poe1'`,
  );

  for (const row of nonFixtureCards) {
    if (fixtureCardNames.has(row.card_name)) continue;

    // Map poe.ninja rarity to a valid KnownRarity (1-4).
    // Unknown (0) or null defaults to 4 (Common) — matching what the
    // comparison slice does: `p.rarities.get(card.name) ?? 4`.
    const filterRarity =
      row.rarity && row.rarity >= 1 && row.rarity <= 4 ? row.rarity : 4;

    await dbExec(
      page,
      `INSERT OR IGNORE INTO filter_card_rarities
         (filter_id, card_name, rarity, created_at)
       VALUES (?, ?, ?, ?)`,
      [filter1Id, row.card_name, filterRarity, now],
    );
    await dbExec(
      page,
      `INSERT OR IGNORE INTO filter_card_rarities
         (filter_id, card_name, rarity, created_at)
       VALUES (?, ?, ?, ?)`,
      [filter2Id, row.card_name, filterRarity, now],
    );
  }
}

/**
 * Seed divination cards into the `divination_cards` table only (no rarities
 * or filters). Useful when you just need cards to exist for `loadCards()`.
 *
 * @param page - Playwright Page
 * @param cards - Array of `RarityInsightsCardFixture` entries
 */
export async function seedDivinationCards(
  page: Page,
  cards: RarityInsightsCardFixture[],
): Promise<void> {
  const now = new Date().toISOString();
  for (const card of cards) {
    await dbExec(
      page,
      `INSERT OR REPLACE INTO divination_cards
         (id, name, stack_size, description, reward_html, art_src, flavour_html,
          game, data_hash, from_boss, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        card.name,
        card.stackSize,
        card.description,
        card.rewardHtml,
        card.artSrc,
        card.flavourHtml,
        card.game,
        card.dataHash,
        card.fromBoss ? 1 : 0,
        now,
        now,
      ],
    );
  }
}

/**
 * Sync seeded filter metadata from the database into the renderer's Zustand
 * store so the Filters dropdown is populated.
 *
 * In E2E mode the filesystem auto-scan is disabled (see store hydrate()),
 * so the `availableFilters` array and `lastScannedAt` timestamp are never
 * populated automatically.  This helper bridges the gap by:
 *
 *   1. Calling `window.electron.rarityInsights.getAll()` to read the seeded
 *      `filter_metadata` rows from the database.
 *   2. Pushing the result into the Zustand store's
 *      `rarityInsights.availableFilters` via `window.__zustandStore`.
 *   3. Stamping `lastScannedAt` so the Filters dropdown renders the
 *      "scanned" state (filter list) instead of the "scan prompt" state.
 *
 * When a filter is toggled in the UI, `toggleFilter` calls `parseFilter`
 * which IPCs to the main process.  Because the seeded filters are marked
 * `is_fully_parsed = 1`, `ensureFilterParsed` reads the cached
 * `filter_card_rarities` from the database instead of reading the filter
 * file from disk — so no store-level `parsedResults` injection is needed.
 *
 * Call this **after** navigating to the Rarity Insights page and waiting for
 * the initial render (i.e. after `waitForPageSettled`).
 *
 * @param page - Playwright Page with the Rarity Insights page loaded
 */
export async function syncAvailableFiltersToStore(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const electron = (window as any).electron;
    const store = (window as any).__zustandStore;

    if (!electron?.rarityInsights?.getAll) {
      throw new Error(
        "syncAvailableFiltersToStore: window.electron.rarityInsights.getAll is not available",
      );
    }
    if (!store) {
      throw new Error(
        "syncAvailableFiltersToStore: window.__zustandStore is not available — " +
          "ensure the renderer store exposes itself in E2E mode",
      );
    }

    const filters = await electron.rarityInsights.getAll();
    store.getState().rarityInsights.setAvailableFilters(filters);

    // Stamp lastScannedAt so that UI components (e.g. the Filters dropdown)
    // show the "scanned" state instead of the "scan prompt" state.
    store.setState(
      (s: any) => {
        s.rarityInsights.lastScannedAt = new Date().toISOString();
      },
      false,
      "e2e/syncAvailableFiltersToStore/stampLastScannedAt",
    );
  });
}

// ─── CSV Export Snapshot Seeding ─────────────────────────────────────────────

export interface SeedCsvExportSnapshotOptions {
  /** Game type. Defaults to `"poe1"`. */
  game?: string;
  /** Scope string (e.g. `"all-time"` or a league name). */
  scope: string;
  /** ISO timestamp of the export. Defaults to 1 hour ago. */
  exportedAt?: string;
  /** Card entries in the snapshot. */
  cards: Array<{
    cardName: string;
    count: number;
  }>;
}

/**
 * Seed a CSV export snapshot into the `csv_export_snapshots` table.
 *
 * This creates a snapshot record that the CSV export system uses to compute
 * deltas for incremental exports. After seeding, `csv.getSnapshotMeta(scope)`
 * will return `{ exists: true, ... }` and the "Export Latest Cards" button
 * will appear in the Statistics actions dropdown.
 *
 * Uses `INSERT OR REPLACE` so it's safe to call multiple times with the
 * same (game, scope, card_name) combination.
 *
 * @param page - Playwright Page
 * @param options - Snapshot configuration
 */
export async function seedCsvExportSnapshot(
  page: Page,
  options: SeedCsvExportSnapshotOptions,
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { game = "poe1", scope, exportedAt = oneHourAgo, cards } = options;

  const totalCount = cards.reduce((sum, c) => sum + c.count, 0);

  for (const card of cards) {
    await dbExec(
      page,
      `INSERT OR REPLACE INTO csv_export_snapshots
         (game, scope, card_name, count, total_count, exported_at, integrity_status, integrity_details)
       VALUES (?, ?, ?, ?, ?, ?, 'pass', NULL)`,
      [game, scope, card.cardName, card.count, totalCount, exportedAt],
    );
  }
}

// ─── Data Store Cards Seeding ───────────────────────────────────────────────

export interface SeedDataStoreCardsOptions {
  /** Game type. Defaults to `"poe1"`. */
  game?: string;
  /**
   * Scope string — `"all-time"` for aggregated stats, or a league name
   * (e.g. `"Standard"`, `"Settlers of Kalguur"`) for league-specific stats.
   */
  scope: string;
  /** Card entries to seed. */
  cards: Array<{
    cardName: string;
    count: number;
  }>;
}

/**
 * Seed rows into the `cards` table that backs the DataStore service.
 *
 * This is the table queried by:
 * - `dataStore.getAllTime(game)` — reads `scope = "all-time"`
 * - `dataStore.getLeague(game, league)` — reads `scope = <league>`
 * - `dataStore.getLeagues(game)` — returns `DISTINCT scope` where `scope != "all-time"`
 *
 * **Important:** The Statistics page, scope selector (league dropdown), and
 * CSV export all read from this table — *not* from `sessions` / `session_cards`.
 * If you only seed `sessions` the statistics page will show empty data and
 * the league dropdown will have no options.
 *
 * Uses `INSERT … ON CONFLICT DO UPDATE SET count = ?` so the final count is
 * exactly what you specify (not incremented). Safe to call multiple times.
 *
 * @example
 * ```ts
 * // Seed all-time aggregated stats
 * await seedDataStoreCards(page, {
 *   scope: "all-time",
 *   cards: [
 *     { cardName: "The Doctor", count: 5 },
 *     { cardName: "Humility", count: 60 },
 *   ],
 * });
 *
 * // Seed league-specific stats (also populates the league dropdown)
 * await seedDataStoreCards(page, {
 *   scope: "Standard",
 *   cards: [
 *     { cardName: "The Doctor", count: 5 },
 *     { cardName: "Humility", count: 20 },
 *   ],
 * });
 * ```
 */
export async function seedDataStoreCards(
  page: Page,
  options: SeedDataStoreCardsOptions,
): Promise<void> {
  const { game = "poe1", scope, cards } = options;
  const now = new Date().toISOString();

  for (const card of cards) {
    await dbExec(
      page,
      `INSERT INTO cards (game, scope, card_name, count, last_updated)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(game, scope, card_name) DO UPDATE SET
         count = excluded.count,
         last_updated = excluded.last_updated`,
      [game, scope, card.cardName, card.count, now],
    );
  }
}

/**
 * Convenience wrapper: seed the `cards` table for **both** the all-time scope
 * and one or more league scopes in a single call.
 *
 * For each league entry the cards are written under `scope = <leagueName>`.
 * An all-time row is also upserted by summing counts across all provided
 * leagues (merged with any pre-existing all-time rows).
 *
 * @example
 * ```ts
 * await seedDataStoreForStatistics(page, [
 *   {
 *     leagueName: "Standard",
 *     cards: [
 *       { cardName: "The Doctor", count: 5 },
 *       { cardName: "Humility", count: 20 },
 *     ],
 *   },
 *   {
 *     leagueName: "Settlers of Kalguur",
 *     cards: [
 *       { cardName: "Humility", count: 40 },
 *       { cardName: "House of Mirrors", count: 1 },
 *     ],
 *   },
 * ]);
 * ```
 */
export async function seedDataStoreForStatistics(
  page: Page,
  leagues: Array<{
    leagueName: string;
    cards: Array<{ cardName: string; count: number }>;
    game?: string;
  }>,
): Promise<void> {
  // Accumulator for all-time totals across all leagues
  const allTimeTotals = new Map<string, { count: number; game: string }>();

  for (const league of leagues) {
    const game = league.game ?? "poe1";

    // Seed league-specific scope
    await seedDataStoreCards(page, {
      game,
      scope: league.leagueName,
      cards: league.cards,
    });

    // Accumulate all-time totals
    for (const card of league.cards) {
      const existing = allTimeTotals.get(`${game}:${card.cardName}`);
      if (existing) {
        existing.count += card.count;
      } else {
        allTimeTotals.set(`${game}:${card.cardName}`, {
          count: card.count,
          game,
        });
      }
    }
  }

  // Seed all-time scope (one entry per game)
  const byGame = new Map<string, Array<{ cardName: string; count: number }>>();
  for (const [key, val] of allTimeTotals) {
    const cardName = key.split(":").slice(1).join(":");
    const arr = byGame.get(val.game) ?? [];
    arr.push({ cardName, count: val.count });
    byGame.set(val.game, arr);
  }

  for (const [game, cards] of byGame) {
    await seedDataStoreCards(page, { game, scope: "all-time", cards });
  }
}
