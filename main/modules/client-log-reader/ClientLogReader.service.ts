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
import { parseCards } from "./utils";

/**
 * SQLite-based ClientLogReader service
 * Watches client.txt for new divination cards and adds them to the active session.
 *
 * Uses a tail-follow pattern: keeps a persistent file descriptor open and only
 * reads new bytes appended since the last poll, avoiding redundant open/close
 * cycles on every 100ms tick.
 */
class ClientLogReaderService extends EventEmitter {
  private static _instance: ClientLogReaderService;
  private session: CurrentSessionService;
  private settingsStore: SettingsStoreService;
  private perfLogger: PerformanceLoggerService;
  private game: GameType | null = null;
  private clientLogPath: string | null = null;
  private initialized: boolean = false;

  /** Re-entrancy guard: prevents concurrent watchFile callbacks from overlapping. */
  private isProcessing: boolean = false;

  /** Tracks the file size at last read so we only read new bytes. */
  private lastKnownSize: number = 0;

  /** Persistent file descriptor for the watched log file. */
  private fd: number | null = null;

  /**
   * Buffer for an incomplete trailing line from the previous read.
   * Because we read raw byte chunks the last "line" may be incomplete;
   * we prepend it to the next chunk so parseCards always sees whole lines.
   */
  private partialLine: string = "";

  static async getInstance(
    mainWindow?: MainWindowServiceType,
  ): Promise<ClientLogReaderService> {
    if (!ClientLogReaderService._instance) {
      if (!mainWindow) {
        throw new Error(
          "ClientLogReaderService requires mainWindow for first initialization",
        );
      }
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

  /**
   * Open (or re-open) a persistent file descriptor for reading and
   * initialise `lastKnownSize` to the current file size so we don't
   * re-process historical data.
   */
  private openFileDescriptor(filePath: string): void {
    this.closeFileDescriptor();

    try {
      this.fd = fs.openSync(filePath, "r");
      // Seed with the current size — we only care about future appends.
      const stat = fs.fstatSync(this.fd);
      this.lastKnownSize = stat.size;
    } catch {
      // File may not exist yet; that's fine — the watchFile callback will
      // keep firing and we'll try again when data arrives.
      this.fd = null;
      this.lastKnownSize = 0;
    }

    this.partialLine = "";
  }

  /**
   * Close the persistent file descriptor if one is open.
   */
  private closeFileDescriptor(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        // Ignore — fd may already be invalid after file deletion / rotation.
      }
      this.fd = null;
    }
  }

  public watchFile(clientLogPath: string): void {
    if (!this.game) {
      console.warn(
        "[ClientLogReader] Cannot watch file - game not initialized",
      );
      return;
    }

    // Open a persistent fd and seed lastKnownSize.
    this.openFileDescriptor(clientLogPath);

    fs.watchFile(
      clientLogPath,
      { interval: 100 },
      async (curr: fs.Stats, _prev: fs.Stats) => {
        // Re-entrancy guard: if a previous callback is still awaiting addCard,
        // skip this tick. The next tick will pick up any new bytes.
        if (this.isProcessing) return;

        // Guard against game not being set
        if (!this.game) {
          return;
        }
        const currentGame = this.game;

        // ── Fast-path: no new data ────────────────────────────────────────
        // curr.size === 0 && birthtime === 0 means the file doesn't exist.
        if (curr.size === 0 && curr.birthtimeMs === 0) {
          // File was deleted — reset state so we re-read from the start
          // if / when it reappears.
          this.closeFileDescriptor();
          this.lastKnownSize = 0;
          this.partialLine = "";
          return;
        }

        if (curr.size <= this.lastKnownSize) {
          if (curr.size < this.lastKnownSize) {
            // File was truncated / rotated — re-open and read from beginning.
            this.openFileDescriptor(clientLogPath);
            // After openFileDescriptor, lastKnownSize == current size and we
            // skip this tick (the rotated file's existing content is "old").
          }
          // No new bytes — nothing to do.
          return;
        }

        // ── There are new bytes to read ──────────────────────────────────

        const perf = this.perfLogger.startTimers();
        const overallTimer = this.perfLogger.startTimer("Processing summary");

        this.isProcessing = true;
        try {
          // Check if there's an active session for this game
          perf?.start("sessionCheck");
          const isActive = this.session.isSessionActive(currentGame);

          if (!isActive) {
            // No active session — still advance lastKnownSize so we don't
            // re-process these bytes once a session starts.
            this.lastKnownSize = curr.size;
            this.partialLine = "";
            return;
          }
          const sessionCheckTime = perf?.end("sessionCheck") ?? 0;

          // Get current league from active session
          perf?.start("sessionInfo");
          const sessionInfo = this.session.getActiveSessionInfo(currentGame);
          if (!sessionInfo) {
            this.lastKnownSize = curr.size;
            this.partialLine = "";
            return;
          }
          const sessionInfoTime = perf?.end("sessionInfo") ?? 0;

          // ── Read only the new bytes ──────────────────────────────────
          perf?.start("read");

          // Ensure we have a valid fd.
          if (this.fd === null) {
            this.openFileDescriptor(clientLogPath);
            // openFileDescriptor sets lastKnownSize to current size,
            // so there's nothing new to read on this tick.
            return;
          }

          const bytesToRead = curr.size - this.lastKnownSize;
          const buffer = Buffer.alloc(bytesToRead);
          const bytesRead = fs.readSync(
            this.fd,
            buffer,
            0,
            bytesToRead,
            this.lastKnownSize,
          );

          this.lastKnownSize = curr.size;

          // Combine any leftover partial line with the new chunk.
          const chunk =
            this.partialLine + buffer.toString("utf-8", 0, bytesRead);

          // If the chunk doesn't end with a newline the last "line" is
          // incomplete — buffer it for the next tick.
          let textToParse: string;
          if (chunk.length > 0 && !chunk.endsWith("\n")) {
            const lastNewline = chunk.lastIndexOf("\n");
            if (lastNewline === -1) {
              // Entire chunk is a partial line — nothing to parse yet.
              this.partialLine = chunk;
              perf?.end("read");
              return;
            }
            textToParse = chunk.substring(0, lastNewline + 1);
            this.partialLine = chunk.substring(lastNewline + 1);
          } else {
            textToParse = chunk;
            this.partialLine = "";
          }

          const readTime = perf?.end("read") ?? 0;

          // Parse divination cards from the new lines
          perf?.start("parse");
          const allProcessedIds = this.session.getAllProcessedIds(currentGame);
          const newCards = parseCards(textToParse, allProcessedIds);
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
          console.error(`[ClientLogReader] Processing failed:`, error);
        } finally {
          this.isProcessing = false;
        }
      },
    );
  }

  public stopWatchFile(): void {
    if (this.clientLogPath) {
      fs.unwatchFile(this.clientLogPath);
    }
    this.closeFileDescriptor();
    this.lastKnownSize = 0;
    this.partialLine = "";
    this.isProcessing = false;
  }

  /**
   * Update which client.txt file to watch and which game it's for.
   */
  public setClientLogPath(path: string, game: GameType): void {
    this.stopWatchFile();
    this.game = game;
    this.clientLogPath = path;
    this.watchFile(path);
  }
}

export { ClientLogReaderService };
