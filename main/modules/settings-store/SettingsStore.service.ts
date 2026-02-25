import { promises as fs } from "node:fs";
import path from "node:path";

import {
  app,
  BrowserWindow,
  type IpcMainInvokeEvent,
  ipcMain,
  shell,
} from "electron";

import { ClientLogReaderService } from "~/main/modules/client-log-reader";
import { DatabaseService } from "~/main/modules/database";
import { OverlayChannel } from "~/main/modules/overlay/Overlay.channels";
import {
  assertBoolean,
  assertBoundedString,
  assertEnum,
  assertExitBehavior,
  assertFilePath,
  assertGameType,
  assertInstalledGames,
  assertInteger,
  assertNumber,
  assertPriceSource,
  assertSetupStep,
  assertString,
  assertStringArray,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import { SettingsStoreChannel } from "./SettingsStore.channels";
import type { CustomSoundFile, UserSettingsDTO } from "./SettingsStore.dto";
import { SettingsKey } from "./SettingsStore.keys";
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

  /**
   * Get the Path of Exile custom sounds directory
   */
  private getPoeSoundsDirectory(): string {
    const documentsPath = app.getPath("documents");
    return path.join(documentsPath, "My Games", "Path of Exile");
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
            case "audioEnabled":
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
            case "audioVolume":
              assertNumber(value, "audioVolume", ch);
              if ((value as number) < 0 || (value as number) > 1) {
                throw new IpcValidationError(
                  ch,
                  `Expected "audioVolume" to be between 0 and 1, got ${value}`,
                );
              }
              break;
            case "audioRarity1Path":
            case "audioRarity2Path":
            case "audioRarity3Path":
              if (value !== null) {
                assertFilePath(value, key, ch);
              }
              break;
            case "raritySource":
              assertEnum(value, "raritySource", ch, [
                "poe.ninja",
                "filter",
                "prohibited-library",
              ] as const);
              break;
            case "selectedFilterId":
              // Can be null (cleared) or a bounded string
              if (value !== null) {
                assertBoundedString(value, "selectedFilterId", ch, 256);
              }
              break;
            case "lastSeenAppVersion":
              // Can be null (cleared) or a bounded semver string
              if (value !== null) {
                assertBoundedString(value, "lastSeenAppVersion", ch, 64);
              }
              break;
            case "overlayFontSize":
              assertNumber(value, "overlayFontSize", ch);
              if ((value as number) < 0.5 || (value as number) > 2.0) {
                throw new IpcValidationError(
                  ch,
                  `Expected "overlayFontSize" to be between 0.5 and 2.0, got ${value}`,
                );
              }
              break;
            case "mainWindowBounds":
              // Can be null (reset) or a bounds object
              if (value !== null) {
                if (typeof value !== "object") {
                  throw new IpcValidationError(
                    ch,
                    `Expected "mainWindowBounds" to be an object or null, got ${typeof value}`,
                  );
                }
                const bounds = value as Record<string, unknown>;
                assertInteger(bounds.x, "mainWindowBounds.x", ch, {
                  min: -100_000,
                  max: 100_000,
                });
                assertInteger(bounds.y, "mainWindowBounds.y", ch, {
                  min: -100_000,
                  max: 100_000,
                });
                assertInteger(bounds.width, "mainWindowBounds.width", ch, {
                  min: 1,
                  max: 100_000,
                });
                assertInteger(bounds.height, "mainWindowBounds.height", ch, {
                  min: 1,
                  max: 100_000,
                });
              }
              break;
            default:
              throw new IpcValidationError(ch, `Unknown setting key "${key}"`);
          }
          await this.set(key, value);

          // Notify overlay when price source, active game, or overlay font size changes
          if (
            key === SettingsKey.Poe1PriceSource ||
            key === SettingsKey.Poe2PriceSource ||
            key === SettingsKey.ActiveGame ||
            key === SettingsKey.OverlayFontSize
          ) {
            this.broadcastSettingsChanged();
          }

          // Notify ClientLogReader when client.txt path changes
          if (
            (key === "poe1ClientTxtPath" || key === "poe2ClientTxtPath") &&
            value !== null
          ) {
            const game = key === "poe1ClientTxtPath" ? "poe1" : "poe2";
            const reader = await ClientLogReaderService.getInstance();
            reader.setClientLogPath(value as string, game);
          }
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

          // Notify ClientLogReader to start watching the new path
          const clientLogReader = await ClientLogReaderService.getInstance();
          clientLogReader.setClientLogPath(path, "poe1");
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

          // Notify ClientLogReader to start watching the new path
          const clientLogReader = await ClientLogReaderService.getInstance();
          clientLogReader.setClientLogPath(path, "poe2");
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
          this.broadcastSettingsChanged();
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
          this.broadcastSettingsChanged();
        } catch (error) {
          return handleValidationError(
            error,
            SettingsStoreChannel.SetSelectedPoe2PriceSource,
          );
        }
      },
    );

    // Audio: Scan custom sounds directory
    ipcMain.handle(
      SettingsStoreChannel.ScanCustomSounds,
      async (): Promise<CustomSoundFile[]> => {
        try {
          const soundsDir = this.getPoeSoundsDirectory();
          const entries = await fs.readdir(soundsDir).catch(() => []);
          const mp3Files = entries.filter((f) =>
            f.toLowerCase().endsWith(".mp3"),
          );
          return mp3Files.map((filename) => ({
            filename,
            fullPath: path.join(soundsDir, filename),
          }));
        } catch (error) {
          console.error("[Settings] Failed to scan custom sounds:", error);
          return [];
        }
      },
    );

    // Audio: Get custom sound file as base64 data URL
    ipcMain.handle(
      SettingsStoreChannel.GetCustomSoundData,
      async (_event, filePath: string): Promise<string | null> => {
        try {
          assertFilePath(
            filePath,
            "filePath",
            SettingsStoreChannel.GetCustomSoundData,
          );

          // Security: ensure the path is within the PoE sounds directory
          const soundsDir = this.getPoeSoundsDirectory();
          const resolved = path.resolve(filePath);
          if (!resolved.startsWith(soundsDir)) {
            console.warn(
              `[Settings] Rejected sound file outside PoE directory: ${filePath}`,
            );
            return null;
          }

          const buffer = await fs.readFile(resolved);
          const base64 = buffer.toString("base64");
          return `data:audio/mpeg;base64,${base64}`;
        } catch (error) {
          console.error("[Settings] Failed to read custom sound:", error);
          return null;
        }
      },
    );

    // Audio: Open custom sounds folder in file explorer
    ipcMain.handle(
      SettingsStoreChannel.OpenCustomSoundsFolder,
      async (): Promise<{ success: boolean; path: string }> => {
        try {
          const soundsDir = this.getPoeSoundsDirectory();

          // Create directory if it doesn't exist
          await fs.mkdir(soundsDir, { recursive: true });

          await shell.openPath(soundsDir);
          return { success: true, path: soundsDir };
        } catch (error) {
          console.error(
            "[Settings] Failed to open custom sounds folder:",
            error,
          );
          return {
            success: false,
            path: this.getPoeSoundsDirectory(),
          };
        }
      },
    );

    // Database management — confirmation is handled by the renderer UI
    ipcMain.handle(SettingsStoreChannel.ResetDatabase, async () => {
      try {
        const db = DatabaseService.getInstance();
        db.reset();
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
   * Broadcast a settings-changed event to all windows (e.g. overlay)
   * so they can live-update price source, audio settings, etc.
   */
  private broadcastSettingsChanged(): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(OverlayChannel.SettingsChanged);
      }
    }
  }

  /**
   * Get all settings as a single object
   */
  public async getAllSettings(): Promise<UserSettingsDTO> {
    return this.repository.getAll();
  }
}

export { SettingsStoreService };
