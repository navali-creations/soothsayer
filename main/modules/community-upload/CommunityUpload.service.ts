import * as Sentry from "@sentry/electron/main";
import { app, ipcMain } from "electron";
import type { Kysely } from "kysely";

import { DatabaseService } from "~/main/modules/database";
import type { Database } from "~/main/modules/database/Database.types";
import { GggAuthService } from "~/main/modules/ggg-auth";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import { SupabaseClientService } from "~/main/modules/supabase";
import {
  assertBoolean,
  assertBoundedString,
  assertGameType,
  assertTrustedSender,
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
      async (event, enabled: unknown) => {
        try {
          assertTrustedSender(event, CommunityUploadChannel.SetUploadsEnabled);
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
    ipcMain.handle(CommunityUploadChannel.GetBackfillLeagues, async () => {
      try {
        return await this.getBackfillLeagues();
      } catch (error) {
        return handleValidationError(
          error,
          CommunityUploadChannel.GetBackfillLeagues,
        );
      }
    });

    ipcMain.handle(CommunityUploadChannel.TriggerBackfill, async (event) => {
      try {
        assertTrustedSender(event, CommunityUploadChannel.TriggerBackfill);
        await this.backfillIfNeeded();
        return { success: true };
      } catch (error) {
        return handleValidationError(
          error,
          CommunityUploadChannel.TriggerBackfill,
        );
      }
    });
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
   * Get the list of leagues that have local data but haven't been backfilled yet.
   */
  public async getBackfillLeagues(): Promise<
    { game: string; league: string }[]
  > {
    const enabled = await this.isEnabled();
    if (!enabled) return [];

    if (!this.supabase.isConfigured()) return [];

    const leagues = await this.kysely
      .selectFrom("cards")
      .select(["game", "scope"])
      .where("scope", "!=", "all-time")
      .where("count", ">", 0)
      .groupBy(["game", "scope"])
      .execute();

    const result: { game: string; league: string }[] = [];
    for (const { game, scope } of leagues) {
      const backfillKey = `community_backfill_done_${game}_${scope}`;
      const done = await this.kysely
        .selectFrom("app_metadata")
        .select("value")
        .where("key", "=", backfillKey)
        .executeTakeFirst();
      if (!done) {
        result.push({ game, league: scope });
      }
    }
    return result;
  }

  /**
   * Link GGG account to all existing community upload records for this device.
   * Called after successful GGG OAuth. Fire-and-forget — errors are logged, never thrown.
   */
  public async linkGggAccount(): Promise<void> {
    try {
      if (!this.supabase.isConfigured()) {
        console.log(
          "[CommunityUpload] Supabase not configured, skipping GGG link",
        );
        return;
      }

      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log("[CommunityUpload] Uploads disabled, skipping GGG link");
        return;
      }

      const deviceId = await this.getDeviceId();

      let gggAccessToken: string | null = null;
      try {
        gggAccessToken = await GggAuthService.getInstance().getAccessToken();
      } catch {
        console.warn(
          "[CommunityUpload] Could not get GGG access token for link",
        );
        return;
      }

      if (!gggAccessToken) {
        console.warn(
          "[CommunityUpload] No GGG access token available for link",
        );
        return;
      }

      const result = await this.supabase.callEdgeFunction<{
        success: boolean;
        ggg_username: string;
        ggg_uuid: string;
        updated_records: number;
      }>(
        "upload-community-data",
        {
          action: "link-ggg",
          device_id: deviceId,
          is_packaged: app.isPackaged,
        },
        { "X-GGG-Token": gggAccessToken },
      );

      console.log(
        `[CommunityUpload] GGG account linked: ${result.ggg_username} — ${result.updated_records} record(s) updated`,
      );
    } catch (error) {
      // Fire-and-forget — don't break the auth flow
      console.error("[CommunityUpload] Failed to link GGG account:", error);
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: { module: "community-upload", operation: "link-ggg" },
        },
      );
    }
  }

  /**
   * Check if community uploads are enabled.
   *
   * Uploads default to enabled (opt-out model). The privacy policy change is
   * communicated via the "What's New" modal, and users can disable uploads
   * at any time in Settings → Privacy.
   */
  public async isEnabled(): Promise<boolean> {
    const enabled = await this.settingsStore.get(
      SettingsKey.CommunityUploadsEnabled,
    );
    // Only disabled when the user has explicitly toggled it off
    return enabled !== false;
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

      // Get the last-uploaded snapshot to compute delta
      const snapshot = await this.kysely
        .selectFrom("community_upload_snapshot")
        .select(["card_name", "count"])
        .where("game", "=", game)
        .where("scope", "=", league)
        .execute();

      const snapshotMap = new Map(snapshot.map((s) => [s.card_name, s.count]));

      // Only upload cards that are new or have increased counts
      const changedCards = cards.filter((c) => {
        const prev = snapshotMap.get(c.card_name);
        return prev === undefined || c.count > prev;
      });

      if (changedCards.length === 0) {
        console.log("[CommunityUpload] No changes since last upload, skipping");
        return;
      }

      // Format changed cards for the edge function (still sends cumulative counts — server uses GREATEST)
      const cardEntries = changedCards.map((c) => ({
        card_name: c.card_name,
        count: c.count,
      }));

      // Attempt to get GGG access token for verified upload (non-fatal if unavailable)
      let gggAccessToken: string | null = null;
      try {
        gggAccessToken = await GggAuthService.getInstance().getAccessToken();
      } catch (_error) {
        // GGG auth failure is non-fatal — proceed as anonymous upload
        console.log(
          "[CommunityUpload] GGG token unavailable, uploading anonymously",
        );
      }

      console.log(
        `[CommunityUpload] Uploading ${cardEntries.length} unique cards for ${game}/${league}` +
          (gggAccessToken ? " (verified)" : " (anonymous)"),
      );

      // Build the edge function payload
      const payload: Record<string, unknown> = {
        league_name: league,
        game,
        device_id: deviceId,
        cards: cardEntries,
        is_packaged: app.isPackaged,
      };

      // Pass GGG token as a header rather than in the body
      const extraHeaders: Record<string, string> = {};
      if (gggAccessToken) {
        extraHeaders["X-GGG-Token"] = gggAccessToken;
      }

      // Call the edge function with league_name + game (not UUID)
      const result = await this.supabase.callEdgeFunction<{
        success: boolean;
        upload_id: string;
        total_cards: number;
        unique_cards: number;
        upload_count: number;
        is_verified: boolean;
      }>("upload-community-data", payload, extraHeaders);

      console.log(
        `[CommunityUpload] Upload successful: ${result.unique_cards} unique cards (${changedCards.length} changed), upload #${result.upload_count}`,
      );

      // Persist snapshot of uploaded counts for delta computation on next upload
      for (const card of changedCards) {
        await this.kysely
          .insertInto("community_upload_snapshot")
          .values({
            game,
            scope: league,
            card_name: card.card_name,
            count: card.count,
          })
          .onConflict((oc) =>
            oc
              .columns(["game", "scope", "card_name"])
              .doUpdateSet({ count: card.count }),
          )
          .execute();
      }

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
      console.error(
        "[CommunityUpload] Upload failed:",
        error instanceof Error ? error.message : String(error),
      );
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

  /**
   * Backfill community uploads for leagues that have local data but were never
   * uploaded. Runs once per (game, scope) pair at startup. Fire-and-forget.
   */
  public async backfillIfNeeded(): Promise<void> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log("[CommunityUpload] Uploads disabled, skipping backfill");
        return;
      }

      if (!this.supabase.isConfigured()) {
        console.log(
          "[CommunityUpload] Supabase not configured, skipping backfill",
        );
        return;
      }

      const leagues = await this.kysely
        .selectFrom("cards")
        .select(["game", "scope"])
        .where("scope", "!=", "all-time")
        .where("count", ">", 0)
        .groupBy(["game", "scope"])
        .execute();

      for (const { game, scope } of leagues) {
        try {
          const backfillKey = `community_backfill_done_${game}_${scope}`;

          const existing = await this.kysely
            .selectFrom("app_metadata")
            .select("value")
            .where("key", "=", backfillKey)
            .executeTakeFirst();

          if (existing) {
            console.log(
              `[CommunityUpload] Backfill already done for ${game}/${scope}, skipping`,
            );
            continue;
          }

          await this.uploadOnSessionEnd(game as GameType, scope);

          await this.kysely
            .insertInto("app_metadata")
            .values({ key: backfillKey, value: "true" })
            .onConflict((oc) => oc.column("key").doUpdateSet({ value: "true" }))
            .execute();

          console.log(
            `[CommunityUpload] Backfill complete for ${game}/${scope}`,
          );
        } catch (error) {
          console.error(
            `[CommunityUpload] Backfill failed for ${game}/${scope}:`,
            error instanceof Error ? error.message : String(error),
          );
          Sentry.captureException(
            error instanceof Error ? error : new Error(String(error)),
            {
              tags: {
                module: "community-upload",
                operation: "backfill",
              },
              extra: { game, scope },
            },
          );
        }
      }
    } catch (error) {
      console.error("[CommunityUpload] Backfill failed:", error);
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: {
            module: "community-upload",
            operation: "backfill",
          },
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
