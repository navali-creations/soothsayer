import { ipcMain } from "electron";
import { MainWindowEvent } from "../../enums";
import { PoeProcessPoller } from "../pollers/PoeProcessPoller";
import type { MainWindowEngineType } from "./MainWindowEngine";

/**
 * Engine responsible for monitoring the Path of Exile process
 * and communicating its state to the renderer process.
 */
export class PoeProcessEngine {
  private static _instance: PoeProcessEngine;
  private poller: PoeProcessPoller;
  private mainWindow: MainWindowEngineType | null = null;

  static getInstance(): PoeProcessEngine {
    if (!PoeProcessEngine._instance) {
      PoeProcessEngine._instance = new PoeProcessEngine();
    }
    return PoeProcessEngine._instance;
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
  public initialize(mainWindow: MainWindowEngineType): void {
    this.mainWindow = mainWindow;
    this.poller.start();
    console.log("PoE Process Engine initialized");
  }

  /**
   * Stop monitoring and clean up resources.
   */
  public stop(): void {
    this.poller.stop();
    console.log("PoE Process Engine stopped");
  }

  private setupPollerListeners(): void {
    // PoE process started
    this.poller.on("start", (state) => {
      console.log("PoE process started:", state);
      this.sendToRenderer("poe-process-start", state);
    });

    // PoE process stopped
    this.poller.on("stop", (previousState) => {
      console.log("PoE process stopped:", previousState);
      this.sendToRenderer("poe-process-stop", previousState);
    });

    // PoE process state (emitted on every poll)
    this.poller.on("data", (state) => {
      this.sendToRenderer("poe-process-state", state);
    });

    // Handle errors
    this.poller.on("error", (error) => {
      console.error("PoE process poller error:", error);
      this.sendToRenderer("poe-process-error", { error: error.message });
    });
  }

  private setupIpcHandlers(): void {
    // Get current PoE process state
    ipcMain.handle(MainWindowEvent.IsPoeRunning, () => {
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
