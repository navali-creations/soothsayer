import {
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
} from "electron";

import { DatabaseService } from "~/main/modules/database";
import {
  assertBoolean,
  assertExitBehavior,
  assertFilePath,
  assertGameType,
  assertInstalledGames,
  assertInteger,
  assertPriceSource,
  assertSetupStep,
  assertString,
  assertStringArray,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import { SettingsStoreChannel } from "./SettingsStore.channels";
import type { UserSettingsDTO } from "./SettingsStore.dto";
import { SettingsStoreRepository } from "./SettingsStore.repository";

class SettingsStoreService {
  private static _instance: SettingsStoreService;
  private repository: SettingsStoreRepository;

  static getInstance() {
    if (!SettingsStoreService._instance) {
      SettingsStoreService._instance = new SettingsStoreService();
    }

    return SettingsStoreService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new SettingsStoreRepository(db.getKysely());
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    // Generic get/set
    ipcMain.handle(SettingsStoreChannel.GetAllSettings, async () => {
      return this.getAllSettings();
    });

    ipcMain.handle(
      SettingsStoreChannel.GetSetting,
      async (_event, key: keyof UserSettingsDTO) => {
        try {
          assertString(key, "key", SettingsStoreChannel.GetSetting);
          return this.get(key);
        } catch (error) {
          return handleValidationError(error, SettingsStoreChannel.GetSetting);
        }
      },
    );

    ipcMain.handle(
      SettingsStoreChannel.SetSetting,
      async <K extends keyof UserSettingsDTO>(
        _event: IpcMainInvokeEvent,
        key: K,
        value: UserSettingsDTO[K],
      ) => {
        const ch = SettingsStoreChannel.SetSetting;
        try {
          assertString(key, "key", ch);
          if (value === undefined) {
            throw new IpcValidationError(
              ch,
              `Value for setting "${key}" cannot be undefined`,
            );
          }
          // Validate value type based on the specific key to prevent
          // a compromised renderer from bypassing individual typed setters.
          switch (key) {
            case "poe1ClientTxtPath":
            case "poe2ClientTxtPath":
              // These can be null (cleared) or a valid file path
              if (value !== null) {
                assertFilePath(value, key, ch);
              }
              break;
            case "appExitAction":
              assertExitBehavior(value, ch);
              break;
            case "appOpenAtLogin":
            case "appOpenAtLoginMinimized":
            case "setupCompleted":
              assertBoolean(value, key, ch);
              break;
            case "selectedGame":
              assertGameType(value, ch);
              break;
            case "installedGames":
              assertInstalledGames(value, ch);
              break;
            case "poe1SelectedLeague":
            case "poe2SelectedLeague":
              assertString(value, key, ch);
              break;
            case "poe1PriceSource":
            case "poe2PriceSource":
              assertPriceSource(value, ch);
              break;
            case "setupStep":
              assertSetupStep(value, ch);
              break;
            case "setupVersion":
              assertInteger(value, "setupVersion", ch, { min: 0, max: 1000 });
              break;
            case "onboardingDismissedBeacons":
              assertStringArray(value, "onboardingDismissedBeacons", ch, {
                maxLength: 100,
                maxItemLength: 256,
              });
              break;
            case "overlayBounds":
              // Can be null (reset) or a bounds object
              if (value !== null) {
                if (typeof value !== "object") {
                  throw new IpcValidationError(
                    ch,
                    `Expected "overlayBounds" to be an object or null, got ${typeof value}`,
                  );
                }
                const bounds = value as Record<string, unknown>;
                assertInteger(bounds.x, "overlayBounds.x", ch, {
                  min: -100_000,
                  max: 100_000,
                });
                assertInteger(bounds.y, "overlayBounds.y", ch, {
                  min: -100_000,
                  max: 100_000,
                });
                assertInteger(bounds.width, "overlayBounds.width", ch, {
                  min: 1,
                  max: 100_000,
                });
                assertInteger(bounds.height, "overlayBounds.height", ch, {
                  min: 1,
                  max: 100_000,
                });
              }
              break;
            default:
              throw new IpcValidationError(ch, `Unknown setting key "${key}"`);
          }
          await this.set(key, value);
        } catch (error) {
          return handleValidationError(error, ch);
        }
      },
    );

    // Client paths
    ipcMain.handle(SettingsStoreChannel.GetPoe1ClientPath, async () => {
      return this.repository.getPoe1ClientTxtPath();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetPoe1ClientPath,
      async (_event, path: string) => {
        try {
          assertFilePath(path, "path", SettingsStoreChannel.SetPoe1ClientPath);
          await this.repository.setPoe1ClientTxtPath(path);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetPoe1ClientPath,
          );
        }
      },
    );

    ipcMain.handle(SettingsStoreChannel.GetPoe2ClientPath, async () => {
      return this.repository.getPoe2ClientTxtPath();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetPoe2ClientPath,
      async (_event, path: string) => {
        try {
          assertFilePath(path, "path", SettingsStoreChannel.SetPoe2ClientPath);
          await this.repository.setPoe2ClientTxtPath(path);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetPoe2ClientPath,
          );
        }
      },
    );

    // App exit behavior
    ipcMain.handle(SettingsStoreChannel.GetAppExitBehavior, async () => {
      return this.repository.getAppExitAction();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetAppExitBehavior,
      async (_event, behavior: "exit" | "minimize") => {
        try {
          assertExitBehavior(behavior, SettingsStoreChannel.SetAppExitBehavior);
          await this.repository.setAppExitAction(behavior);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetAppExitBehavior,
          );
        }
      },
    );

    // Launch on startup
    ipcMain.handle(SettingsStoreChannel.GetLaunchOnStartup, async () => {
      return this.repository.getAppOpenAtLogin();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetLaunchOnStartup,
      async (_event, enabled: boolean) => {
        try {
          assertBoolean(
            enabled,
            "enabled",
            SettingsStoreChannel.SetLaunchOnStartup,
          );
          await this.repository.setAppOpenAtLogin(enabled);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetLaunchOnStartup,
          );
        }
      },
    );

    // Start minimized
    ipcMain.handle(SettingsStoreChannel.GetStartMinimized, async () => {
      return this.repository.getAppOpenAtLoginMinimized();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetStartMinimized,
      async (_event, enabled: boolean) => {
        try {
          assertBoolean(
            enabled,
            "enabled",
            SettingsStoreChannel.SetStartMinimized,
          );
          await this.repository.setAppOpenAtLoginMinimized(enabled);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetStartMinimized,
          );
        }
      },
    );

    // Active game
    ipcMain.handle(SettingsStoreChannel.GetActiveGame, async () => {
      return this.repository.getSelectedGame();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetActiveGame,
      async (_event, game: "poe1" | "poe2") => {
        try {
          assertGameType(game, SettingsStoreChannel.SetActiveGame);
          await this.repository.setSelectedGame(game);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetActiveGame,
          );
        }
      },
    );

    // Installed games
    ipcMain.handle(SettingsStoreChannel.GetInstalledGames, async () => {
      return this.repository.getInstalledGames();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetInstalledGames,
      async (_event, games: ("poe1" | "poe2")[]) => {
        try {
          assertInstalledGames(games, SettingsStoreChannel.SetInstalledGames);
          await this.repository.setInstalledGames(games);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetInstalledGames,
          );
        }
      },
    );

    // Selected PoE1 league
    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe1League, async () => {
      return this.repository.getPoe1SelectedLeague();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe1League,
      async (_event, leagueId: string) => {
        try {
          assertString(
            leagueId,
            "leagueId",
            SettingsStoreChannel.SetSelectedPoe1League,
          );
          await this.repository.setPoe1SelectedLeague(leagueId);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetSelectedPoe1League,
          );
        }
      },
    );

    // Selected PoE2 league
    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe2League, async () => {
      return this.repository.getPoe2SelectedLeague();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe2League,
      async (_event, leagueId: string) => {
        try {
          assertString(
            leagueId,
            "leagueId",
            SettingsStoreChannel.SetSelectedPoe2League,
          );
          await this.repository.setPoe2SelectedLeague(leagueId);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetSelectedPoe2League,
          );
        }
      },
    );

    // Selected PoE1 price source
    ipcMain.handle(
      SettingsStoreChannel.GetSelectedPoe1PriceSource,
      async () => {
        return this.repository.getPoe1PriceSource();
      },
    );

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe1PriceSource,
      async (_event, source: "exchange" | "stash") => {
        try {
          assertPriceSource(
            source,
            SettingsStoreChannel.SetSelectedPoe1PriceSource,
          );
          await this.repository.setPoe1PriceSource(source);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetSelectedPoe1PriceSource,
          );
        }
      },
    );

    // Selected PoE2 price source
    ipcMain.handle(
      SettingsStoreChannel.GetSelectedPoe2PriceSource,
      async () => {
        return this.repository.getPoe2PriceSource();
      },
    );

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe2PriceSource,
      async (_event, source: "exchange" | "stash") => {
        try {
          assertPriceSource(
            source,
            SettingsStoreChannel.SetSelectedPoe2PriceSource,
          );
          await this.repository.setPoe2PriceSource(source);
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetSelectedPoe2PriceSource,
          );
        }
      },
    );

    // Database management — requires native OS confirmation dialog
    ipcMain.handle(SettingsStoreChannel.ResetDatabase, async () => {
      try {
        // Security: show a native OS-level confirmation dialog in the main process.
        // This ensures that even if the renderer is compromised and calls this
        // IPC channel directly, the user still gets an unforgeable native dialog.
        const focusedWindow = BrowserWindow.getFocusedWindow();
        const dialogOptions: Electron.MessageBoxOptions = {
          type: "warning",
          buttons: ["Cancel", "Reset Database"],
          defaultId: 0,
          cancelId: 0,
          title: "Reset Database",
          message: "Are you sure you want to reset the database?",
          detail:
            "This will permanently delete ALL your data including sessions, card statistics, and price snapshots. This action cannot be undone.",
        };

        const result = focusedWindow
          ? await dialog.showMessageBox(focusedWindow, dialogOptions)
          : await dialog.showMessageBox(dialogOptions);

        // "Cancel" is index 0, "Reset Database" is index 1
        if (result.response !== 1) {
          return { success: false, error: "Reset cancelled by user" };
        }

        const db = DatabaseService.getInstance();
        db.reset();

        // Return success with restart required flag
        return { success: true, requiresRestart: true };
      } catch (error) {
        console.error("[Settings] Failed to reset database:", error);
        return { success: false, error: (error as Error).message };
      }
    });
  }

  /**
   * Get a setting value by key
   */
  public async get<K extends keyof UserSettingsDTO>(
    key: K,
  ): Promise<UserSettingsDTO[K]> {
    return this.repository.get(key);
  }

  /**
   * Set a setting value by key
   */
  public async set<K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ): Promise<void> {
    await this.repository.set(key, value);
  }

  /**
   * Get all settings as a single object
   */
  public async getAllSettings(): Promise<UserSettingsDTO> {
    return this.repository.getAll();
  }
}

export { SettingsStoreService };
