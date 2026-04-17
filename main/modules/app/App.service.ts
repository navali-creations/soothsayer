import { resolve } from "node:path";

import { type App, app, ipcMain } from "electron";

import {
  CurrentSessionService,
  DatabaseService,
  GggAuthService,
  type MainWindowServiceType,
  OverlayService,
  PoeProcessService,
  SettingsKey,
  SettingsStoreService,
  SnapshotService,
  TrayService,
} from "~/main/modules";

import { System } from "../../../enums";
import pkgJson from "../../../package.json" with { type: "json" };
import { AppChannel } from "./App.channels";

class AppService {
  public isQuitting: boolean = false;
  private app: App;
  private settingsStore: SettingsStoreService =
    SettingsStoreService.getInstance();
  private sessionStorage: CurrentSessionService =
    CurrentSessionService.getInstance();
  private snapshotService: SnapshotService = SnapshotService.getInstance();
  private database: DatabaseService = DatabaseService.getInstance();
  private overlay: OverlayService = OverlayService.getInstance();
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
      this.app.setAsDefaultProtocolClient("soothsayer", process.execPath, [
        resolve(process.argv[1]),
      ]);
    } else {
      this.app.setAsDefaultProtocolClient("soothsayer");
    }
  }

  public emitGetVersion() {
    ipcMain.handle(AppChannel.GetVersion, () => {
      return pkgJson.version;
    });
  }

  public emitRestart() {
    ipcMain.handle(AppChannel.Restart, () => {
      if (this.isQuitting) return;
      this.app.relaunch();
      this.app.exit(0);
    });
  }

  public quitOnAllWindowsClosed(
    windows: (MainWindowServiceType | OverlayService | null)[],
  ) {
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
    this.app.on(AppChannel.SecondInstance, (_event, commandLine) => {
      if (!mainWindow) {
        return;
      }

      // Focus on the main window if the user tried to open another
      mainWindow.show?.();

      // Windows/Linux: deep link URL arrives via command line args
      const deepLinkUrl = (commandLine as string[]).find((arg) =>
        arg.startsWith("soothsayer://"),
      );
      if (deepLinkUrl) {
        this.handleDeepLink(deepLinkUrl);
      }
    });
  }

  /**
   * Register the macOS `open-url` handler for deep links (e.g. OAuth callbacks).
   * On macOS the OS delivers custom-protocol URLs via this app event rather than
   * through `second-instance` command-line args.
   */
  public emitOpenUrl() {
    this.app.on(AppChannel.OpenUrl, (event, url) => {
      event.preventDefault();
      this.handleDeepLink(url);
    });
  }

  /**
   * Route a `soothsayer://` deep link to the appropriate handler.
   * Currently only `soothsayer://oauth/callback` is supported.
   */
  private handleDeepLink(url: string): void {
    console.log("[App] Deep link received:", url);

    try {
      const parsed = new URL(url);

      if (
        parsed.protocol === "soothsayer:" &&
        parsed.hostname === "oauth" &&
        parsed.pathname === "/callback"
      ) {
        GggAuthService.getInstance().handleCallback(url);
      } else {
        console.warn("[App] Unrecognised deep link path:", url);
      }
    } catch (error) {
      console.error("[App] Failed to parse deep link URL:", url, error);
    }
  }

  /**
   * `beforeQuitCloseWindowsAndDestroyElements` method is used to perform any necessary cleanup tasks
   * before quitting the application, such as closing windows and destroying any elements
   * that need to be cleaned up.
   */
  public beforeQuitCloseWindowsAndDestroyElements() {
    this.app.on(AppChannel.BeforeQuit, async () => {
      this.isQuitting = true;
      console.log("[Shutdown] Starting cleanup...");

      // Close overlay window
      console.log("[Shutdown] Closing overlay...");
      this.overlay.destroy();

      // Stop all snapshot auto-refresh timers
      console.log("[Shutdown] Stopping snapshot auto-refresh...");
      this.snapshotService.stopAllAutoRefresh();

      // Stop active sessions (this will flush processed IDs)
      if (this.sessionStorage.isSessionActive("poe1")) {
        console.log("[Shutdown] Stopping POE1 session...");
        await this.sessionStorage.stopSession("poe1");
        console.log("[Shutdown] POE1 session stopped");
      }
      if (this.sessionStorage.isSessionActive("poe2")) {
        console.log("[Shutdown] Stopping POE2 session...");
        await this.sessionStorage.stopSession("poe2");
        console.log("[Shutdown] POE2 session stopped");
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

  /**
   * Handles GPU process crashes by relaunching the app.
   * Chromium kills the entire browser process when the GPU process
   * can't be recovered (`gpu_data_manager_impl_private.cc` LOG_FATAL).
   * By catching `child-process-gone` we can gracefully relaunch instead.
   */
  public handleGpuProcessCrash() {
    this.app.on(AppChannel.ChildProcessGone, (_event, details) => {
      if (details.type === "GPU" && details.reason === "crashed") {
        console.error(
          `[GPU] GPU process crashed (exitCode: ${details.exitCode}). Relaunching...`,
        );
        this.app.relaunch();
        this.app.exit(0);
      }
    });
  }

  public quit() {
    this.app.quit();
  }

  public async openAtLogin() {
    const openAtLogin = await this.settingsStore.get(
      SettingsKey.AppOpenAtLogin,
    );

    this.app.setLoginItemSettings({
      openAtLogin,
    });
  }
}

export { AppService };
