import { ipcMain } from "electron";

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
  }

  /**
   * Initialize the PoE process monitoring.
   * Call this after the main window is created.
   */
  public initialize(mainWindow: MainWindowService): void {
    this.mainWindow = mainWindow;
    this.poller.start();
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
