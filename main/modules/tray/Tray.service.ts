import path from "node:path";

import { app, Menu, nativeImage, shell, Tray } from "electron";

import {
  AppService,
  MainWindowService,
  type MainWindowServiceType,
} from "~/main/modules";

class TrayService {
  private tray: Tray | null = null;
  private readonly mainWindow: MainWindowServiceType;
  private readonly app: AppService;
  private static _instance: TrayService;

  static getInstance() {
    if (!TrayService._instance) {
      TrayService._instance = new TrayService();
    }

    return TrayService._instance;
  }

  constructor() {
    this.mainWindow = MainWindowService.getInstance();
    this.app = AppService.getInstance();
  }

  private getIconPath(): string {
    // In development, app.getAppPath() points to the project root
    // In production, it points to the app.asar or resources folder
    const isDev = !app.isPackaged;
    const basePath = isDev
      ? path.join(app.getAppPath(), "renderer/assets/logo")
      : path.join(process.resourcesPath, "logo");

    switch (process.platform) {
      case "win32":
        return path.join(basePath, "windows/icon.ico");
      case "darwin":
        return path.join(basePath, "macos/16x16.png");
      default:
        return path.join(basePath, "linux/icons/32x32.png");
    }
  }

  private createIcon(): Tray {
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
      console.error("[Tray] Failed to load icon from:", iconPath);
    }

    if (process.platform === "darwin") {
      icon.setTemplateImage(true);
    }

    return new Tray(icon);
  }

  private createContextMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show Soothsayer",
        click: () => this.mainWindow.show?.(),
      },
      { type: "separator" },
      {
        label: "Discord / Help",
        type: "normal",
        click: async () => {
          await shell.openExternal("https://discord.gg/yxuBrPY");
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        type: "normal",
        click: () => {
          this.app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public destroyTray = () => this.tray instanceof Tray && this.tray.destroy();

  public createTray() {
    this.tray = this.createIcon();
    this.tray.setToolTip("soothsayer");
    this.tray.on("click", () => this.mainWindow.show?.());
    this.tray.setIgnoreDoubleClickEvents(true);
    this.createContextMenu();
  }
}

export { TrayService };
