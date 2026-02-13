/**
 * Settings keys enum for type-safe access to user settings
 */
export const SettingsKey = {
  AppExitAction: "appExitAction",
  AppOpenAtLogin: "appOpenAtLogin",
  AppOpenAtLoginMinimized: "appOpenAtLoginMinimized",
  OnboardingDismissedBeacons: "onboardingDismissedBeacons",
  OverlayBounds: "overlayBounds",
  Poe1ClientTxtPath: "poe1ClientTxtPath",
  SelectedPoe1League: "poe1SelectedLeague",
  Poe1PriceSource: "poe1PriceSource",
  Poe2ClientTxtPath: "poe2ClientTxtPath",
  SelectedPoe2League: "poe2SelectedLeague",
  Poe2PriceSource: "poe2PriceSource",
  ActiveGame: "selectedGame",
  InstalledGames: "installedGames",
  SetupCompleted: "setupCompleted",
  SetupStep: "setupStep",
  SetupVersion: "setupVersion",
  AudioEnabled: "audioEnabled",
  AudioVolume: "audioVolume",
  AudioRarity1Path: "audioRarity1Path",
  AudioRarity2Path: "audioRarity2Path",
  AudioRarity3Path: "audioRarity3Path",
} as const;

export type SettingsKeyType = (typeof SettingsKey)[keyof typeof SettingsKey];
