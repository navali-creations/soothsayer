import fs from "node:fs";
import path from "node:path";
import { BrowserWindow, ipcMain } from "electron";
import Store from "electron-store";
import type {
  DetailedCardEntry,
  DetailedDivinationCardStats,
  GameType,
  SessionPriceSnapshot,
} from "../../types/data-stores";
import { DataStoreEngine, PoeNinjaEngine } from ".";

// Store for tracking last processed IDs globally (prevents replay on new session)
interface ProcessedIdsTracker {
  lastProcessedIds: string[];
}

class SessionEngine {
  private static _instance: SessionEngine;

  // Current session stores (one per game)
  private poe1CurrentSessionStore: Store<DetailedDivinationCardStats> | null =
    null;
  private poe2CurrentSessionStore: Store<DetailedDivinationCardStats> | null =
    null;

  // Global processed IDs tracker (persists across sessions)
  private poe1GlobalProcessedIdsStore: Store<ProcessedIdsTracker>;
  private poe2GlobalProcessedIdsStore: Store<ProcessedIdsTracker>;

  // In-memory processed IDs for quick lookup (current session + global history)
  private poe1ProcessedIds: Set<string> = new Set();
  private poe2ProcessedIds: Set<string> = new Set();

  // Track active sessions
  private poe1ActiveSession: { league: string; startedAt: string } | null =
    null;
  private poe2ActiveSession: { league: string; startedAt: string } | null =
    null;

  private dataStore: DataStoreEngine;
  private poeNinjaEngine: PoeNinjaEngine;

  static getInstance() {
    if (!SessionEngine._instance) {
      SessionEngine._instance = new SessionEngine();
    }

    return SessionEngine._instance;
  }

  constructor() {
    this.dataStore = DataStoreEngine.getInstance();
    this.poeNinjaEngine = PoeNinjaEngine.getInstance();

    // Initialize global processed IDs stores (keeps last ~1000 IDs to prevent replays)
    this.poe1GlobalProcessedIdsStore = new Store<ProcessedIdsTracker>({
      name: "poe1-data/processed-ids-tracker",
      defaults: {
        lastProcessedIds: [],
      },
    });

    this.poe2GlobalProcessedIdsStore = new Store<ProcessedIdsTracker>({
      name: "poe2-data/processed-ids-tracker",
      defaults: {
        lastProcessedIds: [],
      },
    });

    // Load global processed IDs into memory
    this.loadGlobalProcessedIds("poe1");
    this.loadGlobalProcessedIds("poe2");

    this.setupHandlers();
  }

  /**
   * Load global processed IDs from disk into memory
   */
  private loadGlobalProcessedIds(game: GameType) {
    const store =
      game === "poe1"
        ? this.poe1GlobalProcessedIdsStore
        : this.poe2GlobalProcessedIdsStore;
    const processedIds =
      game === "poe1" ? this.poe1ProcessedIds : this.poe2ProcessedIds;

    const tracker = store.store;
    tracker.lastProcessedIds.forEach((id) => processedIds.add(id));

    console.log(`Loaded ${processedIds.size} global processed IDs for ${game}`);
  }

  /**
   * Save processed ID to global tracker (keeps last 20 to prevent unbounded growth)
   */
  private saveProcessedIdGlobally(game: GameType, processedId: string) {
    const store =
      game === "poe1"
        ? this.poe1GlobalProcessedIdsStore
        : this.poe2GlobalProcessedIdsStore;
    const tracker = store.store;

    // Add new ID
    const updatedIds = [...tracker.lastProcessedIds, processedId];

    // Keep only last 20 IDs (sliding window - enough to cover last 10 lines + buffer)
    const trimmedIds = updatedIds.slice(-20);

    store.set("lastProcessedIds", trimmedIds);
  }

