import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";

import type { SetupStep, UserSettingsDTO } from "./SettingsStore.dto";
import { boolToInt, toDBKey, toUserSettingsDTO } from "./SettingsStore.mapper";

const COMMUNITY_UPLOADS_CONSENT_KEY = "community_uploads_consent_v1";

/**
 * Repository for user settings
 * Handles all database operations for the user_settings table
 */
export class SettingsStoreRepository {
  private _cache: UserSettingsDTO | null = null;

  constructor(private kysely: Kysely<Database>) {}

  /**
   * Get all user settings
   */
  async getAll(): Promise<UserSettingsDTO> {
    if (this._cache !== null) {
      return this._cache;
    }

    const row = await this.kysely
      .selectFrom("user_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();

    const dto = toUserSettingsDTO(row);
    // The legacy column defaulted to 1. Only a completed contribution records
    // the old explicit agreement to share card names and counts.
    const consent = await this.kysely
      .selectFrom("app_metadata")
      .select("value")
      .where("key", "=", COMMUNITY_UPLOADS_CONSENT_KEY)
      .executeTakeFirst();
    const priorContribution =
      row.community_uploads_enabled === 1 && consent === undefined
        ? await this.kysely
            .selectFrom("app_metadata")
            .select("key")
            .where(
              sql<boolean>`"key" GLOB ${"community_backfill_done_poe[12]_?*"}`,
            )
            .where("value", "=", "true")
            .limit(1)
            .executeTakeFirst()
        : undefined;
    dto.communityUploadsEnabled =
      row.community_uploads_enabled === 1 &&
      (consent !== undefined
        ? consent.value === "true"
        : priorContribution !== undefined);
    this._cache = dto;
    return dto;
  }

  /**
   * Get a specific setting by key
   */
  async get<K extends keyof UserSettingsDTO>(
    key: K,
  ): Promise<UserSettingsDTO[K]> {
    if (this._cache !== null) {
      return this._cache[key];
    }
    const settings = await this.getAll();
    return settings[key];
  }

  /**
   * Invalidate the in-memory settings cache.
   * Called after any write operation to ensure subsequent reads reflect the latest data.
   */
  invalidateCache(): void {
    this._cache = null;
  }

  /**
   * Update a specific setting
   */
  async set<K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ): Promise<void> {
    if (key === "communityUploadsEnabled") {
      await this.setMultiple({ communityUploadsEnabled: value as boolean });
      return;
    }
    const dbKey = toDBKey(key);
    let dbValue: any;

    if (typeof value === "boolean") {
      dbValue = boolToInt(value);
    } else if (key === "overlayBounds" && value !== null) {
      dbValue = JSON.stringify(value);
    } else if (key === "mainWindowBounds" && value !== null) {
      dbValue = JSON.stringify(value);
    } else if (key === "onboardingDismissedBeacons") {
      dbValue = JSON.stringify(value);
    } else if (key === "installedGames") {
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

    this.invalidateCache();
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

    const writeSettings = async (database: Kysely<Database>) => {
      await database
        .updateTable("user_settings")
        .set(dbSettings as any)
        .where("id", "=", 1)
        .execute();
      if (typeof settings.communityUploadsEnabled === "boolean") {
        const value = settings.communityUploadsEnabled ? "true" : "false";
        await database
          .insertInto("app_metadata")
          .values({ key: COMMUNITY_UPLOADS_CONSENT_KEY, value })
          .onConflict((conflict) =>
            conflict.column("key").doUpdateSet({ value }),
          )
          .execute();
      }
    };
    if (typeof settings.communityUploadsEnabled === "boolean") {
      await this.kysely.transaction().execute(writeSettings);
    } else {
      await writeSettings(this.kysely);
    }

    this.invalidateCache();
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

  async getInstalledGames(): Promise<("poe1" | "poe2")[]> {
    return this.get("installedGames");
  }

  async setInstalledGames(value: ("poe1" | "poe2")[]): Promise<void> {
    return this.set("installedGames", value);
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

  async getSetupCompleted(): Promise<boolean> {
    return this.get("setupCompleted");
  }

  async setSetupCompleted(value: boolean): Promise<void> {
    return this.set("setupCompleted", value);
  }

  async getSetupStep(): Promise<SetupStep> {
    return this.get("setupStep");
  }

  async setSetupStep(value: SetupStep): Promise<void> {
    return this.set("setupStep", value);
  }

  async getSetupVersion(): Promise<number> {
    return this.get("setupVersion");
  }

  async setSetupVersion(value: number): Promise<void> {
    return this.set("setupVersion", value);
  }
}
