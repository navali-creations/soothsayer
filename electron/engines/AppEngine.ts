import { resolve } from "node:path";
import { type App, app, ipcMain } from "electron";
import { AppEvent, LocalStorageKey, System } from "../../enums";
import {
  LocalStorageEngine,
  MainWindowEngine,
  type MainWindowEngineType,
  TrayEngine,
  PoeProcessEngine,
  SessionEngine,
} from ".";

class AppEngine {
  public isQuitting: boolean = true;
  private app: App;
  private localStorage: LocalStorageEngine = LocalStorageEngine.getInstance();
  private sessionStorage: SessionEngine = SessionEngine.getInstance();
  private static _instance: AppEngine;

  static getInstance() {
    if (!AppEngine._instance) {
      AppEngine._instance = new AppEngine();
    }

    return AppEngine._instance;
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
    ipcMain.handle(AppEvent.Restart, (e) => {
      if (this.isQuitting) return;
      e.preventDefault();
      this.app.relaunch();
      this.app.exit(0);
    });
  }

  public quitOnAllWindowsClosed(windows: [MainWindowEngine | null]) {
    this.app.on(AppEvent.WindowAllClosed, () => {
      windows?.map((window) => {
        window = null;
        return null;
      });
      if (process.platform !== System.MacOS) {
        this.quit();
      }
    });
  }

  public emitSecondInstance(mainWindow: MainWindowEngineType) {
    this.app.on(AppEvent.SecondInstance, () => {
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
    this.app.on(AppEvent.BeforeQuit, () => {
      // Stop any active sessions before quitting

      if (this.sessionStorage.isSessionActive("poe1")) {
        this.sessionStorage.stopSession("poe1");
      }
      if (this.sessionStorage.isSessionActive("poe2")) {
        this.sessionStorage.stopSession("poe2");
      }

      PoeProcessEngine.getInstance().stop();
      TrayEngine.getInstance().destroyTray();
      this.isQuitting = true;
    });
  }

  /**
   * Emitted when attempting to re-launch the application when it's already running
   */
  public emitActivate(mainWindow: MainWindowEngine) {
    if (!mainWindow) return;
    this.app.on(AppEvent.Activate, async () => {
      await mainWindow.createMainWindow();
    });
  }

  public quit() {
    this.app.quit();
    process.exit(0);
  }

  public openAtLogin() {
    const openAtLogin = this.localStorage.store.get(
      LocalStorageKey.AppOpenAtLogin,
    );

    this.app.setLoginItemSettings({
      openAtLogin,
    });
  }
}

export { AppEngine };
