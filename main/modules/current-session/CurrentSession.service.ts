import crypto from "node:crypto";

import type BetterSqlite3 from "better-sqlite3";
import { BrowserWindow, ipcMain } from "electron";

import { CommunityUploadService } from "~/main/modules/community-upload";
import { DatabaseService } from "~/main/modules/database";
import { PerformanceLoggerService } from "~/main/modules/performance-logger";
import { RarityInsightsService } from "~/main/modules/rarity-insights/RarityInsights.service";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import { SnapshotService } from "~/main/modules/snapshots";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";
import {
  assertBoolean,
  assertBoundedString,
  assertCardName,
  assertGameType,
  assertPriceSource,
  assertSessionId,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import type {
  AggregatedTimeline,
  CardEntry,
  GameType,
  NotableDrop,
  Rarity,
  RecentDrop,
  SessionCardDelta,
  SessionPriceSnapshot,
  SessionTotals,
  TimelineBucket,
  TimelineDelta,
} from "../../../types/data-stores";
import { CurrentSessionChannel } from "./CurrentSession.channels";
import type { SessionCardEventDTO } from "./CurrentSession.dto";
import { CurrentSessionRepository } from "./CurrentSession.repository";

interface ActiveSessionInfo {
  sessionId: string;
  league: string;
  startedAt: string;
}

/**
 * CurrentSession Service - Refactored with Kysely + Repository Pattern
 * Manages active game sessions with type-safe database operations
 */
class CurrentSessionService {
  private static _instance: CurrentSessionService;

  private repository: CurrentSessionRepository;
  private rawDb: BetterSqlite3.Database;

  private snapshotService: SnapshotService;
  private perfLogger: PerformanceLoggerService;
  private rarityInsightsService: RarityInsightsService;
  private settingsStore: SettingsStoreService;

  // Active session tracking
  private poe1ActiveSession: ActiveSessionInfo | null = null;
  private poe2ActiveSession: ActiveSessionInfo | null = null;

  // In-memory processed IDs for current session (prevents duplicates)
  private poe1ProcessedIds: Set<string> = new Set();
  private poe2ProcessedIds: Set<string> = new Set();

  // Global processed IDs (persisted to DB)
  private poe1GlobalProcessedIds: Set<string> = new Set();
  private poe2GlobalProcessedIds: Set<string> = new Set();

  // In-memory timeline aggregation cache (per game)
  private poe1TimelineCache: AggregatedTimeline | null = null;
  private poe2TimelineCache: AggregatedTimeline | null = null;

  // Cached card rarity maps (populated alongside timeline cache)
  private poe1CardRarities: Map<string, number> | null = null;
  private poe2CardRarities: Map<string, number> | null = null;

  // In-memory snapshot cache per game (snapshot is immutable for the life of a session)
  private poe1SnapshotCache: {
    snapshotId: string;
    snapshot: SessionPriceSnapshot;
  } | null = null;
  private poe2SnapshotCache: {
    snapshotId: string;
    snapshot: SessionPriceSnapshot;
  } | null = null;

  // In-memory card count cache for incremental delta emission (avoids DB roundtrip on every drop)
  private poe1CardCounts: Map<string, number> = new Map();
  private poe2CardCounts: Map<string, number> = new Map();

  // Running totals cache (stash/exchange total values, updated incrementally)
  private poe1RunningTotals: { stashTotal: number; exchangeTotal: number } = {
    stashTotal: 0,
    exchangeTotal: 0,
  };
  private poe2RunningTotals: { stashTotal: number; exchangeTotal: number } = {
    stashTotal: 0,
    exchangeTotal: 0,
  };

  // Per-card hidePrice flags cache (cardName → { exchange: boolean, stash: boolean })
  private poe1HidePriceFlags: Map<
    string,
    { exchange: boolean; stash: boolean }
  > = new Map();
  private poe2HidePriceFlags: Map<
    string,
    { exchange: boolean; stash: boolean }
  > = new Map();

  // Per-card divination card metadata cache (for new card deltas)
  private poe1DivinationCardCache: Map<string, any> = new Map();
  private poe2DivinationCardCache: Map<string, any> = new Map();

  static getInstance(): CurrentSessionService {
    if (!CurrentSessionService._instance) {
      CurrentSessionService._instance = new CurrentSessionService();
    }
    return CurrentSessionService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new CurrentSessionRepository(db.getKysely());
    this.rawDb = db.getDb();

    this.snapshotService = SnapshotService.getInstance();
    this.perfLogger = PerformanceLoggerService.getInstance();
    this.rarityInsightsService = RarityInsightsService.getInstance();
    this.settingsStore = SettingsStoreService.getInstance();

    this.loadGlobalProcessedIds("poe1");
    this.loadGlobalProcessedIds("poe2");
    this.setupHandlers();
  }

  /**
   * Cleans up orphaned sessions from abrupt shutdowns
   */
  public async initialize(): Promise<void> {
    console.log(
      "[CurrentSession] Initializing and cleaning up orphaned sessions...",
    );

    // Deactivate any sessions that were left active from previous run
    await this.repository.deactivateAllSessions("poe1");
    await this.repository.deactivateAllSessions("poe2");

    // Clear recent drops from previous sessions
    await this.repository.clearRecentDrops("poe1");
    await this.repository.clearRecentDrops("poe2");

    console.log("[CurrentSession] Orphaned sessions cleaned up");
  }

  // ============================================================================
  // Processed IDs Management
  // ============================================================================

  /**
   * Load global processed IDs from database into memory
   */
  private async loadGlobalProcessedIds(game: GameType): Promise<void> {
    const rows = await this.repository.getProcessedIds(game);
    const processedSet =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;

    processedSet.clear();
    for (const row of rows) {
      processedSet.add(row.processedId);
    }
  }

  /**
   * Get all processed IDs for a game (session + global) for deduplication in parser.
   * Returns a lightweight object that checks both sets without copying.
   */
  public getAllProcessedIds(game: GameType): { has(id: string): boolean } {
    const sessionProcessedIds =
      game === "poe1" ? this.poe1ProcessedIds : this.poe2ProcessedIds;
    const globalProcessedIds =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;

    return {
      has: (id: string) =>
        sessionProcessedIds.has(id) || globalProcessedIds.has(id),
    };
  }

  // ============================================================================
  // IPC Handlers
  // ============================================================================

  private setupHandlers(): void {
    // Start session
    ipcMain.handle(
      CurrentSessionChannel.Start,
      async (_event, game: GameType, league: string) => {
        try {
          assertGameType(game, CurrentSessionChannel.Start);
          assertBoundedString(
            league,
            "league",
            CurrentSessionChannel.Start,
            256,
          );
          await this.startSession(game, league);
          return { success: true };
        } catch (error) {
          if (error instanceof IpcValidationError) {
            console.warn(`[Security] ${error.message}`);
            return { success: false, error: `Invalid input: ${error.detail}` };
          }
          console.error("Failed to start session:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    );

    // Stop session
    ipcMain.handle(
      CurrentSessionChannel.Stop,
      async (_event, game: GameType) => {
        try {
          assertGameType(game, CurrentSessionChannel.Stop);
          const result = await this.stopSession(game);
          return { success: true, ...result };
        } catch (error) {
          if (error instanceof IpcValidationError) {
            console.warn(`[Security] ${error.message}`);
            return { success: false, error: `Invalid input: ${error.detail}` };
          }
          console.error("Failed to stop session:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    );

    // Is active
    ipcMain.handle(CurrentSessionChannel.IsActive, (_event, game: GameType) => {
      try {
        assertGameType(game, CurrentSessionChannel.IsActive);
        return this.isSessionActive(game);
      } catch (error) {
        return handleValidationError(error, CurrentSessionChannel.IsActive);
      }
    });

    // Get current session
    ipcMain.handle(
      CurrentSessionChannel.Get,
      async (_event, game: GameType) => {
        try {
          assertGameType(game, CurrentSessionChannel.Get);
          return await this.getCurrentSession(game);
        } catch (error) {
          return handleValidationError(error, CurrentSessionChannel.Get);
        }
      },
    );

    // Get session info
    ipcMain.handle(CurrentSessionChannel.Info, (_event, game: GameType) => {
      try {
        assertGameType(game, CurrentSessionChannel.Info);
        return this.getActiveSessionInfo(game);
      } catch (error) {
        return handleValidationError(error, CurrentSessionChannel.Info);
      }
    });

    // Update card price visibility
    ipcMain.handle(
      CurrentSessionChannel.UpdateCardPriceVisibility,
      async (
        _event,
        game: GameType,
        sessionId: string,
        priceSource: "exchange" | "stash",
        cardName: string,
        hidePrice: boolean,
      ) => {
        try {
          assertGameType(game, CurrentSessionChannel.UpdateCardPriceVisibility);
          assertSessionId(
            sessionId,
            CurrentSessionChannel.UpdateCardPriceVisibility,
          );
          assertPriceSource(
            priceSource,
            CurrentSessionChannel.UpdateCardPriceVisibility,
          );
          assertCardName(
            cardName,
            CurrentSessionChannel.UpdateCardPriceVisibility,
          );
          assertBoolean(
            hidePrice,
            "hidePrice",
            CurrentSessionChannel.UpdateCardPriceVisibility,
          );
          await this.updateCardPriceVisibility(
            game,
            sessionId,
            priceSource,
            cardName,
            hidePrice,
          );
          return { success: true };
        } catch (error) {
          if (error instanceof IpcValidationError) {
            console.warn(`[Security] ${error.message}`);
            return { success: false, error: `Invalid input: ${error.detail}` };
          }
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    );

    // Get timeline data for a session (used by session details page)
    ipcMain.handle(
      CurrentSessionChannel.GetTimeline,
      async (_event, sessionId: string) => {
        try {
          assertSessionId(sessionId, CurrentSessionChannel.GetTimeline);

          // Get session cards for rarity map
          const selectedFilterId = await this.getActiveFilterId();
          const cards = await this.repository.getSessionCards(
            sessionId,
            selectedFilterId,
          );

          const raritySource = await this.settingsStore.get(
            SettingsKey.RaritySource,
          );

          // Build cards object for rarity map
          const cardsObject: Record<string, CardEntry> = {};
          const timelineHidePriceFlags = new Map<
            string,
            { exchange: boolean; stash: boolean }
          >();
          for (const card of cards) {
            cardsObject[card.cardName] = {
              name: card.cardName,
              count: card.count,
              divinationCard: card.divinationCard
                ? {
                    ...card.divinationCard,
                    id: card.divinationCard.id ?? "",
                    rarity: card.divinationCard.rarity ?? 4,
                    fromBoss: false,
                  }
                : undefined,
            };
            timelineHidePriceFlags.set(card.cardName, {
              exchange: card.hidePriceExchange,
              stash: card.hidePriceStash,
            });
          }

          const cardRarities = this.buildCardRaritiesMap(
            cardsObject,
            raritySource as string,
          );

          // Determine price source from session's game
          const session = await this.repository.getSessionById(sessionId);
          const timelinePriceSource: "exchange" | "stash" = session
            ? (((await this.settingsStore.get(
                session.game === "poe1"
                  ? SettingsKey.Poe1PriceSource
                  : SettingsKey.Poe2PriceSource,
              )) ?? "exchange") as "exchange" | "stash")
            : "exchange";

          const allEvents = await this.repository.getAllCardEvents(sessionId);
          return this.buildTimelineFromEvents(
            allEvents,
            cardRarities,
            timelineHidePriceFlags,
            timelinePriceSource,
          );
        } catch (error) {
          if (error instanceof IpcValidationError) {
            console.warn(`[Security] ${error.message}`);
            return null;
          }
          console.error(
            `[CurrentSession] Failed to get timeline for ${sessionId}:`,
            error,
          );
          return null;
        }
      },
    );
  }

  // ============================================================================
  // Session Lifecycle
  // ============================================================================

  /**
   * Start a new session
   */
  public async startSession(game: GameType, league: string): Promise<void> {
    console.log(
      `[CurrentSession] startSession called: game=${game}, league="${league}"`,
    );

    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (activeSession) {
      throw new Error(`Session already active for ${game}`);
    }

    // If rarity source is "filter", ensure the selected filter is parsed before starting
    const raritySource = await this.settingsStore.get(SettingsKey.RaritySource);
    if (raritySource === "filter") {
      const selectedFilterId = await this.settingsStore.get(
        SettingsKey.SelectedFilterId,
      );

      if (!selectedFilterId) {
        console.warn(
          "[CurrentSession] Rarity source is 'filter' but no filter is selected — falling back to poe.ninja rarities",
        );
      } else {
        console.log(
          `[CurrentSession] Rarity source is 'filter' — ensuring filter ${selectedFilterId} is parsed...`,
        );
        const parseResult =
          await this.rarityInsightsService.ensureFilterParsed(selectedFilterId);

        if (!parseResult) {
          console.warn(
            `[CurrentSession] Selected filter ${selectedFilterId} not found — falling back to poe.ninja rarities`,
          );
        } else if (!parseResult.hasDivinationSection) {
          console.warn(
            `[CurrentSession] Selected filter "${parseResult.filterName}" has no divination section — falling back to poe.ninja rarities`,
          );
        } else {
          console.log(
            `[CurrentSession] Filter "${parseResult.filterName}" is ready with ${parseResult.totalCards} card rarities`,
          );
        }
      }
    }

    // Get or create snapshot for this league
    const { snapshotId, data: _priceSnapshot } =
      await this.snapshotService.getSnapshotForSession(game, league);

    // Start auto-refresh for this league
    this.snapshotService.startAutoRefresh(game, league);

    const sessionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Get league ID via repository
    const leagueId = await this.repository.getLeagueId(game, league);
    if (!leagueId) {
      throw new Error(`League not found: ${game}/${league}`);
    }

    // Create session via repository
    await this.repository.createSession({
      id: sessionId,
      game,
      leagueId,
      snapshotId,
      startedAt,
    });

    // Set active session
    const sessionInfo: ActiveSessionInfo = { sessionId, league, startedAt };

    if (game === "poe1") {
      this.poe1ActiveSession = sessionInfo;
      this.poe1ProcessedIds.clear();
      this.poe1TimelineCache = null;
      this.poe1CardRarities = null;
      this.poe1SnapshotCache = null;
      this.poe1CardCounts.clear();
      this.poe1RunningTotals = { stashTotal: 0, exchangeTotal: 0 };
      this.poe1HidePriceFlags.clear();
      this.poe1DivinationCardCache.clear();
    } else {
      this.poe2ActiveSession = sessionInfo;
      this.poe2ProcessedIds.clear();
      this.poe2TimelineCache = null;
      this.poe2CardRarities = null;
      this.poe2SnapshotCache = null;
      this.poe2CardCounts.clear();
      this.poe2RunningTotals = { stashTotal: 0, exchangeTotal: 0 };
      this.poe2HidePriceFlags.clear();
      this.poe2DivinationCardCache.clear();
    }
    this.emitSessionStateChange(game);
  }

  /**
   * Stop the active session
   */
  public async stopSession(game: GameType): Promise<{
    totalCount: number;
    durationMs: number;
    league: string;
    game: GameType;
  }> {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) {
      throw new Error(`No active session for ${game}`);
    }

    const endedAt = new Date().toISOString();
    const startedAt = new Date(activeSession.startedAt).getTime();
    const durationMs = Date.now() - startedAt;

    // Get total count via repository
    const totalCount = await this.repository.getSessionTotalCount(
      activeSession.sessionId,
    );

    // Update session via repository
    await this.repository.updateSession(activeSession.sessionId, {
      totalCount,
      endedAt,
      isActive: false,
    });

    // Create session summary for fast list queries
    await this.createSessionSummary(
      activeSession.sessionId,
      game,
      activeSession.league,
      endedAt,
    );

    // Community upload (fire-and-forget — must not block session teardown)
    CommunityUploadService.getInstance()
      .uploadOnSessionEnd(game, activeSession.league, activeSession.sessionId)
      .catch(() => {}); // Error already logged inside uploadOnSessionEnd

    // Clear recent drops (processed_ids table) and re-sync the in-memory set
    // so it matches the pruned DB (otherwise it grows unboundedly across sessions)
    await this.repository.clearRecentDrops(game);
    await this.loadGlobalProcessedIds(game);

    // Stop auto-refresh
    this.snapshotService.stopAutoRefresh(game, activeSession.league);

    // Capture league before clearing
    const league = activeSession.league;

    // Clear active session and caches
    if (game === "poe1") {
      this.poe1ActiveSession = null;
      this.poe1ProcessedIds.clear();
      this.poe1TimelineCache = null;
      this.poe1CardRarities = null;
      this.poe1SnapshotCache = null;
      this.poe1CardCounts.clear();
      this.poe1RunningTotals = { stashTotal: 0, exchangeTotal: 0 };
      this.poe1HidePriceFlags.clear();
      this.poe1DivinationCardCache.clear();
    } else {
      this.poe2ActiveSession = null;
      this.poe2ProcessedIds.clear();
      this.poe2TimelineCache = null;
      this.poe2CardRarities = null;
      this.poe2SnapshotCache = null;
      this.poe2CardCounts.clear();
      this.poe2RunningTotals = { stashTotal: 0, exchangeTotal: 0 };
      this.poe2HidePriceFlags.clear();
      this.poe2DivinationCardCache.clear();
    }

    this.emitSessionStateChange(game);

    return { totalCount, durationMs, league, game };
  }

  /**
   * Create session summary for analytics
   */
  private async createSessionSummary(
    sessionId: string,
    game: GameType,
    league: string,
    endedAt: string,
  ): Promise<void> {
    // Get session details via repository
    const session = await this.repository.getSessionById(sessionId);
    if (!session) return;

    // Get session cards
    const cards = await this.repository.getSessionCards(sessionId);

    // Get price snapshot - FIXED: use loadSnapshot instead of getSnapshotById
    if (!session.snapshotId) return;

    const priceSnapshot = await this.snapshotService.loadSnapshot(
      session.snapshotId,
    );
    if (!priceSnapshot) return;

    // Calculate totals
    let exchangeTotal = 0;
    let stashTotal = 0;

    for (const card of cards) {
      const exchangePrice = priceSnapshot.exchange.cardPrices[card.cardName];
      const stashPrice = priceSnapshot.stash.cardPrices[card.cardName];

      if (exchangePrice && !card.hidePriceExchange) {
        exchangeTotal += exchangePrice.chaosValue * card.count;
      }
      if (stashPrice && !card.hidePriceStash) {
        stashTotal += stashPrice.chaosValue * card.count;
      }
    }

    // Calculate net profit (subtract stacked deck investment)
    const deckCost = priceSnapshot.stackedDeckChaosCost ?? 0;
    const totalDeckCost = deckCost * session.totalCount;
    const exchangeNetProfit = exchangeTotal - totalDeckCost;
    const stashNetProfit = stashTotal - totalDeckCost;

    // Calculate duration
    const start = new Date(session.startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const durationMinutes = Math.round((end - start) / 1000 / 60);

    // Create summary via repository
    await this.repository.createSessionSummary({
      sessionId,
      game,
      league,
      startedAt: session.startedAt,
      endedAt,
      durationMinutes,
      totalDecksOpened: session.totalCount,
      totalExchangeValue: exchangeTotal,
      totalStashValue: stashTotal,
      totalExchangeNetProfit: exchangeNetProfit,
      totalStashNetProfit: stashNetProfit,
      exchangeChaosToDivine: priceSnapshot.exchange.chaosToDivineRatio,
      stashChaosToDivine: priceSnapshot.stash.chaosToDivineRatio,
      stackedDeckChaosCost: deckCost,
    });
  }

  // ============================================================================
  // Card Management
  // ============================================================================

  /**
   * Add a card to the current session
   */
  public async addCard(
    game: GameType,
    league: string,
    cardName: string,
    processedId: string,
  ): Promise<void> {
    const perf = this.perfLogger.startTimers();

    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) {
      throw new Error(`No active session for ${game}`);
    }

    // Check for duplicates
    const sessionProcessedIds =
      game === "poe1" ? this.poe1ProcessedIds : this.poe2ProcessedIds;
    const globalProcessedIds =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;

    if (
      sessionProcessedIds.has(processedId) ||
      globalProcessedIds.has(processedId)
    ) {
      return; // Already processed
    }

    const _dupCheckTime = perf?.end("dupCheck") ?? 0;

    // Add to session-scoped set
    sessionProcessedIds.add(processedId);

    // Add to global set immediately (for in-memory duplicate prevention)
    const globalSet =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;
    globalSet.add(processedId);

    // Resolve card price at drop time for timeline tracking
    let chaosValue: number | null = null;
    let divineValue: number | null = null;

    const snapshotCache =
      game === "poe1" ? this.poe1SnapshotCache : this.poe2SnapshotCache;
    if (snapshotCache) {
      const priceSource =
        game === "poe1"
          ? await this.settingsStore.get(SettingsKey.Poe1PriceSource)
          : await this.settingsStore.get(SettingsKey.Poe2PriceSource);
      const prices =
        priceSource === "stash"
          ? snapshotCache.snapshot.stash.cardPrices[cardName]
          : snapshotCache.snapshot.exchange.cardPrices[cardName];
      chaosValue = prices?.chaosValue ?? null;
      divineValue = prices?.divineValue ?? null;
    }

    // Perform all hot-path DB writes in a single synchronous better-sqlite3
    // transaction. This replaces the sequential awaits of incrementCardCount(),
    // saveProcessedId(), and DataStore.addCard() — eliminating ~6 event-loop
    // yields per card drop.
    const now = new Date().toISOString();
    this.repository.addCardSync(this.rawDb, {
      sessionId: activeSession.sessionId,
      cardName,
      timestamp: now,
      chaosValue,
      divineValue,
      game,
      league,
      processedId,
    });

    // Ensure rarity map has this card before appending to timeline cache
    await this.ensureCardInRarityMap(game, activeSession.league, cardName);

    // Append to timeline cache (O(1) incremental update)
    const priceSourceForTimeline =
      game === "poe1"
        ? await this.settingsStore.get(SettingsKey.Poe1PriceSource)
        : await this.settingsStore.get(SettingsKey.Poe2PriceSource);
    const timelineDelta = this.appendToTimelineCache(
      game,
      {
        cardName,
        chaosValue,
        divineValue,
        droppedAt: now,
      },
      (priceSourceForTimeline ?? "exchange") as "exchange" | "stash",
    );

    // Emit timeline delta separately (lightweight, bypasses full session rebuild)
    if (timelineDelta) {
      const windows = BrowserWindow.getAllWindows();
      for (const window of windows) {
        window.webContents.send(CurrentSessionChannel.TimelineDelta, {
          game,
          delta: timelineDelta,
        });
      }
    }

    // Ensure divination card metadata is cached for this card (so the delta
    // includes full artwork/stackSize/etc. instead of a minimal stub).
    const divinationCardCache =
      game === "poe1"
        ? this.poe1DivinationCardCache
        : this.poe2DivinationCardCache;
    if (!divinationCardCache.has(cardName)) {
      const meta = await this.repository.getDivinationCardMetadata(
        game,
        cardName,
      );
      if (meta) {
        const rarities =
          game === "poe1" ? this.poe1CardRarities : this.poe2CardRarities;
        divinationCardCache.set(cardName, {
          id: meta.id,
          stackSize: meta.stackSize,
          description: meta.description,
          rewardHtml: cleanWikiMarkup(meta.rewardHtml),
          artSrc: meta.artSrc,
          flavourHtml: cleanWikiMarkup(meta.flavourHtml),
          rarity: rarities?.get(cardName) ?? 4,
          fromBoss: false,
        });
      }
    }

    // Build and emit a lightweight card delta instead of full session rebuild
    const cardDelta = this.buildCardDelta(game, cardName);
    if (cardDelta) {
      const windows = BrowserWindow.getAllWindows();
      for (const window of windows) {
        window.webContents.send(CurrentSessionChannel.CardDelta, {
          game,
          delta: cardDelta,
        });
      }
    }
  }

  // ============================================================================
  // Session Queries
  // ============================================================================

  /**
   * Check if a session is active
   */
  public isSessionActive(game: GameType): boolean {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;
    return activeSession !== null;
  }

  /**
   * Get active session info
   */
  public getActiveSessionInfo(game: GameType): ActiveSessionInfo | null {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) {
      return null;
    }

    return {
      league: activeSession.league,
      startedAt: activeSession.startedAt,
      sessionId: activeSession.sessionId,
    };
  }

  /**
   * Get current session with full details
   */
  public async getCurrentSession(game: GameType): Promise<any> {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) {
      return null;
    }

    // Get session from repository
    const session = await this.repository.getSessionById(
      activeSession.sessionId,
    );

    if (!session) {
      return null;
    }

    // Get price snapshot
    const priceSnapshot = session.snapshotId
      ? await this.snapshotService.loadSnapshot(session.snapshotId)
      : null;

    // Cache the snapshot for fast access in addCard() / buildCardDelta()
    if (priceSnapshot && session.snapshotId) {
      if (game === "poe1") {
        this.poe1SnapshotCache = {
          snapshotId: session.snapshotId,
          snapshot: priceSnapshot,
        };
      } else {
        this.poe2SnapshotCache = {
          snapshotId: session.snapshotId,
          snapshot: priceSnapshot,
        };
      }
    }

    // Get the selected filter ID for filter-based rarity lookups
    const selectedFilterId = await this.getActiveFilterId();

    const cards = await this.repository.getSessionCards(
      activeSession.sessionId,
      selectedFilterId,
    );

    // Build cards object with prices
    const cardsObject: Record<string, CardEntry> = {};

    for (const card of cards) {
      const cardEntry: CardEntry = {
        name: card.cardName,
        count: card.count,
        processedIds: [], // Not tracking individual IDs per card anymore
        divinationCard: card.divinationCard
          ? {
              ...card.divinationCard,
              id: card.divinationCard.id ?? "",
              rarity: card.divinationCard.rarity ?? 4,
              fromBoss: false,
            }
          : undefined,
      };

      // Add price data if snapshot exists
      if (priceSnapshot) {
        const exchangeData = priceSnapshot.exchange.cardPrices[card.cardName];
        const stashData = priceSnapshot.stash.cardPrices[card.cardName];

        // Always add exchangePrice (even if no data) so hidePrice flag is available
        cardEntry.exchangePrice = exchangeData
          ? {
              chaosValue: exchangeData.chaosValue,
              divineValue: exchangeData.divineValue,
              totalValue: exchangeData.chaosValue * card.count,
              hidePrice: card.hidePriceExchange,
            }
          : {
              chaosValue: 0,
              divineValue: 0,
              totalValue: 0,
              hidePrice: card.hidePriceExchange,
            };

        // Always add stashPrice (even if no data) so hidePrice flag is available
        cardEntry.stashPrice = stashData
          ? {
              chaosValue: stashData.chaosValue,
              divineValue: stashData.divineValue,
              totalValue: stashData.chaosValue * card.count,
              hidePrice: card.hidePriceStash,
            }
          : {
              chaosValue: 0,
              divineValue: 0,
              totalValue: 0,
              hidePrice: card.hidePriceStash,
            };
      }

      cardsObject[card.cardName] = cardEntry;
    }

    // Calculate totals - handle null priceSnapshot
    const totals = priceSnapshot
      ? this.calculateSessionTotals(
          cardsObject,
          priceSnapshot,
          session.totalCount,
        )
      : {
          exchange: { totalValue: 0, netProfit: 0, chaosToDivineRatio: 0 },
          stash: { totalValue: 0, netProfit: 0, chaosToDivineRatio: 0 },
          stackedDeckChaosCost: 0,
          totalDeckCost: 0,
        };

    // Determine which rarity source is active for display purposes
    const raritySource = await this.settingsStore.get(SettingsKey.RaritySource);

    // Get recent drops (last 20 individual card drops in chronological order)
    const recentDropsRaw = await this.repository.getRecentDrops(game, 20);

    const recentDrops = recentDropsRaw.map((cardName) => {
      const cardData = cardsObject[cardName];

      // Get the actual rarity from divination card metadata.
      // If rarity source is "filter" and filter rarity is available, use it.
      // Otherwise fall back to poe.ninja price-based rarity.
      const filterRarity = cardData?.divinationCard?.filterRarity;
      const priceRarity = cardData?.divinationCard?.rarity ?? 4;
      const actualRarity =
        raritySource === "filter" && filterRarity != null
          ? filterRarity
          : priceRarity;

      // Check if the card is marked as hidden for either price source
      // Hidden cards are typically those with unreliable pricing due to market manipulation
      const isHiddenExchange = cardData?.exchangePrice?.hidePrice || false;
      const isHiddenStash = cardData?.stashPrice?.hidePrice || false;

      // If the card is hidden for either source, treat it as common (rarity 4)
      // This prevents showing inflated rarity for poorly-priced cards
      const displayRarity =
        isHiddenExchange || isHiddenStash ? 4 : actualRarity;

      return {
        cardName,
        rarity: displayRarity,
        exchangePrice: {
          chaosValue: cardData?.exchangePrice?.chaosValue || 0,
          divineValue: cardData?.exchangePrice?.divineValue || 0,
        },
        stashPrice: {
          chaosValue: cardData?.stashPrice?.chaosValue || 0,
          divineValue: cardData?.stashPrice?.divineValue || 0,
        },
      };
    });

    // Convert cards object to array with name included
    const cardsArray = Object.entries(cardsObject).map(([cardName, entry]) => ({
      ...entry,
      name: cardName,
    }));

    // Seed in-memory caches for incremental delta emission.
    // This ensures buildCardDelta() has warm caches after hydration / session resume.
    const cardCounts =
      game === "poe1" ? this.poe1CardCounts : this.poe2CardCounts;
    const runningTotals =
      game === "poe1" ? this.poe1RunningTotals : this.poe2RunningTotals;
    const hidePriceFlags =
      game === "poe1" ? this.poe1HidePriceFlags : this.poe2HidePriceFlags;
    const divinationCardCache =
      game === "poe1"
        ? this.poe1DivinationCardCache
        : this.poe2DivinationCardCache;

    cardCounts.clear();
    let seedStashTotal = 0;
    let seedExchangeTotal = 0;

    for (const [name, entry] of Object.entries(cardsObject)) {
      cardCounts.set(name, entry.count);
      hidePriceFlags.set(name, {
        exchange: entry.exchangePrice?.hidePrice ?? false,
        stash: entry.stashPrice?.hidePrice ?? false,
      });
      if (entry.exchangePrice && !entry.exchangePrice.hidePrice) {
        seedExchangeTotal += entry.exchangePrice.totalValue;
      }
      if (entry.stashPrice && !entry.stashPrice.hidePrice) {
        seedStashTotal += entry.stashPrice.totalValue;
      }
      if (entry.divinationCard) {
        divinationCardCache.set(name, entry.divinationCard);
      }
    }
    runningTotals.stashTotal = seedStashTotal;
    runningTotals.exchangeTotal = seedExchangeTotal;

    // Build or return cached timeline
    let timelineCache =
      game === "poe1" ? this.poe1TimelineCache : this.poe2TimelineCache;

    if (!timelineCache) {
      // First call or after cache clear — build from DB
      const allEvents = await this.repository.getAllCardEvents(
        activeSession.sessionId,
      );
      const cardRarities = this.buildCardRaritiesMap(
        cardsObject,
        raritySource as string,
      );
      const timelinePriceSource =
        (game === "poe1"
          ? await this.settingsStore.get(SettingsKey.Poe1PriceSource)
          : await this.settingsStore.get(SettingsKey.Poe2PriceSource)) ??
        "exchange";
      timelineCache = this.buildTimelineFromEvents(
        allEvents,
        cardRarities,
        hidePriceFlags,
        timelinePriceSource as "exchange" | "stash",
      );
      if (game === "poe1") {
        this.poe1TimelineCache = timelineCache;
        this.poe1CardRarities = cardRarities;
      } else {
        this.poe2TimelineCache = timelineCache;
        this.poe2CardRarities = cardRarities;
      }
    }

    const result = {
      id: activeSession.sessionId,
      totalCount: session.totalCount,
      cards: cardsArray,
      recentDrops,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      league: activeSession.league,
      snapshotId: session.snapshotId ?? null,
      totals,
      priceSnapshot,
      timeline: timelineCache,
    };
    return result;
  }

  /**
   * Calculate session totals
   */
  private calculateSessionTotals(
    cards: Record<string, CardEntry>,
    priceSnapshot: SessionPriceSnapshot,
    totalDecksOpened: number,
  ): SessionTotals {
    let stashTotal = 0;
    let exchangeTotal = 0;

    for (const [_cardName, entry] of Object.entries(cards)) {
      if (entry.stashPrice && !entry.stashPrice.hidePrice) {
        stashTotal += entry.stashPrice.totalValue;
      }
      if (entry.exchangePrice && !entry.exchangePrice.hidePrice) {
        exchangeTotal += entry.exchangePrice.totalValue;
      }
    }

    const deckCost = priceSnapshot.stackedDeckChaosCost ?? 0;
    const totalDeckCost = deckCost * totalDecksOpened;

    return {
      stash: {
        totalValue: stashTotal,
        netProfit: stashTotal - totalDeckCost,
        chaosToDivineRatio: priceSnapshot.stash.chaosToDivineRatio,
      },
      exchange: {
        totalValue: exchangeTotal,
        netProfit: exchangeTotal - totalDeckCost,
        chaosToDivineRatio: priceSnapshot.exchange.chaosToDivineRatio,
      },
      stackedDeckChaosCost: deckCost,
      totalDeckCost,
    };
  }

  /**
   * Update card price visibility
   */
  public async updateCardPriceVisibility(
    game: GameType,
    sessionId: string,
    priceSource: "exchange" | "stash",
    cardName: string,
    hidePrice: boolean,
  ): Promise<void> {
    // Resolve "current" to actual session ID
    let actualSessionId = sessionId;

    if (sessionId === "current") {
      const activeSession =
        game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;
      if (!activeSession) {
        throw new Error("No active session");
      }
      actualSessionId = activeSession.sessionId;
    }

    // Update via repository
    await this.repository.updateCardPriceVisibility(
      actualSessionId,
      cardName,
      priceSource,
      hidePrice,
    );

    // Update in-memory hidePrice flags cache
    if (sessionId === "current") {
      const hidePriceFlags =
        game === "poe1" ? this.poe1HidePriceFlags : this.poe2HidePriceFlags;
      const existing = hidePriceFlags.get(cardName);
      if (existing) {
        if (priceSource === "exchange") {
          existing.exchange = hidePrice;
        } else {
          existing.stash = hidePrice;
        }
      } else {
        hidePriceFlags.set(cardName, {
          exchange: priceSource === "exchange" ? hidePrice : false,
          stash: priceSource === "stash" ? hidePrice : false,
        });
      }

      // Invalidate timeline cache so it rebuilds with updated hidePrice flags
      if (game === "poe1") {
        this.poe1TimelineCache = null;
      } else {
        this.poe2TimelineCache = null;
      }
    }

    // Emit update for active session
    if (sessionId === "current") {
      await this.emitSessionDataUpdate(game);
    }
  }

  // ============================================================================
  // Event Emitters
  // ============================================================================

  /**
   * Emit session state change event
   */
  private emitSessionStateChange(game: GameType): void {
    const windows = BrowserWindow.getAllWindows();
    const isActive = this.isSessionActive(game);
    const sessionInfo = this.getActiveSessionInfo(game);

    for (const window of windows) {
      window.webContents.send(CurrentSessionChannel.StateChanged, {
        game,
        isActive,
        sessionInfo,
      });
    }
  }

  /**
   * Get the active filter ID if rarity source is "filter".
   * Returns null if rarity source is not "filter" or no filter is selected.
   */
  private async getActiveFilterId(): Promise<string | null> {
    try {
      const raritySource = await this.settingsStore.get(
        SettingsKey.RaritySource,
      );
      if (raritySource !== "filter") {
        return null;
      }
      const filterId = await this.settingsStore.get(
        SettingsKey.SelectedFilterId,
      );
      return filterId || null;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Timeline Helpers
  // ============================================================================

  /**
   * Build a card-name → rarity map from the cards object used by getCurrentSession.
   * Uses filter rarity if rarity source is "filter", otherwise price-based rarity.
   */
  private buildCardRaritiesMap(
    cardsObject: Record<string, CardEntry>,
    raritySource: string,
  ): Map<string, number> {
    const rarities = new Map<string, number>();
    for (const [name, entry] of Object.entries(cardsObject)) {
      const filterRarity = entry.divinationCard?.filterRarity;
      const priceRarity = entry.divinationCard?.rarity ?? 4;
      const rarity =
        raritySource === "filter" && filterRarity != null
          ? filterRarity
          : priceRarity;
      rarities.set(name, rarity);
    }
    return rarities;
  }

  /**
   * Build an AggregatedTimeline from raw session_card_events rows.
   * Groups events into 10-second buckets, computes cumulative values,
   * and identifies notable drops (rarity 1/2/3).
   */
  private buildTimelineFromEvents(
    events: SessionCardEventDTO[],
    cardRarities: Map<string, number>,
    hidePriceFlags?: Map<string, { exchange: boolean; stash: boolean }>,
    priceSource?: "exchange" | "stash",
  ): AggregatedTimeline {
    if (events.length === 0) {
      return {
        buckets: [],
        liveEdge: [],
        totalChaosValue: 0,
        totalDivineValue: 0,
        totalDrops: 0,
        notableDrops: [],
      };
    }

    const bucketMap = new Map<
      string,
      {
        timestamp: string;
        dropCount: number;
        cumulativeChaosValue: number;
        cumulativeDivineValue: number;
        topCard: string | null;
        topCardChaosValue: number;
      }
    >();

    let totalChaosValue = 0;
    let totalDivineValue = 0;
    let totalDrops = 0;
    const notableDrops: NotableDrop[] = [];

    for (const event of events) {
      totalDrops++;
      const rawChaos = event.chaosValue ?? 0;
      const rawDivine = event.divineValue ?? 0;

      // If this card is hidden for the active price source, zero out its value
      const isHidden = hidePriceFlags
        ? ((priceSource === "stash"
            ? hidePriceFlags.get(event.cardName)?.stash
            : hidePriceFlags.get(event.cardName)?.exchange) ?? false)
        : false;
      const chaos = isHidden ? 0 : rawChaos;
      const divine = isHidden ? 0 : rawDivine;

      totalChaosValue += chaos;
      totalDivineValue += divine;

      // 10-second bucket key
      const dt = new Date(event.droppedAt);
      const s = dt.getSeconds();
      dt.setSeconds(s - (s % 10), 0);
      const bucketKey = dt.toISOString();

      let bucket = bucketMap.get(bucketKey);
      if (!bucket) {
        bucket = {
          timestamp: bucketKey,
          dropCount: 0,
          cumulativeChaosValue: 0,
          cumulativeDivineValue: 0,
          topCard: null,
          topCardChaosValue: 0,
        };
        bucketMap.set(bucketKey, bucket);
      }

      bucket.dropCount++;
      bucket.cumulativeChaosValue = totalChaosValue;
      bucket.cumulativeDivineValue = totalDivineValue;

      if (!isHidden && chaos > bucket.topCardChaosValue) {
        bucket.topCard = event.cardName;
        bucket.topCardChaosValue = chaos;
      }

      // Hidden cards should not appear as notable drops
      const rarity = cardRarities.get(event.cardName) ?? 4;
      if (rarity >= 1 && rarity <= 3 && !isHidden) {
        notableDrops.push({
          cumulativeDropIndex: totalDrops,
          cardName: event.cardName,
          chaosValue: chaos,
          rarity: rarity as 1 | 2 | 3,
        });
      }
    }

    // Sort buckets by timestamp
    const buckets = Array.from(bucketMap.values()).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return {
      buckets,
      liveEdge: [],
      totalChaosValue,
      totalDivineValue,
      totalDrops,
      notableDrops,
    };
  }

  /**
   * Append a card drop to the in-memory timeline cache and return a TimelineDelta.
   * O(1) amortised — updates or creates a single bucket.
   */
  private appendToTimelineCache(
    game: GameType,
    drop: {
      cardName: string;
      chaosValue: number | null;
      divineValue: number | null;
      droppedAt: string;
    },
    priceSource: "exchange" | "stash",
  ): TimelineDelta | null {
    const cache =
      game === "poe1" ? this.poe1TimelineCache : this.poe2TimelineCache;
    if (!cache) return null;

    const hidePriceFlags =
      game === "poe1" ? this.poe1HidePriceFlags : this.poe2HidePriceFlags;
    const isHidden =
      priceSource === "stash"
        ? (hidePriceFlags.get(drop.cardName)?.stash ?? false)
        : (hidePriceFlags.get(drop.cardName)?.exchange ?? false);

    const chaos = isHidden ? 0 : (drop.chaosValue ?? 0);
    const divine = isHidden ? 0 : (drop.divineValue ?? 0);

    cache.totalChaosValue += chaos;
    cache.totalDivineValue += divine;
    cache.totalDrops++;

    // 10-second bucket key
    const dt = new Date(drop.droppedAt);
    const s = dt.getSeconds();
    dt.setSeconds(s - (s % 10), 0);
    const bucketKey = dt.toISOString();

    // Find or create bucket
    let updatedBucket: TimelineBucket;
    const existingIdx = cache.buckets.findIndex(
      (b) => b.timestamp === bucketKey,
    );

    if (existingIdx >= 0) {
      const bucket = cache.buckets[existingIdx];
      bucket.dropCount++;
      bucket.cumulativeChaosValue = cache.totalChaosValue;
      bucket.cumulativeDivineValue = cache.totalDivineValue;
      if (!isHidden && chaos > bucket.topCardChaosValue) {
        bucket.topCard = drop.cardName;
        bucket.topCardChaosValue = chaos;
      }
      updatedBucket = bucket;
    } else {
      updatedBucket = {
        timestamp: bucketKey,
        dropCount: 1,
        cumulativeChaosValue: cache.totalChaosValue,
        cumulativeDivineValue: cache.totalDivineValue,
        topCard: drop.cardName,
        topCardChaosValue: chaos,
      };
      cache.buckets.push(updatedBucket);
    }

    // Check for notable drop
    const rarities =
      game === "poe1" ? this.poe1CardRarities : this.poe2CardRarities;
    const rarity = rarities?.get(drop.cardName) ?? 4;
    let notableDrop: NotableDrop | null = null;

    if (rarity >= 1 && rarity <= 3 && !isHidden) {
      notableDrop = {
        cumulativeDropIndex: cache.totalDrops,
        cardName: drop.cardName,
        chaosValue: chaos,
        rarity: rarity as 1 | 2 | 3,
      };
      cache.notableDrops.push(notableDrop);
    }

    return {
      bucket: { ...updatedBucket },
      notableDrop,
      totalChaosValue: cache.totalChaosValue,
      totalDivineValue: cache.totalDivineValue,
      totalDrops: cache.totalDrops,
    };
  }

  /**
   * Ensure a card's rarity is in the rarity map.
   * The rarity map is built once from getCurrentSession(), but
   * new cards discovered mid-session need to be added manually.
   */
  private async ensureCardInRarityMap(
    game: GameType,
    league: string,
    cardName: string,
  ): Promise<void> {
    const rarities =
      game === "poe1" ? this.poe1CardRarities : this.poe2CardRarities;
    if (!rarities || rarities.has(cardName)) return;

    // Try to look up the rarity from the DB (price-based rarity)
    const priceRarity = await this.repository.getCardPriceRarity(
      game,
      league,
      cardName,
    );
    if (priceRarity != null) {
      rarities.set(cardName, priceRarity);
      return;
    }

    // If rarity source is "filter", try filter-based rarity
    const filterId = await this.getActiveFilterId();
    if (filterId) {
      const filterRarity = await this.repository.getCardFilterRarity(
        filterId,
        cardName,
      );
      if (filterRarity != null) {
        rarities.set(cardName, filterRarity);
        return;
      }
    }

    // Default to common (rarity 4) if no rarity data found
    rarities.set(cardName, 4);
  }

  /**
   * Build a lightweight SessionCardDelta from in-memory caches.
   * This avoids the expensive getCurrentSession() DB roundtrip on every card drop.
   * All data needed is already available in-memory from the addCard() call path.
   */
  private buildCardDelta(
    game: GameType,
    cardName: string,
  ): SessionCardDelta | null {
    const snapshotCache =
      game === "poe1" ? this.poe1SnapshotCache : this.poe2SnapshotCache;
    const cardCounts =
      game === "poe1" ? this.poe1CardCounts : this.poe2CardCounts;
    const runningTotals =
      game === "poe1" ? this.poe1RunningTotals : this.poe2RunningTotals;
    const hidePriceFlags =
      game === "poe1" ? this.poe1HidePriceFlags : this.poe2HidePriceFlags;
    const divinationCardCache =
      game === "poe1"
        ? this.poe1DivinationCardCache
        : this.poe2DivinationCardCache;
    const rarities =
      game === "poe1" ? this.poe1CardRarities : this.poe2CardRarities;

    // Update card count cache
    const prevCount = cardCounts.get(cardName) ?? 0;
    const newCount = prevCount + 1;
    cardCounts.set(cardName, newCount);

    // Get prices from snapshot cache
    const snapshot = snapshotCache?.snapshot ?? null;
    const exchangeData = snapshot?.exchange.cardPrices[cardName] ?? null;
    const stashData = snapshot?.stash.cardPrices[cardName] ?? null;

    const exchangeChaos = exchangeData?.chaosValue ?? 0;
    const exchangeDivine = exchangeData?.divineValue ?? 0;
    const stashChaos = stashData?.chaosValue ?? 0;
    const stashDivine = stashData?.divineValue ?? 0;

    // Get hidePrice flags (default to not hidden for new cards)
    if (!hidePriceFlags.has(cardName)) {
      hidePriceFlags.set(cardName, {
        exchange: exchangeData?.hidePrice ?? false,
        stash: stashData?.hidePrice ?? false,
      });
    }
    const flags = hidePriceFlags.get(cardName)!;

    // Update running totals incrementally (add the value of this single new card)
    if (!flags.exchange) {
      runningTotals.exchangeTotal += exchangeChaos;
    }
    if (!flags.stash) {
      runningTotals.stashTotal += stashChaos;
    }

    // Compute total count from all cards
    let totalCount = 0;
    for (const count of cardCounts.values()) {
      totalCount += count;
    }

    // Build updated totals
    const deckCost = snapshot?.stackedDeckChaosCost ?? 0;
    const totalDeckCost = deckCost * totalCount;

    const updatedTotals: SessionTotals = {
      stash: {
        totalValue: runningTotals.stashTotal,
        netProfit: runningTotals.stashTotal - totalDeckCost,
        chaosToDivineRatio: snapshot?.stash.chaosToDivineRatio ?? 0,
      },
      exchange: {
        totalValue: runningTotals.exchangeTotal,
        netProfit: runningTotals.exchangeTotal - totalDeckCost,
        chaosToDivineRatio: snapshot?.exchange.chaosToDivineRatio ?? 0,
      },
      stackedDeckChaosCost: deckCost,
      totalDeckCost,
    };

    // Build recent drop entry
    const rarity = (rarities?.get(cardName) ?? 4) as Rarity;
    const recentDrop: RecentDrop = {
      cardName,
      rarity,
      exchangePrice: { chaosValue: exchangeChaos, divineValue: exchangeDivine },
      stashPrice: { chaosValue: stashChaos, divineValue: stashDivine },
    };

    // Get or cache divination card metadata (only sent for brand-new cards)
    let divinationCard = divinationCardCache.get(cardName);
    const isNewCard = prevCount === 0;

    if (isNewCard && !divinationCard) {
      // We don't have metadata cached yet — build a minimal version from what we know
      // The full metadata will be available on next full hydrate
      divinationCard = {
        id: cardName,
        rarity,
        fromBoss: false,
      };
      divinationCardCache.set(cardName, divinationCard);
    }

    return {
      cardName,
      newCount,
      totalCount,
      exchangePrice: exchangeData
        ? { chaosValue: exchangeChaos, divineValue: exchangeDivine }
        : null,
      stashPrice: stashData
        ? { chaosValue: stashChaos, divineValue: stashDivine }
        : null,
      updatedTotals,
      recentDrop,
      divinationCard: isNewCard ? divinationCard : undefined,
      hidePriceExchange: flags.exchange,
      hidePriceStash: flags.stash,
    };
  }

  private async emitSessionDataUpdate(game: GameType): Promise<void> {
    const sessionData = await this.getCurrentSession(game);
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(CurrentSessionChannel.DataUpdated, {
        game,
        data: sessionData,
      });
    }
  }
}

export { CurrentSessionService };
