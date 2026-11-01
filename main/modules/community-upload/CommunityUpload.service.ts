import { randomUUID } from "node:crypto";

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
  assertBoolean,
  assertTrustedSender,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import type { GameType } from "../../../types/data-stores";
import { CommunityIdentityRepository } from "./CommunityIdentity.repository";
import { CommunityUploadChannel } from "./CommunityUpload.channels";
import type {
  CommunityBackfillLeague,
  CommunityBackfillLeaguesResult,
  CommunityBackfillResult,
  CommunityDropContextConsentResult,
  CommunityDropContextUploadStatus,
  CommunityDropContextUploadStatusResult,
} from "./CommunityUpload.dto";
import { CommunityUploadRepository } from "./CommunityUpload.repository";
import {
  COMMUNITY_IDENTITY_CONFLICT,
  COMMUNITY_IDENTITY_PROOF_REQUIRED,
  parseCountUploadAcknowledgement,
} from "./CommunityUpload.utils";

interface CommunityUploadCard {
  card_name: string;
  count: number;
}

interface CommunityDropEvent {
  event_id: string;
  card_name: string;
  location: string | null;
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
  identity_id: string;
  game: string;
  scope: string;
  cards_json: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
}

type UploadQueueResult = { success: true } | { success: false; error: Error };

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const DROP_EVENT_RATE_WINDOW_MS = 60 * 60_000;
const DROP_EVENT_MAX_REQUESTS_PER_WINDOW = 240;
const COMMUNITY_BACKFILL_ERROR =
  "Community data could not be queued. Please try again.";

