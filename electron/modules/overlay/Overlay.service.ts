import { join } from "node:path";
import { BrowserWindow, ipcMain, screen } from "electron";
import { OverlayChannel } from "./Overlay.channels";
import { SettingsKey, SettingsStoreService } from "../settings-store";
import { CurrentSessionService } from "../current-session";

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

  /**
   * Create the overlay window
   */
  public async createOverlay(): Promise<void> {
    if (this.overlayWindow) {
      return;
    }

    const preload = join(__dirname, "preload.js");

    const savedBounds = this.settingsStore.get("overlayBounds" as any);
    let x: number;
    let y: number;
    let overlayWidth: number;
    let overlayHeight: number;

    if (savedBounds) {
      // Use saved position
      x = savedBounds.x;
      y = savedBounds.y;
      overlayWidth = savedBounds.width || 400;
      overlayHeight = savedBounds.height || 100;
    } else {
      // Detect the monitor where the cursor is (likely the game monitor)
      const primaryDisplay = screen.getPrimaryDisplay();

      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workAreaSize;
      const { x: screenX, y: screenY } = primaryDisplay.workArea;

      // Custom overlay dimensions
      overlayWidth = 250;
      overlayHeight = 145;

      // Position: centered horizontally, 300px from bottom
      x = screenX + screenWidth - overlayWidth;
      y = screenY + screenHeight - overlayHeight - 632;
    }

    this.overlayWindow = new BrowserWindow({
      width: overlayWidth,
      height: overlayHeight,
      x,
      y,
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      alwaysOnTop: true,
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

    // Add ready-to-show handler to prevent white flash
    this.overlayWindow.once("ready-to-show", () => {
      if (this.isVisible) {
        this.overlayWindow?.showInactive();
      }
    });

    this.overlayWindow.on("closed", () => {
      this.overlayWindow = null;
      this.isVisible = false;
    });
  }

  /**
   * Get current session data formatted for overlay
   */
  private async getSessionData() {
    const activeGame = this.settingsStore.get(SettingsKey.ActiveGame);
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
        ? session.cards.map((card: any) => ({
            cardName: card.name || card.cardName,
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

    ipcMain.handle(
      OverlayChannel.SetOpacity,
      async (_event, opacity: number) => {
        return this.setOpacity(opacity);
      },
    );

    ipcMain.handle("overlay:get-session-data", async () => {
      return this.getSessionData();
    });
  }

  public async show(): Promise<void> {
    if (!this.overlayWindow) {
      this.isVisible = true;
      await this.createOverlay();
    } else {
      this.overlayWindow?.showInactive();
      this.isVisible = true;
    }
  }

  public hide(): void {
    this.overlayWindow?.hide();
    this.isVisible = false;
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

  public setOpacity(opacity: number): void {
    if (!this.overlayWindow) {
      console.warn("[Overlay] Cannot set opacity - window not created");
      return;
    }
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.overlayWindow.setOpacity(clampedOpacity);
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
}

export { OverlayService };
export type { OverlayBounds };
