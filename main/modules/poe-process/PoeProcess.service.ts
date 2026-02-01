import { ipcMain, powerMonitor } from "electron";

import { type MainWindowService, PoeProcessChannel } from "~/main/modules";

import { PoeProcessPoller } from "../../pollers/PoeProcessPoller";

/**
 * Service responsible for monitoring the Path of Exile process
 * and communicating its state to the renderer process.
 */
class PoeProcessService {
  private static _instance: PoeProcessService;
  private poller: PoeProcessPoller;
  private currentState: { isRunning: boolean; processName: string } = {
    isRunning: false,
    processName: "",
  };
  private mainWindow: MainWindowService | null = null;
  private isSystemSuspended = false;

  static getInstance(): PoeProcessService {
    if (!PoeProcessService._instance) {
      PoeProcessService._instance = new PoeProcessService();
    }
    return PoeProcessService._instance;
  }

  private constructor() {
    this.poller = new PoeProcessPoller();
    this.setupPollerListeners();
    this.setupIpcHandlers();
    this.setupPowerMonitor();
  }

  /**
   * Initialize the PoE process monitoring.
   * Call this after the main window is created.
   */
  public initialize(mainWindow: MainWindowService): void {
    this.mainWindow = mainWindow;
    // Only start polling if system is not suspended
    if (!this.isSystemSuspended) {
      this.poller.start();
    }
  }

  /**
   * Stop monitoring and clean up resources.
   */
  public stop(): void {
    this.poller.stop();
  }

  private setupPollerListeners(): void {
    // PoE process started
    this.poller.on("start", (state) => {
      this.currentState = state;
      this.sendToRenderer(PoeProcessChannel.Start, state);
    });

    // PoE process stopped
    this.poller.on("stop", (previousState) => {
      this.currentState = { isRunning: false, processName: "" };
      this.sendToRenderer(PoeProcessChannel.Stop, previousState);
    });

    // PoE process state (emitted on every poll)
    this.poller.on("data", (state) => {
      this.currentState = state;
      this.sendToRenderer(PoeProcessChannel.GetState, state);
    });

    // Handle errors
    this.poller.on("error", (error) => {
      console.error("PoE process poller error:", error);
      this.sendToRenderer(PoeProcessChannel.GetError, {
        error: error.message,
      });
    });
  }

  private setupIpcHandlers(): void {
    // Get current PoE process state
    ipcMain.handle(PoeProcessChannel.IsRunning, () => {
      return this.currentState;
    });
  }

  private setupPowerMonitor(): void {
    // Stop polling when system is about to suspend/sleep
    powerMonitor.on("suspend", () => {
      console.log("[PoeProcess] System suspending, stopping poller");
      this.isSystemSuspended = true;
      this.poller.stop();
    });

    // Resume polling when system wakes up
    powerMonitor.on("resume", () => {
      console.log("[PoeProcess] System resumed, starting poller");
      this.isSystemSuspended = false;
      // Only restart if we have a main window (service was initialized)
      if (this.mainWindow) {
        this.poller.start();
      }
    });

    // Also handle lock/unlock events on Windows
    powerMonitor.on("lock-screen", () => {
      console.log("[PoeProcess] Screen locked");
    });

    powerMonitor.on("unlock-screen", () => {
      console.log("[PoeProcess] Screen unlocked");
    });
  }

  private sendToRenderer(channel: string, data?: any): void {
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
