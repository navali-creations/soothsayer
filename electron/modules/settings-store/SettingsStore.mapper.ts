import type { UserSettingsTable } from "~/electron/modules/database";
import type {
  AppSettingsDTO,
  Poe1SettingsDTO,
  Poe2SettingsDTO,
  SetupSettingsDTO,
  UserSettingsDTO,
} from "./SettingsStore.dto";

/**
 * Mappers convert between database rows and DTOs
 */

/**
 * Map database row to full UserSettingsDTO
 */
export function toUserSettingsDTO(row: UserSettingsTable): UserSettingsDTO {
  return {
    appExitAction: row.app_exit_action as "exit" | "minimize",
    appOpenAtLogin: Boolean(row.app_open_at_login),
    appOpenAtLoginMinimized: Boolean(row.app_open_at_login_minimized),
    onboardingDismissedBeacons: row.onboarding_dismissed_beacons
      ? JSON.parse(row.onboarding_dismissed_beacons)
      : [],
    overlayBounds: row.overlay_bounds ? JSON.parse(row.overlay_bounds) : null,
    poe1ClientTxtPath: row.poe1_client_txt_path,
    poe1SelectedLeague: row.poe1_selected_league,
    poe1PriceSource: row.poe1_price_source as "exchange" | "stash",
    poe2ClientTxtPath: row.poe2_client_txt_path,
    poe2SelectedLeague: row.poe2_selected_league,
    poe2PriceSource: row.poe2_price_source as "exchange" | "stash",
    selectedGame: row.selected_game as "poe1" | "poe2",
    setupCompleted: Boolean(row.setup_completed),
    setupStep: row.setup_step as 0 | 1 | 2 | 3,
    setupVersion: row.setup_version,
  };
}

/**
 * Map database row to app-specific settings
 */
export function toAppSettingsDTO(row: UserSettingsTable): AppSettingsDTO {
  return {
    exitAction: row.app_exit_action as "exit" | "minimize",
    openAtLogin: Boolean(row.app_open_at_login),
    openAtLoginMinimized: Boolean(row.app_open_at_login_minimized),
  };
}

/**
 * Map database row to PoE1-specific settings
 */
export function toPoe1SettingsDTO(row: UserSettingsTable): Poe1SettingsDTO {
  return {
    clientTxtPath: row.poe1_client_txt_path,
    selectedLeague: row.poe1_selected_league,
    priceSource: row.poe1_price_source as "exchange" | "stash",
  };
}

/**
 * Map database row to PoE2-specific settings
 */
export function toPoe2SettingsDTO(row: UserSettingsTable): Poe2SettingsDTO {
  return {
    clientTxtPath: row.poe2_client_txt_path,
    selectedLeague: row.poe2_selected_league,
    priceSource: row.poe2_price_source as "exchange" | "stash",
  };
}

/**
 * Map database row to setup settings
 */
export function toSetupSettingsDTO(row: UserSettingsTable): SetupSettingsDTO {
  return {
    completed: Boolean(row.setup_completed),
    step: row.setup_step as 0 | 1 | 2 | 3,
    version: row.setup_version,
  };
}

/**
 * Map DTO key to database column name
 */
export function toDBKey(key: keyof UserSettingsDTO): keyof UserSettingsTable {
  const mapping: Record<keyof UserSettingsDTO, keyof UserSettingsTable> = {
    appExitAction: "app_exit_action",
    appOpenAtLogin: "app_open_at_login",
    appOpenAtLoginMinimized: "app_open_at_login_minimized",
    onboardingDismissedBeacons: "onboarding_dismissed_beacons",
    overlayBounds: "overlay_bounds",
    poe1ClientTxtPath: "poe1_client_txt_path",
    poe1SelectedLeague: "poe1_selected_league",
    poe1PriceSource: "poe1_price_source",
    poe2ClientTxtPath: "poe2_client_txt_path",
    poe2SelectedLeague: "poe2_selected_league",
    poe2PriceSource: "poe2_price_source",
    selectedGame: "selected_game",
    setupCompleted: "setup_completed",
    setupStep: "setup_step",
    setupVersion: "setup_version",
  };
  return mapping[key];
}

/**
 * Convert boolean to SQLite integer
 */
export function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}
