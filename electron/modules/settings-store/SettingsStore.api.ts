import { ipcRenderer } from "electron";
import type { PriceSource } from "../../../types/data-stores";
import { SettingsStoreChannel } from "./SettingsStore.channels";
import type {
  AppExitActions,
  GameVersion,
  ReleaseChannels,
  SettingsStoreSchema,
} from "./SettingsStore.schemas";

const SettingsStoreAPI = {
  // Get all settings
  getAll: (): Promise<SettingsStoreSchema> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetAllSettings),

  // Generic get/set
  get: <K extends keyof SettingsStoreSchema>(
    key: K,
  ): Promise<SettingsStoreSchema[K]> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSetting, key),
  set: <K extends keyof SettingsStoreSchema>(
    key: K,
    value: SettingsStoreSchema[K],
  ): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSetting, key, value),

  // Client paths
  getPoe1ClientPath: (): Promise<string | undefined> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetPoe1ClientPath),
  setPoe1ClientPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetPoe1ClientPath, path),

  getPoe2ClientPath: (): Promise<string | undefined> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetPoe2ClientPath),
  setPoe2ClientPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetPoe2ClientPath, path),

  // App behavior
  getReleaseChannel: (): Promise<ReleaseChannels> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetReleaseChannel),
  setReleaseChannel: (channel: ReleaseChannels): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetReleaseChannel, channel),

  getAppExitBehavior: (): Promise<AppExitActions> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetAppExitBehavior),
  setAppExitBehavior: (behavior: AppExitActions): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetAppExitBehavior, behavior),

  getLaunchOnStartup: (): Promise<boolean> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetLaunchOnStartup),
  setLaunchOnStartup: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetLaunchOnStartup, enabled),

  getStartMinimized: (): Promise<boolean> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetStartMinimized),
  setStartMinimized: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetStartMinimized, enabled),

  // Game and league selection
  getSelectedGame: (): Promise<GameVersion> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetInstalledGames),
  setSelectedGame: (game: GameVersion): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetInstalledGames, game),

  getSelectedPoe1League: (): Promise<string> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe1League),
  setSelectedPoe1League: (leagueId: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe1League, leagueId),

  getSelectedPoe2League: (): Promise<string> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe2League),
  setSelectedPoe2League: (leagueId: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe2League, leagueId),

  getSelectedPoe1PriceSource: (): Promise<PriceSource> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe1PriceSource),
  setSelectedPoe1PriceSource: (source: PriceSource): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe1PriceSource, source),

  getSelectedPoe2PriceSource: (): Promise<PriceSource> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe2PriceSource),
  setSelectedPoe2PriceSource: (source: PriceSource): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe2PriceSource, source),
};

export { SettingsStoreAPI };
