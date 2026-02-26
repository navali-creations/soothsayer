/**
 * Data Transfer Objects for SettingsStore module
 */

import type { RaritySource } from "~/types/data-stores";

export interface UserSettingsDTO {
  appExitAction: "exit" | "minimize";
  appOpenAtLogin: boolean;
  appOpenAtLoginMinimized: boolean;
  onboardingDismissedBeacons: string[];
  overlayBounds: { x: number; y: number; width: number; height: number } | null;
  poe1ClientTxtPath: string | null;
  poe1SelectedLeague: string;
  poe1PriceSource: "exchange" | "stash";
  poe2ClientTxtPath: string | null;
  poe2SelectedLeague: string;
  poe2PriceSource: "exchange" | "stash";
  selectedGame: "poe1" | "poe2";
  installedGames: ("poe1" | "poe2")[];
  setupCompleted: boolean;
  setupStep: SetupStep;
  setupVersion: number;
  audioEnabled: boolean;
  audioVolume: number;
  audioRarity1Path: string | null;
  audioRarity2Path: string | null;
  audioRarity3Path: string | null;
  raritySource: RaritySource;
  selectedFilterId: string | null;
  lastSeenAppVersion: string | null;
  overlayFontSize: number;
  overlayToolbarFontSize: number;
  mainWindowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

/**
 * Setup step type (0 = not started, 1-3 = steps)
 */
export type SetupStep = 0 | 1 | 2 | 3;

/**
 * App-specific settings group
 */
export interface AppSettingsDTO {
  exitAction: "exit" | "minimize";
  openAtLogin: boolean;
  openAtLoginMinimized: boolean;
}

/**
 * PoE1-specific settings group
 */
export interface Poe1SettingsDTO {
  clientTxtPath: string | null;
  selectedLeague: string;
  priceSource: "exchange" | "stash";
}

/**
 * PoE2-specific settings group
 */
export interface Poe2SettingsDTO {
  clientTxtPath: string | null;
  selectedLeague: string;
  priceSource: "exchange" | "stash";
}

/**
 * Setup and onboarding settings
 */
export interface SetupSettingsDTO {
  completed: boolean;
  step: SetupStep;
  version: number;
}

/**
 * Detected custom sound file info
 */
export interface CustomSoundFile {
  filename: string;
  fullPath: string;
}
