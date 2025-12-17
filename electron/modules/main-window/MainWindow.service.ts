import { join } from "node:path";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { updateElectronApp } from "update-electron-app";

import {
  AppChannel,
  ClientLogReaderService,
  CsvService,
  CurrentSessionService,
  DatabaseService,
  DataStoreService,
  MainWindowChannel,
  PoeLeaguesService,
  PoeNinjaService,
  PoeProcessService,
  SettingsKey,
  SettingsStoreService,
  SnapshotService,
  AnalyticsService,
  SessionsService,
  TrayService,
  OverlayService,
  DivinationCardsService,
} from "../../modules";

class MainWindowService {
  private mainWindow: BrowserWindow;
  private url: string = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  private settingsStore: SettingsStoreService | null = null;
  private database: DatabaseService | null = null;

  private static _instance: MainWindowService;

  static getInstance() {
    if (!MainWindowService._instance) {
      MainWindowService._instance = new MainWindowService();
    }

    return MainWindowService._instance;
  }

  public async createMainWindow(isQuitting: boolean = false) {
    const indexHtml = join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
    );
    const preload = join(__dirname, "preload.js");

    this.mainWindow = new BrowserWindow({
      title: "Soothsayer",
      width: 1200,
      height: 800,
      minWidth: 1200,
      backgroundColor: "transparent",
      show: false, // This line prevents electron's default #1E1E1E bg load before html renders and html blank screen (white flash)
      webPreferences: {
        preload,
        nodeIntegration: true,
        webSecurity: true,
        contextIsolation: true,
      },
      frame: false,
    });

    // Initialize services in correct order
    console.log("[Init] Initializing services...");

    // 1. Settings (no dependencies)
    this.settingsStore = SettingsStoreService.getInstance();
    console.log("[Init] ✓ Settings");

    // 2. Database (core dependency)
    this.database = DatabaseService.getInstance();
    console.log("[Init] ✓ Database");
    console.log(`[Init] Database location: ${this.database.getPath()}`);

    // 3. POE.ninja (external API)
    PoeNinjaService.getInstance();
    PoeLeaguesService.getInstance();
    console.log("[Init] ✓ POE Services");

    // 4. Divination Cards (static data + rarity updates, depends on database + poe.ninja)
    const divinationCards = DivinationCardsService.getInstance();
    await divinationCards.initialize();
    console.log("[Init] ✓ Divination Cards");

    // 5. Snapshot service (depends on database + poe.ninja)
    SnapshotService.getInstance();
    console.log("[Init] ✓ Snapshots");

    // 6. Session management (depends on database + snapshots + dataStore)
    const currentSessionService = CurrentSessionService.getInstance();
    await currentSessionService.initialize();
    SessionsService.getInstance();
    console.log("[Init] ✓ Sessions");

    // 7. Analytics (depends on database)
    AnalyticsService.getInstance();
    console.log("[Init] ✓ Analytics");

    // 8. CSV (utility)
    CsvService.getInstance();
    console.log("[Init] ✓ CSV");

    // 9. Overlay (UI overlay window)
    OverlayService.getInstance();
    console.log("[Init] ✓ Overlay");

    console.log("[Init] All services initialized successfully");

    this.showAppOnceReadyToShow();

    if (this.url) {
      await this.mainWindow.loadURL?.(this.url);
      this.mainWindow.webContents?.openDevTools();
    } else {
      await this.mainWindow.loadFile?.(indexHtml);
    }

    // Initialize PoE Process monitoring
    PoeProcessService.getInstance().initialize(
      this.mainWindow as MainWindowServiceType,
    );

    // Caption events
    this.emitCaptionEvents();
    this.emitFileDialogEvents();
    this.emitOnMainWindowClose(isQuitting);

    TrayService.getInstance().createTray();
    // updateElectronApp();

    ClientLogReaderService.getInstance(this.mainWindow)
      .on("clientlog-start", (data) => {})
      .on("clientlog-stop", (data) => {});

    console.log("[Init] Main window created and ready");
  }

  private emitFileDialogEvents() {
    // Handler for file selection
    ipcMain.handle("select-file", async (_event, options: any) => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        title: options.title || "Select File",
        filters: options.filters || [],
        properties: options.properties || ["openFile"],
      });

      // Return the first selected file path, or undefined if cancelled
      return result.canceled ? undefined : result.filePaths[0];
    });
  }

  private emitCaptionEvents() {
    ipcMain.handle(MainWindowChannel.Minimize, async () =>
      this.mainWindow?.minimize?.(),
    );

    ipcMain.handle(MainWindowChannel.Maximize, async () =>
      this.mainWindow?.maximize?.(),
    );

    ipcMain.handle(MainWindowChannel.Unmaximize, async () =>
      this.mainWindow?.unmaximize?.(),
    );

    ipcMain.handle(
      MainWindowChannel.IsMaximized,
      async () => this.mainWindow?.isMaximized?.() ?? false,
    );

    /**
     * When clicking X (close window) either:
     * a) minimize instead of quitting
     * b) quit instead of minimizing
     */
    ipcMain.handle(MainWindowChannel.Close, async () => {
      const shouldAppQuitBasedOnUserPreference =
        this.settingsStore?.get(SettingsKey.AppExitAction) === AppChannel.Quit;
      const shouldAppHideBasedOnUserPreference =
        this.settingsStore?.get(SettingsKey.AppExitAction) ===
        AppChannel.MinimizeToTray;

      const byDefaultQuitApp =
        !shouldAppHideBasedOnUserPreference &&
        !shouldAppQuitBasedOnUserPreference;

      if (shouldAppQuitBasedOnUserPreference || byDefaultQuitApp) {
        OverlayService.getInstance().destroy();
        this.mainWindow?.close?.();
      }

      if (shouldAppHideBasedOnUserPreference) {
        this.mainWindow?.hide?.();
      }
    });
  }

  private emitOnMainWindowClose(isQuitting: boolean) {
    this.mainWindow?.on?.(MainWindowChannel.OnClose, (e) => {
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

    this.mainWindow?.once?.(MainWindowChannel.ReadyToShow, () => {
      const openAtLogin = this.settingsStore?.store.get(
        SettingsKey.AppOpenAtLogin,
      );
      const openAtLoginMinimized = this.settingsStore?.store.get(
        SettingsKey.AppOpenAtLoginMinimized,
      );

      if (openAtLogin && openAtLoginMinimized) {
        return; // keep window hidden due to user preference
      }

      this.mainWindow?.show?.();
    });
  }
}

type MainWindowServiceType = MainWindowService & Partial<BrowserWindow>;

export { MainWindowService };
export type { MainWindowServiceType };
