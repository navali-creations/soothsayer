import crypto from "node:crypto";
import { BrowserWindow, ipcMain } from "electron";
import type {
  CardEntry,
  CardPriceInfo,
  GameType,
  SessionPriceSnapshot,
  SessionTotals,
} from "../../../types/data-stores";
import { DatabaseService } from "../database/Database.service";
import { DataStoreService } from "../data-store/DataStore.service";
import { PerformanceLoggerService } from "../performance-logger/PerformanceLogger.service";
import { SnapshotService } from "../snapshots/Snapshot.service";
import { CurrentSessionChannel } from "./CurrentSession.channels";
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
  private dataStore: DataStoreService;
  private snapshotService: SnapshotService;
  private perfLogger: PerformanceLoggerService;

  // Active session tracking
  private poe1ActiveSession: ActiveSessionInfo | null = null;
  private poe2ActiveSession: ActiveSessionInfo | null = null;

  // In-memory processed IDs for current session (prevents duplicates)
  private poe1ProcessedIds: Set<string> = new Set();
  private poe2ProcessedIds: Set<string> = new Set();

  // Global processed IDs (persisted to DB)
  private poe1GlobalProcessedIds: Set<string> = new Set();
  private poe2GlobalProcessedIds: Set<string> = new Set();

  // Write queue for processed IDs (batch writes)
  private trackerWriteQueue: Map<GameType, Set<string>> = new Map([
    ["poe1", new Set()],
    ["poe2", new Set()],
  ]);
  private trackerWriteTimeout: Map<GameType, NodeJS.Timeout | null> = new Map([
    ["poe1", null],
    ["poe2", null],
  ]);

  static getInstance(): CurrentSessionService {
    if (!CurrentSessionService._instance) {
      CurrentSessionService._instance = new CurrentSessionService();
    }
    return CurrentSessionService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new CurrentSessionRepository(db.getKysely());
    this.dataStore = DataStoreService.getInstance();
    this.snapshotService = SnapshotService.getInstance();
    this.perfLogger = PerformanceLoggerService.getInstance();

    this.loadGlobalProcessedIds("poe1");
    this.loadGlobalProcessedIds("poe2");
    this.setupHandlers();
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

    console.log(`Loaded ${processedSet.size} global processed IDs for ${game}`);
  }

  /**
   * Save processed ID globally (with batching)
   */
  private saveProcessedIdGlobally(game: GameType, processedId: string): void {
    const globalSet =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;
    globalSet.add(processedId);

    // Add to write queue
    this.trackerWriteQueue.get(game)!.add(processedId);

    // Clear existing timeout
    const existingTimeout = this.trackerWriteTimeout.get(game);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout (batch write after 1 second)
    const timeout = setTimeout(() => {
      this.flushTrackerQueue(game);
    }, 1000);

    this.trackerWriteTimeout.set(game, timeout);
  }

  /**
   * Flush queued processed IDs to database (batched for performance)
   */
  private async flushTrackerQueue(
    game: GameType,
    prune: boolean = false,
  ): Promise<void> {
    const queue = this.trackerWriteQueue.get(game);
    const globalSet =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;

    // Add any queued IDs to in-memory global set
    if (queue && queue.size > 0) {
      for (const id of queue) {
        globalSet.add(id);
      }

      console.log(
        `[ProcessedIDs] Added ${queue.size} IDs to ${game} global set (now ${globalSet.size} total)`,
      );

      queue.clear();
    }

    // If pruning, trim to last 20 IDs by insertion order (matching old electron-store behavior)
    if (prune) {
      if (globalSet.size === 0) {
        console.log(`[ProcessedIDs] No IDs to prune for ${game}`);
        return;
      }

      const allIds = Array.from(globalSet);
      const last20Ids = allIds.slice(-20);

      // Clear and rebuild set with only the last 20
      globalSet.clear();
      for (const id of last20Ids) {
        globalSet.add(id);
      }

      console.log(
        `[ProcessedIDs] Pruned ${game} global set to last 20 IDs (removed ${allIds.length - 20})`,
      );
    }

    // If there's nothing to write, skip database operation
    if (globalSet.size === 0) {
      console.log(`[ProcessedIDs] No IDs to flush for ${game}`);
      return;
    }

    // Write current global set to database via repository
    const idsToWrite = Array.from(globalSet);
    await this.repository.replaceProcessedIds(game, idsToWrite);

    console.log(`[ProcessedIDs] Flushed ${idsToWrite.length} IDs for ${game}`);
  }

  /**
   * Get all processed IDs for a game (session + global) for deduplication in parser
   */
  public getAllProcessedIds(game: GameType): Set<string> {
    const sessionProcessedIds =
      game === "poe1" ? this.poe1ProcessedIds : this.poe2ProcessedIds;
    const globalProcessedIds =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;

    return new Set([...sessionProcessedIds, ...globalProcessedIds]);
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
          await this.startSession(game, league);
          return { success: true };
        } catch (error) {
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
          await this.stopSession(game);
          return { success: true };
        } catch (error) {
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
      return this.isSessionActive(game);
    });

    // Get current session
    ipcMain.handle(
      CurrentSessionChannel.Get,
      async (_event, game: GameType) => {
        return await this.getCurrentSession(game);
      },
    );

    // Get session info
    ipcMain.handle(CurrentSessionChannel.Info, (_event, game: GameType) => {
      return this.getActiveSessionInfo(game);
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
          await this.updateCardPriceVisibility(
            game,
            sessionId,
            priceSource,
            cardName,
            hidePrice,
          );
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
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
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (activeSession) {
      throw new Error(`Session already active for ${game}`);
    }

    // Get or create snapshot for this league
    const { snapshotId, data: priceSnapshot } =
      await this.snapshotService.getSnapshotForSession(game, league);

    console.log(
      `Using snapshot ${snapshotId} for session (Exchange: ${Object.keys(priceSnapshot.exchange.cardPrices).length} cards, Stash: ${Object.keys(priceSnapshot.stash.cardPrices).length} cards)`,
    );

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
    } else {
      this.poe2ActiveSession = sessionInfo;
      this.poe2ProcessedIds.clear();
    }

    console.log(
      `Session started for ${game} in league ${league} (${sessionId})`,
    );
    this.emitSessionStateChange(game);
  }

  /**
   * Stop the active session
   */
  public async stopSession(game: GameType): Promise<void> {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) {
      throw new Error(`No active session for ${game}`);
    }

    const endedAt = new Date().toISOString();

    // Clear any pending flush timeout and flush immediately
    const existingTimeout = this.trackerWriteTimeout.get(game);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.trackerWriteTimeout.delete(game);
    }

    // Flush any pending processed IDs before stopping
    console.log(
      `[StopSession] Flushing processed IDs for ${game} before stopping...`,
    );
    await this.flushTrackerQueue(game, true);

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

    // Stop auto-refresh
    this.snapshotService.stopAutoRefresh(game, activeSession.league);

    // Clear active session
    if (game === "poe1") {
      this.poe1ActiveSession = null;
      this.poe1ProcessedIds.clear();
    } else {
      this.poe2ActiveSession = null;
      this.poe2ProcessedIds.clear();
    }

    console.log(`Session stopped for ${game}`);
    this.emitSessionStateChange(game);
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

      if (exchangePrice) {
        exchangeTotal += exchangePrice.chaosValue * card.count;
      }
      if (stashPrice) {
        stashTotal += stashPrice.chaosValue * card.count;
      }
    }

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
      exchangeChaosToDivine: priceSnapshot.exchange.chaosToDivineRatio,
      stashChaosToDivine: priceSnapshot.stash.chaosToDivineRatio,
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

    const dupCheckTime = perf?.end("dupCheck") ?? 0;

    console.log(`[Card] ${cardName} for ${game}`);
    console.log(`[DupCheck] ${dupCheckTime.toFixed(2)}ms`);

    // Add to session-scoped set
    sessionProcessedIds.add(processedId);

    // Queue for global tracking
    this.saveProcessedIdGlobally(game, processedId);

    // Increment card count via repository
    const now = new Date().toISOString();
    await this.repository.incrementCardCount(
      activeSession.sessionId,
      cardName,
      now,
    );

    // Cascade to data store (all-time and league stats)
    await this.dataStore.addCard(game, league, cardName);

    // Emit update
    this.emitSessionDataUpdate(game);
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

    // Get price snapshot - FIXED: use loadSnapshot instead of getSnapshotById
    const priceSnapshot = session.snapshotId
      ? await this.snapshotService.loadSnapshot(session.snapshotId)
      : null;

    // Get session cards
    const cards = await this.repository.getSessionCards(
      activeSession.sessionId,
    );

    // Build cards object with prices
    const cardsObject: Record<string, CardEntry> = {};

    for (const card of cards) {
      const cardEntry: CardEntry = {
        count: card.count,
        processedIds: [], // Not tracking individual IDs per card anymore
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
      ? this.calculateSessionTotals(cardsObject, priceSnapshot)
      : {
          exchange: { totalValue: 0, chaosToDivineRatio: 0 },
          stash: { totalValue: 0, chaosToDivineRatio: 0 },
        };

    // Convert to array for UI
    const cardsArray = this.convertCardsToArray(cardsObject);

    const result = {
      totalCount: session.totalCount,
      cards: cardsArray,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      league: activeSession.league,
      totals,
      priceSnapshot,
    };

    return result;
  }

  /**
   * Convert cards object to array
   */
  private convertCardsToArray(
    cards: Record<string, CardEntry>,
  ): Array<{ name: string } & CardEntry> {
    return Object.entries(cards)
      .map(([name, entry]) => ({
        name,
        count: entry.count,
        processedIds: entry.processedIds,
        stashPrice: entry.stashPrice,
        exchangePrice: entry.exchangePrice,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Calculate session totals
   */
  private calculateSessionTotals(
    cards: Record<string, CardEntry>,
    priceSnapshot: SessionPriceSnapshot,
  ): SessionTotals {
    let stashTotal = 0;
    let exchangeTotal = 0;

    for (const [cardName, entry] of Object.entries(cards)) {
      if (entry.stashPrice && !entry.stashPrice.hidePrice) {
        stashTotal += entry.stashPrice.totalValue;
      }
      if (entry.exchangePrice && !entry.exchangePrice.hidePrice) {
        exchangeTotal += entry.exchangePrice.totalValue;
      }
    }

    return {
      stash: {
        totalValue: stashTotal,
        chaosToDivineRatio: priceSnapshot.stash.chaosToDivineRatio,
      },
      exchange: {
        totalValue: exchangeTotal,
        chaosToDivineRatio: priceSnapshot.exchange.chaosToDivineRatio,
      },
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

    // Emit update for active session
    if (sessionId === "current") {
      this.emitSessionDataUpdate(game);
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
   * Emit session data update event
   */
  private emitSessionDataUpdate(game: GameType): void {
    const windows = BrowserWindow.getAllWindows();
    this.getCurrentSession(game).then((sessionData) => {
      for (const window of windows) {
        window.webContents.send("session:data-updated", {
          game,
          data: sessionData,
        });
      }
    });
  }
}

export { CurrentSessionService };
