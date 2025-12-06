import { resolve } from "node:path";
import { type App, app, ipcMain } from "electron";
import { System } from "../../../enums";
import {
  CurrentSessionService,
  type MainWindowServiceType,
  PoeProcessService,
  SettingsKey,
  SettingsStoreService,
  TrayService,
} from "../../modules";
import { AppChannel } from "./App.channels";

class AppService {
  public isQuitting: boolean = true;
  private app: App;
  private settingsStore: SettingsStoreService =
    SettingsStoreService.getInstance();
  private sessionStorage: CurrentSessionService =
    CurrentSessionService.getInstance();
  private static _instance: AppService;

  static getInstance() {
    if (!AppService._instance) {
      AppService._instance = new AppService();
    }

    return AppService._instance;
  }

  constructor() {
    this.app = app;
    this.setAppNameForWinNotifications();
    this.setAppProtocol();
    this.openAtLogin();
  }

  public setAppNameForWinNotifications(): void {
    if (process.platform !== System.Windows) return;
    this.app.setAppUserModelId(this.app.getName());
  }

  public setAppProtocol() {
    if (!this.app.isPackaged && process.platform !== System.MacOS) {
      this.app.setAsDefaultProtocolClient("smoothsayer", process.execPath, [
        resolve(process.argv[1]),
      ]);
    } else {
      this.app.setAsDefaultProtocolClient("smoothsayer");
    }
  }

  public emitRestart() {
    ipcMain.handle(AppChannel.Restart, (e) => {
      if (this.isQuitting) return;
      e.preventDefault();
      this.app.relaunch();
      this.app.exit(0);
    });
  }

  public quitOnAllWindowsClosed(windows: [MainWindowServiceType | null]) {
    this.app.on(AppChannel.WindowAllClosed, () => {
      windows?.map((window) => {
        window = null;
        return null;
      });
      if (process.platform !== System.MacOS) {
        this.quit();
      }
    });
  }

  public emitSecondInstance(mainWindow: MainWindowServiceType) {
    this.app.on(AppChannel.SecondInstance, () => {
      if (!mainWindow) {
        return;
      }

      // Focus on the main window if the user tried to open another
      if (mainWindow.isMinimized?.()) {
        mainWindow.restore?.();
        mainWindow.focus?.();
      } else {
        mainWindow.show?.();
      }
    });
  }

  /**
   * `beforeQuitCloseWindowsAndDestroyElements` method is used to perform any necessary cleanup tasks
   * before quitting the application, such as closing windows and destroying any elements
   * that need to be cleaned up.
   */
  public beforeQuitCloseWindowsAndDestroyElements() {
    this.app.on(AppChannel.BeforeQuit, () => {
      // Stop any active sessions before quitting

      if (this.sessionStorage.isSessionActive("poe1")) {
        this.sessionStorage.stopSession("poe1");
      }
      if (this.sessionStorage.isSessionActive("poe2")) {
        this.sessionStorage.stopSession("poe2");
      }

      PoeProcessService.getInstance().stop();
      TrayService.getInstance().destroyTray();
      this.isQuitting = true;
    });
  }

  /**
   * Emitted when attempting to re-launch the application when it's already running
   */
  public emitActivate(mainWindow: MainWindowServiceType) {
    if (!mainWindow) return;
    this.app.on(AppChannel.Activate, async () => {
      await mainWindow.createMainWindow();
    });
  }

  public quit() {
    this.app.quit();
    process.exit(0);
  }

  public openAtLogin() {
    const openAtLogin = this.settingsStore.store.get(
      SettingsKey.AppOpenAtLogin,
    );

    this.app.setLoginItemSettings({
      openAtLogin,
    });
  }
}

export { AppService };
