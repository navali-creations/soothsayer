import type { ReleaseChannel } from "../../../enums/release-channel";
import type { PriceSource } from "../../../types/data-stores";
import type { AppChannel } from "../app/App.channels";

// Re-export types for convenience
export type AppExitActions = (typeof AppChannel)[keyof typeof AppChannel];
export type ReleaseChannels =
  (typeof ReleaseChannel)[keyof typeof ReleaseChannel];
export type GameVersion = "poe1" | "poe2" | "both";

// Setup step type for type safety
export type SetupStep = 0 | 1 | 2 | 3; // 0 = not started, 1-3 = steps, 3 = complete

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
  Poe1ClientTxtPath: "poe1-client-txt-path",
  Poe2ClientTxtPath: "poe2-client-txt-path",
  CollectionPath: "collection-path",

  // Game and league selection
  ActiveGame: "active-game",
  InstalledGames: "installed-games",
  SelectedPoe1League: "selected-poe1-league",
  SelectedPoe2League: "selected-poe2-league",

  // Setup and onboarding
  OnboardingDismissedBeacons: "onboarding-dismissed-beacons",
  SetupCompleted: "setup-completed",
  SetupStep: "setup-step",
  SetupVersion: "setup-version", // Track setup flow version for future migrations

  // Price source selection (add after league selection)
  SelectedPoe1PriceSource: "selected-poe1-price-source",
  SelectedPoe2PriceSource: "selected-poe2-price-source",
} as const;

// Settings store schema - using type instead of interface to support computed keys
export type SettingsStoreSchema = {
  // App behavior
  [SettingsKey.ReleaseChannel]: ReleaseChannels;
  [SettingsKey.AppExitAction]: AppExitActions;
  [SettingsKey.AppOpenAtLogin]: boolean;
  [SettingsKey.AppOpenAtLoginMinimized]: boolean;

  // File paths
  [SettingsKey.Poe1ClientTxtPath]: string | undefined;
  [SettingsKey.Poe2ClientTxtPath]: string | undefined;
  [SettingsKey.CollectionPath]: string | undefined;

  // Game and league selection
  [SettingsKey.ActiveGame]: Omit<GameVersion, "both"> | undefined;
  [SettingsKey.InstalledGames]: GameVersion | undefined;
  [SettingsKey.SelectedPoe1League]: string;
  [SettingsKey.SelectedPoe2League]: string;

  // Setup and onboarding
  [SettingsKey.OnboardingDismissedBeacons]: string[];
  [SettingsKey.SetupCompleted]: boolean;
  [SettingsKey.SetupStep]: SetupStep;
  [SettingsKey.SetupVersion]: number;

  // Price source selection
  [SettingsKey.SelectedPoe1PriceSource]: PriceSource;
  [SettingsKey.SelectedPoe2PriceSource]: PriceSource;
};

// Settings store keys (string literal union type)
export type SettingsStoreKey = keyof SettingsStoreSchema;

// Default values
export const DEFAULT_SETTINGS: SettingsStoreSchema = {
  [SettingsKey.ReleaseChannel]: "stable" as ReleaseChannels,
  [SettingsKey.AppExitAction]: "minimize-to-tray" as AppExitActions,
  [SettingsKey.AppOpenAtLogin]: false,
  [SettingsKey.AppOpenAtLoginMinimized]: false,
  [SettingsKey.Poe1ClientTxtPath]: undefined,
  [SettingsKey.Poe2ClientTxtPath]: undefined,
  [SettingsKey.CollectionPath]: undefined,
  [SettingsKey.ActiveGame]: undefined,
  [SettingsKey.InstalledGames]: undefined,
  [SettingsKey.SelectedPoe1League]: "Standard",
  [SettingsKey.SelectedPoe2League]: "Standard",
  [SettingsKey.OnboardingDismissedBeacons]: [],
  [SettingsKey.SetupCompleted]: false,
  [SettingsKey.SetupStep]: 0,
  [SettingsKey.SetupVersion]: 1, // Current setup flow version
  [SettingsKey.SelectedPoe1PriceSource]: "exchange",
  [SettingsKey.SelectedPoe2PriceSource]: "exchange",
};
