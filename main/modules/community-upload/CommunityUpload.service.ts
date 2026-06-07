import { app, ipcMain, powerMonitor } from "electron";
import type { Kysely } from "kysely";

import { DatabaseService } from "~/main/modules/database";
import type { Database } from "~/main/modules/database/Database.types";
import { GggAuthService } from "~/main/modules/ggg-auth";
import { captureSentryException } from "~/main/modules/sentry/Sentry.reporter";
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

interface CommunityUploadCard {
  card_name: string;
  count: number;
}

interface UploadOnSessionEndOptions {
  /**
   * When true, queue the upload snapshot and immediately try to process the
   * pending outbox. When false, only persist the outbox row for a later retry
   * such as startup/resume. "Flush" never deletes pending data.
   */
  flush?: boolean;
}

interface PendingUploadRow {
  game: string;
  scope: string;
  cards_json: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
}

interface PreparedPendingUpload {
  cards: CommunityUploadCard[];
  deviceId: string;
}

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

class CommunityUploadService {
  private static _instance: CommunityUploadService;
  private kysely: Kysely<Database>;
  private settingsStore: SettingsStoreService;
  private supabase: SupabaseClientService;
  private sessionUploadJobs = new Map<string, Promise<void>>();
  private flushJobs = new Map<string, Promise<void>>();

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
    this.setupPowerMonitor();
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
        "v2-upload-community-data",
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
      captureSentryException(
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
   * Queue cumulative card data on session end and optionally flush it.
   *
   * In this context, "flush" means "process the pending upload outbox now".
   * It does not mean discard or clear queued data. Sleep/suspend paths use
   * flush=false because the network may disappear immediately; normal session
   * end and app quit paths use flush=true when they can still send.
   *
   * Network failure leaves the local outbox pending for startup/resume retry.
   */
  public uploadOnSessionEnd(
    game: GameType,
    league: string,
    sessionId?: string,
    options: UploadOnSessionEndOptions = {},
  ): Promise<void> {
    const key = this.uploadKey(game, league);
    const previousJob = this.sessionUploadJobs.get(key) ?? Promise.resolve();

    const job = previousJob
      .catch(() => {})
      .then(() =>
        this.uploadOnSessionEndInternal(game, league, sessionId, options),
      )
      .finally(() => {
        if (this.sessionUploadJobs.get(key) === job) {
          this.sessionUploadJobs.delete(key);
        }
      });

    this.sessionUploadJobs.set(key, job);
    return job;
  }

  /**
   * Try to send every due row in the community upload outbox.
   *
   * Successfully sent rows are removed. Failed rows stay queued with retry
   * metadata so startup/resume or a later explicit flush can try again.
   */
  public async flushPendingUploads(): Promise<void> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log("[CommunityUpload] Uploads disabled, skipping flush");
        return;
      }

      if (!this.supabase.isConfigured()) {
        console.log(
          "[CommunityUpload] Supabase not configured, skipping flush",
        );
        return;
      }

      await this.enqueueChangedUploadsForAllLeagues();

      const pendingRows = await this.kysely
        .selectFrom("community_upload_outbox")
        .select([
          "game",
          "scope",
          "cards_json",
          "attempts",
          "last_error",
          "next_attempt_at",
        ])
        .execute();

