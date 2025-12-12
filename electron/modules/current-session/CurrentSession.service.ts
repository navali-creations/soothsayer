import crypto from "node:crypto";
import { BrowserWindow, ipcMain } from "electron";
import type {
  CardEntry,
  DetailedDivinationCardStats,
  GameType,
  SessionPriceSnapshot,
  SessionTotals,
} from "../../../types/data-stores";
import { DatabaseService } from "../database/Database.service";
import { DataStoreService } from "../data-store/DataStore.service";
import { PerformanceLoggerService } from "../performance-logger/PerformanceLogger.service";
import { SnapshotService } from "../snapshots/Snapshot.service";
import { CurrentSessionChannel } from "./CurrentSession.channels";

interface ActiveSessionInfo {
  sessionId: string;
  league: string;
  startedAt: string;
}

/**
 * SQLite-based CurrentSession service
 * Manages active sessions and their card tracking
 */
class CurrentSessionService {
  private static _instance: CurrentSessionService;
  private db: DatabaseService;
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

  // Prepared statements
  private statements: {
    insertSession: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    updateSession: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    getActiveSession: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    upsertSessionCard: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    getSessionCards: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    getSession: ReturnType<typeof DatabaseService.prototype.getDb>["prepare"];
    deactivateSession: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    addProcessedId: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    getProcessedIds: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
  };

  static getInstance(): CurrentSessionService {
    if (!CurrentSessionService._instance) {
      CurrentSessionService._instance = new CurrentSessionService();
    }
    return CurrentSessionService._instance;
  }

  constructor() {
    this.db = DatabaseService.getInstance();
    this.dataStore = DataStoreService.getInstance();
    this.snapshotService = SnapshotService.getInstance();
    this.perfLogger = PerformanceLoggerService.getInstance();

    // Prepare statements
    const dbInstance = this.db.getDb();

    this.statements = {
      insertSession: dbInstance.prepare(`
        INSERT INTO sessions
        (id, game, league_id, snapshot_id, started_at, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `),
      updateSession: dbInstance.prepare(`
        UPDATE sessions
        SET total_count = ?, ended_at = ?, is_active = ?
        WHERE id = ?
      `),
      getActiveSession: dbInstance.prepare(`
        SELECT s.id, s.started_at, l.name as league
        FROM sessions s
        JOIN leagues l ON s.league_id = l.id
        WHERE s.game = ? AND s.is_active = 1
        LIMIT 1
      `),
      upsertSessionCard: dbInstance.prepare(`
        INSERT INTO session_cards (session_id, card_name, count, first_seen_at, last_seen_at)
        VALUES (?, ?, 1, datetime('now'), datetime('now'))
        ON CONFLICT(session_id, card_name)
        DO UPDATE SET
          count = count + 1,
          last_seen_at = datetime('now')
      `),
      getSessionCards: dbInstance.prepare(`
        SELECT card_name, count, first_seen_at, last_seen_at
        FROM session_cards
        WHERE session_id = ?
      `),
      getSession: dbInstance.prepare(`
        SELECT s.*, l.name as league
        FROM sessions s
        JOIN leagues l ON s.league_id = l.id
        WHERE s.id = ?
      `),
      deactivateSession: dbInstance.prepare(`
        UPDATE sessions
        SET is_active = 0, ended_at = ?
        WHERE id = ?
      `),
      addProcessedId: dbInstance.prepare(`
        INSERT OR IGNORE INTO processed_ids (game, scope, processed_id)
        VALUES (?, ?, ?)
      `),
      getProcessedIds: dbInstance.prepare(`
        SELECT processed_id
        FROM processed_ids
        WHERE game = ? AND scope = 'global'
        ORDER BY created_at ASC, processed_id ASC
      `),
    };

    this.loadGlobalProcessedIds("poe1");
    this.loadGlobalProcessedIds("poe2");
    this.setupHandlers();
  }

  /**
   * Load global processed IDs from database into memory
   */
  private loadGlobalProcessedIds(game: GameType): void {
    const rows = this.statements.getProcessedIds.all(game) as Array<{
      processed_id: string;
    }>;

    const processedSet =
      game === "poe1"
        ? this.poe1GlobalProcessedIds
        : this.poe2GlobalProcessedIds;

    processedSet.clear();
    for (const row of rows) {
      processedSet.add(row.processed_id);
    }
  }

