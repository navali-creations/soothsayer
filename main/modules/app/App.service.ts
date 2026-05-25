import { resolve } from "node:path";

import { type App, app, ipcMain } from "electron";

import { AppPerformanceService } from "~/main/modules/app-performance";
import { CommunityUploadService } from "~/main/modules/community-upload";
import { CurrentSessionService } from "~/main/modules/current-session";
import { DatabaseService } from "~/main/modules/database";
import { GggAuthService } from "~/main/modules/ggg-auth";
import type { MainWindowServiceType } from "~/main/modules/main-window";
import { OverlayService } from "~/main/modules/overlay";
import { PoeProcessService } from "~/main/modules/poe-process";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import { SnapshotService } from "~/main/modules/snapshots";
import { TrayService } from "~/main/modules/tray";

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
  private appPerformance: AppPerformanceService =
    AppPerformanceService.getInstance();
  private shutdownCleanupComplete = false;
  private shutdownCleanupPromise: Promise<void> | null = null;
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
    ipcMain.handle(AppChannel.Restart, async () => {
      if (this.isQuitting) return;
      await this.appPerformance.shutdown();
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
    this.app.on(AppChannel.BeforeQuit, async (event) => {
      if (this.shutdownCleanupComplete) return;

      const isCleanupOwner = !this.shutdownCleanupPromise;
      const shouldResumeQuit =
        isCleanupOwner && typeof event?.preventDefault === "function";

      event?.preventDefault?.();

      if (!this.shutdownCleanupPromise) {
        this.shutdownCleanupPromise = this.runBeforeQuitCleanup();
      }

      try {
        await this.shutdownCleanupPromise;
      } catch (error) {
        console.error("[Shutdown] Cleanup failed:", error);
      } finally {
        if (isCleanupOwner) {
          this.shutdownCleanupComplete = true;
          this.shutdownCleanupPromise = null;

          if (shouldResumeQuit) {
            this.app.quit();
          }
        }
      }
    });
  }

  private async runBeforeQuitCleanup(): Promise<void> {
    this.isQuitting = true;
    console.log("[Shutdown] Starting cleanup...");

    // Close overlay window
    console.log("[Shutdown] Closing overlay...");
    try {
      this.overlay.destroy();
    } catch (error) {
      console.error("[Shutdown] Failed to close overlay:", error);
    }

    // Stop all snapshot auto-refresh timers
    console.log("[Shutdown] Stopping snapshot auto-refresh...");
    try {
      this.snapshotService.stopAllAutoRefresh();
    } catch (error) {
      console.error("[Shutdown] Failed to stop snapshot auto-refresh:", error);
    }

    // Stop active sessions. Community uploads are queued locally and drained below.
    if (this.sessionStorage.isSessionActive("poe1")) {
      console.log("[Shutdown] Stopping POE1 session...");
      try {
        await this.sessionStorage.stopSession("poe1");
        console.log("[Shutdown] POE1 session stopped");
      } catch (error) {
        console.error("[Shutdown] Failed to stop POE1 session:", error);
      }
    }
    if (this.sessionStorage.isSessionActive("poe2")) {
      console.log("[Shutdown] Stopping POE2 session...");
      try {
        await this.sessionStorage.stopSession("poe2");
        console.log("[Shutdown] POE2 session stopped");
      } catch (error) {
        console.error("[Shutdown] Failed to stop POE2 session:", error);
      }
    }

    console.log("[Shutdown] Draining community uploads...");
    try {
      await CommunityUploadService.getInstance().drainInFlightUploads();
    } catch (error) {
      console.error("[Shutdown] Failed to drain community uploads:", error);
    }

    // Stop POE process monitoring
    console.log("[Shutdown] Stopping POE process monitoring...");
    try {
      PoeProcessService.getInstance().stop();
    } catch (error) {
      console.error("[Shutdown] Failed to stop POE process monitoring:", error);
    }

    // Stop app performance diagnostics and flush pending samples.
    console.log("[Shutdown] Stopping app performance diagnostics...");
    try {
      await this.appPerformance.shutdown();
    } catch (error) {
      console.error(
        "[Shutdown] Failed to stop app performance diagnostics:",
        error,
      );
    }

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
    try {
      this.database.close();
    } catch (error) {
      console.error("[Shutdown] Database close failed:", error);
    }

    // Destroy tray
    console.log("[Shutdown] Destroying tray...");
    try {
      TrayService.getInstance().destroyTray();
    } catch (error) {
      console.error("[Shutdown] Tray destroy failed:", error);
    }

    console.log("[Shutdown] Cleanup complete, quitting now...");
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
