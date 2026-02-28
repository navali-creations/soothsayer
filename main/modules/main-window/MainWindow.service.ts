import path, { join } from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  shell,
} from "electron";

import {
  AnalyticsService,
  AppService,
  ClientLogReaderService,
  CsvService,
  CurrentSessionService,
  DatabaseService,
  DivinationCardsService,
  MainWindowChannel,
  OverlayService,
  PoeLeaguesService,
  PoeProcessService,
  ProhibitedLibraryService,
  SessionsService,
  SettingsKey,
  SettingsStoreService,
  SnapshotService,
  SupabaseClientService,
  TrayService,
  UpdaterService,
} from "~/main/modules";
import { validateFileDialogOptions } from "~/main/utils/ipc-validation";

class MainWindowService {
  private mainWindow: BrowserWindow;
  private url: string = MAIN_WINDOW_VITE_DEV_SERVER_URL;
  private settingsStore: SettingsStoreService | null = null;
  private database: DatabaseService | null = null;
  private debouncedSaveBoundsTimer: ReturnType<typeof setTimeout> | null = null;
  private boundsMovedHandler: (() => void) | null = null;
  private boundsResizedHandler: (() => void) | null = null;

  private static _instance: MainWindowService;

  static getInstance() {
    if (!MainWindowService._instance) {
      MainWindowService._instance = new MainWindowService();
    }

    return MainWindowService._instance;
  }

  private getAppIcon(): Electron.NativeImage {
    const isDev = !app.isPackaged;
    const basePath = isDev
      ? path.join(app.getAppPath(), "renderer/assets/logo")
      : path.join(process.resourcesPath, "logo");

    const iconPath =
      process.platform === "win32"
        ? path.join(basePath, "windows/icon.ico")
        : process.platform === "darwin"
          ? path.join(basePath, "macos/512x512.png")
          : path.join(basePath, "linux/icons/512x512.png");

    return nativeImage.createFromPath(iconPath);
  }

  /**
   * TODO: Replace manual bounds persistence (validateBoundsOnScreen, saveBoundsImmediate,
   * attachBoundsListeners, removeBoundsListeners, and the restore logic in createMainWindow)
   * with Electron's built-in `windowStatePersistence` API once it ships in a stable release.
   * Just pass `name: 'soothsayer-main'` and `windowStatePersistence: true` to the
   * BrowserWindow constructor. See: https://github.com/electron/rfcs/pull/16
   */

  /**
   * Validate that at least 100px of the window overlaps with some display's workArea.
   * Returns the bounds if valid, null if off-screen (e.g. disconnected monitor).
   */
  private validateBoundsOnScreen(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): { x: number; y: number; width: number; height: number } | null {
    const MIN_OVERLAP = 100;
    const displays = screen.getAllDisplays();

    for (const display of displays) {
      const { x: wx, y: wy, width: ww, height: wh } = bounds;
      const { x: dx, y: dy, width: dw, height: dh } = display.workArea;

      const overlapX = Math.max(
        0,
        Math.min(wx + ww, dx + dw) - Math.max(wx, dx),
      );
      const overlapY = Math.max(
        0,
        Math.min(wy + wh, dy + dh) - Math.max(wy, dy),
      );

      if (overlapX >= MIN_OVERLAP || overlapY >= MIN_OVERLAP) {
        return bounds;
      }
    }

    return null;
  }

  /**
   * Immediately save the current window bounds to settings.
   * Skips saving when the window is maximized to avoid storing maximized dimensions.
   */
  private saveBoundsImmediate(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isMaximized()) return;

