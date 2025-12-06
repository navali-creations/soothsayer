import EventEmitter from "node:events";
import fs from "node:fs";
import type { GameType } from "../../../types/data-stores";
import {
  CurrentSessionService,
  type MainWindowService,
  PerformanceLoggerService,
  SettingsStoreService,
} from "../../modules";
import { parseCards, readLastLines } from "./utils";

class ClientLogReaderService extends EventEmitter {
  private static _instance: ClientLogReaderService;
  private readonly clientLogPath: string;
  private mainWindow: MainWindowService;
  private session: CurrentSessionService;
  private settingsStore: SettingsStoreService;
  private perfLogger: PerformanceLoggerService;
  private game: GameType = "poe1"; // Default to PoE1, will be determined by path

  static getInstance(mainWindow: MainWindowService) {
    if (!ClientLogReaderService._instance) {
      ClientLogReaderService._instance = new ClientLogReaderService(mainWindow);
    }

    return ClientLogReaderService._instance;
  }

  constructor(mainWindow: MainWindowService) {
    super();
    this.clientLogPath =
      "E:/Steam/steamapps/common/Path of Exile/logs/Client.txt";
    this.mainWindow = mainWindow;
    this.session = CurrentSessionService.getInstance();
    this.settingsStore = SettingsStoreService.getInstance();
    this.perfLogger = PerformanceLoggerService.getInstance();

    // Determine which game based on path (you'll improve this later with saved paths)
    this.game = this.clientLogPath.includes("Path of Exile 2")
      ? "poe2"
      : "poe1";

    this.watchFile(this.clientLogPath);
  }

  public watchFile(clientLogPath: string) {
    fs.watchFile(clientLogPath, { interval: 100 }, async () => {
      const perf = this.perfLogger.startTimers();
      const overallTimer = this.perfLogger.startTimer("Processing summary");

      try {
        // Check if there's an active session for this game
        perf?.start("sessionCheck");
        if (!this.session.isSessionActive(this.game)) {
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

        // Parse divination cards from recent lines
        perf?.start("parse");
        const newCards = parseCards(lines, new Set());
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
              // 2. Updating current session
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

  public stopWatchFile() {
    fs.unwatchFile(this.clientLogPath);
  }

  /**
   * Update which client.txt file to watch and which game it's for
   */
  public setClientLogPath(path: string, game: GameType) {
    this.stopWatchFile();
    this.game = game;
    this.watchFile(path);
  }
}

export { ClientLogReaderService };
