import { Menu, shell, Tray } from "electron";

import {
  AppService,
  MainWindowService,
  type MainWindowServiceType,
} from "~/electron/modules";

class TrayService {
  private tray: Tray | null = null;
  private readonly mainWindow: MainWindowServiceType;
  private readonly app: AppService;
  // private trayIconPath: string = path.join(__dirname, "../../icon512x512.png");
  // private macosTrayIconPath: string = path.join(
  // __dirname,
  // "../../tray_mac.png",
  // );
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

  private setIcon() {
    // if (process.platform === System.MacOS) {
    //   this.tray = new Tray(this.macosTrayIconPath);
    // }
    // if (process.platform !== System.MacOS) {
    //   this.tray = new Tray(this.trayIconPath);
    // }
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
    this.setIcon();
    this.tray?.setToolTip("Soothsayer");
    this.tray?.on("click", () => this.mainWindow.show?.());
    this.tray?.setIgnoreDoubleClickEvents(true);
    this.createContextMenu();
  }
}

export { TrayService };
