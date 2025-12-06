import EventEmitter from "node:events";
import fs from "node:fs";
import type { GameType } from "../../../types/data-stores";
import {
  CurrentSessionService,
  type MainWindowService,
  SettingsStoreService,
} from "../../modules";
import { parseCards, readLastLines } from "./utils";

class ClientLogReaderService extends EventEmitter {
  private static _instance: ClientLogReaderService;
  private readonly clientLogPath: string;
  private mainWindow: MainWindowService;
  private session: CurrentSessionService;
  private settingsStore: SettingsStoreService;
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
        if (!this.session.isSessionActive(this.game)) {
          // No active session, skip processing
          return;
        }

        // Get current league from active session
        const sessionInfo = this.session.getActiveSessionInfo(this.game);
        if (!sessionInfo) {
          return;
        }

        // Read last 10 lines since we're checking frequently
        const lines = await readLastLines(clientLogPath, 10);

        // Parse divination cards from recent lines
        // We don't need to pass processedIds - CurrentSessionService handles that
        const newCards = parseCards(lines, new Set());

        if (newCards.totalCount > 0) {
          // Process each new card found
          for (const [cardName, entry] of Object.entries(newCards.cards)) {
            for (const processedId of entry.processedIds) {
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

              if (added) {
                console.log(
                  `New card: ${cardName} (${this.game}, ${sessionInfo.league})`,
                );
              }
            }
          }

          // Get updated session stats and emit to renderer
          const currentSession = this.session.getCurrentSession(this.game);
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

export { ClientLogReaderService };
