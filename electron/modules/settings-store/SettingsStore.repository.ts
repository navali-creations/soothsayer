import { type Kysely, sql } from "kysely";
import type { Database } from "~/electron/modules/database";
import type { UserSettingsDTO } from "./SettingsStore.dto";
import { boolToInt, toDBKey, toUserSettingsDTO } from "./SettingsStore.mapper";

/**
 * Repository for user settings
 * Handles all database operations for the user_settings table
 */
export class SettingsStoreRepository {
  constructor(private kysely: Kysely<Database>) {}

  /**
   * Get all user settings
   */
  async getAll(): Promise<UserSettingsDTO> {
    const row = await this.kysely
      .selectFrom("user_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();

    return toUserSettingsDTO(row);
  }

  /**
   * Get a specific setting by key
   */
  async get<K extends keyof UserSettingsDTO>(
    key: K,
  ): Promise<UserSettingsDTO[K]> {
    const settings = await this.getAll();
    return settings[key];
  }

  /**
   * Update a specific setting
   */
  async set<K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ): Promise<void> {
    const dbKey = toDBKey(key);
    let dbValue: any;

    if (typeof value === "boolean") {
      dbValue = boolToInt(value);
    } else if (key === "overlayBounds" && value !== null) {
      dbValue = JSON.stringify(value);
    } else if (key === "onboardingDismissedBeacons") {
      dbValue = JSON.stringify(value);
    } else {
      dbValue = value;
    }

    await this.kysely
      .updateTable("user_settings")
      .set({
        [dbKey]: dbValue,
        updated_at: sql`datetime('now')`,
      } as any)
      .where("id", "=", 1)
      .execute();
  }

  /**
   * Update multiple settings at once
   */
  async setMultiple(settings: Partial<UserSettingsDTO>): Promise<void> {
    const dbSettings: Record<string, any> = {};

    for (const [key, value] of Object.entries(settings)) {
      const dbKey = toDBKey(key as keyof UserSettingsDTO);
      dbSettings[dbKey as string] =
        typeof value === "boolean" ? boolToInt(value) : value;
    }

    dbSettings.updated_at = sql`datetime('now')`;

    await this.kysely
      .updateTable("user_settings")
      .set(dbSettings as any)
      .where("id", "=", 1)
      .execute();
  }

  // ============================================================================
  // Convenience methods for specific settings
  // ============================================================================

  async getAppExitAction(): Promise<"exit" | "minimize"> {
    return this.get("appExitAction");
  }

  async setAppExitAction(value: "exit" | "minimize"): Promise<void> {
    return this.set("appExitAction", value);
  }

  async getAppOpenAtLogin(): Promise<boolean> {
    return this.get("appOpenAtLogin");
  }

  async setAppOpenAtLogin(value: boolean): Promise<void> {
    return this.set("appOpenAtLogin", value);
  }

  async getAppOpenAtLoginMinimized(): Promise<boolean> {
    return this.get("appOpenAtLoginMinimized");
  }

  async setAppOpenAtLoginMinimized(value: boolean): Promise<void> {
    return this.set("appOpenAtLoginMinimized", value);
  }

  async getPoe1ClientTxtPath(): Promise<string | null> {
    return this.get("poe1ClientTxtPath");
  }

  async setPoe1ClientTxtPath(value: string | null): Promise<void> {
    return this.set("poe1ClientTxtPath", value);
  }

  async getPoe2ClientTxtPath(): Promise<string | null> {
    return this.get("poe2ClientTxtPath");
  }

  async setPoe2ClientTxtPath(value: string | null): Promise<void> {
    return this.set("poe2ClientTxtPath", value);
  }

  async getSelectedGame(): Promise<"poe1" | "poe2"> {
    return this.get("selectedGame");
  }

  async setSelectedGame(value: "poe1" | "poe2"): Promise<void> {
    return this.set("selectedGame", value);
  }

  async getPoe1SelectedLeague(): Promise<string> {
    return this.get("poe1SelectedLeague");
  }

  async setPoe1SelectedLeague(value: string): Promise<void> {
    return this.set("poe1SelectedLeague", value);
  }

  async getPoe2SelectedLeague(): Promise<string> {
    return this.get("poe2SelectedLeague");
  }

  async setPoe2SelectedLeague(value: string): Promise<void> {
    return this.set("poe2SelectedLeague", value);
  }

  async getPoe1PriceSource(): Promise<"exchange" | "stash"> {
    return this.get("poe1PriceSource");
  }

  async setPoe1PriceSource(value: "exchange" | "stash"): Promise<void> {
    return this.set("poe1PriceSource", value);
  }

  async getPoe2PriceSource(): Promise<"exchange" | "stash"> {
    return this.get("poe2PriceSource");
  }

  async setPoe2PriceSource(value: "exchange" | "stash"): Promise<void> {
    return this.set("poe2PriceSource", value);
  }

  async getSetupCompleted(): Promise<boolean> {
    return this.get("setupCompleted");
  }

  async setSetupCompleted(value: boolean): Promise<void> {
    return this.set("setupCompleted", value);
  }

  async getSetupStep(): Promise<0 | 1 | 2 | 3> {
    return this.get("setupStep");
  }

  async setSetupStep(value: 0 | 1 | 2 | 3): Promise<void> {
    return this.set("setupStep", value);
  }

  async getSetupVersion(): Promise<number> {
    return this.get("setupVersion");
  }

  async setSetupVersion(value: number): Promise<void> {
    return this.set("setupVersion", value);
  }
}
