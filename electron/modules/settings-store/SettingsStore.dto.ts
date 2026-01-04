/**
 * Data Transfer Objects for SettingsStore module
 */

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
  setupCompleted: boolean;
  setupStep: SetupStep;
  setupVersion: number;
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