  /**
   * Save processed ID globally (with batching)
   */
  private saveProcessedIdGlobally(game: GameType, processedId: string): void {
    // Add to in-memory set
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
  private flushTrackerQueue(game: GameType, prune: boolean = false): void {
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

      queue.clear();
    }

    // If pruning, trim to last 20 IDs by insertion order (matching old electron-store behavior)
    if (prune) {
      if (globalSet.size === 0) {
        return;
      }

      const allIds = Array.from(globalSet);
      const last20Ids = allIds.slice(-20);

      // Clear and rebuild set with only the last 20
      globalSet.clear();
      for (const id of last20Ids) {
        globalSet.add(id);
      }
    }

    // If there's nothing to write, skip database operation
    if (globalSet.size === 0) {
      return;
    }

    // Write current global set to database
    const idsToWrite = Array.from(globalSet);

    this.db.transaction(() => {
      // Clear existing global IDs for this game
      this.db
        .getDb()
        .prepare(
          "DELETE FROM processed_ids WHERE game = ? AND scope = 'global'",
        )
        .run(game);

      // Write all current IDs
      for (const id of idsToWrite) {
        this.statements.addProcessedId.run(game, "global", id);
      }
    });
  }

  /**
   * Setup IPC handlers
   */
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
    ipcMain.handle(CurrentSessionChannel.Stop, (_event, game: GameType) => {
      try {
        this.stopSession(game);
        return { success: true };
      } catch (error) {
        console.error("Failed to stop session:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Is active
    ipcMain.handle(CurrentSessionChannel.IsActive, (_event, game: GameType) => {
      return this.isSessionActive(game);
    });

    // Get current session
    ipcMain.handle(CurrentSessionChannel.Get, (_event, game: GameType) => {
      return this.getCurrentSession(game);
    });

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
    const { snapshotId } = await this.snapshotService.getSnapshotForSession(
      game,
      league,
    );

    // Start auto-refresh for this league
    this.snapshotService.startAutoRefresh(game, league);

    const sessionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Get league ID
    const leagueRow = this.db
      .getDb()
      .prepare("SELECT id FROM leagues WHERE game = ? AND name = ?")
      .get(game, league) as { id: string } | undefined;

    if (!leagueRow) {
      throw new Error(`League not found: ${game}/${league}`);
    }

    // Create session in database
    this.statements.insertSession.run(
      sessionId,
      game,
      leagueRow.id,
      snapshotId,
      startedAt,
    );

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
  public stopSession(game: GameType): void {
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
    this.flushTrackerQueue(game, true);

    // Get total count
    const totalCount = this.db
      .getDb()
      .prepare(
        `SELECT COALESCE(SUM(count), 0) as total
           FROM session_cards
           WHERE session_id = ?`,
      )
      .get(activeSession.sessionId) as { total: number };

    // Update session
    this.statements.updateSession.run(
      totalCount.total,
      endedAt,
      0, // is_active = false
      activeSession.sessionId,
    );

    // Create session summary for fast list queries
    this.createSessionSummary(
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

    this.emitSessionStateChange(game);
  }

  /**
   * Create a session summary with pre-calculated totals
   */
  private createSessionSummary(
    sessionId: string,
    game: GameType,
    league: string,
    endedAt: string,
  ): void {
    const dbInstance = this.db.getDb();

    // Get session data
    const session = this.statements.getSession.get(sessionId) as any;
    if (!session) return;

    // Get session cards
    const cards = this.statements.getSessionCards.all(sessionId) as Array<{
      card_name: string;
      count: number;
    }>;

    // Load snapshot
    const priceSnapshot = session.snapshot_id
      ? this.snapshotService.loadSnapshot(session.snapshot_id)
      : null;

    if (!priceSnapshot) {
      console.warn(
        `[CurrentSession] No price snapshot for session ${sessionId}, skipping summary creation`,
      );
      return;
    }

    // Calculate totals
    let exchangeTotal = 0;
    let stashTotal = 0;

    for (const card of cards) {
      const exchangePrice = priceSnapshot.exchange.cardPrices[card.card_name];
      const stashPrice = priceSnapshot.stash.cardPrices[card.card_name];

      if (exchangePrice && !exchangePrice.hidePrice) {
        exchangeTotal += exchangePrice.chaosValue * card.count;
      }

      if (stashPrice && !stashPrice.hidePrice) {
        stashTotal += stashPrice.chaosValue * card.count;
      }
    }

    // Calculate duration in minutes
    const start = new Date(session.started_at);
    const end = new Date(endedAt);
    const durationMinutes = Math.floor(
      (end.getTime() - start.getTime()) / 60000,
    );

    // Insert summary
    dbInstance
      .prepare(
        `INSERT OR REPLACE INTO session_summaries (
          session_id,
          game,
          league,
          started_at,
          ended_at,
          duration_minutes,
          total_decks_opened,
          total_exchange_value,
          total_stash_value,
          exchange_chaos_to_divine,
          stash_chaos_to_divine
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        game,
        league,
        session.started_at,
        endedAt,
        durationMinutes,
        session.total_count,
        exchangeTotal,
        stashTotal,
        priceSnapshot.exchange.chaosToDivineRatio,
        priceSnapshot.stash.chaosToDivineRatio,
      );
  }

  /**
   * Add a card to the current session
   */
  public addCard(
    game: GameType,
    league: string,
    cardName: string,
    processedId: string,
  ): boolean {
    const perf = this.perfLogger.startTimers();

    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) {
      console.warn(`No active session for ${game}, skipping card: ${cardName}`);
      return false;
    }

    // Check for duplicates
    perf?.start("dupCheck");
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
      const dupCheckTime = perf?.end("dupCheck") ?? 0;
      this.perfLogger.log("Card skipped (duplicate)", {
        Card: cardName,
        DupCheck: dupCheckTime,
      });

      return false;
    }

    sessionProcessedIds.add(processedId);
    perf?.end("dupCheck") ?? 0;

    // Save globally (batched)
    perf?.start("tracker");
    this.saveProcessedIdGlobally(game, processedId);
    perf?.end("tracker") ?? 0;

    // Add to session in transaction
    perf?.start("session");
    this.db.transaction(() => {
      // Update session card
      this.statements.upsertSessionCard.run(activeSession.sessionId, cardName);

      // Update total count
      const totalCount = this.db
        .getDb()
        .prepare(
          `SELECT COALESCE(SUM(count), 0) as total
           FROM session_cards
           WHERE session_id = ?`,
        )
        .get(activeSession.sessionId) as { total: number };

      this.db
        .getDb()
        .prepare("UPDATE sessions SET total_count = ? WHERE id = ?")
        .run(totalCount.total, activeSession.sessionId);
    });
    perf?.end("session") ?? 0;

    // Cascade to data store
    perf?.start("cascade");
    this.dataStore.addCard(game, league, cardName);
    perf?.end("cascade") ?? 0;

    // Emit update
    perf?.start("emit");
    this.emitSessionDataUpdate(game);
    perf?.end("emit") ?? 0;
    return true;
  }

  /**
   * Check if session is active
   */
  public isSessionActive(game: GameType): boolean {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;
    return activeSession !== null;
  }

  /**
   * Get active session info
   */
  public getActiveSessionInfo(
    game: GameType,
  ): { league: string; startedAt: string } | null {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) return null;

    return {
      league: activeSession.league,
      startedAt: activeSession.startedAt,
    };
  }

  /**
   * Get current session data with prices
   */
  public getCurrentSession(game: GameType): DetailedDivinationCardStats | null {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!activeSession) return null;

    const dbInstance = this.db.getDb();

    // Get session from DB
    const session = this.statements.getSession.get(
      activeSession.sessionId,
    ) as any;

    if (!session) return null;

    // Load snapshot
    const priceSnapshot = session.snapshot_id
      ? this.snapshotService.loadSnapshot(session.snapshot_id)
      : undefined;

    // Get session cards with hidePrice flags
    const cards = dbInstance
      .prepare(
        `SELECT card_name, count, hide_price_exchange, hide_price_stash
             FROM session_cards
             WHERE session_id = ?`,
      )
      .all(activeSession.sessionId) as Array<{
      card_name: string;
      count: number;
      hide_price_exchange: number;
      hide_price_stash: number;
    }>;

    // Build cards object
    const cardsObject: Record<string, any> = {};

    for (const card of cards) {
      const cardEntry: any = {
        count: card.count,
        processedIds: [],
      };

      // Add prices if snapshot available
      if (priceSnapshot) {
        const exchangeData = priceSnapshot.exchange.cardPrices[card.card_name];
        const stashData = priceSnapshot.stash.cardPrices[card.card_name];

        if (exchangeData) {
          cardEntry.exchangePrice = {
            chaosValue: exchangeData.chaosValue,
            divineValue: exchangeData.divineValue,
            totalValue: exchangeData.chaosValue * card.count,
            hidePrice: Boolean(card.hide_price_exchange),
          };
        }

        if (stashData) {
          cardEntry.stashPrice = {
            chaosValue: stashData.chaosValue,
            divineValue: stashData.divineValue,
            totalValue: stashData.chaosValue * card.count,
            hidePrice: Boolean(card.hide_price_stash),
          };
        }
      }

      cardsObject[card.card_name] = cardEntry;
    }

    // Calculate totals
    const totals = priceSnapshot
      ? this.calculateSessionTotals(cardsObject, priceSnapshot)
      : undefined;

    // Convert cards object to array for UI
    const cardsArray = this.convertCardsToArray(
      cardsObject,
      session.total_count,
    );

    return {
      totalCount: session.total_count,
      cards: cardsArray, // Return as array for UI
      startedAt: session.started_at,
      endedAt: session.ended_at,
      league: session.league,
      priceSnapshot,
      totals,
    };
  }

  /**
   * Convert cards object to sorted array with card names
   */
  private convertCardsToArray(
    cardsObject: Record<string, any>,
    totalCount: number,
  ): CardEntry[] {
    return Object.entries(cardsObject).map(([name, entry]) => ({
      name,
      count: entry.count,
      processedIds: entry.processedIds || [],
      stashPrice: entry.stashPrice,
      exchangePrice: entry.exchangePrice,
    }));
  }

  /**
   * Calculate session totals
   */
  private calculateSessionTotals(
    cards: Record<string, any>,
    priceSnapshot: SessionPriceSnapshot,
  ): SessionTotals {
    let stashTotal = 0;
    let exchangeTotal = 0;

    for (const [cardName, cardData] of Object.entries(cards)) {
      if (cardData.stashPrice && !cardData.stashPrice.hidePrice) {
        stashTotal += cardData.stashPrice.totalValue;
      }
      if (cardData.exchangePrice && !cardData.exchangePrice.hidePrice) {
        exchangeTotal += cardData.exchangePrice.totalValue;
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
   * Update card price visibility (for hiding cards from totals)
   */
  public async updateCardPriceVisibility(
    game: GameType,
    sessionId: string,
    priceSource: "exchange" | "stash",
    cardName: string,
    hidePrice: boolean,
  ): Promise<void> {
    const dbInstance = this.db.getDb();

    // Resolve "current" to actual session ID
    let actualSessionId = sessionId;
    if (sessionId === "current") {
      const activeSession =
        game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

      if (!activeSession) {
        console.warn(`No active session for ${game}, cannot update visibility`);
        return;
      }

      actualSessionId = activeSession.sessionId;
    }

    const column =
      priceSource === "exchange" ? "hide_price_exchange" : "hide_price_stash";

    // Update the hidePrice flag in the database
    dbInstance
      .prepare(
        `UPDATE session_cards
         SET ${column} = ?
         WHERE session_id = ? AND card_name = ?`,
      )
      .run(hidePrice ? 1 : 0, actualSessionId, cardName);

    // Emit update to refresh the UI
    this.emitSessionDataUpdate(game);
  }

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
    const sessionData = this.getCurrentSession(game);

    for (const window of windows) {
      window.webContents.send("session:data-updated", {
        game,
        data: sessionData,
      });
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
}

export { CurrentSessionService };
