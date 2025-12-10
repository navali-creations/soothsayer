import { ipcMain } from "electron";
import Store from "electron-store";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import {
  type AppExitActions,
  DEFAULT_SETTINGS,
  type GameVersion,
  type ReleaseChannels,
  SettingsKey,
  type SettingsStoreKey,
  type SettingsStoreSchema,
} from "./SettingsStore.schemas";

class SettingsStoreService {
  private static _instance: SettingsStoreService;
  public store = new Store<SettingsStoreSchema>({
    defaults: DEFAULT_SETTINGS,
  });

  static getInstance() {
    if (!SettingsStoreService._instance) {
      SettingsStoreService._instance = new SettingsStoreService();
    }

    return SettingsStoreService._instance;
  }

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    // Generic get/set
    ipcMain.handle(SettingsStoreChannel.GetAllSettings, () => {
      return this.getAllSettings();
    });

    ipcMain.handle(
      SettingsStoreChannel.GetSetting,
      (_event, key: SettingsStoreKey) => {
        return this.get(key);
      },
    );

    ipcMain.handle(
      SettingsStoreChannel.SetSetting,
      <K extends SettingsStoreKey>(
        _event: any,
        key: K,
        value: SettingsStoreSchema[K],
      ) => {
        this.set(key, value);
      },
    );

    // Client paths
    ipcMain.handle(SettingsStoreChannel.GetPoe1ClientPath, () => {
      return this.get(SettingsKey.Poe1ClientTxtPath);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetPoe1ClientPath,
      (_event, path: string) => {
        this.set(SettingsKey.Poe1ClientTxtPath, path);
      },
    );

    ipcMain.handle(SettingsStoreChannel.GetPoe2ClientPath, () => {
      return this.get(SettingsKey.Poe2ClientTxtPath);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetPoe2ClientPath,
      (_event, path: string) => {
        this.set(SettingsKey.Poe2ClientTxtPath, path);
      },
    );

    // Release channel
    ipcMain.handle(SettingsStoreChannel.GetReleaseChannel, () => {
      return this.get(SettingsKey.ReleaseChannel);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetReleaseChannel,
      (_event, channel: ReleaseChannels) => {
        this.set(SettingsKey.ReleaseChannel, channel);
      },
    );

    // App exit behavior
    ipcMain.handle(SettingsStoreChannel.GetAppExitBehavior, () => {
      return this.get(SettingsKey.AppExitAction);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetAppExitBehavior,
      (_event, behavior: AppExitActions) => {
        this.set(SettingsKey.AppExitAction, behavior);
      },
    );

    // Launch on startup
    ipcMain.handle(SettingsStoreChannel.GetLaunchOnStartup, () => {
      return this.get(SettingsKey.AppOpenAtLogin);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetLaunchOnStartup,
      (_event, enabled: boolean) => {
        this.set(SettingsKey.AppOpenAtLogin, enabled);
      },
    );

    // Start minimized
    ipcMain.handle(SettingsStoreChannel.GetStartMinimized, () => {
      return this.get(SettingsKey.AppOpenAtLoginMinimized);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetStartMinimized,
      (_event, enabled: boolean) => {
        this.set(SettingsKey.AppOpenAtLoginMinimized, enabled);
      },
    );

    // Installed games
    ipcMain.handle(SettingsStoreChannel.GetActiveGame, () => {
      return this.get(SettingsKey.ActiveGame);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetActiveGame,
      (_event, game: Omit<GameVersion, "both">) => {
        this.set(SettingsKey.ActiveGame, game);
      },
    );

    // Installed games
    ipcMain.handle(SettingsStoreChannel.GetInstalledGames, () => {
      return this.get(SettingsKey.InstalledGames);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetInstalledGames,
      (_event, game: GameVersion) => {
        this.set(SettingsKey.InstalledGames, game);
      },
    );

    // Selected PoE1 league
    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe1League, () => {
      return this.get(SettingsKey.SelectedPoe1League);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe1League,
      (_event, leagueId: string) => {
        this.set(SettingsKey.SelectedPoe1League, leagueId);
      },
    );

    // Selected PoE2 league
    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe2League, () => {
      return this.get(SettingsKey.SelectedPoe2League);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe2League,
      (_event, leagueId: string) => {
        this.set(SettingsKey.SelectedPoe2League, leagueId);
      },
    );

    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe1PriceSource, () => {
      return this.get(SettingsKey.SelectedPoe1PriceSource);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe1PriceSource,
      (_event, source: PriceSource) => {
        this.set(SettingsKey.SelectedPoe1PriceSource, source);
      },
    );

    // Selected PoE2 price source
    ipcMain.handle(SettingsStoreChannel.GetSelectedPoe2PriceSource, () => {
      return this.get(SettingsKey.SelectedPoe2PriceSource);
    });

    ipcMain.handle(
      SettingsStoreChannel.SetSelectedPoe2PriceSource,
      (_event, source: PriceSource) => {
        this.set(SettingsKey.SelectedPoe2PriceSource, source);
      },
    );
  }

  /**
   * Get a setting value by key
   */
  public get<K extends SettingsStoreKey>(key: K): SettingsStoreSchema[K] {
    return this.store.get(key);
  }

  /**
   * Set a setting value by key
   */
  public set<K extends SettingsStoreKey>(
    key: K,
    value: SettingsStoreSchema[K],
  ): void {
    this.store.set(key, value);
  }

  /**
   * Get all settings as a single object
   */
  public getAllSettings(): SettingsStoreSchema {
    return {
      [SettingsKey.ReleaseChannel]: this.get(SettingsKey.ReleaseChannel),
      [SettingsKey.AppExitAction]: this.get(SettingsKey.AppExitAction),
      [SettingsKey.AppOpenAtLogin]: this.get(SettingsKey.AppOpenAtLogin),
      [SettingsKey.AppOpenAtLoginMinimized]: this.get(
        SettingsKey.AppOpenAtLoginMinimized,
      ),
      [SettingsKey.ActiveGame]: this.get(SettingsKey.ActiveGame),
      [SettingsKey.Poe1ClientTxtPath]: this.get(SettingsKey.Poe1ClientTxtPath),
      [SettingsKey.Poe2ClientTxtPath]: this.get(SettingsKey.Poe2ClientTxtPath),
      [SettingsKey.CollectionPath]: this.get(SettingsKey.CollectionPath),
      [SettingsKey.InstalledGames]: this.get(SettingsKey.InstalledGames),
      [SettingsKey.SelectedPoe1League]: this.get(
        SettingsKey.SelectedPoe1League,
      ),
      [SettingsKey.SelectedPoe2League]: this.get(
        SettingsKey.SelectedPoe2League,
      ),
      [SettingsKey.TourCompleted]: this.get(SettingsKey.TourCompleted),
      [SettingsKey.SetupCompleted]: this.get(SettingsKey.SetupCompleted),
      [SettingsKey.SetupStep]: this.get(SettingsKey.SetupStep),
      [SettingsKey.SetupVersion]: this.get(SettingsKey.SetupVersion),

      [SettingsKey.SelectedPoe1PriceSource]: this.get(
        SettingsKey.SelectedPoe1PriceSource,
      ),
      [SettingsKey.SelectedPoe2PriceSource]: this.get(
        SettingsKey.SelectedPoe2PriceSource,
      ),
    };
  }
}

export { SettingsStoreService };