      const nowMs = Date.now();
      for (const row of pendingRows) {
        if (
          row.next_attempt_at &&
          new Date(row.next_attempt_at).getTime() > nowMs
        ) {
          continue;
        }
        if (row.game !== "poe1" && row.game !== "poe2") {
          await this.recordPendingUploadFailure(
            row,
            new Error(`Invalid outbox game "${row.game}"`),
          );
          continue;
        }
        await this.flushPendingUpload(row.game, row.scope);
      }
    } catch (error) {
      console.error(
        "[CommunityUpload] Failed to flush pending uploads:",
        error instanceof Error ? error.message : String(error),
      );
      captureSentryException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: {
            module: "community-upload",
            operation: "flush-pending-uploads",
          },
        },
      );
    }
  }

  public async drainInFlightUploads(timeoutMs = 5_000): Promise<void> {
    const jobs = [
      ...this.sessionUploadJobs.values(),
      ...this.flushJobs.values(),
    ];
    if (jobs.length === 0) return;

    await Promise.race([
      Promise.allSettled(jobs),
      new Promise<void>((resolve) => {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
  }

  private async uploadOnSessionEndInternal(
    game: GameType,
    league: string,
    sessionId: string | undefined,
    options: UploadOnSessionEndOptions,
  ): Promise<void> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log("[CommunityUpload] Uploads disabled, skipping");
        return;
      }

      if (!this.supabase.isConfigured()) {
        console.log(
          "[CommunityUpload] Supabase not configured, skipping upload",
        );
        return;
      }

      const deviceId = await this.getDeviceId();
      const changedCards = await this.getChangedCards(game, league, sessionId);

      if (changedCards.length === 0) {
        console.log(
          `[CommunityUpload] No changes since last upload for ${game}/${league}, skipping`,
        );
        return;
      }

      const queuedCards = await this.enqueuePendingUpload(
        game,
        league,
        changedCards,
      );

      if (options.flush === false) {
        console.log(
          `[CommunityUpload] Queued ${changedCards.length} card(s) for ${game}/${league}; flush deferred`,
        );
        return;
      }

      await this.flushPendingUpload(game, league, {
        cards: queuedCards,
        deviceId,
      });
    } catch (error) {
      console.error(
        "[CommunityUpload] Upload failed:",
        error instanceof Error ? error.message : String(error),
      );
      captureSentryException(
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

  private async flushPendingUpload(
    game: GameType,
    league: string,
    prepared?: PreparedPendingUpload,
  ): Promise<void> {
    const key = this.uploadKey(game, league);
    const existing = this.flushJobs.get(key);
    if (existing) return existing;

    const job = (
      prepared
        ? this.flushPreparedPendingUpload(game, league, prepared)
        : this.flushPendingUploadLoop(game, league)
    ).finally(() => {
      if (this.flushJobs.get(key) === job) {
        this.flushJobs.delete(key);
      }
    });

    this.flushJobs.set(key, job);
    return job;
  }

  private async flushPendingUploadLoop(
    game: GameType,
    league: string,
  ): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      const result = await this.flushPendingUploadOnce(game, league);
      if (result !== "changed") return;
    }
  }

  private async flushPendingUploadOnce(
    game: GameType,
    league: string,
  ): Promise<"done" | "changed" | "missing" | "retry-later"> {
    const row = await this.kysely
      .selectFrom("community_upload_outbox")
      .select([
        "game",
        "scope",
        "cards_json",
        "attempts",
        "last_error",
        "next_attempt_at",
      ])
      .where("game", "=", game)
      .where("scope", "=", league)
      .executeTakeFirst();

    if (!row) return "missing";

    if (
      row.next_attempt_at &&
      new Date(row.next_attempt_at).getTime() > Date.now()
    ) {
      return "retry-later";
    }

    try {
      const cardEntries = this.parseOutboxCards(row);
      if (cardEntries.length === 0) {
        await this.deletePendingUpload(game, league);
        return "done";
      }

      const deviceId = await this.getDeviceId();
      await this.sendPendingUpload(game, league, cardEntries, deviceId);

      const latest = await this.kysely
        .selectFrom("community_upload_outbox")
        .select("cards_json")
        .where("game", "=", game)
        .where("scope", "=", league)
        .executeTakeFirst();

      if (!latest || latest.cards_json === row.cards_json) {
        await this.deletePendingUpload(game, league);
        return "done";
      }

      return "changed";
    } catch (error) {
      console.error(
        "[CommunityUpload] Pending upload failed:",
        error instanceof Error ? error.message : String(error),
      );
      await this.recordPendingUploadFailure(row, error);
      captureSentryException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: {
            module: "community-upload",
            operation: "flush-pending-upload",
          },
          extra: { game, league },
        },
      );
      return "retry-later";
    }
  }

  private async flushPreparedPendingUpload(
    game: GameType,
    league: string,
    prepared: PreparedPendingUpload,
  ): Promise<void> {
    try {
      await this.sendPendingUpload(
        game,
        league,
        prepared.cards,
        prepared.deviceId,
      );

      const latest = await this.kysely
        .selectFrom("community_upload_outbox")
        .select("cards_json")
        .where("game", "=", game)
        .where("scope", "=", league)
        .executeTakeFirst();

      const preparedJson = JSON.stringify(prepared.cards);
      if (!latest || latest.cards_json === preparedJson) {
        await this.deletePendingUpload(game, league);
      }
    } catch (error) {
      const row = await this.kysely
        .selectFrom("community_upload_outbox")
        .select([
          "game",
          "scope",
          "cards_json",
          "attempts",
          "last_error",
          "next_attempt_at",
        ])
        .where("game", "=", game)
        .where("scope", "=", league)
        .executeTakeFirst();

      if (
        row &&
        typeof row.game === "string" &&
        typeof row.scope === "string" &&
        typeof row.attempts === "number"
      ) {
        await this.recordPendingUploadFailure(row, error);
      }

      console.error(
        "[CommunityUpload] Pending upload failed:",
        error instanceof Error ? error.message : String(error),
      );
      captureSentryException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: {
            module: "community-upload",
            operation: "flush-pending-upload",
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
          captureSentryException(
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
      captureSentryException(
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

  private async sendPendingUpload(
    game: GameType,
    league: string,
    cardEntries: CommunityUploadCard[],
    deviceId: string,
  ): Promise<void> {
    let gggAccessToken: string | null = null;
    try {
      gggAccessToken = await GggAuthService.getInstance().getAccessToken();
    } catch (_error) {
      console.log(
        "[CommunityUpload] GGG token unavailable, uploading anonymously",
      );
    }

    console.log(
      `[CommunityUpload] Uploading ${cardEntries.length} unique cards for ${game}/${league}` +
        (gggAccessToken ? " (verified)" : " (anonymous)"),
    );

    const payload: Record<string, unknown> = {
      league_name: league,
      game,
      device_id: deviceId,
      cards: cardEntries,
      is_packaged: app.isPackaged,
    };

    const extraHeaders: Record<string, string> = {};
    if (gggAccessToken) {
      extraHeaders["X-GGG-Token"] = gggAccessToken;
    }

    const result = await this.supabase.callEdgeFunction<{
      success: boolean;
      upload_id: string;
      total_cards: number;
      unique_cards: number;
      upload_count: number;
      is_verified: boolean;
    }>("v2-upload-community-data", payload, extraHeaders);

    console.log(
      `[CommunityUpload] Upload successful: ${result.unique_cards} unique cards (${cardEntries.length} changed), upload #${result.upload_count}`,
    );

    for (const card of cardEntries) {
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

    const now = new Date().toISOString();
    await this.kysely
      .insertInto("app_metadata")
      .values({ key: "community_last_upload_at", value: now })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: now }))
      .execute();

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
  }

  private async enqueueChangedUploadsForAllLeagues(): Promise<void> {
    const leagues = await this.kysely
      .selectFrom("cards")
      .select(["game", "scope"])
      .where("scope", "!=", "all-time")
      .where("count", ">", 0)
      .groupBy(["game", "scope"])
      .execute();

    for (const { game, scope } of leagues) {
      if (game !== "poe1" && game !== "poe2") continue;
      await this.uploadOnSessionEnd(game, scope, undefined, { flush: false });
    }
  }

  private setupPowerMonitor(): void {
    powerMonitor.on("resume", () => {
      console.log("[CommunityUpload] System resumed, flushing pending uploads");
      void this.flushPendingUploads();
    });
  }

  private uploadKey(game: GameType, league: string): string {
    return `${game}:${league}`;
  }

  private async getChangedCards(
    game: GameType,
    league: string,
    sessionId?: string,
  ): Promise<CommunityUploadCard[]> {
    const cards = await this.kysely
      .selectFrom("cards")
      .select(["card_name", "count"])
      .where("game", "=", game)
      .where("scope", "=", league)
      .execute();

    if (cards.length === 0) {
      console.log("[CommunityUpload] No cards to upload for", game, league);
      return [];
    }

    const snapshot = await this.kysely
      .selectFrom("community_upload_snapshot")
      .select(["card_name", "count"])
      .where("game", "=", game)
      .where("scope", "=", league)
      .execute();

    const snapshotMap = new Map(snapshot.map((s) => [s.card_name, s.count]));
    const currentCountMap = new Map(cards.map((c) => [c.card_name, c.count]));

    const sessionCards = sessionId
      ? await this.kysely
          .selectFrom("session_cards")
          .select(["card_name", "count"])
          .where("session_id", "=", sessionId)
          .execute()
      : [];

    // Upload current local increases, plus new drops from the just-finished
    // session even when older local sessions were deleted after upload.
    const changedCardMap = new Map<string, number>();
    for (const c of cards) {
      const prev = snapshotMap.get(c.card_name);
      if (prev === undefined || c.count > prev) {
        changedCardMap.set(c.card_name, c.count);
      }
    }

    for (const card of sessionCards) {
      const prev = snapshotMap.get(card.card_name) ?? 0;
      const current = currentCountMap.get(card.card_name) ?? 0;
      const previousLocalCount = Math.max(current - card.count, 0);
      const observedCount = Math.max(prev, previousLocalCount) + card.count;

      if (observedCount > prev) {
        changedCardMap.set(
          card.card_name,
          Math.max(changedCardMap.get(card.card_name) ?? 0, observedCount),
        );
      }
    }

    return Array.from(changedCardMap, ([card_name, count]) => ({
      card_name,
      count,
    }));
  }

  private async enqueuePendingUpload(
    game: GameType,
    league: string,
    cards: CommunityUploadCard[],
  ): Promise<CommunityUploadCard[]> {
    const existing = await this.kysely
      .selectFrom("community_upload_outbox")
      .select("cards_json")
      .where("game", "=", game)
      .where("scope", "=", league)
      .executeTakeFirst();

    const merged = new Map<string, number>();
    if (typeof existing?.cards_json === "string") {
      for (const card of this.parseOutboxCards({
        game,
        scope: league,
        cards_json: existing.cards_json,
        attempts: 0,
        last_error: null,
        next_attempt_at: null,
      })) {
        merged.set(card.card_name, card.count);
      }
    }

    for (const card of cards) {
      merged.set(
        card.card_name,
        Math.max(merged.get(card.card_name) ?? 0, card.count),
      );
    }

    const queuedCards = Array.from(merged, ([card_name, count]) => ({
      card_name,
      count,
    }));
    const cardsJson = JSON.stringify(queuedCards);
    const now = new Date().toISOString();

    await this.kysely
      .insertInto("community_upload_outbox")
      .values({
        game,
        scope: league,
        cards_json: cardsJson,
        next_attempt_at: now,
        last_error: null,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["game", "scope"]).doUpdateSet({
          cards_json: cardsJson,
          last_error: null,
          next_attempt_at: now,
          updated_at: now,
        }),
      )
      .execute();

    return queuedCards;
  }

  private parseOutboxCards(row: PendingUploadRow): CommunityUploadCard[] {
    const parsed = JSON.parse(row.cards_json) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Pending upload cards_json must be an array");
    }

    return parsed.map((card, index) => {
      if (
        !card ||
        typeof card !== "object" ||
        typeof (card as Record<string, unknown>).card_name !== "string" ||
        typeof (card as Record<string, unknown>).count !== "number" ||
        !Number.isInteger((card as Record<string, unknown>).count) ||
        ((card as Record<string, unknown>).count as number) <= 0
      ) {
        throw new Error(`Pending upload card at index ${index} is invalid`);
      }

      return {
        card_name: (card as { card_name: string }).card_name,
        count: (card as { count: number }).count,
      };
    });
  }

  private async recordPendingUploadFailure(
    row: PendingUploadRow,
    error: unknown,
  ): Promise<void> {
    const attempts = row.attempts + 1;
    const delay =
      RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
    const now = Date.now();

    await this.kysely
      .updateTable("community_upload_outbox")
      .set({
        attempts,
        last_error: error instanceof Error ? error.message : String(error),
        next_attempt_at: new Date(now + delay).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .where("game", "=", row.game)
      .where("scope", "=", row.scope)
      .execute();
  }

  private async deletePendingUpload(
    game: GameType,
    league: string,
  ): Promise<void> {
    await this.kysely
      .deleteFrom("community_upload_outbox")
      .where("game", "=", game)
      .where("scope", "=", league)
      .execute();
  }

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
