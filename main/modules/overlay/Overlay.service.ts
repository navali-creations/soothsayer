import path, { join } from "node:path";

import { app, BrowserWindow, ipcMain, nativeImage, screen } from "electron";

import { CurrentSessionService } from "~/main/modules/current-session";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";

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
      // Detect the monitor where the cursor is (likely the game monitor)
      const primaryDisplay = screen.getPrimaryDisplay();

      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workAreaSize;
      const { x: screenX, y: screenY } = primaryDisplay.workArea;

      // Custom overlay dimensions
      overlayWidth = 250;
      overlayHeight = 175;

      // Position: centered horizontally, 300px from bottom
      x = screenX + screenWidth - overlayWidth;
      y = screenY + screenHeight - overlayHeight - 632;
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
      this.overlayWindow = null;
      this.isVisible = false;
      // Notify main window that overlay is now hidden
      this.notifyVisibilityChanged(false);
    });

    // Load overlay HTML
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const overlayUrl = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/overlay.html`;
      await this.overlayWindow.loadURL(overlayUrl);
      this.overlayWindow.webContents.openDevTools({ mode: "detach" });
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
   * Get current session data formatted for overlay
   */
  private async getSessionData() {
    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);
    const isActive = this.currentSessionService.isSessionActive(activeGame);

    if (!isActive) {
      return {
        isActive: false,
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource: "exchange",
        cards: [],
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
        priceSource: "exchange",
        cards: [],
      };
    }

    const priceSource = "exchange";
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
        return this.setPosition(x, y);
      },
    );

    ipcMain.handle(
      OverlayChannel.SetSize,
      async (_event, width: number, height: number) => {
        return this.setSize(width, height);
      },
    );

    ipcMain.handle(OverlayChannel.GetBounds, async () => {
      return this.getBounds();
    });

    ipcMain.handle("overlay:get-session-data", async () => {
      return this.getSessionData();
    });
  }

  public async show(): Promise<void> {
    this.isVisible = true;

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
      this.overlayWindow.close();
      this.overlayWindow = null;
      this.isVisible = false;
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
