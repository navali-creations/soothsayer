import { ipcMain } from "electron";
import { type MainWindowService, PoeProcessChannel } from "../../modules";
import { PoeProcessPoller } from "../../pollers/PoeProcessPoller";

/**
 * Service responsible for monitoring the Path of Exile process
 * and communicating its state to the renderer process.
 */
class PoeProcessService {
  private static _instance: PoeProcessService;
  private poller: PoeProcessPoller;
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
    console.log("PoE Process Service initialized");
  }

  /**
   * Stop monitoring and clean up resources.
   */
  public stop(): void {
    this.poller.stop();
    console.log("PoE Process Service stopped");
  }

  private setupPollerListeners(): void {
    // PoE process started
    this.poller.on("start", (state) => {
      console.log("PoE process started:", state);
      this.sendToRenderer(PoeProcessChannel.Start, state);
    });

    // PoE process stopped
    this.poller.on("stop", (previousState) => {
      console.log("PoE process stopped:", previousState);
      this.sendToRenderer(PoeProcessChannel.Stop, previousState);
    });

    // PoE process state (emitted on every poll)
    this.poller.on("data", (state) => {
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
      return {
        isRunning: this.poller.isPollerRunning,
      };
    });
  }

  private sendToRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed?.()) {
      this.mainWindow.webContents?.send(channel, data);
    }
  }
}

export { PoeProcessService };