    const bounds = this.mainWindow.getBounds();
    this.settingsStore
      ?.set(SettingsKey.MainWindowBounds, bounds)
      .catch((err) => {
        console.warn("[MainWindow] Failed to save bounds:", err);
      });
  }

  /**
   * Attach move/resize listeners that debounce-save the window bounds.
   */
  private attachBoundsListeners(): void {
    const debouncedSave = () => {
      if (this.debouncedSaveBoundsTimer) {
        clearTimeout(this.debouncedSaveBoundsTimer);
      }
      this.debouncedSaveBoundsTimer = setTimeout(() => {
        this.saveBoundsImmediate();
        this.debouncedSaveBoundsTimer = null;
      }, 500);
    };

    this.boundsMovedHandler = debouncedSave;
    this.boundsResizedHandler = debouncedSave;

    this.mainWindow.on("moved", this.boundsMovedHandler);
    this.mainWindow.on("resized", this.boundsResizedHandler);
  }

  /**
   * Remove bounds listeners and clear any pending debounce timer.
   */
  private removeBoundsListeners(): void {
    if (this.debouncedSaveBoundsTimer) {
      clearTimeout(this.debouncedSaveBoundsTimer);
      this.debouncedSaveBoundsTimer = null;
    }
    if (this.boundsMovedHandler) {
      this.mainWindow?.removeListener("moved", this.boundsMovedHandler);
      this.boundsMovedHandler = null;
    }
    if (this.boundsResizedHandler) {
      this.mainWindow?.removeListener("resized", this.boundsResizedHandler);
      this.boundsResizedHandler = null;
    }
  }

  public async createMainWindow() {
    const indexHtml = join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
    );
    const preload = join(__dirname, "preload.js");

    // 1. Settings (no dependencies) — initialize early so we can load saved bounds
    this.settingsStore = SettingsStoreService.getInstance();
    console.log("[Init] ✓ Settings");

    // Load saved main window bounds
    const savedBounds = await this.settingsStore.get(
      SettingsKey.MainWindowBounds,
    );
    const validBounds = savedBounds
      ? this.validateBoundsOnScreen(savedBounds)
      : null;

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      title: "Soothsayer",
      icon: this.getAppIcon(),
      width: validBounds?.width ?? 1200,
      height: validBounds?.height ?? 800,
      minWidth: 1200,
      backgroundColor: "transparent",
      show: false, // This line prevents electron's default #1E1E1E bg load before html renders and html blank screen (white flash)
      webPreferences: {
        preload,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        contextIsolation: true,
      },
      frame: false,
    };

    if (validBounds) {
      windowOptions.x = validBounds.x;
      windowOptions.y = validBounds.y;
    }

    this.mainWindow = new BrowserWindow(windowOptions);

    // Initialize services in correct order
    console.log("[Init] Initializing services...");

    // 2. Database (core dependency)
    this.database = DatabaseService.getInstance();
    console.log("[Init] ✓ Database");
    console.log(`[Init] Database location: ${this.database.getPath()}`);

    // 3. Supabase (external API - replaces direct poe.ninja calls)
    // Note: Supabase is already configured in main.ts before window creation
    const supabase = SupabaseClientService.getInstance();
    if (supabase.isConfigured()) {
      console.log("[Init] ✓ Supabase (configured)");
    } else {
      console.warn(
        "[Init] ⚠ Supabase (not configured - will use local fallback only)",
      );
    }

    // 4. POE Leagues (still needed for league selection UI)
    PoeLeaguesService.getInstance();
    console.log("[Init] ✓ POE Leagues");

    // 5. Divination Cards (static data + rarity updates, depends on database + snapshot data)
    const divinationCards = DivinationCardsService.getInstance();
    await divinationCards.initialize();
    console.log("[Init] ✓ Divination Cards");

    // 5b. Prohibited Library — no eager loading.
    // PL data is loaded lazily on first access (e.g. Profit Forecast page,
    // Rarity Model page, or Settings → Reload). This avoids parsing the
    // bundled CSV and writing to SQLite on every app startup.
    ProhibitedLibraryService.getInstance();
    console.log("[Init] ✓ Prohibited Library (lazy)");

    // 6. Snapshot service (depends on database + Supabase)
    SnapshotService.getInstance();
    console.log("[Init] ✓ Snapshots");

    // 7. Session management (depends on database + snapshots + dataStore)
    const currentSessionService = CurrentSessionService.getInstance();
    await currentSessionService.initialize();
    SessionsService.getInstance();
    console.log("[Init] ✓ Sessions");

    // 8. Analytics (depends on database)
    AnalyticsService.getInstance();
    console.log("[Init] ✓ Analytics");

    // 9. CSV (utility)
    CsvService.getInstance();
    console.log("[Init] ✓ CSV");

    // 10. Overlay (UI overlay window)
    OverlayService.getInstance();
    console.log("[Init] ✓ Overlay");

    // 11. Client Log Reader (watches client.txt for divination cards)
    await ClientLogReaderService.getInstance(this);
    console.log("[Init] ✓ Client Log Reader");

    console.log("[Init] All services initialized successfully");

    this.showAppOnceReadyToShow();

    if (this.url) {
      await this.mainWindow.loadURL?.(this.url);
      if (!app.isPackaged) {
        this.mainWindow.webContents?.openDevTools();
      }
    } else {
      await this.mainWindow.loadFile?.(indexHtml);
    }

    // Security: Restrict navigation to prevent the renderer from loading external URLs
    this.mainWindow.webContents.on("will-navigate", (event, url) => {
      const allowedOrigins = this.url
        ? [new URL(this.url).origin]
        : ["file://"];

      const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));

      if (!isAllowed) {
        console.warn(`[Security] Blocked navigation to untrusted URL: ${url}`);
        event.preventDefault();
      }
    });

    // Security: Only allow opening URLs from a strict allowlist in the OS browser
    const allowedExternalUrls = [
      "https://www.pathofexile.com/oauth/authorize",
      "https://github.com/navali-creations",
      "https://github.com/orgs/navali-creations",
    ];

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (allowedExternalUrls.some((allowed) => url.startsWith(allowed))) {
        shell.openExternal(url);
      } else {
        console.warn(
          `[Security] Blocked window.open for non-allowlisted URL: ${url}`,
        );
      }
      return { action: "deny" };
    });

    // Initialize PoE Process monitoring
    PoeProcessService.getInstance().initialize(this);

    // Attach bounds persistence listeners
    this.attachBoundsListeners();

    // Caption events
    this.emitCaptionEvents();
    this.emitFileDialogEvents();
    this.emitOnMainWindowClose();

    TrayService.getInstance().createTray();

    // Initialize update checker (checks GitHub releases for new versions)
    UpdaterService.getInstance().initialize(this.mainWindow);
    console.log("[Init] ✓ Updater");

    const clientLogReader = await ClientLogReaderService.getInstance(this);
    clientLogReader
      .on("clientlog-start", (_data) => {})
      .on("clientlog-stop", (_data) => {});

    console.log("[Init] Main window created and ready");
  }

  private emitFileDialogEvents() {
    // Handler for file selection — validates and allowlists options from renderer
    ipcMain.handle(
      "select-file",
      async (_event, options: Electron.OpenDialogOptions) => {
        const validated = validateFileDialogOptions(options, "select-file");

        const result = await dialog.showOpenDialog(this.mainWindow, {
          title: validated.title,
          filters: validated.filters,
          properties: validated.properties,
        });

        // Return the first selected file path, or undefined if cancelled
        return result.canceled ? undefined : result.filePaths[0];
      },
    );
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
      // Save window bounds before closing/hiding
      this.saveBoundsImmediate();

      const exitAction = await this.settingsStore?.get(
        SettingsKey.AppExitAction,
      );
      const shouldAppQuitBasedOnUserPreference = exitAction === "exit";
      const shouldAppHideBasedOnUserPreference = exitAction === "minimize";

      const byDefaultQuitApp =
        !shouldAppHideBasedOnUserPreference &&
        !shouldAppQuitBasedOnUserPreference;

      if (shouldAppQuitBasedOnUserPreference || byDefaultQuitApp) {
        this.removeBoundsListeners();
        OverlayService.getInstance().destroy();
        AppService.getInstance().isQuitting = true;
        this.mainWindow?.close?.();
      }

      if (shouldAppHideBasedOnUserPreference) {
        this.mainWindow?.hide?.();
      }
    });
  }

  private emitOnMainWindowClose() {
    this.mainWindow?.on?.("close", async (e) => {
      if (AppService.getInstance().isQuitting) return;
      e.preventDefault();

      // Save window bounds before closing/hiding
      this.saveBoundsImmediate();

      const exitAction = await this.settingsStore?.get(
        SettingsKey.AppExitAction,
      );
      const shouldAppQuitBasedOnUserPreference = exitAction === "exit";
      const shouldAppHideBasedOnUserPreference = exitAction === "minimize";

      const byDefaultQuitApp =
        !shouldAppHideBasedOnUserPreference &&
        !shouldAppQuitBasedOnUserPreference;

      if (shouldAppQuitBasedOnUserPreference || byDefaultQuitApp) {
        this.removeBoundsListeners();
        OverlayService.getInstance().destroy();
        AppService.getInstance().isQuitting = true;
        this.mainWindow?.close?.();
      }

      if (shouldAppHideBasedOnUserPreference) {
        this.mainWindow?.hide?.();
      }
    });
  }

  /**
   * Prevents white screen that is shown during app initialization
   */
  public showAppOnceReadyToShow() {
    if (!((this.mainWindow as BrowserWindow) instanceof BrowserWindow)) return;

    this.mainWindow?.once?.(MainWindowChannel.ReadyToShow, async () => {
      const openAtLogin = await this.settingsStore?.get(
        SettingsKey.AppOpenAtLogin,
      );
      const openAtLoginMinimized = await this.settingsStore?.get(
        SettingsKey.AppOpenAtLoginMinimized,
      );

      if (openAtLogin && openAtLoginMinimized) {
        return; // keep window hidden due to user preference
      }

      this.mainWindow?.show?.();
    });
  }

  /**
   * Show the main window. If it was minimized, restore it first.
   */
  public show(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }

    this.mainWindow.show();
    this.mainWindow.focus();
  }

  /**
   * Get the BrowserWindow instance
   */
  public getWindow(): BrowserWindow | null {
    return this.mainWindow || null;
  }

  /**
   * Check if the main window is destroyed
   */
  public isDestroyed(): boolean {
    return !this.mainWindow || this.mainWindow.isDestroyed();
  }

  /**
   * Get webContents safely
   */
  public getWebContents() {
    return this.mainWindow?.webContents;
  }
}

type MainWindowServiceType = MainWindowService & Partial<BrowserWindow>;

export { MainWindowService };
export type { MainWindowServiceType };
