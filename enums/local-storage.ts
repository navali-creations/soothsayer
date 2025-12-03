export enum LocalStorageKey {
  ReleaseChannel = "release-channel",
  AppExitAction = "app-exit-action",
  Poe1Path = "poe-1-path",
  Poe1ClientTxtPath = "poe-1-client-txt-path",
  Poe2ClientTxtPath = "poe-2-client-txt-path",
  CollectionPath = "collection-path",
  AppOpenAtLogin = "app-open-at-login",
  AppOpenAtLoginMinimized = "app-open-at-login-minimized",
  DivinationCards = "divination-cards",
  SelectedLeague = "selected-league",
}

export enum LocalStorageEvent {
  FetchLocalSettings = "fetch-local-settings",
  SetSetting = "set-setting",
  GetDivinationCards = "get-divination-cards",
  ResetDivinationCards = "reset-divination-cards",
  GetSelectedLeague = "get-selected-league",
  SetSelectedLeague = "set-selected-league",
  GetClientTxtPaths = "get-client-txt-paths",
  SetClientTxtPaths = "set-client-txt-paths",
}