  /**
   * Setup IPC handlers for session control from renderer
   */
  private setupHandlers() {
    // Start session (now async)
    ipcMain.handle(
      "session:start",
      async (_event, game: GameType, league: string) => {
        try {
          await this.startSession(game, league);
          this.emitSessionStateChange(game);
          return { success: true };
        } catch (error) {
          console.error("Error starting session:", error);
          return { success: false, error: (error as Error).message };
        }
      },
    );

    // Stop session
    ipcMain.handle("session:stop", (_event, game: GameType) => {
      try {
        this.stopSession(game);
        this.emitSessionStateChange(game);
        return { success: true };
      } catch (error) {
        console.error("Error stopping session:", error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Check if session is active
    ipcMain.handle("session:is-active", (_event, game: GameType) => {
      return this.isSessionActive(game);
    });

    // Get current session
    ipcMain.handle("session:get-current", (_event, game: GameType) => {
      return this.getCurrentSession(game);
    });

    // Get session info
    ipcMain.handle("session:get-info", (_event, game: GameType) => {
      return this.getActiveSessionInfo(game);
    });

    // Get all sessions (archived + current)
    ipcMain.handle("session:get-all", (_event, game: GameType) => {
      return this.getAllSessions(game);
    });

    // Get specific session by ID
    ipcMain.handle(
      "session:get-by-id",
      (_event, game: GameType, sessionId: string) => {
        return this.getSessionById(game, sessionId);
      },
    );

    // Update card price visibility
    ipcMain.handle(
      "session:update-card-price-visibility",
      (
        _event,
        game: GameType,
        sessionId: string,
        priceSource: "exchange" | "stash",
        cardName: string,
        hidePrice: boolean,
      ) => {
        try {
          const result = this.updateCardPriceVisibility(
            game,
            sessionId,
            priceSource,
            cardName,
            hidePrice,
          );
          if (result && sessionId === "current") {
            this.emitSessionStateChange(game);
          }
          return { success: result };
        } catch (error) {
          console.error("Error updating card price visibility:", error);
          return { success: false, error: (error as Error).message };
        }
      },
    );
  }

  /**
   * Start a new session for a game
   */
  public async startSession(game: GameType, league: string): Promise<void> {
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (activeSession) {
      throw new Error(`Session already active for ${game}`);
    }

    const startedAt = new Date().toISOString();

    // Fetch price snapshot for this league
    let priceSnapshot: SessionPriceSnapshot | undefined;
    try {
      console.log(`Fetching price snapshot for ${game} league: ${league}...`);
      priceSnapshot = await this.poeNinjaEngine.getPriceSnapshot(league);
      console.log(
        `Price snapshot captured: Exchange (${Object.keys(priceSnapshot.exchange.cardPrices).length} cards, Divine = ${priceSnapshot.exchange.chaosToDivineRatio.toFixed(2)}c), ` +
          `Stash (${Object.keys(priceSnapshot.stash.cardPrices).length} cards, Divine = ${priceSnapshot.stash.chaosToDivineRatio.toFixed(2)}c)`,
      );
    } catch (error) {
      console.error("Failed to fetch price snapshot:", error);

      // Continue without price snapshot - session can still work
      priceSnapshot = undefined;
    }

    // Create current session store
    const sessionStore = new Store<DetailedDivinationCardStats>({
      name: `${game}-session-data/current-session`,
      defaults: {
        totalCount: 0,
        cards: {},
        startedAt,
        endedAt: null,
        league,
        priceSnapshot,
      },
    });

    // Clear the store (in case there was leftover data)
    sessionStore.clear();
    sessionStore.set("totalCount", 0);
    sessionStore.set("cards", {});
    sessionStore.set("startedAt", startedAt);
    sessionStore.set("endedAt", null);
    sessionStore.set("league", league);
    sessionStore.set("priceSnapshot", priceSnapshot);

    if (game === "poe1") {
      this.poe1CurrentSessionStore = sessionStore;
      // Don't clear processedIds - we keep global history to prevent replays
      this.poe1ActiveSession = { league, startedAt };
    } else {
      this.poe2CurrentSessionStore = sessionStore;
      // Don't clear processedIds - we keep global history to prevent replays
      this.poe2ActiveSession = { league, startedAt };
    }

    console.log(`Session started for ${game} in league ${league}`);
    console.log(
      `Global processed IDs in memory: ${game === "poe1" ? this.poe1ProcessedIds.size : this.poe2ProcessedIds.size}`,
    );
  }

  /**
   * Stop the current session and archive it
   */
  public stopSession(game: GameType): void {
    const sessionStore =
      game === "poe1"
        ? this.poe1CurrentSessionStore
        : this.poe2CurrentSessionStore;
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    if (!sessionStore || !activeSession) {
      throw new Error(`No active session for ${game}`);
    }

    const endedAt = new Date().toISOString();
    sessionStore.set("endedAt", endedAt);

    // Create archived session file name
    const timestamp = activeSession.startedAt
      .replace(/:/g, "-")
      .replace(/\..+/, "");
    const archiveName = `${game}-session-data/${activeSession.league}-session-${timestamp}`;

    // Copy current session to archived session
    const archivedSession = new Store<DetailedDivinationCardStats>({
      name: archiveName,
    });

    const sessionData = sessionStore.store;
    archivedSession.store = { ...sessionData, endedAt };

    // Delete the current session file (using the path property)
    try {
      const sessionPath = sessionStore.path;
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
        console.log(`Deleted current session file: ${sessionPath}`);
      }
    } catch (error) {
      console.error(`Failed to delete current session file:`, error);
    }

    // Clear current session in memory
    if (game === "poe1") {
      this.poe1CurrentSessionStore = null;
      this.poe1ActiveSession = null;
      // Note: We DON'T clear processedIds - they persist globally
    } else {
      this.poe2CurrentSessionStore = null;
      this.poe2ActiveSession = null;
      // Note: We DON'T clear processedIds - they persist globally
    }

    console.log(`Session stopped for ${game}, archived as: ${archiveName}`);
  }

  /**
   * Add a card to the current session (and cascade to other stores)
   */
  public addCard(
    game: GameType,
    league: string,
    cardName: string,
    processedId: string,
  ): boolean {
    const sessionStore =
      game === "poe1"
        ? this.poe1CurrentSessionStore
        : this.poe2CurrentSessionStore;
    const processedIds =
      game === "poe1" ? this.poe1ProcessedIds : this.poe2ProcessedIds;
    const activeSession =
      game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;

    // Check if session is active
    if (!sessionStore || !activeSession) {
      console.warn(`No active session for ${game}, card not recorded`);
      return false;
    }

    // Check if already processed GLOBALLY (includes previous sessions)
    if (processedIds.has(processedId)) {
      return false; // Duplicate, skip (could be from previous session)
    }

    // Add to in-memory set (global)
    processedIds.add(processedId);

    // Save to global persistent tracker
    this.saveProcessedIdGlobally(game, processedId);

    // Update session store
    const stats = sessionStore.store;
    const cards = { ...stats.cards };

    if (cards[cardName]) {
      const existingIds = cards[cardName].processedIds || [];
      cards[cardName] = {
        count: cards[cardName].count + 1,
        processedIds: [...existingIds, processedId],
      };
    } else {
      cards[cardName] = {
        count: 1,
        processedIds: [processedId],
      };
    }

    sessionStore.set("cards", cards);
    sessionStore.set("totalCount", stats.totalCount + 1);
    sessionStore.set("lastUpdated", new Date().toISOString());

    // Cascade to data stores (league, all-time, global)
    this.dataStore.addCard(game, league, cardName);

    return true;
  }

  /**
   * Check if a session is active
   */
  public isSessionActive(game: GameType): boolean {
    return game === "poe1"
      ? this.poe1ActiveSession !== null
      : this.poe2ActiveSession !== null;
  }

  /**
   * Get current session stats
   */
  public getCurrentSession(game: GameType): DetailedDivinationCardStats | null {
    const sessionStore =
      game === "poe1"
        ? this.poe1CurrentSessionStore
        : this.poe2CurrentSessionStore;
    return sessionStore ? sessionStore.store : null;
  }

  /**
   * Get active session info
   */
  public getActiveSessionInfo(
    game: GameType,
  ): { league: string; startedAt: string } | null {
    return game === "poe1" ? this.poe1ActiveSession : this.poe2ActiveSession;
  }

  /**
   * Reset current session (clears all data but keeps session active)
   */
  public resetCurrentSession(game: GameType): void {
    const sessionStore =
      game === "poe1"
        ? this.poe1CurrentSessionStore
        : this.poe2CurrentSessionStore;

    if (!sessionStore) {
      throw new Error(`No active session for ${game}`);
    }

    sessionStore.set("totalCount", 0);
    sessionStore.set("cards", {});
    sessionStore.set("lastUpdated", new Date().toISOString());
    // Note: We DON'T clear global processedIds

    console.log(`Session reset for ${game}`);
  }

  /**
   * Clear global processed IDs tracker (use with caution!)
   */
  public clearGlobalProcessedIds(game: GameType): void {
    const store =
      game === "poe1"
        ? this.poe1GlobalProcessedIdsStore
        : this.poe2GlobalProcessedIdsStore;
    const processedIds =
      game === "poe1" ? this.poe1ProcessedIds : this.poe2ProcessedIds;

    store.set("lastProcessedIds", []);
    processedIds.clear();

    console.log(`Cleared global processed IDs for ${game}`);
  }

  /**
   * Emit session state change to all renderer windows
   */
  private emitSessionStateChange(game: GameType): void {
    const windows = BrowserWindow.getAllWindows();
    const isActive = this.isSessionActive(game);
    const sessionInfo = this.getActiveSessionInfo(game);

    for (const window of windows) {
      window.webContents.send("session:state-changed", {
        game,
        isActive,
        sessionInfo,
      });
    }
  }

  /**
   * Get all sessions (current + archived) for a game
   */
  public getAllSessions(
    game: GameType,
  ): Array<DetailedDivinationCardStats & { id: string; isActive: boolean }> {
    const sessions: Array<
      DetailedDivinationCardStats & { id: string; isActive: boolean }
    > = [];

    // Add current session if active
    const currentSession = this.getCurrentSession(game);
    if (currentSession) {
      sessions.push({
        ...currentSession,
        id: "current",
        isActive: true,
      });
    }

    // Get archived sessions from electron-store
    try {
      // Get the config directory from an existing store instance
      const tempStore = new Store({ name: "temp-path-getter" });
      const configPath = path.dirname(tempStore.path);
      const sessionDir = path.join(configPath, `${game}-session-data`);

      if (fs.existsSync(sessionDir)) {
        const files = fs.readdirSync(sessionDir);

        for (const file of files) {
          if (file.endsWith(".json") && file !== "current-session.json") {
            try {
              const sessionStore = new Store<DetailedDivinationCardStats>({
                name: `${game}-session-data/${path.basename(file, ".json")}`,
              });

              const sessionData = sessionStore.store;
              sessions.push({
                ...sessionData,
                id: path.basename(file, ".json"),
                isActive: false,
              });
            } catch (error) {
              console.error(`Error loading session file ${file}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error reading archived sessions:", error);
    }

    // Sort by startedAt (newest first)
    sessions.sort((a, b) => {
      const dateA = new Date(a.startedAt || 0).getTime();
      const dateB = new Date(b.startedAt || 0).getTime();
      return dateB - dateA;
    });

    return sessions;
  }

  /**
   * Get a specific session by ID
   */
  public getSessionById(
    game: GameType,
    sessionId: string,
  ): (DetailedDivinationCardStats & { id: string; isActive: boolean }) | null {
    if (sessionId === "current") {
      const currentSession = this.getCurrentSession(game);
      if (currentSession) {
        return {
          ...currentSession,
          id: "current",
          isActive: true,
        };
      }
      return null;
    }

    // Load archived session
    try {
      const sessionStore = new Store<DetailedDivinationCardStats>({
        name: `${game}-session-data/${sessionId}`,
      });

      return {
        ...sessionStore.store,
        id: sessionId,
        isActive: false,
      };
    } catch (error) {
      console.error("Error loading session:", error);
      return null;
    }
  }

  /**
   * Update hidePrice flag for a card in a session's price snapshot
   */
  public updateCardPriceVisibility(
    game: GameType,
    sessionId: string,
    priceSource: "exchange" | "stash",
    cardName: string,
    hidePrice: boolean,
  ): boolean {
    try {
      let sessionStore: Store<DetailedDivinationCardStats>;

      if (sessionId === "current") {
        const currentStore =
          game === "poe1"
            ? this.poe1CurrentSessionStore
            : this.poe2CurrentSessionStore;

        if (!currentStore) {
          throw new Error(`No active session for ${game}`);
        }
        sessionStore = currentStore;
      } else {
        sessionStore = new Store<DetailedDivinationCardStats>({
          name: `${game}-session-data/${sessionId}`,
        });
      }

      const stats = sessionStore.store;
      if (!stats.priceSnapshot) {
        throw new Error("Session has no price snapshot");
      }

      const source = stats.priceSnapshot[priceSource];
      if (!source.cardPrices[cardName]) {
        throw new Error(`Card ${cardName} not found in ${priceSource} prices`);
      }

      // Update the hidePrice flag
      const updatedPrices = { ...source.cardPrices };
      updatedPrices[cardName] = {
        ...updatedPrices[cardName],
        hidePrice,
      };

      // Update the store
      sessionStore.set(
        `priceSnapshot.${priceSource}.cardPrices`,
        updatedPrices,
      );

      console.log(
        `Updated hidePrice for ${cardName} in ${game} session ${sessionId} (${priceSource}): ${hidePrice}`,
      );

      return true;
    } catch (error) {
      console.error("Error updating card price visibility:", error);
      return false;
    }
  }
}

export { SessionEngine };
