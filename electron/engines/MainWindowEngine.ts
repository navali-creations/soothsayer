import { join } from "node:path";
import { BrowserWindow, ipcMain } from "electron";
import { updateElectronApp } from "update-electron-app";
import { AppExitAction, LocalStorageKey, MainWindowEvent } from "../../enums";

import {
  ClientLogReaderEngine,
  CsvEngine,
  LocalStorageEngine,
  PoeLeaguesEngine,
  PoeNinjaEngine,
  PoeProcessEngine,
  SettingsEngine,
  TrayEngine,
  DataStoreEngine,
  SessionEngine,
} from ".";

class MainWindowEngine {
  private mainWindow: MainWindowEngineType | null = null;
  private url: string = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  private localStorage: LocalStorageEngine | null = null;
  private settings: SettingsEngine | null = null;
  private poeNinja: PoeNinjaEngine | null = null;
  private poeLeagues: PoeLeaguesEngine | null = null;
  private csv: CsvEngine | null = null;
  private dataStore: DataStoreEngine | null = null;
  private session: SessionEngine | null = null;

  private static _instance: MainWindowEngine;

  static getInstance() {
    if (!MainWindowEngine._instance) {
      MainWindowEngine._instance = new MainWindowEngine();
    }

    return MainWindowEngine._instance;
  }

  public async createMainWindow(isQuitting: boolean = false) {
    const indexHtml = join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
    );
    const preload = join(__dirname, "preload.js");

    this.mainWindow = new BrowserWindow({
      title: "Soothsayer",
      width: 800,
      height: 800,
      minWidth: 800,
      webPreferences: {
        preload,
        nodeIntegration: true,
        webSecurity: true,
        contextIsolation: true,
      },
      frame: false,
    }) as MainWindowEngineType;

    this.settings = SettingsEngine.getInstance();
    this.localStorage = LocalStorageEngine.getInstance();
    this.poeNinja = PoeNinjaEngine.getInstance();
    this.poeLeagues = PoeLeaguesEngine.getInstance();
    this.csv = CsvEngine.getInstance();
    this.dataStore = DataStoreEngine.getInstance();
    this.session = SessionEngine.getInstance();
    this.showAppOnceReadyToShow();

    if (this.url) {
      await this.mainWindow.loadURL?.(this.url);
      this.mainWindow.webContents?.openDevTools();
    } else {
      await this.mainWindow.loadFile?.(indexHtml);
    }

    // Initialize PoE Process monitoring
    PoeProcessEngine.getInstance().initialize(this.mainWindow);

    // Caption events
    this.emitCaptionEvents();
    this.emitOnMainWindowClose(isQuitting);

    TrayEngine.getInstance().createTray();

    this.settings.emitGeneralSettings();
    // updateElectronApp();

    ClientLogReaderEngine.getInstance(this.mainWindow)
      .on("clientlog-start", (data) => {})
      .on("clientlog-stop", (data) => {});
  }

  private emitCaptionEvents() {
    ipcMain.handle(MainWindowEvent.HandleWindowMinimize, async () =>
      this.mainWindow?.minimize?.(),
    );

    ipcMain.handle(MainWindowEvent.HandleWindowMaximize, async () =>
      this.mainWindow?.maximize?.(),
    );

    ipcMain.handle(MainWindowEvent.HandleWindowUnmaximize, async () =>
      this.mainWindow?.unmaximize?.(),
    );

    ipcMain.handle(
      MainWindowEvent.IsWindowMaximized,
      async () => this.mainWindow?.isMaximized?.() ?? false,
    );

    /**
     * When clicking X (close window) either:
     * a) minimize instead of quitting
     * b) quit instead of minimizing
     */
    ipcMain.handle(MainWindowEvent.HandleWindowClose, async () => {
      const shouldAppQuitBasedOnUserPreference =
        this.localStorage?.get(LocalStorageKey.AppExitAction) ===
        AppExitAction.Quit;
      const shouldAppHideBasedOnUserPreference =
        this.localStorage?.get(LocalStorageKey.AppExitAction) ===
        AppExitAction.MinimizeToTray;
      const byDefaultQuitApp =
        !shouldAppHideBasedOnUserPreference &&
        !shouldAppQuitBasedOnUserPreference;

      if (shouldAppQuitBasedOnUserPreference || byDefaultQuitApp) {
        this.mainWindow?.close?.();
      }

      if (shouldAppHideBasedOnUserPreference) {
        this.mainWindow?.hide?.();
      }
    });
  }

  private emitOnMainWindowClose(isQuitting: boolean) {
    this.mainWindow?.on?.(MainWindowEvent.OnClose, (e) => {
      if (isQuitting) return;
      e.preventDefault();
      this.mainWindow?.hide?.();
    });
  }

  /**
   * Prevents white screen that is shown during app initialization
   */
  public showAppOnceReadyToShow() {
    if (!((this.mainWindow as BrowserWindow) instanceof BrowserWindow)) return;

    this.mainWindow?.once?.(MainWindowEvent.ReadyToShow, () => {
      const openAtLogin = this.localStorage?.store.get(
        LocalStorageKey.AppOpenAtLogin,
      );
      const openAtLoginMinimized = this.localStorage?.store.get(
        LocalStorageKey.AppOpenAtLoginMinimized,
      );

      if (openAtLogin && openAtLoginMinimized) {
        return; // keep window hidden due to user preference
      }

      this.mainWindow?.show?.();
    });
  }
}

type MainWindowEngineType = MainWindowEngine & Partial<BrowserWindow>;

export { MainWindowEngine };
export type { MainWindowEngineType };
