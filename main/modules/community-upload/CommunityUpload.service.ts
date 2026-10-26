import { app, BrowserWindow, ipcMain, powerMonitor } from "electron";
import type { Kysely } from "kysely";

import { DatabaseService } from "~/main/modules/database";
import type { Database } from "~/main/modules/database/Database.types";
import { GggAuthService } from "~/main/modules/ggg-auth";
import { captureSentryException } from "~/main/modules/sentry/Sentry.reporter";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  EdgeFunctionError,
  SupabaseClientService,
} from "~/main/modules/supabase";
import {
  assertTrustedSender,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import type { GameType } from "../../../types/data-stores";
import { CommunityUploadChannel } from "./CommunityUpload.channels";
import type {
  CommunityBackfillLeague,
  CommunityBackfillLeaguesResult,
  CommunityBackfillResult,
  CommunityDropContextUploadStatus,
  CommunityDropContextUploadStatusResult,
} from "./CommunityUpload.dto";
import { CommunityUploadRepository } from "./CommunityUpload.repository";

interface CommunityUploadCard {
  card_name: string;
  count: number;
}

interface CommunityDropEvent {
  event_id: string;
  card_name: string;
  location: string;
  local_minute: number;
  utc_offset_minutes: number;
}

interface UploadOnSessionEndOptions {
  /**
   * When true, queue the upload snapshot and immediately try to process the
   * pending outbox. When false, only persist the outbox row for a later retry
   * such as startup/resume. "Flush" never deletes pending data.
   */
  flush?: boolean;

  /**
   * Re-throw preparation failures after logging them. Interactive backfill
   * uses this to avoid marking a league complete when no durable outbox row
   * was created; background session uploads retain fire-and-forget behavior.
   */
  throwOnFailure?: boolean;
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

type UploadQueueResult = { success: true } | { success: false; error: Error };

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const DROP_EVENT_RATE_WINDOW_MS = 60 * 60_000;
const DROP_EVENT_MAX_REQUESTS_PER_WINDOW = 240;
const COMMUNITY_BACKFILL_ERROR =
  "Community data could not be queued. Please try again.";

function toSafeIpcFailure(
  error: unknown,
  channel: CommunityUploadChannel,
): { success: false; error: string } {
  try {
    return handleValidationError(error, channel);
  } catch (unexpectedError) {
    console.error(`[CommunityUpload] ${channel} failed:`, unexpectedError);
    return { success: false, error: COMMUNITY_BACKFILL_ERROR };
  }
}

class CommunityUploadService {
  private static _instance: CommunityUploadService;
  private kysely: Kysely<Database>;
  private settingsStore: SettingsStoreService;
  private supabase: SupabaseClientService;
  private repository: CommunityUploadRepository;
  private sessionUploadJobs = new Map<string, Promise<UploadQueueResult>>();
  private pendingUploadsFlushJob: Promise<void> | null = null;
  private flushJobs = new Map<string, Promise<void>>();
  private eventFlushJobs = new Map<string, Promise<void>>();
  private eventRateWindowStartedAt = 0;
  private eventRequestsInWindow = 0;
  private dropContextUploadStatusRevision = 0;

  static getInstance(): CommunityUploadService {
    if (!CommunityUploadService._instance) {
      CommunityUploadService._instance = new CommunityUploadService();
    }
    return CommunityUploadService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.kysely = db.getKysely();
    this.repository = new CommunityUploadRepository(this.kysely);
    this.settingsStore = SettingsStoreService.getInstance();
    this.supabase = SupabaseClientService.getInstance();
    this.setupHandlers();
    this.setupPowerMonitor();
  }

  // ─── IPC Handlers ──────────────────────────────────────────────────────

  private setupHandlers(): void {
    ipcMain.handle(CommunityUploadChannel.GetBackfillLeagues, async (event) => {
      try {
        assertTrustedSender(event, CommunityUploadChannel.GetBackfillLeagues);
        return {
          success: true,
          leagues: await this.getBackfillLeagues(),
        } satisfies CommunityBackfillLeaguesResult;
      } catch (error) {
        return toSafeIpcFailure(
          error,
          CommunityUploadChannel.GetBackfillLeagues,
        );
      }
    });

    ipcMain.handle(CommunityUploadChannel.TriggerBackfill, async (event) => {
      try {
        assertTrustedSender(event, CommunityUploadChannel.TriggerBackfill);
        return await this.backfillIfNeeded();
      } catch (error) {
        return toSafeIpcFailure(error, CommunityUploadChannel.TriggerBackfill);
      }
    });

    ipcMain.handle(
      CommunityUploadChannel.GetDropContextUploadStatus,
      async (event) => {
        try {
          assertTrustedSender(
            event,
            CommunityUploadChannel.GetDropContextUploadStatus,
          );
          return {
            success: true,
            status: await this.getDropContextUploadStatus(),
          } satisfies CommunityDropContextUploadStatusResult;
        } catch (error) {
          return toSafeIpcFailure(
            error,
            CommunityUploadChannel.GetDropContextUploadStatus,
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
   * Get the list of leagues that have local data but haven't been backfilled yet.
   */
  public async getBackfillLeagues(): Promise<CommunityBackfillLeague[]> {
    const enabled = await this.isEnabled();
    if (!enabled) return [];

    if (!this.supabase.isConfigured()) return [];

    return this.repository.getBackfillLeagues();
  }

  public async getDropContextUploadStatus(): Promise<CommunityDropContextUploadStatus> {
    return this.readDropContextUploadStatus(
      this.dropContextUploadStatusRevision,
    );
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
    return this.queueSessionUpload(game, league, sessionId, options).then(
      (result) => {
        if (!result.success && options.throwOnFailure) {
          throw result.error;
        }
      },
    );
  }

  private queueSessionUpload(
    game: GameType,
    league: string,
    sessionId?: string,
    options: UploadOnSessionEndOptions = {},
  ): Promise<UploadQueueResult> {
    const key = this.uploadKey(game, league);
    const previousJob =
      this.sessionUploadJobs.get(key) ??
      Promise.resolve<UploadQueueResult>({ success: true });

    const job = previousJob
      .catch((error: unknown) => ({
        success: false as const,
        error: error instanceof Error ? error : new Error(String(error)),
      }))
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
  public flushPendingUploads(): Promise<void> {
    if (this.pendingUploadsFlushJob) {
      return this.pendingUploadsFlushJob;
    }

    const job = this.flushPendingUploadsInternal().finally(() => {
      if (this.pendingUploadsFlushJob === job) {
        this.pendingUploadsFlushJob = null;
      }
    });
    this.pendingUploadsFlushJob = job;
    return job;
  }

  private async flushPendingUploadsInternal(): Promise<void> {
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

      const eventScopes = await this.getPendingDropEventScopes();
      const eventDeviceId =
        eventScopes.length > 0 ? await this.getDeviceId() : null;
      for (const { game, scope } of eventScopes) {
        if (game !== "poe1" && game !== "poe2") {
          console.error(
            `[CommunityUpload] Invalid card-drop outbox game "${game}"`,
          );
          continue;
        }
        if (await this.isPendingDropEventScopeDue(game, scope, nowMs)) {
          await this.flushPendingDropEvents(game, scope, eventDeviceId!);
        }
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
      ...(this.pendingUploadsFlushJob ? [this.pendingUploadsFlushJob] : []),
      ...this.sessionUploadJobs.values(),
      ...this.flushJobs.values(),
      ...this.eventFlushJobs.values(),
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
  ): Promise<UploadQueueResult> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log("[CommunityUpload] Uploads disabled, skipping");
        return {
          success: false,
          error: new Error("Community uploads are disabled"),
        };
      }

      if (!this.supabase.isConfigured()) {
        console.log(
          "[CommunityUpload] Supabase not configured, skipping upload",
        );
        return {
          success: false,
          error: new Error("Community uploads are unavailable"),
        };
      }

      const deviceId = await this.getDeviceId();
      const changedCards = await this.getChangedCards(game, league, sessionId);
      const hasPendingEvents = await this.hasPendingDropEvents(game, league);

      if (changedCards.length === 0 && !hasPendingEvents) {
        console.log(
          `[CommunityUpload] No changes since last upload for ${game}/${league}, skipping`,
        );
        return { success: true };
      }

      const queuedCards =
        changedCards.length > 0
          ? await this.enqueuePendingUpload(game, league, changedCards)
          : [];

      if (options.flush === false) {
        console.log(
          `[CommunityUpload] Queued ${changedCards.length} changed card(s) for ${game}/${league}; card-drop context flush deferred`,
        );
        return { success: true };
      }

      if (queuedCards.length > 0) {
        await this.flushPendingUpload(game, league, {
          cards: queuedCards,
          deviceId,
        });
      }
      if (
        hasPendingEvents &&
        (await this.isPendingDropEventScopeDue(game, league, Date.now()))
      ) {
        await this.flushPendingDropEvents(game, league, deviceId);
      }
      return { success: true };
    } catch (error) {
      const uploadError =
        error instanceof Error ? error : new Error(String(error));
      console.error("[CommunityUpload] Upload failed:", uploadError.message);
      captureSentryException(uploadError, {
        tags: {
          module: "community-upload",
          operation: "upload-on-session-end",
        },
        extra: { game, league },
      });
      return { success: false, error: uploadError };
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
   * uploaded. A league is marked complete only after its snapshot is durably
   * queued (or no changes remain). Failures are returned so interactive
   * callers can keep the banner available for retry.
   */
  public async backfillIfNeeded(): Promise<CommunityBackfillResult> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        console.log("[CommunityUpload] Uploads disabled, skipping backfill");
        return {
          success: false,
          error: "Community uploads are disabled.",
        };
      }

      if (!this.supabase.isConfigured()) {
        console.log(
          "[CommunityUpload] Supabase not configured, skipping backfill",
        );
        return {
          success: false,
          error: "Community uploads are currently unavailable.",
        };
      }

      const leagues = await this.getBackfillLeagues();
      const completedLeagues: CommunityBackfillLeague[] = [];
      let hasFailures = false;

      for (const backfillLeague of leagues) {
        const { game, league } = backfillLeague;
        try {
          await this.uploadOnSessionEnd(game, league, undefined, {
            throwOnFailure: true,
          });

          console.log(
            `[CommunityUpload] Backfill complete for ${game}/${league}`,
          );
          completedLeagues.push(backfillLeague);
        } catch (error) {
          hasFailures = true;
          console.error(
            `[CommunityUpload] Backfill failed for ${game}/${league}:`,
            error instanceof Error ? error.message : String(error),
          );
          captureSentryException(
            error instanceof Error ? error : new Error(String(error)),
            {
              tags: {
                module: "community-upload",
                operation: "backfill",
              },
              extra: { game, league },
            },
          );
        }
      }

      await this.repository.commitBackfill(completedLeagues, !hasFailures);

      if (hasFailures) {
        return {
          success: false,
          error: "Some community data could not be queued. Please try again.",
        };
      }

      return { success: true };
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
      return {
        success: false,
        error: COMMUNITY_BACKFILL_ERROR,
      };
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
        "[CommunityUpload] GGG token unavailable, uploading without linked account",
      );
    }

    console.log(
      `[CommunityUpload] Uploading ${cardEntries.length} unique cards for ${game}/${league}` +
        (gggAccessToken ? " (verified)" : " (unlinked)"),
    );

    const payload = {
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

      changedCardMap.set(
        card.card_name,
        Math.max(changedCardMap.get(card.card_name) ?? 0, observedCount),
      );
    }

    return Array.from(changedCardMap, ([card_name, count]) => ({
      card_name,
      count,
    }));
  }

  private async getPendingDropEvents(
    game: GameType,
    league: string,
  ): Promise<CommunityDropEvent[]> {
    const rows = await this.kysely
      .selectFrom("community_drop_event_outbox")
      .select([
        "event_id",
        "card_name",
        "location",
        "local_minute",
        "utc_offset_minutes",
      ])
      .where("game", "=", game)
      .where("scope", "=", league)
      .orderBy("created_at", "asc")
      .limit(500)
      .execute();
    if (!Array.isArray(rows)) return [];
    return rows.filter(
      (row): row is CommunityDropEvent =>
        typeof row.event_id === "string" &&
        typeof row.card_name === "string" &&
        typeof row.location === "string" &&
        typeof row.local_minute === "number" &&
        typeof row.utc_offset_minutes === "number",
    );
  }

  private async getPendingDropEventScopes(): Promise<
    Array<{ game: string; scope: string }>
  > {
    return this.kysely
      .selectFrom("community_drop_event_outbox")
      .select(["game", "scope"])
      .groupBy(["game", "scope"])
      .execute();
  }

  private async hasPendingDropEvents(
    game: GameType,
    league: string,
  ): Promise<boolean> {
    const row = await this.kysely
      .selectFrom("community_drop_event_outbox")
      .select("event_id")
      .where("game", "=", game)
      .where("scope", "=", league)
      .executeTakeFirst();
    return typeof row?.event_id === "string";
  }

  private async flushPendingDropEvents(
    game: GameType,
    league: string,
    deviceId: string,
  ): Promise<void> {
    const key = this.uploadKey(game, league);
    const existing = this.eventFlushJobs.get(key);
    if (existing) return existing;

    const job = this.flushPendingDropEventLoop(game, league, deviceId).finally(
      () => {
        if (this.eventFlushJobs.get(key) === job) {
          this.eventFlushJobs.delete(key);
        }
        void this.emitDropContextUploadStatus();
      },
    );
    this.eventFlushJobs.set(key, job);
    void this.emitDropContextUploadStatus();
    return job;
  }

  private async flushPendingDropEventLoop(
    game: GameType,
    league: string,
    deviceId: string,
  ): Promise<void> {
    while (true) {
      const events = await this.getPendingDropEvents(game, league);
      if (events.length === 0) {
        await this.clearDropEventUploadState(game, league);
        return;
      }
      if (!this.reserveDropEventRequest()) break;

      try {
        await this.sendPendingDropEvents(game, league, events, deviceId);
        await this.deletePendingDropEvents(events);
        await this.clearDropEventUploadState(game, league);
        await this.emitDropContextUploadStatus();
      } catch (error) {
        await this.recordDropEventUploadFailure(game, league, error);
        console.error(
          "[CommunityUpload] Card-drop context upload failed:",
          error instanceof Error ? error.message : String(error),
        );
        captureSentryException(
          error instanceof Error ? error : new Error(String(error)),
          {
            tags: {
              module: "community-upload",
              operation: "flush-card-drop-events",
            },
            extra: { game, league, eventCount: events.length },
          },
        );
        return;
      }
    }

    await this.recordDropEventUploadFailure(
      game,
      league,
      new Error("Hourly card-drop upload request budget reached"),
      DROP_EVENT_RATE_WINDOW_MS,
    );
  }

  private async sendPendingDropEvents(
    game: GameType,
    league: string,
    events: readonly CommunityDropEvent[],
    deviceId: string,
  ): Promise<void> {
    const result = await this.supabase.callEdgeFunction<unknown>(
      "upload-community-drop-events",
      {
        league_name: league,
        game,
        device_id: deviceId,
        events,
      },
    );

    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error("Card-drop context upload returned an invalid response");
    }

    const response = result as Record<string, unknown>;
    if (
      response.success !== true ||
      response.accepted_events !== events.length ||
      typeof response.inserted_events !== "number" ||
      !Number.isInteger(response.inserted_events) ||
      response.inserted_events < 0 ||
      response.inserted_events > events.length
    ) {
      throw new Error(
        "Card-drop context upload did not acknowledge the complete batch",
      );
    }

    console.log(
      `[CommunityUpload] Uploaded ${events.length} card-drop context event(s) for ${game}/${league} (${response.inserted_events} new)`,
    );
  }

  private async deletePendingDropEvents(
    events: readonly CommunityDropEvent[],
  ): Promise<void> {
    if (events.length === 0) return;
    await this.kysely
      .deleteFrom("community_drop_event_outbox")
      .where(
        "event_id",
        "in",
        events.map((event) => event.event_id),
      )
      .execute();
  }

  private async readDropContextUploadStatus(
    revision: number,
  ): Promise<CommunityDropContextUploadStatus> {
    const row = await this.kysely
      .selectFrom("community_drop_event_outbox")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .executeTakeFirst();

    return {
      pendingEvents: Number(row?.count ?? 0),
      isUploading: this.eventFlushJobs.size > 0,
      revision,
    };
  }

  private async emitDropContextUploadStatus(): Promise<void> {
    const revision = ++this.dropContextUploadStatusRevision;
    try {
      const status = await this.readDropContextUploadStatus(revision);
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(
            CommunityUploadChannel.DropContextUploadStatusChanged,
            status,
          );
        }
      }
    } catch (error) {
      console.warn(
        "[CommunityUpload] Failed to publish card-history upload status:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private reserveDropEventRequest(nowMs = Date.now()): boolean {
    if (
      this.eventRateWindowStartedAt === 0 ||
      nowMs - this.eventRateWindowStartedAt >= DROP_EVENT_RATE_WINDOW_MS
    ) {
      this.eventRateWindowStartedAt = nowMs;
      this.eventRequestsInWindow = 0;
    }
    if (this.eventRequestsInWindow >= DROP_EVENT_MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    this.eventRequestsInWindow++;
    return true;
  }

  private async isPendingDropEventScopeDue(
    game: GameType,
    league: string,
    nowMs: number,
  ): Promise<boolean> {
    const state = await this.kysely
      .selectFrom("community_drop_event_upload_state")
      .select("next_attempt_at")
      .where("game", "=", game)
      .where("scope", "=", league)
      .executeTakeFirst();
    return (
      !state?.next_attempt_at ||
      new Date(state.next_attempt_at).getTime() <= nowMs
    );
  }

  private async clearDropEventUploadState(
    game: GameType,
    league: string,
  ): Promise<void> {
    await this.kysely
      .deleteFrom("community_drop_event_upload_state")
      .where("game", "=", game)
      .where("scope", "=", league)
      .execute();
  }

  private async recordDropEventUploadFailure(
    game: GameType,
    league: string,
    error: unknown,
    delayOverrideMs?: number,
  ): Promise<void> {
    const previous = await this.kysely
      .selectFrom("community_drop_event_upload_state")
      .select("attempts")
      .where("game", "=", game)
      .where("scope", "=", league)
      .executeTakeFirst();
    const attempts = (previous?.attempts ?? 0) + 1;
    const delayMs =
      delayOverrideMs ??
      (error instanceof EdgeFunctionError && error.status === 429
        ? DROP_EVENT_RATE_WINDOW_MS
        : RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]);

    await this.kysely
      .insertInto("community_drop_event_upload_state")
      .values({
        game,
        scope: league,
        attempts,
        last_error: error instanceof Error ? error.message : String(error),
        next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
      })
      .onConflict((conflict) =>
        conflict.columns(["game", "scope"]).doUpdateSet({
          attempts,
          last_error: error instanceof Error ? error.message : String(error),
          next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
        }),
      )
      .execute();
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
}

export { CommunityUploadService };
