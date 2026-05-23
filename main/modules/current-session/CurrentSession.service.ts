import crypto from "node:crypto";

import type BetterSqlite3 from "better-sqlite3";
import { BrowserWindow, ipcMain, powerMonitor } from "electron";

import { AppPerformanceService } from "~/main/modules/app-performance";
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

interface StopSessionOptions {
  /**
   * Wait for the community upload queue/send step before finishing session
   * teardown. Used by suspend/shutdown paths that need deterministic ordering.
   */
  waitForCommunityUpload?: boolean;
  /**
   * After the session snapshot is queued, immediately try to process pending
   * community uploads. This does not delete queued data. Set false for
   * suspend/hibernate because network may vanish before the request completes.
   */
  flushCommunityUpload?: boolean;
}

type StopSessionResult = {
  totalCount: number;
  durationMs: number;
  league: string;
  game: GameType;
};

interface ResolvedStopSessionOptions {
  waitForCommunityUpload: boolean;
  flushCommunityUpload: boolean;
}

interface StopSessionJob {
  promise: Promise<StopSessionResult>;
  options: ResolvedStopSessionOptions;
  communityUploadPromise: Promise<void> | null;
  uploadFlushRequested: boolean | null;
  postFlushPromise: Promise<void> | null;
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
  private appPerformanceService: AppPerformanceService;

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

  // Running total cache, updated incrementally.
  private poe1RunningTotal = 0;
  private poe2RunningTotal = 0;

  // Per-card hidePrice flags cache.
  private poe1HidePriceFlags: Map<string, boolean> = new Map();
  private poe2HidePriceFlags: Map<string, boolean> = new Map();

  // Per-card divination card metadata cache (for new card deltas)
  private poe1DivinationCardCache: Map<string, any> = new Map();
  private poe2DivinationCardCache: Map<string, any> = new Map();

  // App performance captures started by session auto-start (per game)
  private poe1AppPerformanceCaptureId: string | null = null;
  private poe2AppPerformanceCaptureId: string | null = null;
  private stopSessionPromises = new Map<GameType, StopSessionJob>();

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
    this.appPerformanceService = AppPerformanceService.getInstance();

