import * as Sentry from "@sentry/electron/main";
import { ipcMain } from "electron";
import type { Kysely } from "kysely";

import { DatabaseService } from "~/main/modules/database";
import type { Database } from "~/main/modules/database/Database.types";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import { SupabaseClientService } from "~/main/modules/supabase";
import {
  assertBoolean,
  assertBoundedString,
  assertGameType,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import type { GameType } from "../../../types/data-stores";
import { CommunityUploadChannel } from "./CommunityUpload.channels";

class CommunityUploadService {
  private static _instance: CommunityUploadService;
  private kysely: Kysely<Database>;
  private settingsStore: SettingsStoreService;
  private supabase: SupabaseClientService;

  static getInstance(): CommunityUploadService {
    if (!CommunityUploadService._instance) {
      CommunityUploadService._instance = new CommunityUploadService();
    }
    return CommunityUploadService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.kysely = db.getKysely();
    this.settingsStore = SettingsStoreService.getInstance();
    this.supabase = SupabaseClientService.getInstance();
    this.setupHandlers();
  }

  // ─── IPC Handlers ──────────────────────────────────────────────────────

  private setupHandlers(): void {
    ipcMain.handle(CommunityUploadChannel.GetUploadStatus, async () => {
      try {
        const enabled = await this.isEnabled();
        const deviceId = await this.getDeviceId();

        const lastUploadRow = await this.kysely
          .selectFrom("app_metadata")
          .select("value")
          .where("key", "=", "community_last_upload_at")
          .executeTakeFirst();

        return {
          enabled,
          deviceId,
          lastUploadAt: lastUploadRow?.value ?? null,
        };
      } catch (error) {
        return handleValidationError(
          error,
          CommunityUploadChannel.GetUploadStatus,
        );
      }
    });

    ipcMain.handle(
      CommunityUploadChannel.SetUploadsEnabled,
      async (_event, enabled: unknown) => {
        try {
          assertBoolean(
            enabled,
            "enabled",
            CommunityUploadChannel.SetUploadsEnabled,
          );

          await this.settingsStore.set(
            SettingsKey.CommunityUploadsEnabled,
            enabled,
          );

          return { success: true };
        } catch (error) {
          return handleValidationError(
            error,
            CommunityUploadChannel.SetUploadsEnabled,
          );
        }
      },
    );

    ipcMain.handle(
      CommunityUploadChannel.GetUploadStats,
      async (_event, game: unknown, league: unknown) => {
        try {
          assertGameType(game, CommunityUploadChannel.GetUploadStats);
          assertBoundedString(
            league,
            "league",
            CommunityUploadChannel.GetUploadStats,
            256,
          );

          return await this.getUploadStats(game, league);
        } catch (error) {
          return handleValidationError(
            error,
            CommunityUploadChannel.GetUploadStats,
          );
        }
      },
    );
  }

  // ─── Public Methods ────────────────────────────────────────────────────

  /**
   * Get the device_id from the app_metadata table
   */
  public async getDeviceId(): Promise<string> {
    const row = await this.kysely
      .selectFrom("app_metadata")
      .select("value")
      .where("key", "=", "device_id")
      .executeTakeFirst();

    if (!row) {
      throw new Error("device_id not found in app_metadata");
    }
    return row.value;
  }

  /**
   * Check if community uploads are enabled
   */
  public async isEnabled(): Promise<boolean> {
    const enabled = await this.settingsStore.get(
      SettingsKey.CommunityUploadsEnabled,
    );
    return enabled !== false; // Default to true if not set
  }

  /**
   * Upload cumulative card data on session end.
   * Fire-and-forget — errors are logged but never thrown to caller.
   */
  public async uploadOnSessionEnd(
    game: GameType,
    league: string,
  ): Promise<void> {
    try {
      // Check if uploads are enabled
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log("[CommunityUpload] Uploads disabled, skipping");
        return;
      }

      // Check if Supabase is configured
      if (!this.supabase.isConfigured()) {
        console.log(
          "[CommunityUpload] Supabase not configured, skipping upload",
        );
        return;
      }

      // Get device ID
      const deviceId = await this.getDeviceId();

      // Get cumulative card counts for this league from local SQLite
      const cards = await this.kysely
        .selectFrom("cards")
        .select(["card_name", "count"])
        .where("game", "=", game)
        .where("scope", "=", league)
        .execute();

      if (cards.length === 0) {
        console.log("[CommunityUpload] No cards to upload for", game, league);
        return;
      }

      // Format cards for the edge function
      const cardEntries = cards.map((c) => ({
        card_name: c.card_name,
        count: c.count,
      }));

      console.log(
        `[CommunityUpload] Uploading ${cardEntries.length} unique cards for ${game}/${league}`,
      );

      // Call the edge function with league_name + game (not UUID)
      const result = await this.supabase.callEdgeFunction<{
        success: boolean;
        upload_id: string;
        total_cards: number;
        unique_cards: number;
        upload_count: number;
        is_verified: boolean;
      }>("upload-community-data", {
        league_name: league,
        game,
        device_id: deviceId,
        cards: cardEntries,
      });

      console.log(
        `[CommunityUpload] Upload successful: ${result.unique_cards} unique cards, upload #${result.upload_count}`,
      );

      // Store last upload time
      const now = new Date().toISOString();
      await this.kysely
        .insertInto("app_metadata")
        .values({ key: "community_last_upload_at", value: now })
        .onConflict((oc) => oc.column("key").doUpdateSet({ value: now }))
        .execute();

      // Store upload count for this league
      const leagueKey = `community_upload_count_${game}_${league}`;
      await this.kysely
        .insertInto("app_metadata")
        .values({
          key: leagueKey,
          value: String(result.upload_count),
        })
        .onConflict((oc) =>
          oc.column("key").doUpdateSet({
            value: String(result.upload_count),
          }),
        )
        .execute();
    } catch (error) {
      // Fire-and-forget: log but don't throw
      console.error("[CommunityUpload] Upload failed:", error);
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: {
            module: "community-upload",
            operation: "upload-on-session-end",
          },
          extra: { game, league },
        },
      );
    }
  }

  // ─── Private Methods ───────────────────────────────────────────────────

  private async getUploadStats(
    game: GameType,
    league: string,
  ): Promise<{ totalUploads: number; lastUploadAt: string | null }> {
    const leagueKey = `community_upload_count_${game}_${league}`;

    const [countRow, lastUploadRow] = await Promise.all([
      this.kysely
        .selectFrom("app_metadata")
        .select("value")
        .where("key", "=", leagueKey)
        .executeTakeFirst(),
      this.kysely
        .selectFrom("app_metadata")
        .select("value")
        .where("key", "=", "community_last_upload_at")
        .executeTakeFirst(),
    ]);

    return {
      totalUploads: countRow ? parseInt(countRow.value, 10) : 0,
      lastUploadAt: lastUploadRow?.value ?? null,
    };
  }
}

export { CommunityUploadService };
