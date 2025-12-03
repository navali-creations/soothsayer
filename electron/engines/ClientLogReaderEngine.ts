import EventEmitter from "node:events";
import fs from "node:fs";
import { parseCards } from "../utils/parseCards";
import { readLastLines } from "../utils/read-last-lines";
import {
  SessionEngine,
  LocalStorageEngine,
  type MainWindowEngineType,
} from ".";
import type { GameType } from "../../types/data-stores";

class ClientLogReaderEngine extends EventEmitter {
  private static _instance: ClientLogReaderEngine;
  private readonly clientLogPath: string;
  private mainWindow: MainWindowEngineType;
  private sessionEngine: SessionEngine;
  private localStorageEngine: LocalStorageEngine;
  private game: GameType = "poe1"; // Default to PoE1, will be determined by path

  static getInstance(mainWindow: MainWindowEngineType) {
    if (!ClientLogReaderEngine._instance) {
      ClientLogReaderEngine._instance = new ClientLogReaderEngine(mainWindow);
    }

    return ClientLogReaderEngine._instance;
  }

  constructor(mainWindow: MainWindowEngineType) {
    super();
    this.clientLogPath =
      "E:/Steam/steamapps/common/Path of Exile/logs/Client.txt";
    this.mainWindow = mainWindow;
    this.sessionEngine = SessionEngine.getInstance();
    this.localStorageEngine = LocalStorageEngine.getInstance();

    // Determine which game based on path (you'll improve this later with saved paths)
    this.game = this.clientLogPath.includes("Path of Exile 2")
      ? "poe2"
      : "poe1";

    this.watchFile(this.clientLogPath);
  }

  public watchFile(clientLogPath: string) {
    fs.watchFile(clientLogPath, { interval: 100 }, async () => {
      try {
        // Check if there's an active session for this game
        if (!this.sessionEngine.isSessionActive(this.game)) {
          // No active session, skip processing
          return;
        }

        // Get current league from active session
        const sessionInfo = this.sessionEngine.getActiveSessionInfo(this.game);
        if (!sessionInfo) {
          return;
        }

        // Read last 10 lines since we're checking frequently
        const lines = await readLastLines(clientLogPath, 10);

        // Parse divination cards from recent lines
        // We don't need to pass processedIds - SessionEngine handles that
        const newCards = parseCards(lines, new Set());

        if (newCards.totalCount > 0) {
          // Process each new card found
          for (const [cardName, entry] of Object.entries(newCards.cards)) {
            for (const processedId of entry.processedIds) {
              // SessionEngine.addCard handles:
              // 1. Duplicate detection (via processedIds)
              // 2. Updating current session
              // 3. Cascading to league, all-time, and global stats
              const added = this.sessionEngine.addCard(
                this.game,
                sessionInfo.league,
                cardName,
                processedId,
              );

              if (added) {
                console.log(
                  `New card: ${cardName} (${this.game}, ${sessionInfo.league})`,
                );
              }
            }
          }

          // Get updated session stats and emit to renderer
          const currentSession = this.sessionEngine.getCurrentSession(
            this.game,
          );
          if (currentSession) {
            this.emit("divination-cards-update", currentSession);
            this.mainWindow?.webContents?.send(
              "divination-cards-update",
              currentSession,
            );
          }
        }
      } catch (error) {
        console.error("Error processing divination cards:", error);
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

export { ClientLogReaderEngine };
