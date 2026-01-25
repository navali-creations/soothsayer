import EventEmitter from "node:events";
import fs from "node:fs";

import type { GameType } from "../../../types/data-stores";
import {
  CurrentSessionService,
  type MainWindowServiceType,
  PerformanceLoggerService,
  SettingsKey,
  SettingsStoreService,
} from "../../modules";
import { parseCards, readLastLines } from "./utils";

/**
 * SQLite-based ClientLogReader service
 * Watches client.txt for new divination cards and adds them to the active session
 */
class ClientLogReaderService extends EventEmitter {
  private static _instance: ClientLogReaderService;
  private session: CurrentSessionService;
  private settingsStore: SettingsStoreService;
  private perfLogger: PerformanceLoggerService;
  private game: GameType | null = null;
  private clientLogPath: string | null = null;
  private initialized: boolean = false;

  static async getInstance(
    mainWindow: MainWindowServiceType,
  ): Promise<ClientLogReaderService> {
    if (!ClientLogReaderService._instance) {
      ClientLogReaderService._instance = new ClientLogReaderService(mainWindow);
      await ClientLogReaderService._instance.initialize();
    }

    return ClientLogReaderService._instance;
  }

  constructor(_mainWindow: MainWindowServiceType) {
    super();
    this.session = CurrentSessionService.getInstance();
    this.settingsStore = SettingsStoreService.getInstance();
    this.perfLogger = PerformanceLoggerService.getInstance();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    this.game = (await this.settingsStore.get(
      SettingsKey.ActiveGame,
    )) as GameType;
    this.clientLogPath = await this.settingsStore.get(
      SettingsKey.Poe1ClientTxtPath,
    );

    if (this.clientLogPath) {
      this.watchFile(this.clientLogPath);
    }

    this.initialized = true;
  }

  public watchFile(clientLogPath: string): void {
    if (!this.game) {
      console.warn(
        "[ClientLogReader] Cannot watch file - game not initialized",
      );
      return;
    }

    fs.watchFile(clientLogPath, { interval: 100 }, async () => {
      // Guard against game not being set
      if (!this.game) {
        return;
      }
      const currentGame = this.game;

      const perf = this.perfLogger.startTimers();
      const overallTimer = this.perfLogger.startTimer("Processing summary");

      try {
        // Check if there's an active session for this game
        perf?.start("sessionCheck");
        const isActive = this.session.isSessionActive(currentGame);

        if (!isActive) {
          // No active session, skip processing
          return;
        }
        const sessionCheckTime = perf?.end("sessionCheck") ?? 0;

        // Get current league from active session
        perf?.start("sessionInfo");
        const sessionInfo = this.session.getActiveSessionInfo(currentGame);
        if (!sessionInfo) {
          return;
        }
        const sessionInfoTime = perf?.end("sessionInfo") ?? 0;

        // Read last 10 lines since we're checking frequently
        perf?.start("read");
        const lines = await readLastLines(clientLogPath, 10);
        const readTime = perf?.end("read") ?? 0;

        // Parse divination cards from recent lines, excluding already processed IDs
        perf?.start("parse");
        const allProcessedIds = this.session.getAllProcessedIds(currentGame);

        const newCards = parseCards(lines, allProcessedIds);

        const parseTime = perf?.end("parse") ?? 0;

        if (newCards.totalCount > 0) {
          this.perfLogger.log("File processing", {
            "File read": readTime,
            Parse: parseTime,
            "Session check": sessionCheckTime,
            "Session info": sessionInfoTime,
          });

          // Process each new card found
          for (const [cardName, entry] of Object.entries(newCards.cards)) {
            for (const processedId of entry.processedIds) {
              perf?.start("addCard");

              // CurrentSessionService.addCard handles:
              // 1. Duplicate detection (via processedIds)
              // 2. Updating current session in SQLite
              // 3. Cascading to league, all-time, and global stats
              // 4. Emitting session data updates to renderer
              await this.session.addCard(
                currentGame,
                sessionInfo.league,
                cardName,
                processedId,
              );

              const addCardTime = perf?.end("addCard") ?? 0;

              this.perfLogger.log(`Card added: ${cardName}`, {
                Game: currentGame,
                League: sessionInfo.league,
                "addCard()": addCardTime,
              });
            }
          }

          overallTimer?.({
            "Cards processed": newCards.totalCount,
          });
        }
      } catch (error) {
        console.error(`[ERROR] Processing failed:`, error);
      }
    });
  }

  public stopWatchFile(): void {
    if (this.clientLogPath) {
      fs.unwatchFile(this.clientLogPath);
    }
  }

  /**
   * Update which client.txt file to watch and which game it's for
   */
  public setClientLogPath(path: string, game: GameType): void {
    this.stopWatchFile();
    this.game = game;
    this.clientLogPath = path;
    this.watchFile(path);
  }
}

export { ClientLogReaderService };