    this.loadGlobalProcessedIds("poe1");
    this.loadGlobalProcessedIds("poe2");
    this.setupHandlers();
    this.setupPowerMonitor();
  }

  private setupPowerMonitor(): void {
    powerMonitor.on("suspend", () => {
      console.log(
        "[CurrentSession] System suspending, stopping active sessions",
      );
      void this.stopActiveSessionsForSuspend();
    });
  }

  private async stopActiveSessionsForSuspend(): Promise<void> {
    const stops: Promise<unknown>[] = [];

    if (this.isSessionActive("poe1")) {
      stops.push(
        this.stopSession("poe1", {
          waitForCommunityUpload: true,
          flushCommunityUpload: false,
        }),
      );
    }

    if (this.isSessionActive("poe2")) {
      stops.push(
        this.stopSession("poe2", {
          waitForCommunityUpload: true,
          flushCommunityUpload: false,
        }),
      );
    }

    const results = await Promise.allSettled(stops);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          "[CurrentSession] Failed to stop session on suspend:",
          result.reason,
        );
      }
    }
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
        cardName: string,
        hidePrice: boolean,
      ) => {
        try {
          assertGameType(game, CurrentSessionChannel.UpdateCardPriceVisibility);
          assertSessionId(
            sessionId,
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
          const timelineHidePriceFlags = new Map<string, boolean>();
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
            timelineHidePriceFlags.set(card.cardName, card.hidePrice);
          }

          const cardRarities = this.buildCardRaritiesMap(
            cardsObject,
            raritySource as string,
          );

          const allEvents = await this.repository.getAllCardEvents(sessionId);
          return this.buildTimelineFromEvents(
            allEvents,
            cardRarities,
            timelineHidePriceFlags,
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
      this.poe1RunningTotal = 0;
      this.poe1HidePriceFlags.clear();
      this.poe1DivinationCardCache.clear();
    } else {
      this.poe2ActiveSession = sessionInfo;
      this.poe2ProcessedIds.clear();
      this.poe2TimelineCache = null;
      this.poe2CardRarities = null;
      this.poe2SnapshotCache = null;
      this.poe2CardCounts.clear();
      this.poe2RunningTotal = 0;
      this.poe2HidePriceFlags.clear();
      this.poe2DivinationCardCache.clear();
    }
    this.emitSessionStateChange(game);
    await this.startAppPerformanceDiagnosticsForSession(game);
  }

  private async startAppPerformanceDiagnosticsForSession(
    game: GameType,
  ): Promise<void> {
    try {
      const [featureEnabled, autoStartEnabled] = await Promise.all([
        this.settingsStore.get(SettingsKey.AppPerformanceMonitorEnabled),
        this.settingsStore.get(SettingsKey.AppPerformanceAutoStartOnSession),
      ]);

      if (!featureEnabled || !autoStartEnabled) {
        return;
      }

      const currentState = this.appPerformanceService.getState();
      if (currentState.isSampling && currentState.capture) {
        console.warn(
          `[CurrentSession] App performance diagnostics already running; skipping ${game} session auto-start`,
        );
        return;
      }

      const state = await this.appPerformanceService.startFreshCapture();
      if (game === "poe1") {
        this.poe1AppPerformanceCaptureId = state.capture?.id ?? null;
      } else {
        this.poe2AppPerformanceCaptureId = state.capture?.id ?? null;
      }
    } catch (error) {
      console.error(
        "[CurrentSession] Failed to auto-start app performance diagnostics:",
        error,
      );
    }
  }

  private async stopAppPerformanceDiagnosticsForSession(
    game: GameType,
  ): Promise<void> {
    const captureId =
      game === "poe1"
        ? this.poe1AppPerformanceCaptureId
        : this.poe2AppPerformanceCaptureId;

    if (!captureId) {
      return;
    }

    try {
      const state = this.appPerformanceService.getState();
      if (state.isSampling && state.capture?.id === captureId) {
        await this.appPerformanceService.stopCapture();
      }
    } catch (error) {
      console.error(
        "[CurrentSession] Failed to stop app performance diagnostics:",
        error,
      );
    } finally {
      if (game === "poe1") {
        this.poe1AppPerformanceCaptureId = null;
      } else {
        this.poe2AppPerformanceCaptureId = null;
      }
    }
  }

  /**
   * Stop the active session
   */
  public async stopSession(
    game: GameType,
    options: StopSessionOptions = {},
  ): Promise<StopSessionResult> {
    const resolvedOptions = this.resolveStopSessionOptions(options);
    const existingJob = this.stopSessionPromises.get(game);
    if (existingJob) {
      this.mergeStopSessionOptions(existingJob.options, resolvedOptions);
      return this.waitForStopSessionJob(existingJob, resolvedOptions);
    }

    const stopJob: StopSessionJob = {
      promise: Promise.resolve(null as never),
      options: resolvedOptions,
      communityUploadPromise: null,
      uploadFlushRequested: null,
      postFlushPromise: null,
    };

    const stopPromise = this.stopSessionInternal(game, stopJob).finally(() => {
      if (this.stopSessionPromises.get(game) === stopJob) {
        this.stopSessionPromises.delete(game);
      }
    });

    stopJob.promise = stopPromise;
    this.stopSessionPromises.set(game, stopJob);
    return this.waitForStopSessionJob(stopJob, resolvedOptions);
  }

  private resolveStopSessionOptions(
    options: StopSessionOptions,
  ): ResolvedStopSessionOptions {
    return {
      waitForCommunityUpload: options.waitForCommunityUpload === true,
      flushCommunityUpload: options.flushCommunityUpload !== false,
    };
  }

  private mergeStopSessionOptions(
    target: ResolvedStopSessionOptions,
    incoming: ResolvedStopSessionOptions,
  ): void {
    target.waitForCommunityUpload ||= incoming.waitForCommunityUpload;
    target.flushCommunityUpload ||= incoming.flushCommunityUpload;
  }

  private async waitForStopSessionJob(
    stopJob: StopSessionJob,
    callerOptions: ResolvedStopSessionOptions,
  ): Promise<StopSessionResult> {
    const result = await stopJob.promise;

    if (
      callerOptions.flushCommunityUpload &&
      stopJob.uploadFlushRequested === false
    ) {
      stopJob.postFlushPromise ??= CommunityUploadService.getInstance()
        .flushPendingUploads()
        .catch(() => {});
      await stopJob.postFlushPromise;
    }

    if (callerOptions.waitForCommunityUpload) {
      if (stopJob.communityUploadPromise) {
        await stopJob.communityUploadPromise;
      }
      if (stopJob.postFlushPromise) {
        await stopJob.postFlushPromise;
      }
    }

    return result;
  }

  private async stopSessionInternal(
    game: GameType,
    stopJob: StopSessionJob,
  ): Promise<StopSessionResult> {
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

    const flushCommunityUpload = stopJob.options.flushCommunityUpload;
    stopJob.uploadFlushRequested = flushCommunityUpload;
    const communityUploadPromise = CommunityUploadService.getInstance()
      .uploadOnSessionEnd(game, activeSession.league, activeSession.sessionId, {
        flush: flushCommunityUpload,
      })
      .catch(() => {}); // Error already logged inside uploadOnSessionEnd
    stopJob.communityUploadPromise = communityUploadPromise;

    if (stopJob.options.waitForCommunityUpload) {
      await communityUploadPromise;
    }

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
      this.poe1RunningTotal = 0;
      this.poe1HidePriceFlags.clear();
      this.poe1DivinationCardCache.clear();
    } else {
      this.poe2ActiveSession = null;
      this.poe2ProcessedIds.clear();
      this.poe2TimelineCache = null;
      this.poe2CardRarities = null;
      this.poe2SnapshotCache = null;
      this.poe2CardCounts.clear();
      this.poe2RunningTotal = 0;
      this.poe2HidePriceFlags.clear();
      this.poe2DivinationCardCache.clear();
    }

    this.emitSessionStateChange(game);
    await this.stopAppPerformanceDiagnosticsForSession(game);

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
    let totalValue = 0;

    for (const card of cards) {
      const price = priceSnapshot.cardPrices[card.cardName];

      if (price && !card.hidePrice) {
        totalValue += price.chaosValue * card.count;
      }
    }

    // Calculate net profit (subtract stacked deck investment)
    const deckCost = priceSnapshot.stackedDeckChaosCost ?? 0;
    const totalDeckCost = deckCost * session.totalCount;
    const netProfit = totalValue - totalDeckCost;

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
      totalValue: totalValue,
      netProfit: netProfit,
      chaosToDivineRatio: priceSnapshot.chaosToDivineRatio,
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
      const prices = snapshotCache.snapshot.cardPrices[cardName];
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
    const timelineDelta = this.appendToTimelineCache(game, {
      cardName,
      chaosValue,
      divineValue,
      droppedAt: now,
    });

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
        const priceData = priceSnapshot.cardPrices[card.cardName];

        cardEntry.price = priceData
          ? {
              chaosValue: priceData.chaosValue,
              divineValue: priceData.divineValue,
              totalValue: priceData.chaosValue * card.count,
              hidePrice: card.hidePrice,
            }
          : {
              chaosValue: 0,
              divineValue: 0,
              totalValue: 0,
              hidePrice: card.hidePrice,
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
          totalValue: 0,
          netProfit: 0,
          chaosToDivineRatio: 0,
          stackedDeckChaosCost: 0,
          totalDeckCost: 0,
        };

    // Determine which rarity source is active for display purposes
    const raritySource = await this.settingsStore.get(SettingsKey.RaritySource);

    // Get recent drops (last 20 individual card drops in chronological order)
    const recentDropsRaw = await this.repository.getRecentDrops(game, 20);

    const recentDrops = recentDropsRaw.map((cardName) => {
      const cardData = cardsObject[cardName];

      const actualRarity = this.getEffectiveCardRarity(
        cardData?.divinationCard,
        raritySource as string,
      );

      const isHidden = cardData?.price?.hidePrice || false;

      const displayRarity = isHidden ? 4 : actualRarity;

      return {
        cardName,
        rarity: displayRarity,
        price: cardData?.price
          ? {
              chaosValue: cardData.price.chaosValue,
              divineValue: cardData.price.divineValue,
            }
          : null,
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
    const hidePriceFlags =
      game === "poe1" ? this.poe1HidePriceFlags : this.poe2HidePriceFlags;
    const divinationCardCache =
      game === "poe1"
        ? this.poe1DivinationCardCache
        : this.poe2DivinationCardCache;

    cardCounts.clear();
    let seedTotal = 0;

    for (const [name, entry] of Object.entries(cardsObject)) {
      cardCounts.set(name, entry.count);
      hidePriceFlags.set(name, entry.price?.hidePrice ?? false);
      if (entry.price && !entry.price.hidePrice) {
        seedTotal += entry.price.totalValue;
      }
      if (entry.divinationCard) {
        divinationCardCache.set(name, entry.divinationCard);
      }
    }
    if (game === "poe1") {
      this.poe1RunningTotal = seedTotal;
    } else {
      this.poe2RunningTotal = seedTotal;
    }

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
      timelineCache = this.buildTimelineFromEvents(
        allEvents,
        cardRarities,
        hidePriceFlags,
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
    let totalValue = 0;

    for (const [_cardName, entry] of Object.entries(cards)) {
      if (entry.price && !entry.price.hidePrice) {
        totalValue += entry.price.totalValue;
      }
    }

    const deckCost = priceSnapshot.stackedDeckChaosCost ?? 0;
    const totalDeckCost = deckCost * totalDecksOpened;

    return {
      totalValue,
      netProfit: totalValue - totalDeckCost,
      chaosToDivineRatio: priceSnapshot.chaosToDivineRatio,
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
      hidePrice,
    );

    // Update in-memory hidePrice flags cache
    if (sessionId === "current") {
      const hidePriceFlags =
        game === "poe1" ? this.poe1HidePriceFlags : this.poe2HidePriceFlags;
      hidePriceFlags.set(cardName, hidePrice);

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
   * Uses the selected rarity source when that source has data, otherwise price rarity.
   */
  private buildCardRaritiesMap(
    cardsObject: Record<string, CardEntry>,
    raritySource: string,
  ): Map<string, number> {
    const rarities = new Map<string, number>();
    for (const [name, entry] of Object.entries(cardsObject)) {
      const rarity = this.getEffectiveCardRarity(
        entry.divinationCard,
        raritySource,
      );
      rarities.set(name, rarity);
    }
    return rarities;
  }

  private getEffectiveCardRarity(
    divinationCard: CardEntry["divinationCard"] | undefined,
    raritySource: string,
  ): Rarity {
    const priceRarity = divinationCard?.rarity ?? 4;

    if (raritySource === "filter" && divinationCard?.filterRarity != null) {
      return divinationCard.filterRarity;
    }

    if (
      raritySource === "prohibited-library" &&
      divinationCard?.prohibitedLibraryRarity != null
    ) {
      return divinationCard.prohibitedLibraryRarity;
    }

    return priceRarity;
  }

  /**
   * Build an AggregatedTimeline from raw session_card_events rows.
   * Groups events into 10-second buckets, computes cumulative values,
   * and identifies notable drops (rarity 1/2/3).
   */
  private buildTimelineFromEvents(
    events: SessionCardEventDTO[],
    cardRarities: Map<string, number>,
    hidePriceFlags?: Map<string, boolean>,
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

      const isHidden = hidePriceFlags?.get(event.cardName) ?? false;
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
  ): TimelineDelta | null {
    const cache =
      game === "poe1" ? this.poe1TimelineCache : this.poe2TimelineCache;
    if (!cache) return null;

    const hidePriceFlags =
      game === "poe1" ? this.poe1HidePriceFlags : this.poe2HidePriceFlags;
    const isHidden = hidePriceFlags.get(drop.cardName) ?? false;

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
    let rarities =
      game === "poe1" ? this.poe1CardRarities : this.poe2CardRarities;

    if (!rarities) {
      rarities = new Map<string, number>();
      if (game === "poe1") {
        this.poe1CardRarities = rarities;
      } else {
        this.poe2CardRarities = rarities;
      }
    }

    if (rarities.has(cardName)) return;

    let raritySource: string | null = null;
    try {
      raritySource = await this.settingsStore.get(SettingsKey.RaritySource);
    } catch {
      raritySource = null;
    }

    if (raritySource === "filter") {
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
    }

    if (raritySource === "prohibited-library") {
      const prohibitedLibraryRarity =
        await this.repository.getCardProhibitedLibraryRarity(
          game,
          league,
          cardName,
        );
      if (prohibitedLibraryRarity != null) {
        rarities.set(cardName, prohibitedLibraryRarity);
        return;
      }
    }

    // Fall back to the DB price-based rarity.
    const priceRarity = await this.repository.getCardPriceRarity(
      game,
      league,
      cardName,
    );
    if (priceRarity != null) {
      rarities.set(cardName, priceRarity);
      return;
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
    const priceData = snapshot?.cardPrices[cardName] ?? null;

    const chaosValue = priceData?.chaosValue ?? 0;
    const divineValue = priceData?.divineValue ?? 0;

    // Get hidePrice flags (default to not hidden for new cards)
    if (!hidePriceFlags.has(cardName)) {
      hidePriceFlags.set(cardName, priceData?.hidePrice ?? false);
    }
    const hidePrice = hidePriceFlags.get(cardName)!;

    // Update running totals incrementally (add the value of this single new card)
    if (!hidePrice) {
      if (game === "poe1") {
        this.poe1RunningTotal += chaosValue;
      } else {
        this.poe2RunningTotal += chaosValue;
      }
    }
    const runningTotal =
      game === "poe1" ? this.poe1RunningTotal : this.poe2RunningTotal;

    // Compute total count from all cards
    let totalCount = 0;
    for (const count of cardCounts.values()) {
      totalCount += count;
    }

    // Build updated totals
    const deckCost = snapshot?.stackedDeckChaosCost ?? 0;
    const totalDeckCost = deckCost * totalCount;

    const updatedTotals: SessionTotals = {
      totalValue: runningTotal,
      netProfit: runningTotal - totalDeckCost,
      chaosToDivineRatio: snapshot?.chaosToDivineRatio ?? 0,
      stackedDeckChaosCost: deckCost,
      totalDeckCost,
    };

    // Build recent drop entry
    const rarity = (rarities?.get(cardName) ?? 4) as Rarity;
    const recentDrop: RecentDrop = {
      cardName,
      rarity,
      price: priceData ? { chaosValue, divineValue } : null,
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
      price: priceData ? { chaosValue, divineValue } : null,
      updatedTotals,
      recentDrop,
      divinationCard: isNewCard ? divinationCard : undefined,
      hidePrice,
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
