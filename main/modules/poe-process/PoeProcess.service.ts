import { app, ipcMain, powerMonitor } from "electron";

import type { MainWindowService } from "~/main/modules/main-window";
import { PoeProcessWatcher } from "~/main/pollers/PoeProcessWatcher";
import { assertTrustedSender } from "~/main/utils/ipc-validation";

import { PoeProcessChannel } from "./PoeProcess.channels";
import {
  createPoeProcessSnapshot,
  type PoeProcessSnapshot,
} from "./PoeProcess.dto";

/**
 * Service responsible for monitoring the Path of Exile process
 * and communicating its state to the renderer process.
 */
class PoeProcessService {
  private static _instance: PoeProcessService;
  private readonly watcher: PoeProcessWatcher;
  private currentSnapshot = createPoeProcessSnapshot();
  private mainWindow: MainWindowService | null = null;
  private isSystemSuspended = false;

  static getInstance(): PoeProcessService {
    if (!PoeProcessService._instance) {
      PoeProcessService._instance = new PoeProcessService();
    }
    return PoeProcessService._instance;
  }

  private constructor() {
    this.watcher = new PoeProcessWatcher({
      isPackaged: app.isPackaged,
    });
    this.setupWatcherListeners();
    this.setupIpcHandlers();
    this.setupPowerMonitor();
  }

  /**
   * Initialize the PoE process monitoring.
   * Call this after the main window is created.
   */
  public initialize(mainWindow: MainWindowService): void {
    this.mainWindow = mainWindow;
    if (!this.isSystemSuspended) {
      this.watcher.start();
    }
  }

  /**
   * Stop monitoring and clean up resources.
   */
  public stop(): void {
    this.watcher.stop();
  }

  private setupWatcherListeners(): void {
    this.watcher.on("data", (snapshot: PoeProcessSnapshot) => {
      this.currentSnapshot = snapshot;
      this.sendToRenderer(
        PoeProcessChannel.SnapshotChanged,
        this.currentSnapshot,
      );
    });

    this.watcher.on("error", (error: Error) => {
      console.error("PoE process watcher error:", error);
    });
  }

  private setupIpcHandlers(): void {
    ipcMain.handle(PoeProcessChannel.GetSnapshot, async (event) => {
      assertTrustedSender(event, PoeProcessChannel.GetSnapshot);
      this.currentSnapshot = await this.watcher.pollSnapshot();
      return this.currentSnapshot;
    });
  }

  private setupPowerMonitor(): void {
    powerMonitor.on("suspend", () => {
      console.log("[PoeProcess] System suspending, stopping watcher");
      this.isSystemSuspended = true;
      this.watcher.stop();
      this.currentSnapshot = createPoeProcessSnapshot();
      this.sendToRenderer(
        PoeProcessChannel.SnapshotChanged,
        this.currentSnapshot,
      );
    });

    powerMonitor.on("resume", () => {
      console.log("[PoeProcess] System resumed, starting watcher");
      this.isSystemSuspended = false;
      if (this.mainWindow) {
        this.watcher.start();
      }
    });

    powerMonitor.on("lock-screen", () => {
      console.log("[PoeProcess] Screen locked");
    });

    powerMonitor.on("unlock-screen", () => {
      console.log("[PoeProcess] Screen unlocked");
    });
  }

  private sendToRenderer(channel: PoeProcessChannel, data?: unknown): void {
    if (!this.mainWindow) return;

    try {
      const webContents = this.mainWindow.getWebContents();
      if (webContents && !webContents.isDestroyed()) {
        webContents.send(channel, data);
      }
    } catch (error) {
      console.warn(
        `[PoeProcess] Failed to send to renderer (${channel}):`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export { PoeProcessService };
