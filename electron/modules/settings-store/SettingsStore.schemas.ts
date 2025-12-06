import type { ReleaseChannel } from "../../../enums/release-channel";
import type { AppChannel } from "../app/App.channels";

// Re-export types for convenience
export type AppExitActions = (typeof AppChannel)[keyof typeof AppChannel];
export type ReleaseChannels =
  (typeof ReleaseChannel)[keyof typeof ReleaseChannel];
export type GameVersion = "poe1" | "poe2";

/**
 * Settings store keys as constants
 * Centralized to avoid typos and enable refactoring
 */
export const SettingsKey = {
  // App behavior
  ReleaseChannel: "release-channel",
  AppExitAction: "app-exit-action",
  AppOpenAtLogin: "app-open-at-login",
  AppOpenAtLoginMinimized: "app-open-at-login-minimized",

  // File paths
  Poe1Path: "poe1-path",
  Poe1ClientTxtPath: "poe1-client-txt-path",
  Poe2ClientTxtPath: "poe2-client-txt-path",
  CollectionPath: "collection-path",

  // Game and league selection
  SelectedGame: "selected-game",
  SelectedPoe1League: "selected-poe1-league",
  SelectedPoe2League: "selected-poe2-league",
} as const;

// Settings store schema - using type instead of interface to support computed keys
export type SettingsStoreSchema = {
  // App behavior
  [SettingsKey.ReleaseChannel]: ReleaseChannels;
  [SettingsKey.AppExitAction]: AppExitActions;
  [SettingsKey.AppOpenAtLogin]: boolean;
  [SettingsKey.AppOpenAtLoginMinimized]: boolean;

  // File paths
  [SettingsKey.Poe1Path]: string | undefined;
  [SettingsKey.Poe1ClientTxtPath]: string | undefined;
  [SettingsKey.Poe2ClientTxtPath]: string | undefined;
  [SettingsKey.CollectionPath]: string | undefined;

  // Game and league selection
  [SettingsKey.SelectedGame]: GameVersion;
  [SettingsKey.SelectedPoe1League]: string;
  [SettingsKey.SelectedPoe2League]: string;
};

// Settings store keys (string literal union type)
export type SettingsStoreKey = keyof SettingsStoreSchema;

// Default values
export const DEFAULT_SETTINGS: SettingsStoreSchema = {
  [SettingsKey.ReleaseChannel]: "stable" as ReleaseChannels,
  [SettingsKey.AppExitAction]: "minimize-to-tray" as AppExitActions,
  [SettingsKey.AppOpenAtLogin]: false,
  [SettingsKey.AppOpenAtLoginMinimized]: false,
  [SettingsKey.Poe1Path]: undefined,
  [SettingsKey.Poe1ClientTxtPath]: undefined,
  [SettingsKey.Poe2ClientTxtPath]: undefined,
  [SettingsKey.CollectionPath]: undefined,
  [SettingsKey.SelectedGame]: "poe1",
  [SettingsKey.SelectedPoe1League]: "Standard",
  [SettingsKey.SelectedPoe2League]: "Standard",
};
