import EventEmitter from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { GameType } from "../../../types/data-stores";
import {
  CurrentSessionService,
  type MainWindowService,
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
  private mainWindow: MainWindowService;
  private session: CurrentSessionService;
  private settingsStore: SettingsStoreService;
  private perfLogger: PerformanceLoggerService;
  private game: GameType;
  private clientLogPath: string;

  static getInstance(
    mainWindow: MainWindowService,
  ): ClientLogReaderService {
    if (!ClientLogReaderService._instance) {
      ClientLogReaderService._instance = new ClientLogReaderService(
        mainWindow,
      );
    }

    return ClientLogReaderService._instance;
  }

  constructor(mainWindow: MainWindowService) {
    super();
    this.mainWindow = mainWindow;
    this.session = CurrentSessionService.getInstance();
    this.settingsStore = SettingsStoreService.getInstance();
    this.perfLogger = PerformanceLoggerService.getInstance();
    this.game = this.settingsStore.get(SettingsKey.ActiveGame) as GameType;
    this.clientLogPath = this.settingsStore.get(SettingsKey.Poe1ClientTxtPath)!;

    this.watchFile(this.clientLogPath);
  }

  public watchFile(clientLogPath: string): void {
    fs.watchFile(clientLogPath, { interval: 100 }, async () => {
      const perf = this.perfLogger.startTimers();
      const overallTimer = this.perfLogger.startTimer("Processing summary");

      try {
        // Check if there's an active session for this game
        perf?.start("sessionCheck");
        const isActive = this.session.isSessionActive(this.game);

        if (!isActive) {
          // No active session, skip processing
          return;
        }
        const sessionCheckTime = perf?.end("sessionCheck") ?? 0;

        // Get current league from active session
        perf?.start("sessionInfo");
        const sessionInfo = this.session.getActiveSessionInfo(this.game);
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
        const allProcessedIds = this.session.getAllProcessedIds(this.game);

        console.log(
          `[ClientLogReader] Parsing with ${allProcessedIds.size} processed IDs for ${this.game}`,
        );

        const newCards = parseCards(lines, allProcessedIds);

        console.log(
          `[ClientLogReader] Found ${newCards.totalCount} new cards after filtering`,
        );

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
              const added = this.session.addCard(
                this.game,
                sessionInfo.league,
                cardName,
                processedId,
              );

              const addCardTime = perf?.end("addCard") ?? 0;

              if (added) {
                this.perfLogger.log(`Card added: ${cardName}`, {
                  Game: this.game,
                  League: sessionInfo.league,
                  "addCard()": addCardTime,
                });
              } else {
                // Card was duplicate, log it too for debugging
                this.perfLogger.log(`Duplicate: ${cardName}`, {
                  "addCard()": addCardTime,
                });
              }
            }
          }

          // Get updated session stats and emit to renderer
          perf?.start("emit");
          const currentSession = this.session.getCurrentSession(this.game);
          if (currentSession) {
            this.emit("divination-cards-update", currentSession);
            this.mainWindow?.webContents?.send(
              "divination-cards-update",
              currentSession,
            );
          }
          const emitTime = perf?.end("emit") ?? 0;

          overallTimer?.({
            Emit: emitTime,
            "Cards processed": newCards.totalCount,
          });
        }
      } catch (error) {
        console.error(`[ERROR] Processing failed:`, error);
      }
    });
  }

  public stopWatchFile(): void {
    fs.unwatchFile(this.clientLogPath);
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
