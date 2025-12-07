enum SettingsStoreChannel {
  // General settings
  GetAllSettings = "settings-store:get-all",
  GetSetting = "settings-store:get",
  SetSetting = "settings-store:set",

  // Client paths
  GetPoe1ClientPath = "settings-store:get-poe1-client-path",
  SetPoe1ClientPath = "settings-store:set-poe1-client-path",
  GetPoe2ClientPath = "settings-store:get-poe2-client-path",
  SetPoe2ClientPath = "settings-store:set-poe2-client-path",

  // App behavior
  GetReleaseChannel = "settings-store:get-release-channel",
  SetReleaseChannel = "settings-store:set-release-channel",
  GetAppExitBehavior = "settings-store:get-app-exit-behavior",
  SetAppExitBehavior = "settings-store:set-app-exit-behavior",
  GetLaunchOnStartup = "settings-store:get-launch-on-startup",
  SetLaunchOnStartup = "settings-store:set-launch-on-startup",
  GetStartMinimized = "settings-store:get-start-minimized",
  SetStartMinimized = "settings-store:set-start-minimized",

  // Game and league selection
  SetActiveGame = "settings-store:set-active-game",
  GetActiveGame = "settings-store:get-active-game",
  GetInstalledGames = "settings-store:get-installed-games",
  SetInstalledGames = "settings-store:set-installed-games",
  GetSelectedPoe1League = "settings-store:get-selected-poe1-league",
  SetSelectedPoe1League = "settings-store:set-selected-poe1-league",
  GetSelectedPoe2League = "settings-store:get-selected-poe2-league",
  SetSelectedPoe2League = "settings-store:set-selected-poe2-league",
}

export { SettingsStoreChannel };
