import { ipcRenderer } from "electron";

import { SettingsStoreChannel } from "./SettingsStore.channels";
import type { UserSettingsDTO } from "./SettingsStore.dto";

const SettingsStoreAPI = {
  // Get all settings
  getAll: (): Promise<UserSettingsDTO> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetAllSettings),

  // Generic get/set
  get: <K extends keyof UserSettingsDTO>(key: K): Promise<UserSettingsDTO[K]> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSetting, key),
  set: <K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSetting, key, value),

  // Client paths
  getPoe1ClientPath: (): Promise<string | null> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetPoe1ClientPath),
  setPoe1ClientPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetPoe1ClientPath, path),

  getPoe2ClientPath: (): Promise<string | null> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetPoe2ClientPath),
  setPoe2ClientPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetPoe2ClientPath, path),

  // App behavior
  getAppExitBehavior: (): Promise<"exit" | "minimize"> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetAppExitBehavior),
  setAppExitBehavior: (behavior: "exit" | "minimize"): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetAppExitBehavior, behavior),

  getLaunchOnStartup: (): Promise<boolean> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetLaunchOnStartup),
  setLaunchOnStartup: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetLaunchOnStartup, enabled),

  getStartMinimized: (): Promise<boolean> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetStartMinimized),
  setStartMinimized: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetStartMinimized, enabled),

  // Game selection
  getActiveGame: (): Promise<"poe1" | "poe2"> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetActiveGame),
  setActiveGame: (game: "poe1" | "poe2"): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetActiveGame, game),

  // League selection
  getSelectedPoe1League: (): Promise<string> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe1League),
  setSelectedPoe1League: (leagueId: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe1League, leagueId),

  getSelectedPoe2League: (): Promise<string> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe2League),
  setSelectedPoe2League: (leagueId: string): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe2League, leagueId),

  // Price source selection
  getSelectedPoe1PriceSource: (): Promise<"exchange" | "stash"> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe1PriceSource),
  setSelectedPoe1PriceSource: (source: "exchange" | "stash"): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe1PriceSource, source),

  getSelectedPoe2PriceSource: (): Promise<"exchange" | "stash"> =>
    ipcRenderer.invoke(SettingsStoreChannel.GetSelectedPoe2PriceSource),
  setSelectedPoe2PriceSource: (source: "exchange" | "stash"): Promise<void> =>
    ipcRenderer.invoke(SettingsStoreChannel.SetSelectedPoe2PriceSource, source),

  // Database management
  resetDatabase: (): Promise<{
    success: boolean;
    requiresRestart?: boolean;
    error?: string;
  }> => ipcRenderer.invoke(SettingsStoreChannel.ResetDatabase),
};

export { SettingsStoreAPI };
