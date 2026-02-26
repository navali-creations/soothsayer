import path, { join } from "node:path";

import { app, BrowserWindow, ipcMain, nativeImage, screen } from "electron";

import { CurrentSessionService } from "~/main/modules/current-session";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertBoolean,
  assertInteger,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import { OverlayChannel } from "./Overlay.channels";

interface OverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Overlay Service
 * Manages a transparent, always-on-top overlay window for in-game display
 */
class OverlayService {
  private overlayWindow: BrowserWindow | null = null;
  private settingsStore: SettingsStoreService;
  private currentSessionService: CurrentSessionService;
  private isVisible: boolean = false;
  private isLocked: boolean = true;
  private debouncedSaveBoundsTimer: ReturnType<typeof setTimeout> | null = null;
  private boundsMoveListener: (() => void) | null = null;
  private boundsResizeListener: (() => void) | null = null;

  private static _instance: OverlayService;

  static getInstance(): OverlayService {
    if (!OverlayService._instance) {
      OverlayService._instance = new OverlayService();
    }
    return OverlayService._instance;
  }

  constructor() {
    this.settingsStore = SettingsStoreService.getInstance();
    this.currentSessionService = CurrentSessionService.getInstance();
    this.setupHandlers();
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
   * Create the overlay window
   */
  public async createOverlay(): Promise<void> {
    if (this.overlayWindow) {
      return;
    }

    const preload = join(__dirname, "preload.js");

    const savedBounds = await this.settingsStore.get(SettingsKey.OverlayBounds);
    let x: number;
    let y: number;
    let overlayWidth: number;
    let overlayHeight: number;

    if (savedBounds) {
      // Use saved position
      x = savedBounds.x;
      y = savedBounds.y;
      overlayWidth = savedBounds.width || 250;
      overlayHeight = savedBounds.height || 145;
    } else {
      // Default to top-left of primary display work area with a small margin
      const primaryDisplay = screen.getPrimaryDisplay();
      const { x: screenX, y: screenY } = primaryDisplay.workArea;

      overlayWidth = 250;
      overlayHeight = 175;

      x = screenX + 20;
      y = screenY + 20;
    }

    this.overlayWindow = new BrowserWindow({
      width: overlayWidth,
      height: overlayHeight,
      x,
      y,
      icon: this.getAppIcon(),
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      // Don't set alwaysOnTop in constructor - set it after creation to avoid Windows rendering bug
      alwaysOnTop: false,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
      show: false,
      webPreferences: {
        preload,
        nodeIntegration: false,
        sandbox: true,
        contextIsolation: true,
        webSecurity: true,
      },
    });

    // Disable window animations (Windows specific)
    if (process.platform === "win32") {
      this.overlayWindow.setSkipTaskbar(true);
    }

    this.overlayWindow.setBackgroundColor("rgba(0,0,0,0)");

    // Set alwaysOnTop AFTER window creation with "screen-saver" level for game overlay support
    // This avoids the Windows bug where transparent + alwaysOnTop in constructor causes invisible windows
    this.overlayWindow.setAlwaysOnTop(true, "screen-saver");

    // Add ready-to-show handler BEFORE loading to prevent race condition
    this.overlayWindow.once("ready-to-show", () => {
      if (this.isVisible && this.overlayWindow) {
        // Small delay to ensure GPU/compositor is ready (fixes first-launch visibility issues)
        setTimeout(() => {
          if (!this.overlayWindow) return;
          // On Windows, showInactive() on transparent windows can fail on first startup
          // Use show() then immediately blur to avoid stealing focus
          this.overlayWindow.show();
          this.overlayWindow.blur();
          // Force a repaint by toggling opacity
          this.overlayWindow.setOpacity(0.99);
          setTimeout(() => {
            this.overlayWindow?.setOpacity(1);
          }, 100);
        }, 50);
      }
    });

    this.overlayWindow.on("closed", () => {
      this.removeBoundsListeners();
      this.isLocked = true;
      this.overlayWindow = null;
      this.isVisible = false;
      // Notify main window that overlay is now hidden
      this.notifyVisibilityChanged(false);
    });

    // Load overlay HTML
    // Security: Restrict navigation in overlay window
    this.overlayWindow.webContents.on("will-navigate", (event, url) => {
      // Overlay should never navigate anywhere
      console.warn(`[Security] Blocked overlay navigation to: ${url}`);
      event.preventDefault();
    });

    // Security: Prevent new windows from overlay
    this.overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
      console.warn(`[Security] Blocked overlay window.open for: ${url}`);
      return { action: "deny" };
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const overlayUrl = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/overlay.html`;
      await this.overlayWindow.loadURL(overlayUrl);
      if (!app.isPackaged) {
        this.overlayWindow.webContents.openDevTools({ mode: "detach" });
      }
    } else {
      // In production, overlay.html is built alongside index.html
      const overlayHtml = join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/overlay.html`,
      );
      await this.overlayWindow.loadFile(overlayHtml);
    }
  }

  /**
   * Resolve the user's price source setting for the given game.
   */
  private async getPriceSourceForGame(
    activeGame: string,
  ): Promise<"exchange" | "stash"> {
    const key =
      activeGame === "poe1"
        ? SettingsKey.Poe1PriceSource
        : SettingsKey.Poe2PriceSource;
    const value = await this.settingsStore.get(key);
    return value === "exchange" || value === "stash" ? value : "exchange";
  }

  /**
   * Get current session data formatted for overlay
   */
  private async getSessionData() {
    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);
    const isActive = this.currentSessionService.isSessionActive(activeGame);
    const priceSource = await this.getPriceSourceForGame(activeGame);

    if (!isActive) {
      return {
        isActive: false,
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource,
        cards: [],
        recentDrops: [],
      };
    }

    const session =
      await this.currentSessionService.getCurrentSession(activeGame);

    if (!session) {
      return {
        isActive: false,
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource,
        cards: [],
        recentDrops: [],
      };
    }

    const totals = session.totals?.[priceSource];

    return {
      isActive: true,
      totalCount: session.totalCount || 0,
      totalProfit: totals?.totalValue || 0,
      chaosToDivineRatio: totals?.chaosToDivineRatio || 0,
      priceSource,
      cards: session.cards
        ? session.cards.map((card: { name: string; count: number }) => ({
            cardName: card.name,
            count: card.count,
          }))
        : [],
      recentDrops: (session.recentDrops || []).map(
        (drop: {
          cardName: string;
          rarity?: number;
          exchangePrice: { chaosValue: number; divineValue: number };
          stashPrice: { chaosValue: number; divineValue: number };
        }) => ({
          ...drop,
          rarity: drop.rarity ?? 4,
        }),
      ),
    };
  }

  /**
   * Setup IPC handlers for overlay control
   */
  private setupHandlers(): void {
    ipcMain.handle(OverlayChannel.Show, async () => {
      return this.show();
    });

    ipcMain.handle(OverlayChannel.Hide, async () => {
      return this.hide();
    });

    ipcMain.handle(OverlayChannel.Toggle, async () => {
      return this.toggle();
    });

    ipcMain.handle(OverlayChannel.IsVisible, async () => {
      return this.isVisible;
    });

    ipcMain.handle(
      OverlayChannel.SetPosition,
      async (_event, x: number, y: number) => {
        try {
          assertInteger(x, "x", OverlayChannel.SetPosition, {
            min: -100_000,
            max: 100_000,
          });
          assertInteger(y, "y", OverlayChannel.SetPosition, {
            min: -100_000,
            max: 100_000,
          });
          return this.setPosition(x, y);
        } catch (error) {
          return handleValidationError(error, OverlayChannel.SetPosition);
        }
      },
    );

    ipcMain.handle(
      OverlayChannel.SetSize,
      async (_event, width: number, height: number) => {
        try {
          assertInteger(width, "width", OverlayChannel.SetSize, {
            min: 1,
            max: 100_000,
          });
          assertInteger(height, "height", OverlayChannel.SetSize, {
            min: 1,
            max: 100_000,
          });
          return this.setSize(width, height);
        } catch (error) {
          return handleValidationError(error, OverlayChannel.SetSize);
        }
      },
    );

    ipcMain.handle(OverlayChannel.GetBounds, async () => {
      return this.getBounds();
    });

    ipcMain.handle(
      OverlayChannel.SetLocked,
      async (_event, locked: unknown) => {
        try {
          assertBoolean(locked, "locked", OverlayChannel.SetLocked);
          return this.setLocked(locked);
        } catch (error) {
          return handleValidationError(error, OverlayChannel.SetLocked);
        }
      },
    );

    ipcMain.handle("overlay:get-session-data", async () => {
      return this.getSessionData();
    });
  }

  /**
   * Lock or unlock the overlay window.
   *
   * Both states keep alwaysOnTop at "screen-saver" level so the overlay
   * never drops behind fullscreen games or other apps. The original overlay
   * always used screen-saver and never had z-order issues — changing to
   * "floating" on unlock was what caused the overlay to disappear behind games.
   *
   * Lock: non-focusable, non-resizable.
   * Unlock: focusable, resizable, bounds listeners attached.
   */
  public setLocked(locked: boolean): void {
    if (!this.overlayWindow) {
      console.warn("[Overlay] Cannot set locked state - window not created");
      return;
    }

    this.isLocked = locked;

    if (locked) {
      // Save final position before locking
      this.saveBoundsImmediate();
      this.removeBoundsListeners();

      this.overlayWindow.setFocusable(false);
      this.overlayWindow.setResizable(false);
    } else {
      this.overlayWindow.setFocusable(true);
      this.overlayWindow.setResizable(true);
      this.attachBoundsListeners();
    }
  }

  /**
   * Attach debounced move/resize listeners to persist overlay bounds on change.
   */
  private attachBoundsListeners(): void {
    if (!this.overlayWindow) return;

    // Remove any existing listeners first to avoid duplicates
    this.removeBoundsListeners();

    const debouncedSave = () => {
      if (this.debouncedSaveBoundsTimer) {
        clearTimeout(this.debouncedSaveBoundsTimer);
      }
      this.debouncedSaveBoundsTimer = setTimeout(() => {
        this.saveBoundsImmediate();
      }, 500);
    };

    this.boundsMoveListener = debouncedSave;
    this.boundsResizeListener = debouncedSave;

    this.overlayWindow.on("moved", this.boundsMoveListener);
    this.overlayWindow.on("resized", this.boundsResizeListener);
  }

  /**
   * Remove move/resize listeners and clear any pending debounced save.
   */
  private removeBoundsListeners(): void {
    if (this.debouncedSaveBoundsTimer) {
      clearTimeout(this.debouncedSaveBoundsTimer);
      this.debouncedSaveBoundsTimer = null;
    }

    if (this.overlayWindow) {
      if (this.boundsMoveListener) {
        this.overlayWindow.removeListener("moved", this.boundsMoveListener);
      }
      if (this.boundsResizeListener) {
        this.overlayWindow.removeListener("resized", this.boundsResizeListener);
      }
    }

    this.boundsMoveListener = null;
    this.boundsResizeListener = null;
  }

  /**
   * Immediately persist the current overlay bounds to settings.
   */
  private saveBoundsImmediate(): void {
    if (!this.overlayWindow) return;

    const bounds = this.overlayWindow.getBounds();
    this.settingsStore
      .set(SettingsKey.OverlayBounds, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      })
      .catch((err: unknown) => {
        console.error("[Overlay] Failed to save bounds:", err);
      });
  }

  public async show(): Promise<void> {
    this.isVisible = true;
    this.isLocked = true;

    if (!this.overlayWindow) {
      await this.createOverlay();
    }

    // After createOverlay completes, if ready-to-show already fired and missed isVisible=true,
    // we need to explicitly show it
    if (this.overlayWindow && !this.overlayWindow.isVisible()) {
      this.overlayWindow.setAlwaysOnTop(true, "screen-saver");
      this.overlayWindow.show();
      this.overlayWindow.blur();
      this.overlayWindow.setOpacity(0.99);
      setTimeout(() => {
        this.overlayWindow?.setOpacity(1);
      }, 100);
    } else if (this.overlayWindow) {
      this.overlayWindow.setAlwaysOnTop(true, "screen-saver");
      this.overlayWindow.show();
      this.overlayWindow.blur();
    }

    this.notifyVisibilityChanged(true);
  }

  public async hide(): Promise<void> {
    if (this.overlayWindow) {
      // If unlocked, auto-lock first to save bounds and clean up listeners
      if (!this.isLocked) {
        this.setLocked(true);
      }
      this.overlayWindow.hide();
      this.isVisible = false;
      this.notifyVisibilityChanged(false);
    }
  }

  public async toggle(): Promise<void> {
    if (this.isVisible) {
      this.hide();
    } else {
      await this.show();
    }
  }

  public setPosition(x: number, y: number): void {
    if (!this.overlayWindow) {
      console.warn("[Overlay] Cannot set position - window not created");
      return;
    }
    this.overlayWindow.setPosition(x, y);
  }

  public setSize(width: number, height: number): void {
    if (!this.overlayWindow) {
      console.warn("[Overlay] Cannot set size - window not created");
      return;
    }
    this.overlayWindow.setSize(width, height);
  }

  public getBounds(): OverlayBounds | null {
    if (!this.overlayWindow) {
      return null;
    }
    const bounds = this.overlayWindow.getBounds();
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }

  public destroy(): void {
    if (this.overlayWindow) {
      this.removeBoundsListeners();
      this.overlayWindow.close();
      this.overlayWindow = null;
      this.isVisible = false;
      this.isLocked = true;
    }
  }

  public getWindow(): BrowserWindow | null {
    return this.overlayWindow;
  }

  /**
   * Notify main window of visibility changes
   */
  private notifyVisibilityChanged(isVisible: boolean): void {
    const allWindows = BrowserWindow.getAllWindows();

    const mainWindow = allWindows.find(
      (win) =>
        !win.isDestroyed() &&
        !win.webContents.getURL().includes("overlay.html"),
    );

    if (mainWindow) {
      mainWindow.webContents.send(OverlayChannel.VisibilityChanged, isVisible);
    }
  }
}

export { OverlayService };
export type { OverlayBounds };