function uploadFailureMessage(error: unknown): string {
  if (
    error instanceof EdgeFunctionError &&
    (error.code === COMMUNITY_IDENTITY_PROOF_REQUIRED ||
      error.code === COMMUNITY_IDENTITY_CONFLICT)
  )
    return error.code;
  return error instanceof Error ? error.message : String(error);
}

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
  private identities: CommunityIdentityRepository;
  private gggLinkJob: Promise<void> | null = null;
  private gggLinkAccount: string | undefined;
  private verifiedResumeJob: Promise<void> | null = null;
  private repository: CommunityUploadRepository;
  private sessionUploadJobs = new Map<string, Promise<UploadQueueResult>>();
  private pendingUploadsFlushJob: Promise<void> | null = null;
  private flushJobs = new Map<string, Promise<void>>();
  private eventFlushJobs = new Map<string, Promise<void>>();
  private eventRateWindowStartedAt = 0;
  private eventRequestsInWindow = 0;
  private dropContextUploadStatusRevision = 0;
  private gggUnlinkJob: Promise<void> | null = null;
  private gggAccountRevision = 0;
  private unlinkCallbacks = new Set<() => void>();
  private unlinkIdentityChanged = false;
  private accountRequests = new Set<Promise<unknown>>();

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
    this.identities = new CommunityIdentityRepository(this.kysely, db.getDb());
    this.settingsStore = SettingsStoreService.getInstance();
    this.supabase = SupabaseClientService.getInstance();
    this.setupHandlers();
    this.setupPowerMonitor();
  }

  // ─── IPC Handlers ──────────────────────────────────────────────────────

  private setupHandlers(): void {
    ipcMain.handle(
      CommunityUploadChannel.GetDropContextConsent,
      async (event) => {
        const channel = CommunityUploadChannel.GetDropContextConsent;
        try {
          assertTrustedSender(event, channel);
          return {
            success: true,
            consent: await this.repository.getDropContextConsent(),
          } satisfies CommunityDropContextConsentResult;
        } catch (error) {
          return toSafeIpcFailure(error, channel);
        }
      },
    );

    ipcMain.handle(
      CommunityUploadChannel.SetDropContextConsent,
      async (event, enabled: boolean) => {
        const channel = CommunityUploadChannel.SetDropContextConsent;
        try {
          assertTrustedSender(event, channel);
          assertBoolean(enabled, "enabled", channel);
          await this.repository.setDropContextConsent(enabled);
          await this.emitDropContextUploadStatus();
          if (enabled) void this.flushPendingUploads();
          return {
            success: true,
            consent: enabled,
          } satisfies CommunityDropContextConsentResult;
        } catch (error) {
          return toSafeIpcFailure(error, channel);
        }
      },
    );

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
        // This handler is invoked only after the contribution banner's opt-in.
        await this.settingsStore.set(SettingsKey.CommunityUploadsEnabled, true);
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
    if (!this.supabase.isConfigured()) return [];

    return this.repository.getBackfillLeagues();
  }

  public async getDropContextUploadStatus(): Promise<CommunityDropContextUploadStatus> {
    return this.readDropContextUploadStatus(
      this.dropContextUploadStatusRevision,
    );
  }

  /** Resolve an account's upload ID without changing any historical uploads. */
  public linkGggAccount(accountId?: string): Promise<void> {
    if (this.gggUnlinkJob) return Promise.resolve();
    if (
      accountId !== undefined &&
      this.gggLinkJob &&
      this.gggLinkAccount === accountId
    )
      return this.gggLinkJob;
    const previous = this.gggLinkJob;
    const revision = ++this.gggAccountRevision;
    let linkedAccount: string | null = null;
    const job = (async () => {
      if (previous) await previous.catch(() => {});
      if (revision !== this.gggAccountRevision || this.gggUnlinkJob) return;
      linkedAccount = await this.activateVerifiedIdentity(accountId, revision);
    })().finally(async () => {
      if (this.gggLinkJob === job) {
        this.gggLinkJob = null;
        this.gggLinkAccount = undefined;
        await this.emitDropContextUploadStatus();
        if (linkedAccount && revision === this.gggAccountRevision) {
          const resume = this.resumeVerifiedUploads(
            linkedAccount,
            revision,
          ).finally(() => {
            if (this.verifiedResumeJob === resume)
              this.verifiedResumeJob = null;
          });
          this.verifiedResumeJob = resume;
        }
      }
    });
    this.gggLinkJob = job;
    this.gggLinkAccount = accountId;
    return job;
  }

  private async resumeVerifiedUploads(
    account: string,
    revision: number,
  ): Promise<void> {
    try {
      if (
        revision !== this.gggAccountRevision ||
        this.gggUnlinkJob ||
        !(await this.isEnabled())
      )
        return;
      await this.repository.releaseVerificationRetries(account);
      if (revision !== this.gggAccountRevision || this.gggUnlinkJob) return;
      // An existing startup flush can be awaiting this link. Do not await that
      // same flush here, and retry only data already queued for upload.
      await this.flushPendingUploads({ enqueueChanged: false });
    } catch (error) {
      console.warn("[CommunityUpload] Could not resume verified uploads");
      captureSentryException(
        error instanceof Error ? error : new Error(String(error)),
        { tags: { module: "community-upload", operation: "resume-verified" } },
      );
    }
  }

  private async activateVerifiedIdentity(
    accountId: string | undefined,
    revision: number,
  ): Promise<string | null> {
    await Promise.allSettled([...this.accountRequests]);
    const auth = GggAuthService.getInstance();
    const currentAccount = await auth.getAccountId();
    const account = accountId ?? currentAccount;
    if (!account) return null;
    if (currentAccount !== account)
      throw new Error("GGG sign-in changed while linking. Please try again.");
    // OAuth can complete while sharing is off. Resolve ownership after opt-in.
    if (!(await this.isEnabled()) || !this.supabase.isConfigured()) return null;
    const known = await this.identities.getVerified(account);
    const id = known?.id ?? randomUUID();
    if (!(await this.isEnabled()) || !this.supabase.isConfigured()) return null;
    const token = await auth.getAccessToken();
    if (!token) throw new Error("GGG verification is unavailable");
    const legacyId = await this.getDeviceId();
    if (
      revision !== this.gggAccountRevision ||
      this.gggUnlinkJob ||
      !(await this.isEnabled())
    )
      return null;
    if ((await auth.getAccountId()) !== account)
      throw new Error("GGG sign-in changed while linking. Please try again.");
    if (revision !== this.gggAccountRevision || this.gggUnlinkJob) return null;
    const result = await this.trackAccountRequest(
      this.supabase.callEdgeFunction<{
        success: boolean;
        device_id: string;
        ggg_uuid: string;
        legacy_anonymous: boolean;
      }>(
        "v2-upload-community-data",
        {
          action: "link-ggg",
          device_id: id,
          ...(!known ? { legacy_device_id: legacyId } : {}),
          is_packaged: app.isPackaged,
        },
        { "X-GGG-Token": token },
      ),
    );
    if (
      result?.success !== true ||
      result.ggg_uuid !== account ||
      (result.device_id !== id && result.device_id !== legacyId)
    ) {
      throw new Error("Community upload identity was not acknowledged");
    }
    if (revision !== this.gggAccountRevision || this.gggUnlinkJob) return null;
    if ((await auth.getAccountId()) !== account)
      throw new Error("GGG sign-in changed while linking. Please try again.");
    if (revision !== this.gggAccountRevision || this.gggUnlinkJob) return null;
    this.identities.activateVerified(
      result.device_id,
      account,
      result.legacy_anonymous === true,
    );
    return account;
  }

  /** Unlink is local and works offline. Verified history retains its owner. */
  public unlinkGggAccount(clearLocalSession?: () => void): Promise<void> {
    if (this.gggUnlinkJob && this.unlinkIdentityChanged && clearLocalSession) {
      try {
        clearLocalSession();
      } catch (error) {
        return Promise.reject(error);
      }
      return this.gggUnlinkJob;
    }
    if (clearLocalSession) this.unlinkCallbacks.add(clearLocalSession);
    if (this.gggUnlinkJob) return this.gggUnlinkJob;
    this.gggAccountRevision += 1;
    const job = this.unlinkGggAccountInternal().finally(() => {
      if (this.gggUnlinkJob === job) {
        this.gggUnlinkJob = null;
        this.unlinkCallbacks.clear();
        this.unlinkIdentityChanged = false;
      }
    });
    this.gggUnlinkJob = job;
    return job;
  }

  private async unlinkGggAccountInternal(): Promise<void> {
    await Promise.allSettled([
      ...this.accountRequests,
      ...(this.gggLinkJob ? [this.gggLinkJob] : []),
    ]);
    this.identities.activateAnonymous(() => {
      for (const clear of this.unlinkCallbacks) clear();
    });
    this.unlinkIdentityChanged = true;
    // The session file may have disappeared without passing through auth logout.
    GggAuthService.getInstance().notifyAuthStatusChanged();
    void this.emitDropContextUploadStatus();
  }

  private async ensureAccountIdentity(): Promise<void> {
    if (this.gggUnlinkJob || this.gggLinkJob) return;
    const account = await GggAuthService.getInstance().getAccountId();
    const active = await this.identities.getActive();
    if (!account && active.kind === "verified") await this.unlinkGggAccount();
    else if (account && active.account_id !== account)
      await this.linkGggAccount(account);
  }

  private async getOwnerAccess(
    id: string,
    game: GameType,
    league: string,
  ): Promise<{ allowed: boolean; token: string | null }> {
    if (this.gggUnlinkJob || this.gggLinkJob)
      return { allowed: false, token: null };
    if (await this.identities.isRetired(id, game, league))
      return { allowed: false, token: null };
    const identity = await this.identities.get(id);
    if (!identity) return { allowed: false, token: null };
    if (identity.kind === "anonymous") return { allowed: true, token: null };
    if (identity.kind === "legacy") {
      return {
        allowed: (await this.identities.getActive()).id === id,
        token: null,
      };
    }
    const auth = GggAuthService.getInstance();
    const account = await auth.getAccountId();
    if (account !== identity.account_id) {
      if (!account && (await this.identities.getActive()).kind === "verified")
        await this.unlinkGggAccount();
      return { allowed: false, token: null };
    }
    const token = await auth.getAccessToken();
    if (!token && !(await auth.getAccountId())) await this.unlinkGggAccount();
    return {
      allowed: !!token && (await auth.getAccountId()) === identity.account_id,
      token,
    };
  }

  private async trackAccountRequest<T>(request: Promise<T>): Promise<T> {
    this.accountRequests.add(request);
    try {
      return await request;
    } finally {
      this.accountRequests.delete(request);
    }
  }

  private async handleMissingIdentityProof(
    error: unknown,
    deviceId: string,
  ): Promise<void> {
    if (
      error instanceof EdgeFunctionError &&
      error.code === COMMUNITY_IDENTITY_PROOF_REQUIRED &&
      !(await GggAuthService.getInstance().getAccountId()) &&
      (await this.identities.getActive()).id === deviceId
    ) {
      await this.unlinkGggAccount();
    }
  }

  /**
   * Check if community uploads are enabled.
   *
   * Settings require a recorded opt-in; missing values never grant permission.
   */
  public async isEnabled(): Promise<boolean> {
    const enabled = await this.settingsStore.get(
      SettingsKey.CommunityUploadsEnabled,
    );
    return enabled === true;
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
    options: UploadOnSessionEndOptions = {},
  ): Promise<void> {
    return this.queueSessionUpload(game, league, options).then((result) => {
      if (!result.success && options.throwOnFailure) {
        throw result.error;
      }
    });
  }

  private queueSessionUpload(
    game: GameType,
    league: string,
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
      .then(() => this.uploadOnSessionEndInternal(game, league, options))
      .finally(async () => {
        if (this.sessionUploadJobs.get(key) === job) {
          this.sessionUploadJobs.delete(key);
        }
        await this.emitDropContextUploadStatus();
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
  public flushPendingUploads(
    options: { enqueueChanged?: boolean } = {},
  ): Promise<void> {
    if (this.pendingUploadsFlushJob) {
      return this.pendingUploadsFlushJob;
    }

    const job = this.flushPendingUploadsInternal(
      options.enqueueChanged !== false,
    ).finally(async () => {
      if (this.pendingUploadsFlushJob === job) {
        this.pendingUploadsFlushJob = null;
      }
      await this.emitDropContextUploadStatus();
    });
    this.pendingUploadsFlushJob = job;
    return job;
  }

  private async flushPendingUploadsInternal(
    enqueueChanged: boolean,
  ): Promise<void> {
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

      await this.ensureAccountIdentity();
      if (enqueueChanged) await this.enqueueChangedUploadsForAllLeagues();

      const pendingRows = await this.kysely
        .selectFrom("community_upload_outbox")
        .select([
          "game",
          "scope",
          "identity_id",
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
        await this.flushPendingUpload(row.game, row.scope, row.identity_id);
      }

      const eventScopes = await this.getPendingDropEventScopes();
      for (const { game, scope, identity_id } of eventScopes) {
        if (game !== "poe1" && game !== "poe2") {
          console.error(
            `[CommunityUpload] Invalid card-drop outbox game "${game}"`,
          );
          continue;
        }
        if (await this.isPendingDropEventScopeDue(game, scope, nowMs)) {
          await this.flushPendingDropEvents(game, scope, identity_id);
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
      ...(this.verifiedResumeJob ? [this.verifiedResumeJob] : []),
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

      await this.ensureAccountIdentity();
      const owners = await this.identities.getScopeOwners(game, league);
      for (const deviceId of owners) {
        const changedCards = await this.getChangedCards(game, league, deviceId);
        if (changedCards.length > 0) {
          await this.enqueuePendingUpload(game, league, changedCards, deviceId);
        }
        if (options.flush === false) continue;
        await this.flushPendingUpload(game, league, deviceId);
        if (await this.isPendingDropEventScopeDue(game, league, Date.now())) {
          await this.flushPendingDropEvents(game, league, deviceId);
        }
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
    deviceId: string,
  ): Promise<void> {
    const key = `${deviceId}:${this.uploadKey(game, league)}`;
    const existing = this.flushJobs.get(key);
    if (existing) return existing;

    const job = this.flushPendingUploadLoop(game, league, deviceId).finally(
      () => {
        if (this.flushJobs.get(key) === job) {
          this.flushJobs.delete(key);
        }
      },
    );

    this.flushJobs.set(key, job);
    return job;
  }

  private async flushPendingUploadLoop(
    game: GameType,
    league: string,
    deviceId: string,
  ): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      const result = await this.flushPendingUploadOnce(game, league, deviceId);
      if (result !== "changed") return;
    }
  }

  private async flushPendingUploadOnce(
    game: GameType,
    league: string,
    deviceId: string,
  ): Promise<"done" | "changed" | "missing" | "retry-later"> {
    if (!(await this.isEnabled())) return "retry-later";
    const row = await this.kysely
      .selectFrom("community_upload_outbox")
      .select([
        "game",
        "scope",
        "identity_id",
        "cards_json",
        "attempts",
        "last_error",
        "next_attempt_at",
      ])
      .where("game", "=", game)
      .where("scope", "=", league)
      .where("identity_id", "=", deviceId)
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
        await this.deletePendingUpload(game, league, deviceId);
        return "done";
      }

      if (
        !(await this.sendPendingUpload(game, league, cardEntries, deviceId))
      ) {
        return "retry-later";
      }

      const latest = await this.kysely
        .selectFrom("community_upload_outbox")
        .select("cards_json")
        .where("game", "=", game)
        .where("scope", "=", league)
        .where("identity_id", "=", deviceId)
        .executeTakeFirst();

      if (!latest || latest.cards_json === row.cards_json) {
        await this.deletePendingUpload(game, league, deviceId);
        return "done";
      }

      return "changed";
    } catch (error) {
      console.error(
        "[CommunityUpload] Pending upload failed:",
        error instanceof Error ? error.message : String(error),
      );
      await this.recordIdentityWarning(deviceId, error);
      await this.handleMissingIdentityProof(error, deviceId);
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
          await this.uploadOnSessionEnd(game, league, {
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
  ): Promise<boolean> {
    const accountRevision = this.gggAccountRevision;
    const access = await this.getOwnerAccess(deviceId, game, league);
    if (!access.allowed || !(await this.isEnabled())) return false;
    if (
      this.gggUnlinkJob ||
      this.gggLinkJob ||
      accountRevision !== this.gggAccountRevision
    )
      return false;
    const gggAccessToken = access.token;

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

    const response = await this.trackAccountRequest(
      this.supabase.callEdgeFunction<unknown>(
        "v2-upload-community-data",
        payload,
        extraHeaders,
      ),
    );
    const result = parseCountUploadAcknowledgement(response, !!gggAccessToken);
    if (await this.identities.isRetired(deviceId, game, league)) return true;

    console.log(
      `[CommunityUpload] Upload successful: ${result.unique_cards} unique cards (${cardEntries.length} changed), upload #${result.upload_count}`,
    );

    for (const card of cardEntries) {
      await this.kysely
        .insertInto("community_upload_snapshot")
        .values({
          game,
          scope: league,
          identity_id: deviceId,
          card_name: card.card_name,
          count: card.count,
        })
        .onConflict((oc) =>
          oc
            .columns(["identity_id", "game", "scope", "card_name"])
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

    await this.repository.clearIdentityWarning(deviceId);
    return true;
  }

  private async enqueueChangedUploadsForAllLeagues(): Promise<void> {
    const leagues = await this.kysely
      .selectFrom("community_upload_card_counts")
      .select(["game", "scope"])
      .where("scope", "!=", "all-time")
      .where("count", ">", 0)
      .groupBy(["game", "scope"])
      .execute();

    for (const { game, scope } of leagues) {
      if (game !== "poe1" && game !== "poe2") continue;
      await this.uploadOnSessionEnd(game, scope, { flush: false });
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
    deviceId: string,
  ): Promise<CommunityUploadCard[]> {
    const cards = await this.kysely
      .selectFrom("community_upload_card_counts as counts")
      .leftJoin("community_upload_snapshot as snapshot", (join) =>
        join
          .onRef("counts.identity_id", "=", "snapshot.identity_id")
          .onRef("counts.game", "=", "snapshot.game")
          .onRef("counts.scope", "=", "snapshot.scope")
          .onRef("counts.card_name", "=", "snapshot.card_name"),
      )
      .select(["counts.card_name", "counts.count"])
      .where("counts.identity_id", "=", deviceId)
      .where("counts.game", "=", game)
      .where("counts.scope", "=", league)
      .where((eb) =>
        eb.or([
          eb("snapshot.count", "is", null),
          eb("counts.count", ">", eb.ref("snapshot.count")),
        ]),
      )
      .execute();
    return cards;
  }

  private async getPendingDropEvents(
    game: GameType,
    league: string,
    deviceId: string,
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
      .where("identity_id", "=", deviceId)
      .orderBy("created_at", "asc")
      .limit(500)
      .execute();
    if (!Array.isArray(rows)) return [];
    return rows.filter(
      (row): row is CommunityDropEvent =>
        typeof row.event_id === "string" &&
        typeof row.card_name === "string" &&
        (row.location === null || typeof row.location === "string") &&
        typeof row.local_minute === "number" &&
        typeof row.utc_offset_minutes === "number",
    );
  }

  private async getPendingDropEventScopes(): Promise<
    Array<{ game: string; scope: string; identity_id: string }>
  > {
    return this.kysely
      .selectFrom("community_drop_event_outbox")
      .select(["game", "scope", "identity_id"])
      .groupBy(["game", "scope", "identity_id"])
      .execute();
  }

  private async flushPendingDropEvents(
    game: GameType,
    league: string,
    deviceId: string,
  ): Promise<void> {
    const key = `${deviceId}:${this.uploadKey(game, league)}`;
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
      // Recheck for every batch, including startup/resume retries and history.
      // Local event collection does not imply permission to send it.
      if (!(await this.isEnabled())) return;
      if ((await this.repository.getDropContextConsent()) !== true) return;
      const accountRevision = this.gggAccountRevision;
      const access = await this.getOwnerAccess(deviceId, game, league);
      if (!access.allowed) return;
      // Counts create the verified league row; context must not create it anonymously.
      const pendingCounts = await this.kysely
        .selectFrom("community_upload_outbox")
        .select("identity_id")
        .where("identity_id", "=", deviceId)
        .where("game", "=", game)
        .where("scope", "=", league)
        .executeTakeFirst();
      if (
        pendingCounts &&
        (await this.identities.get(deviceId))?.kind === "verified"
      )
        return;
      const events = await this.getPendingDropEvents(game, league, deviceId);
      if (events.length === 0) {
        await this.clearDropEventUploadState(game, league);
        return;
      }
      if (!this.reserveDropEventRequest()) break;

      try {
        if (!(await this.isEnabled())) return;
        if ((await this.repository.getDropContextConsent()) !== true) return;
        if (
          this.gggUnlinkJob ||
          this.gggLinkJob ||
          accountRevision !== this.gggAccountRevision
        )
          return;
        await this.trackAccountRequest(
          this.sendPendingDropEvents(
            game,
            league,
            events,
            deviceId,
            access.token,
          ),
        );
        await this.deletePendingDropEvents(events);
        await this.clearDropEventUploadState(game, league);
        await this.repository.clearIdentityWarning(deviceId);
        await this.emitDropContextUploadStatus();
      } catch (error) {
        await this.recordIdentityWarning(deviceId, error);
        await this.handleMissingIdentityProof(error, deviceId);
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
    token: string | null,
  ): Promise<void> {
    const result = await this.supabase.callEdgeFunction<unknown>(
      "upload-community-drop-events",
      {
        league_name: league,
        game,
        device_id: deviceId,
        events,
      },
      ...(token ? [{ "X-GGG-Token": token }] : []),
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
    if (!(await this.isEnabled())) {
      return { pendingEvents: 0, isUploading: false, revision };
    }
    const account = await GggAuthService.getInstance().getAccountId();
    const contextEnabled =
      (await this.repository.getDropContextConsent()) === true;
    const uploadWarning = await this.repository.getUploadWarning(
      account,
      contextEnabled,
    );
    const status: CommunityDropContextUploadStatus = {
      pendingEvents: 0,
      isUploading: false,
      revision,
      ...(uploadWarning ? { uploadWarning } : {}),
    };
    if (!contextEnabled) return status;
    const owners = await this.identities.getEligibleIds(account);
    if (owners.length === 0) return status;
    const row = await this.kysely
      .selectFrom("community_drop_event_outbox")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("identity_id", "in", owners)
      .executeTakeFirst();

    return {
      ...status,
      pendingEvents: Number(row?.count ?? 0),
      isUploading: this.eventFlushJobs.size > 0,
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

  private async recordIdentityWarning(
    deviceId: string,
    error: unknown,
  ): Promise<void> {
    if (
      error instanceof EdgeFunctionError &&
      (error.code === COMMUNITY_IDENTITY_PROOF_REQUIRED ||
        error.code === COMMUNITY_IDENTITY_CONFLICT)
    )
      await this.repository.setIdentityWarning(deviceId, error.code);
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
        last_error: uploadFailureMessage(error),
        next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
      })
      .onConflict((conflict) =>
        conflict.columns(["game", "scope"]).doUpdateSet({
          attempts,
          last_error: uploadFailureMessage(error),
          next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
        }),
      )
      .execute();
  }

  private async enqueuePendingUpload(
    game: GameType,
    league: string,
    cards: CommunityUploadCard[],
    deviceId: string,
  ): Promise<CommunityUploadCard[]> {
    const existing = await this.kysely
      .selectFrom("community_upload_outbox")
      .select("cards_json")
      .where("game", "=", game)
      .where("scope", "=", league)
      .where("identity_id", "=", deviceId)
      .executeTakeFirst();

    const merged = new Map<string, number>();
    if (typeof existing?.cards_json === "string") {
      for (const card of this.parseOutboxCards({
        identity_id: deviceId,
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
    if (existing?.cards_json === cardsJson) return queuedCards;
    const now = new Date().toISOString();

    await this.kysely
      .insertInto("community_upload_outbox")
      .values({
        identity_id: deviceId,
        game,
        scope: league,
        cards_json: cardsJson,
        next_attempt_at: now,
        last_error: null,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["identity_id", "game", "scope"]).doUpdateSet({
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
        last_error: uploadFailureMessage(error),
        next_attempt_at: new Date(now + delay).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .where("game", "=", row.game)
      .where("scope", "=", row.scope)
      .where("identity_id", "=", row.identity_id)
      .execute();
  }

  private async deletePendingUpload(
    game: GameType,
    league: string,
    deviceId: string,
  ): Promise<void> {
    await this.kysely
      .deleteFrom("community_upload_outbox")
      .where("game", "=", game)
      .where("scope", "=", league)
      .where("identity_id", "=", deviceId)
      .execute();
  }
}

export { CommunityUploadService };
