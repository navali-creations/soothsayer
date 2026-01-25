import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";

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
        return this.get(key);
      },
    );

    ipcMain.handle(
      SettingsStoreChannel.SetSetting,
      async <K extends keyof UserSettingsDTO>(
        _event: any,
        key: K,
        value: UserSettingsDTO[K],
      ) => {
        await this.set(key, value);
      },
    );

    // Client paths
    ipcMain.handle(SettingsStoreChannel.GetPoe1ClientPath, async () => {
      return this.repository.getPoe1ClientTxtPath();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetPoe1ClientPath,
      async (_event, path: string) => {
        await this.repository.setPoe1ClientTxtPath(path);
      },
    );

    ipcMain.handle(SettingsStoreChannel.GetPoe2ClientPath, async () => {
      return this.repository.getPoe2ClientTxtPath();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetPoe2ClientPath,
      async (_event, path: string) => {
        await this.repository.setPoe2ClientTxtPath(path);
      },
    );

    // App exit behavior
    ipcMain.handle(SettingsStoreChannel.GetAppExitBehavior, async () => {
      return this.repository.getAppExitAction();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetAppExitBehavior,
      async (_event, behavior: "exit" | "minimize") => {
        await this.repository.setAppExitAction(behavior);
      },
    );

    // Launch on startup
    ipcMain.handle(SettingsStoreChannel.GetLaunchOnStartup, async () => {
      return this.repository.getAppOpenAtLogin();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetLaunchOnStartup,
      async (_event, enabled: boolean) => {
        await this.repository.setAppOpenAtLogin(enabled);
      },
    );

    // Start minimized
    ipcMain.handle(SettingsStoreChannel.GetStartMinimized, async () => {
      return this.repository.getAppOpenAtLoginMinimized();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetStartMinimized,
      async (_event, enabled: boolean) => {
        await this.repository.setAppOpenAtLoginMinimized(enabled);
      },
    );

    // Active game
    ipcMain.handle(SettingsStoreChannel.GetActiveGame, async () => {
      return this.repository.getSelectedGame();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetActiveGame,
      async (_event, game: "poe1" | "poe2") => {
        await this.repository.setSelectedGame(game);
      },
    );

    // Selected PoE1 league
    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe1League, async () => {
      return this.repository.getPoe1SelectedLeague();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe1League,
      async (_event, leagueId: string) => {
        await this.repository.setPoe1SelectedLeague(leagueId);
      },
    );

    // Selected PoE2 league
    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe2League, async () => {
      return this.repository.getPoe2SelectedLeague();
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe2League,
      async (_event, leagueId: string) => {
        await this.repository.setPoe2SelectedLeague(leagueId);
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
        await this.repository.setPoe1PriceSource(source);
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
        await this.repository.setPoe2PriceSource(source);
      },
    );

    // Database management
    ipcMain.handle(SettingsStoreChannel.ResetDatabase, async () => {
      try {
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
