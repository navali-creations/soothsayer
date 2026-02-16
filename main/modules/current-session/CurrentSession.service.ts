import crypto from "node:crypto";

import { BrowserWindow, ipcMain } from "electron";

import { DataStoreService } from "~/main/modules/data-store";
import { DatabaseService } from "~/main/modules/database";
import { FilterService } from "~/main/modules/filters/Filter.service";
import { PerformanceLoggerService } from "~/main/modules/performance-logger";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import { SnapshotService } from "~/main/modules/snapshots";
import {
  assertBoolean,
  assertCardName,
  assertGameType,
  assertPriceSource,
  assertSessionId,
  assertString,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import type {
  CardEntry,
  GameType,
  SessionPriceSnapshot,
  SessionTotals,
} from "../../../types/data-stores";
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
  private filterService: FilterService;
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
    this.filterService = FilterService.getInstance();
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
          assertGameType(game, CurrentSessionChannel.Start);
          assertString(league, "league", CurrentSessionChannel.Start);
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
          await this.filterService.ensureFilterParsed(selectedFilterId);

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
    } else {
      this.poe2ActiveSession = sessionInfo;
      this.poe2ProcessedIds.clear();
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

    // Clear recent drops (processed_ids table)
    await this.repository.clearRecentDrops(game);

    // Stop auto-refresh
    this.snapshotService.stopAutoRefresh(game, activeSession.league);

    // Capture league before clearing
    const league = activeSession.league;

    // Clear active session
    if (game === "poe1") {
      this.poe1ActiveSession = null;
      this.poe1ProcessedIds.clear();
    } else {
      this.poe2ActiveSession = null;
      this.poe2ProcessedIds.clear();
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

    // Increment card count via repository
    const now = new Date().toISOString();
    await this.repository.incrementCardCount(
      activeSession.sessionId,
      cardName,
      now,
    );

    // Save processed ID with card name immediately (for recent drops)
    await this.repository.saveProcessedId(game, processedId, cardName);

    // Cascade to data store (all-time and league stats)
    await this.dataStore.addCard(game, league, cardName);

    // Emit update
    await this.emitSessionDataUpdate(game);
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
        divinationCard: card.divinationCard, // Include divination card metadata
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
      const priceRarity = cardData?.divinationCard?.rarity || 4;
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

    const result = {
      totalCount: session.totalCount,
      cards: cardsArray,
      recentDrops,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      league: activeSession.league,
      totals,
      priceSnapshot,
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

  private async emitSessionDataUpdate(game: GameType): Promise<void> {
    const sessionData = await this.getCurrentSession(game);
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send("session:data-updated", {
        game,
        data: sessionData,
      });
    }
  }
}

export { CurrentSessionService };
