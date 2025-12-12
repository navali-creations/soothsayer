import { resolve } from "node:path";
import { type App, app, ipcMain } from "electron";
import { System } from "../../../enums";
import {
  CurrentSessionService,
  DatabaseService,
  type MainWindowServiceType,
  PoeProcessService,
  SettingsKey,
  SettingsStoreService,
  SnapshotService,
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
  private snapshotService: SnapshotService = SnapshotService.getInstance();
  private database: DatabaseService = DatabaseService.getInstance();
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
    this.app.on(AppChannel.BeforeQuit, async () => {
      console.log("[Shutdown] Starting cleanup...");

      // Stop all snapshot auto-refresh timers
      console.log("[Shutdown] Stopping snapshot auto-refresh...");
      this.snapshotService.stopAllAutoRefresh();

      // Stop active sessions (this will flush processed IDs)
      if (this.sessionStorage.isSessionActive("poe1")) {
        console.log("[Shutdown] Stopping POE1 session...");
        this.sessionStorage.stopSession("poe1");
      }
      if (this.sessionStorage.isSessionActive("poe2")) {
        console.log("[Shutdown] Stopping POE2 session...");
        this.sessionStorage.stopSession("poe2");
      }

      // Stop POE process monitoring
      console.log("[Shutdown] Stopping POE process monitoring...");
      PoeProcessService.getInstance().stop();

      // Optimize database before closing
      console.log("[Shutdown] Optimizing database...");
      try {
        this.database.optimize();
        console.log("[Shutdown] Database optimized");
      } catch (error) {
        console.error("[Shutdown] Database optimization failed:", error);
      }

      // Close database connection
      console.log("[Shutdown] Closing database...");
      this.database.close();

      // Destroy tray
      console.log("[Shutdown] Destroying tray...");
      TrayService.getInstance().destroyTray();

      this.isQuitting = true;
      console.log("[Shutdown] Cleanup complete, quitting now...");
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
