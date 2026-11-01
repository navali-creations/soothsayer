import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatabaseServiceMock,
  createElectronMock,
  createGggAuthServiceMock,
  createIpcValidationMock,
  createPerformanceLoggerMock,
  createSettingsStoreMock,
  createSnapshotServiceMock,
  createSupabaseClientMock,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingletons } from "~/main/modules/__test-utils__/singleton-helper";

const {
  mockIpcHandle,
  mockPowerMonitorOn,
  mockWebContentsSend,
  mockGetAllWindows,
  mockGetKysely,
  mockGetDb,
  mockSettingsGet,
  mockSettingsSet,
  mockGetSnapshotForSession,
  mockLoadSnapshot,
  mockStartAutoRefresh,
  mockStopAutoRefresh,
  mockIsConfigured,
  mockCallEdgeFunction,
  mockGetAccessToken,
  mockGetAccountId,
  mockNotifyAuthStatusChanged,
  mockSentryCaptureException,
  mockAppPerformanceStartFreshCapture,
  mockAppPerformanceStopCapture,
  mockAppPerformanceGetState,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockPowerMonitorOn: vi.fn(),
  mockWebContentsSend: vi.fn(),
  mockGetAllWindows: vi.fn(),
  mockGetKysely: vi.fn(),
  mockGetDb: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockGetSnapshotForSession: vi.fn(),
  mockLoadSnapshot: vi.fn(),
  mockStartAutoRefresh: vi.fn(),
  mockStopAutoRefresh: vi.fn(),
  mockIsConfigured: vi.fn(),
  mockCallEdgeFunction: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockGetAccountId: vi.fn(),
  mockNotifyAuthStatusChanged: vi.fn(),
  mockSentryCaptureException: vi.fn(),
  mockAppPerformanceStartFreshCapture: vi.fn(),
  mockAppPerformanceStopCapture: vi.fn(),
  mockAppPerformanceGetState: vi.fn(),
}));

vi.mock("electron", () =>
  createElectronMock({
    mockIpcHandle,
    mockPowerMonitorOn,
    mockWebContentsSend,
    mockGetAllWindows,
  }),
);

vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely, mockGetDb }),
);

vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({
    mockGet: mockSettingsGet,
    mockSet: mockSettingsSet,
    mockGetAllSettings: vi.fn().mockResolvedValue({}),
  }),
);

vi.mock("~/main/modules/snapshots", () =>
  createSnapshotServiceMock({
    mockGetSnapshotForSession,
    mockLoadSnapshot,
    mockStartAutoRefresh,
    mockStopAutoRefresh,
  }),
);

vi.mock("~/main/modules/performance-logger", () =>
  createPerformanceLoggerMock({
    mockStartTimers: vi.fn(() => null),
  }),
);

vi.mock("~/main/modules/app-performance", () => ({
  AppPerformanceService: {
    getInstance: vi.fn(() => ({
      startFreshCapture: mockAppPerformanceStartFreshCapture,
      stopCapture: mockAppPerformanceStopCapture,
      getState: mockAppPerformanceGetState,
    })),
  },
}));

vi.mock("~/main/modules/rarity-insights/RarityInsights.service", () => ({
  RarityInsightsService: {
    getInstance: vi.fn(() => ({
      applyFilterRarities: vi.fn().mockResolvedValue(undefined),
      ensureFilterParsed: vi.fn().mockResolvedValue(null),
    })),
  },
}));

vi.mock("~/main/modules/supabase", () =>
  createSupabaseClientMock({
    mockIsConfigured,
    mockCallEdgeFunction,
  }),
);

vi.mock("~/main/modules/ggg-auth", () =>
  createGggAuthServiceMock({
    mockGetAccessToken,
    mockGetAccountId,
    mockNotifyAuthStatusChanged,
  }),
);

vi.mock("~/main/utils/ipc-validation", () => createIpcValidationMock());

vi.mock("~/main/modules/sentry/Sentry.reporter", () => ({
  captureSentryException: mockSentryCaptureException,
  captureSentryMessage: vi.fn(),
}));

import {
  createTestDatabase,
  seedCards,
  seedLeague,
  seedSession,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import { CurrentSessionService } from "~/main/modules/current-session/CurrentSession.service";
import { SessionsRepository } from "~/main/modules/sessions/Sessions.repository";
import { SettingsStoreRepository } from "~/main/modules/settings-store/SettingsStore.repository";
import { StorageService } from "~/main/modules/storage/Storage.service";
import { EdgeFunctionError } from "~/main/modules/supabase";

import { CommunityIdentityRepository } from "../CommunityIdentity.repository";
import { CommunityUploadChannel } from "../CommunityUpload.channels";
import { CommunityUploadRepository } from "../CommunityUpload.repository";
import { CommunityUploadService } from "../CommunityUpload.service";

interface UploadPayload {
  league_name: string;
  game: "poe1" | "poe2";
  device_id: string;
  cards: Array<{ card_name: string; count: number }>;
  events?: Array<{
    event_id: string;
    card_name: string;
    location: string | null;
    local_minute: number;
    utc_offset_minutes: number;
  }>;
  is_packaged?: boolean;
}

const DEVICE_ID = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
const LEAGUE = "Settlers";

function createPriceSnapshot() {
  return {
    timestamp: "2026-05-17T10:00:00.000Z",
    stackedDeckChaosCost: 3,
    chaosToDivineRatio: 200,
    cardPrices: {
      "The Doctor": { chaosValue: 1200, divineValue: 6 },
      "Rain of Chaos": { chaosValue: 2, divineValue: 0.01 },
    },
  };
}

function createEdgeResponse(uploadCount: number) {
  return {
    success: true,
    upload_id: `upload-${uploadCount}`,
    total_cards: 3,
    unique_cards: 2,
    upload_count: uploadCount,
    is_verified: false,
  };
}

function createDropEventResponse(acceptedEvents = 1, insertedEvents = 1) {
  return {
    success: true,
    accepted_events: acceptedEvents,
    inserted_events: insertedEvents,
  };
}

function getPowerMonitorHandler(eventName: "resume" | "suspend"): () => void {
  const handler = mockPowerMonitorOn.mock.calls.find(
    ([event]: [string]) => event === eventName,
  )?.[1];

  expect(handler).toEqual(expect.any(Function));
  return handler as () => void;
}

function lastUploadPayload(): UploadPayload {
  const call = [...mockCallEdgeFunction.mock.calls]
    .reverse()
    .find(([functionName]) => functionName === "v2-upload-community-data");
  expect(call).toBeDefined();
  return call?.[1] as UploadPayload;
}

function lastDropEventPayload(): UploadPayload {
  const call = [...mockCallEdgeFunction.mock.calls]
    .reverse()
    .find(([functionName]) => functionName === "upload-community-drop-events");
  expect(call).toBeDefined();
  return call?.[1] as UploadPayload;
}

function edgeFunctionCallCount(functionName: string): number {
  return mockCallEdgeFunction.mock.calls.filter(
    ([calledFunctionName]) => calledFunctionName === functionName,
  ).length;
}

function sortedCards(payload: UploadPayload) {
  return [...payload.cards].sort((a, b) =>
    a.card_name.localeCompare(b.card_name),
  );
}

async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  message: string,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(message);
}

describe("community upload main-process flows", () => {
  let testDb: TestDatabase;
  let currentSession: CurrentSessionService;
  let communityUpload: CommunityUploadService;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);
    mockGetDb.mockReturnValue(testDb.db);
    mockGetAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: { send: mockWebContentsSend },
      },
    ]);

    mockSettingsGet.mockImplementation((key: string) => {
      if (key === "communityUploadsEnabled") return Promise.resolve(true);
      if (key === "appPerformanceMonitorEnabled") return Promise.resolve(false);
      if (key === "appPerformanceAutoStartOnSession") {
        return Promise.resolve(false);
      }
      if (key === "raritySource") return Promise.resolve("poe.ninja");
      return Promise.resolve(null);
    });
    mockIsConfigured.mockReturnValue(true);
    mockGetAccessToken.mockResolvedValue(null);
    mockGetAccountId.mockResolvedValue(null);
    mockAppPerformanceStartFreshCapture.mockResolvedValue({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });
    mockAppPerformanceStopCapture.mockResolvedValue({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });
    mockAppPerformanceGetState.mockReturnValue({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });

    const leagueId = await seedLeague(testDb.kysely, {
      id: "poe1-settlers",
      game: "poe1",
      name: LEAGUE,
    });
    const snapshotId = await seedSnapshot(testDb.kysely, {
      id: "snapshot-settlers",
      leagueId,
    });
    await seedSession(testDb.kysely, {
      id: "pending-event-session",
      game: "poe1",
      leagueId,
      startedAt: "2026-03-14T09:00:00.000Z",
      endedAt: "2026-03-14T10:00:00.000Z",
      isActive: false,
    });
    await testDb.kysely
      .insertInto("app_metadata")
      .values({ key: "device_id", value: DEVICE_ID })
      .execute();

    const priceSnapshot = createPriceSnapshot();
    mockGetSnapshotForSession.mockResolvedValue({
      snapshotId,
      data: priceSnapshot,
    });
    mockLoadSnapshot.mockResolvedValue(priceSnapshot);

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    communityUpload = CommunityUploadService.getInstance();
    await new CommunityUploadRepository(testDb.kysely).setDropContextConsent(
      true,
    );
    currentSession = CurrentSessionService.getInstance();
  });

  afterEach(async () => {
    await communityUpload.drainInFlightUploads();
    resetSingletons(
      CurrentSessionService,
      CommunityUploadService,
      StorageService,
    );
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    await testDb.close();
    vi.clearAllMocks();
  });

  async function addThreeCardsAndStop(
    options: Parameters<CurrentSessionService["stopSession"]>[1] = {},
  ) {
    await currentSession.startSession("poe1", LEAGUE);
    await currentSession.addCard("poe1", LEAGUE, "The Doctor", "drop-1");
    await currentSession.addCard("poe1", LEAGUE, "Rain of Chaos", "drop-2");
    await currentSession.addCard("poe1", LEAGUE, "The Doctor", "drop-3");

    return currentSession.stopSession("poe1", options);
  }

  async function getOutboxRows() {
    return testDb.kysely
      .selectFrom("community_upload_outbox")
      .selectAll()
      .execute();
  }

  async function getUploadedSnapshotRows() {
    return testDb.kysely
      .selectFrom("community_upload_snapshot")
      .select(["card_name", "count"])
      .where("game", "=", "poe1")
      .where("scope", "=", LEAGUE)
      .orderBy("card_name", "asc")
      .execute();
  }

  async function getDropEventOutboxRows() {
    return testDb.kysely
      .selectFrom("community_drop_event_outbox")
      .selectAll()
      .execute();
  }

  describe("identity switching without duplicate contributions", () => {
    let serverCounts: Map<string, Map<string, number>>;
    let eventOwners: Map<string, string>;
    let openings = 0;
    beforeEach(() => {
      serverCounts = new Map();
      eventOwners = new Map();
      mockCallEdgeFunction.mockImplementation(
        async (
          name: string,
          payload: any,
          headers?: Record<string, string>,
        ) => {
          if (payload.action === "link-ggg")
            return {
              success: true,
              device_id: payload.device_id,
              ggg_uuid: await mockGetAccountId(),
              legacy_anonymous: true,
            };
          if (name === "upload-community-drop-events") {
            for (const event of payload.events) {
              expect(eventOwners.get(event.event_id) ?? payload.device_id).toBe(
                payload.device_id,
              );
              eventOwners.set(event.event_id, payload.device_id);
            }
            return createDropEventResponse(
              payload.events.length,
              payload.events.length,
            );
          }
          const counts =
            serverCounts.get(payload.device_id) ?? new Map<string, number>();
          for (const card of payload.cards)
            counts.set(
              card.card_name,
              Math.max(counts.get(card.card_name) ?? 0, card.count),
            );
          serverCounts.set(payload.device_id, counts);
          return {
            ...createEdgeResponse(1),
            is_verified: !!headers?.["X-GGG-Token"],
          };
        },
      );
    });
    async function verify(account: string) {
      mockGetAccountId.mockResolvedValue(account);
      mockGetAccessToken.mockResolvedValue(`token-${account}`);
      await communityUpload.linkGggAccount(account);
      await communityUpload.drainInFlightUploads();
      return (
        await new CommunityIdentityRepository(
          testDb.kysely,
          testDb.db,
        ).getActive()
      ).id;
    }
    async function unlink() {
      await communityUpload.unlinkGggAccount(() => {
        mockGetAccountId.mockResolvedValue(null);
        mockGetAccessToken.mockResolvedValue(null);
      });
      return (
        await new CommunityIdentityRepository(
          testDb.kysely,
          testDb.db,
        ).getActive()
      ).id;
    }
    async function open(count = 1, stop = true) {
      if (!currentSession.isSessionActive("poe1"))
        await currentSession.startSession("poe1", LEAGUE);
      for (let i = 0; i < count; i++)
        await currentSession.addCard(
          "poe1",
          LEAGUE,
          "The Doctor",
          `identity-opening-${++openings}`,
        );
      if (stop)
        await currentSession.stopSession("poe1", {
          waitForCommunityUpload: true,
        });
    }
    function total() {
      return [...serverCounts.values()].reduce(
        (sum, cards) => sum + [...cards.values()].reduce((a, b) => a + b, 0),
        0,
      );
    }

    function delayNextIdentityLink() {
      const server = mockCallEdgeFunction.getMockImplementation()!;
      let finishFirst!: () => void;
      let firstStarted = false;
      const holdFirst = new Promise<void>((resolve) => {
        finishFirst = resolve;
      });
      mockCallEdgeFunction.mockImplementation(
        async (name: string, payload: any, headers: any) => {
          const response = await server(name, payload, headers);
          if (payload.action === "link-ggg" && !firstStarted) {
            firstStarted = true;
            await holdFirst;
          }
          return response;
        },
      );
      return {
        release: () => finishFirst(),
        waitUntilStarted: () =>
          waitForCondition(() => firstStarted, "link did not start"),
      };
    }

    it("serializes different account links and records new openings for the latest account", async () => {
      const delayed = delayNextIdentityLink();
      mockGetAccountId.mockResolvedValue("account-a");
      mockGetAccessToken.mockResolvedValue("token-account-a");
      const first = communityUpload.linkGggAccount("account-a");
      await delayed.waitUntilStarted();
      mockGetAccountId.mockResolvedValue("account-b");
      mockGetAccessToken.mockResolvedValue("token-account-b");
      const second = communityUpload.linkGggAccount("account-b");
      expect(second).not.toBe(first);
      expect(communityUpload.linkGggAccount("account-b")).toBe(second);
      delayed.release();
      await Promise.all([first, second]);
      await communityUpload.drainInFlightUploads();
      const identities = new CommunityIdentityRepository(
        testDb.kysely,
        testDb.db,
      );
      const active = await identities.getActive();
      expect(active.account_id).toBe("account-b");
      expect(await identities.getVerified("account-a")).toBeUndefined();
      await open(1);
      expect(serverCounts.get(active.id)?.get("The Doctor")).toBe(1);
      expect(total()).toBe(1);
    });

    it("does not reuse a superseded same-account job after an A-B-A switch", async () => {
      const delayed = delayNextIdentityLink();
      mockGetAccountId.mockResolvedValue("account-a");
      mockGetAccessToken.mockResolvedValue("token-account-a");
      const first = communityUpload.linkGggAccount("account-a");
      await delayed.waitUntilStarted();
      const second = communityUpload.linkGggAccount("account-b");
      const third = communityUpload.linkGggAccount("account-a");
      expect(third).not.toBe(first);
      delayed.release();
      await Promise.all([first, second, third]);
      await communityUpload.drainInFlightUploads();
      expect(
        (
          await new CommunityIdentityRepository(
            testDb.kysely,
            testDb.db,
          ).getActive()
        ).account_id,
      ).toBe("account-a");
      expect(
        mockCallEdgeFunction.mock.calls.filter(
          ([, payload]) => payload.action === "link-ggg",
        ),
      ).toHaveLength(2);
    });

    it("rejects activation if the signed-in account changes without another link request", async () => {
      const delayed = delayNextIdentityLink();
      mockGetAccountId.mockResolvedValue("account-a");
      mockGetAccessToken.mockResolvedValue("token-account-a");
      const linking = communityUpload.linkGggAccount("account-a");
      const rejected = expect(linking).rejects.toThrow("GGG sign-in changed");
      await delayed.waitUntilStarted();
      mockGetAccountId.mockResolvedValue("account-b");
      delayed.release();
      await rejected;
      expect(
        (
          await new CommunityIdentityRepository(
            testDb.kysely,
            testDb.db,
          ).getActive()
        ).kind,
      ).toBe("legacy");
    });

    it("automatically resumes proof-blocked uploads when their original account is linked", async () => {
      const verified = await verify("account-a");
      mockCallEdgeFunction.mockRejectedValueOnce(
        new EdgeFunctionError(
          "v2-upload-community-data",
          409,
          "proof required",
          { code: "COMMUNITY_IDENTITY_PROOF_REQUIRED" },
        ),
      );
      await open(2);
      expect(await getOutboxRows()).toHaveLength(1);
      await unlink();
      expect(await verify("account-a")).toBe(verified);
      expect(await getOutboxRows()).toEqual([]);
      expect(await getDropEventOutboxRows()).toEqual([]);
      expect(total()).toBe(2);
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
    });

    it("does not upload unfinished session observations when an account is linked", async () => {
      await verify("account-a");
      await open(1, false);
      await unlink();
      await verify("account-a");
      expect(serverCounts.size).toBe(0);
      expect(await getOutboxRows()).toEqual([]);
      await open(0);
      expect(total()).toBe(1);
    });

    it("automatically resumes a proof-blocked context queue without replaying card counts", async () => {
      await verify("account-a");
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementationOnce(server);
      mockCallEdgeFunction.mockRejectedValueOnce(
        new EdgeFunctionError(
          "upload-community-drop-events",
          409,
          "proof required",
          {
            code: "COMMUNITY_IDENTITY_PROOF_REQUIRED",
          },
        ),
      );
      await open(1);
      const countRequests = edgeFunctionCallCount("v2-upload-community-data");
      expect(await getDropEventOutboxRows()).toHaveLength(1);
      await unlink();
      await verify("account-a");
      expect(await getDropEventOutboxRows()).toEqual([]);
      // The additional request resolves the link; acknowledged card counts stay local.
      expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(
        countRequests + 1,
      );
      expect(total()).toBe(1);
      expect(eventOwners.size).toBe(1);
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
    });

    it("keeps one owner's context warning after another owner's context upload succeeds", async () => {
      const verified = await verify("account-a");
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementationOnce(server);
      mockCallEdgeFunction.mockRejectedValueOnce(
        new EdgeFunctionError("upload-community-drop-events", 409, "conflict", {
          code: "COMMUNITY_IDENTITY_CONFLICT",
        }),
      );
      await open(1);
      await unlink();
      await verify("account-b");
      testDb.db
        .prepare(
          "UPDATE community_drop_event_upload_state SET next_attempt_at = NULL",
        )
        .run();
      await open(1);
      expect(
        (await getDropEventOutboxRows()).map((row) => row.identity_id),
      ).toEqual([verified]);
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBe("account-mismatch");
      expect(total()).toBe(2);
    });

    it("keeps anonymous periods anonymous, restores the verified ID, and uploads each opening once", async () => {
      await open(2);
      const verified = await verify("account-a");
      await open(3);
      const anonymous = await unlink();
      await open(4);
      expect(await verify("account-a")).toBe(verified);
      await open(1);
      expect(serverCounts.get(DEVICE_ID)?.get("The Doctor")).toBe(2);
      expect(serverCounts.get(verified)?.get("The Doctor")).toBe(4);
      expect(serverCounts.get(anonymous)?.get("The Doctor")).toBe(4);
      expect(total()).toBe(10);
      const before = mockCallEdgeFunction.mock.calls.length;
      await communityUpload.flushPendingUploads();
      await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);
      expect(mockCallEdgeFunction).toHaveBeenCalledTimes(before);
      expect(eventOwners.size).toBe(10);
      for (const [name, payload, headers] of mockCallEdgeFunction.mock.calls) {
        if (
          name === "v2-upload-community-data" &&
          !payload.action &&
          payload.device_id !== verified
        )
          expect(headers).toEqual({});
      }
    });

    it("splits openings during one session at the identity switch", async () => {
      const verified = await verify("account-a");
      await open(2, false);
      const anonymous = await unlink();
      await open(1);
      // Old verified data stays queued while signed out, never reassigned to anonymous.
      expect(serverCounts.get(anonymous)?.get("The Doctor")).toBe(1);
      expect(serverCounts.has(verified)).toBe(false);
      expect(await verify("account-a")).toBe(verified);
      await communityUpload.flushPendingUploads();
      expect(serverCounts.get(verified)?.get("The Doctor")).toBe(2);
      expect(total()).toBe(3);
      expect(eventOwners.size).toBe(3);
    });

    it("retries a committed upload after a lost acknowledgement under its original identity", async () => {
      const verified = await verify("account-a");
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementationOnce(async (...args) => {
        await server(...args);
        throw new Error("acknowledgement lost");
      });
      await open(2);
      expect(total()).toBe(2);
      const anonymous = await unlink();
      await open(1);
      expect(total()).toBe(3);
      expect(await verify("account-a")).toBe(verified);
      testDb.db
        .prepare("UPDATE community_upload_outbox SET next_attempt_at = NULL")
        .run();
      resetSingletons(CommunityUploadService);
      communityUpload = CommunityUploadService.getInstance();
      await communityUpload.flushPendingUploads();
      expect(total()).toBe(3);
      expect(serverCounts.get(verified)?.get("The Doctor")).toBe(2);
      expect(serverCounts.get(anonymous)?.get("The Doctor")).toBe(1);
      await expect(getOutboxRows()).resolves.toEqual([]);
      expect(eventOwners.size).toBe(3);
    });

    it("never counts rebuilt historical aggregates as new openings after session deletion", async () => {
      await open(2);
      const first = await testDb.kysely
        .selectFrom("sessions")
        .select("id")
        .where("total_count", "=", 2)
        .executeTakeFirstOrThrow();
      await open(3);
      const anonymous = await unlink();
      await new SessionsRepository(testDb.kysely).deleteSessions("poe1", [
        first.id,
      ]);
      await communityUpload.flushPendingUploads();
      expect(total()).toBe(5);
      expect(serverCounts.has(anonymous)).toBe(false);
      await open(1);
      expect(serverCounts.get(anonymous)?.get("The Doctor")).toBe(1);
      expect(total()).toBe(6);
    });

    it("continues future anonymous uploads after credentials disappear and keeps verified history paused", async () => {
      const verified = await verify("account-a");
      await open(2);
      mockGetAccessToken.mockImplementationOnce(async () => {
        mockGetAccountId.mockResolvedValue(null);
        return null;
      });
      await open(1);
      const anonymous = (
        await new CommunityIdentityRepository(
          testDb.kysely,
          testDb.db,
        ).getActive()
      ).id;
      expect(anonymous).not.toBe(verified);
      await open(1);
      expect(serverCounts.get(anonymous)?.get("The Doctor")).toBe(1);
      expect(await communityUpload.getDropContextUploadStatus()).toMatchObject({
        pendingEvents: 0,
        isUploading: false,
      });
      expect(await verify("account-a")).toBe(verified);
      await communityUpload.flushPendingUploads();
      expect(total()).toBe(4);
    });

    it("invalidates renderer auth status when the local session disappears before a flush", async () => {
      const verified = await verify("account-a");
      await open(2);
      mockGetAccountId.mockResolvedValue(null);
      mockGetAccessToken.mockResolvedValue(null);
      await communityUpload.flushPendingUploads();
      const active = await new CommunityIdentityRepository(
        testDb.kysely,
        testDb.db,
      ).getActive();
      expect(active.kind).toBe("anonymous");
      expect(active.id).not.toBe(verified);
      expect(mockNotifyAuthStatusChanged).toHaveBeenCalledOnce();
      await open(1);
      expect(serverCounts.get(active.id)?.get("The Doctor")).toBe(1);
      expect(total()).toBe(3);
    });

    it("resolves the original anonymous backlog when OAuth completes while sharing is off", async () => {
      const previous = mockSettingsGet.getMockImplementation()!;
      mockSettingsGet.mockImplementation((key: string) =>
        key === "communityUploadsEnabled"
          ? Promise.resolve(false)
          : previous(key),
      );
      await open(2);
      mockGetAccountId.mockResolvedValue("account-a");
      mockGetAccessToken.mockResolvedValue("token-a");
      await communityUpload.linkGggAccount("account-a");
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
      mockSettingsGet.mockImplementation(previous);
      await communityUpload.flushPendingUploads();
      expect(serverCounts.get(DEVICE_ID)?.get("The Doctor")).toBe(2);
      expect(await getOutboxRows()).toEqual([]);
      expect(
        (
          await new CommunityIdentityRepository(
            testDb.kysely,
            testDb.db,
          ).getActive()
        ).kind,
      ).toBe("verified");
    });

    it("defers identity activation if consent is withdrawn during linking and resolves the backlog when re-enabled", async () => {
      await open(2, false);
      const previous = mockSettingsGet.getMockImplementation()!;
      let consentReads = 0;
      mockSettingsGet.mockImplementation((key: string) =>
        key === "communityUploadsEnabled"
          ? Promise.resolve(++consentReads === 1)
          : previous(key),
      );
      await verify("account-a");
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
      const identities = new CommunityIdentityRepository(
        testDb.kysely,
        testDb.db,
      );
      expect(await identities.getActive()).toMatchObject({
        id: DEVICE_ID,
        kind: "legacy",
      });
      mockSettingsGet.mockImplementation(previous);
      await communityUpload.flushPendingUploads();
      expect(await identities.get(DEVICE_ID)).toMatchObject({
        kind: "anonymous",
      });
      expect(serverCounts.get(DEVICE_ID)?.get("The Doctor")).toBe(2);
      expect(await getOutboxRows()).toEqual([]);
      await open(1);
      expect(total()).toBe(3);
      expect(eventOwners.size).toBe(3);
    });

    it("pauses a legacy context-only queue when proof is missing and sends future anonymous contributions", async () => {
      await open(2);
      await testDb.kysely
        .insertInto("community_drop_event_outbox")
        .values({
          event_id: "aaaaaaaa-1111-4222-8333-000000000099",
          session_id: "pending-event-session",
          game: "poe1",
          scope: LEAGUE,
          card_name: "The Doctor",
          location: null,
          local_minute: 1,
          utc_offset_minutes: 0,
        })
        .execute();
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementation(
        async (name: string, payload: any, ...args: any[]) => {
          if (
            name === "upload-community-drop-events" &&
            payload.device_id === DEVICE_ID
          )
            throw new EdgeFunctionError(name, 409, "proof required", {
              code: "COMMUNITY_IDENTITY_PROOF_REQUIRED",
            });
          return server(name, payload, ...args);
        },
      );
      await communityUpload.flushPendingUploads();
      const active = await new CommunityIdentityRepository(
        testDb.kysely,
        testDb.db,
      ).getActive();
      expect(active.kind).toBe("anonymous");
      expect(active.id).not.toBe(DEVICE_ID);
      expect(await communityUpload.getDropContextUploadStatus()).toMatchObject({
        pendingEvents: 0,
        isUploading: false,
      });
      await open(1);
      testDb.db
        .prepare(
          "UPDATE community_drop_event_upload_state SET next_attempt_at = NULL",
        )
        .run();
      await communityUpload.flushPendingUploads();
      expect(serverCounts.get(active.id)?.get("The Doctor")).toBe(1);
      expect(total()).toBe(3);
      expect(await getDropEventOutboxRows()).toHaveLength(1);
      expect(await communityUpload.getDropContextUploadStatus()).toMatchObject({
        pendingEvents: 0,
        isUploading: false,
        uploadWarning: "verification-required",
      });
    });

    it("purges never-shared observations and starts future league contributions at one", async () => {
      const previous = mockSettingsGet.getMockImplementation()!;
      mockSettingsGet.mockImplementation((key: string) =>
        key === "communityUploadsEnabled"
          ? Promise.resolve(false)
          : previous(key),
      );
      await open(5);
      const storage = StorageService.getInstance();
      expect(await (storage as any).deleteLeagueData("poe1-settlers")).toEqual({
        success: true,
        freedBytes: 0,
      });
      mockSettingsGet.mockImplementation(previous);
      await communityUpload.flushPendingUploads();
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
      await seedLeague(testDb.kysely, { id: "poe1-settlers", name: LEAGUE });
      await seedSnapshot(testDb.kysely, {
        id: "snapshot-settlers",
        leagueId: "poe1-settlers",
      });
      await open(1);
      expect(total()).toBe(1);
      expect(serverCounts.has(DEVICE_ID)).toBe(false);
    });

    it("purges a lost-acknowledgement upload without replaying or undercounting verified openings", async () => {
      const verified = await verify("account-a");
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementationOnce(async (...args) => {
        await server(...args);
        throw new Error("acknowledgement lost");
      });
      await open(5);
      expect(total()).toBe(5);
      expect(
        await (StorageService.getInstance() as any).deleteLeagueData(
          "poe1-settlers",
        ),
      ).toMatchObject({ success: true });
      await seedLeague(testDb.kysely, { id: "poe1-settlers", name: LEAGUE });
      await seedSnapshot(testDb.kysely, {
        id: "snapshot-settlers",
        leagueId: "poe1-settlers",
      });
      await open(1);
      expect(total()).toBe(6);
      expect(lastUploadPayload().device_id).not.toBe(verified);
      const epoch = lastUploadPayload().device_id;
      await unlink();
      expect(await verify("account-a")).toBe(verified);
      await open(1);
      expect(lastUploadPayload().device_id).toBe(epoch);
      expect(total()).toBe(7);
    });

    it.each([
      null,
      {},
      { success: false },
      { ...createEdgeResponse(1), is_verified: true },
    ])(
      "retains counts without a valid acknowledgement: %j",
      async (response) => {
        mockCallEdgeFunction.mockResolvedValue(response);
        await open(1);
        expect(await getOutboxRows()).toHaveLength(1);
        expect(await getUploadedSnapshotRows()).toEqual([]);
      },
    );

    it("keeps different accounts on different verified IDs", async () => {
      const accountA = await verify("account-a");
      await open(2);
      await unlink();
      const accountB = await verify("account-b");
      expect(accountB).not.toBe(accountA);
      await open(3);
      await unlink();
      expect(await verify("account-a")).toBe(accountA);
      await open(1);
      expect(serverCounts.get(accountA)?.get("The Doctor")).toBe(3);
      expect(serverCounts.get(accountB)?.get("The Doctor")).toBe(3);
      expect(total()).toBe(6);
    });

    it("restores a legacy verified installation without resending its acknowledged history", async () => {
      await open(2);
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementation(
        async (name: string, payload: any, ...args: any[]) => {
          if (payload.action === "link-ggg")
            return {
              success: true,
              device_id: DEVICE_ID,
              ggg_uuid: "account-a",
              legacy_anonymous: false,
            };
          return server(name, payload, ...args);
        },
      );
      expect(await verify("account-a")).toBe(DEVICE_ID);
      const before = mockCallEdgeFunction.mock.calls.length;
      await communityUpload.flushPendingUploads();
      expect(mockCallEdgeFunction).toHaveBeenCalledTimes(before);
      await open(1);
      expect(serverCounts.size).toBe(1);
      expect(total()).toBe(3);
    });

    it("isolates a legacy verified queue when the server requires a missing GGG proof", async () => {
      mockCallEdgeFunction.mockRejectedValueOnce(
        new EdgeFunctionError(
          "v2-upload-community-data",
          409,
          "This upload identity requires its original verification",
          { code: "COMMUNITY_IDENTITY_PROOF_REQUIRED" },
        ),
      );
      await open(2);
      const active = await new CommunityIdentityRepository(
        testDb.kysely,
        testDb.db,
      ).getActive();
      expect(active.kind).toBe("anonymous");
      expect(active.id).not.toBe(DEVICE_ID);
      await open(1);
      expect(serverCounts.get(active.id)?.get("The Doctor")).toBe(1);
      expect(serverCounts.has(DEVICE_ID)).toBe(false);
      expect(await communityUpload.getDropContextUploadStatus()).toMatchObject({
        pendingEvents: 0,
        isUploading: false,
      });
      expect(await getOutboxRows()).toHaveLength(1);
    });

    it("shows a durable count-upload warning without context consent and clears it after the original account uploads", async () => {
      await new CommunityUploadRepository(testDb.kysely).setDropContextConsent(
        false,
      );
      mockCallEdgeFunction.mockRejectedValueOnce(
        new EdgeFunctionError(
          "v2-upload-community-data",
          409,
          "proof required",
          {
            code: "COMMUNITY_IDENTITY_PROOF_REQUIRED",
          },
        ),
      );
      await open(2);
      expect((await getOutboxRows())[0].last_error).toBe(
        "COMMUNITY_IDENTITY_PROOF_REQUIRED",
      );
      await open(1);
      expect(total()).toBe(1);
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBe("verification-required");
      // Older builds saved the full server response seen in the user's log.
      testDb.db
        .prepare("UPDATE community_upload_outbox SET last_error = ?")
        .run(
          'Edge Function v2-upload-community-data failed (409): {"code":"COMMUNITY_IDENTITY_PROOF_REQUIRED","error":"This upload identity requires its original verification"}',
        );
      resetSingletons(CommunityUploadService);
      communityUpload = CommunityUploadService.getInstance();
      expect(await communityUpload.getDropContextUploadStatus()).toMatchObject({
        pendingEvents: 0,
        isUploading: false,
        uploadWarning: "verification-required",
      });
      expect(mockWebContentsSend).toHaveBeenCalledWith(
        CommunityUploadChannel.DropContextUploadStatusChanged,
        expect.objectContaining({ uploadWarning: "verification-required" }),
      );
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementation(
        async (name: string, payload: any, ...args: any[]) => {
          if (payload.action === "link-ggg")
            return {
              success: true,
              device_id: DEVICE_ID,
              ggg_uuid: "account-a",
              legacy_anonymous: false,
            };
          return server(name, payload, ...args);
        },
      );
      expect(await verify("account-a")).toBe(DEVICE_ID);
      testDb.db
        .prepare("UPDATE community_upload_outbox SET next_attempt_at = NULL")
        .run();
      await communityUpload.flushPendingUploads();
      expect(total()).toBe(3);
      expect(await getOutboxRows()).toEqual([]);
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
    });

    it("warns about account conflicts without exposing the server error", async () => {
      mockCallEdgeFunction.mockRejectedValueOnce(
        new EdgeFunctionError(
          "v2-upload-community-data",
          409,
          "private server details",
          { code: "COMMUNITY_IDENTITY_CONFLICT" },
        ),
      );
      await open(1);
      const status = await communityUpload.getDropContextUploadStatus();
      expect(status.uploadWarning).toBe("account-mismatch");
      expect(JSON.stringify(status)).not.toContain("private server details");
      expect((await getOutboxRows())[0].last_error).toBe(
        "COMMUNITY_IDENTITY_CONFLICT",
      );
    });

    it("warns only for pending verified contributions when a different account is linked", async () => {
      await verify("account-a");
      await open(1);
      await unlink();
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
      await verify("account-a");
      mockCallEdgeFunction.mockRejectedValueOnce(new Error("offline"));
      await open(1);
      await unlink();
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBe("verification-required");
      await verify("account-b");
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBe("account-mismatch");
      await verify("account-a");
      testDb.db
        .prepare("UPDATE community_upload_outbox SET next_attempt_at = NULL")
        .run();
      await communityUpload.flushPendingUploads();
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
      expect(total()).toBe(2);
    });

    it("warns about paused context only while context sharing is enabled", async () => {
      await verify("account-a");
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockImplementationOnce(server);
      mockCallEdgeFunction.mockRejectedValueOnce(new Error("offline"));
      await open(1);
      expect(await getOutboxRows()).toEqual([]);
      expect(await getDropEventOutboxRows()).toHaveLength(1);
      await unlink();
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBe("verification-required");
      await new CommunityUploadRepository(testDb.kysely).setDropContextConsent(
        false,
      );
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
      await new CommunityUploadRepository(testDb.kysely).setDropContextConsent(
        true,
      );
      await verify("account-a");
      testDb.db
        .prepare(
          "UPDATE community_drop_event_upload_state SET next_attempt_at = NULL",
        )
        .run();
      await communityUpload.flushPendingUploads();
      expect(await getDropEventOutboxRows()).toEqual([]);
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
      expect(total()).toBe(1);
    });

    it("retains the server's verification requirement for a context-only backlog", async () => {
      const server = mockCallEdgeFunction.getMockImplementation()!;
      let rejectContext = true;
      mockCallEdgeFunction.mockImplementation(
        async (name: string, payload: any, ...args: any[]) => {
          if (name === "upload-community-drop-events" && rejectContext) {
            rejectContext = false;
            throw new EdgeFunctionError(name, 409, "proof required", {
              code: "COMMUNITY_IDENTITY_PROOF_REQUIRED",
            });
          }
          return server(name, payload, ...args);
        },
      );
      await open(1);
      expect(await getOutboxRows()).toEqual([]);
      expect(await getDropEventOutboxRows()).toHaveLength(1);
      resetSingletons(CommunityUploadService);
      communityUpload = CommunityUploadService.getInstance();
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBe("verification-required");
      expect(
        testDb.db
          .prepare("SELECT last_error FROM community_drop_event_upload_state")
          .get(),
      ).toEqual({ last_error: "COMMUNITY_IDENTITY_PROOF_REQUIRED" });
      await new CommunityUploadRepository(testDb.kysely).setDropContextConsent(
        false,
      );
      expect(
        (await communityUpload.getDropContextUploadStatus()).uploadWarning,
      ).toBeUndefined();
    });

    it("does not contact community services when linking with community sharing disabled", async () => {
      const previousGet = mockSettingsGet.getMockImplementation();
      mockSettingsGet.mockImplementation((key: string) =>
        key === "communityUploadsEnabled"
          ? Promise.resolve(false)
          : previousGet?.(key),
      );
      await verify("account-a");
      await open(2);
      await communityUpload.flushPendingUploads();
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
      expect(serverCounts.size).toBe(0);
    });

    it("does not turn anonymous queued data into verified data when verifying", async () => {
      const server = mockCallEdgeFunction.getMockImplementation()!;
      mockCallEdgeFunction.mockRejectedValueOnce(new Error("offline"));
      await open(2);
      const verified = await verify("account-a");
      testDb.db
        .prepare("UPDATE community_upload_outbox SET next_attempt_at = NULL")
        .run();
      await communityUpload.flushPendingUploads();
      expect(serverCounts.get(DEVICE_ID)?.get("The Doctor")).toBe(2);
      expect(serverCounts.has(verified)).toBe(false);
      expect(total()).toBe(2);
      expect(server).toBeTypeOf("function");
      expect(eventOwners.size).toBe(2);
    });
  });

  it.each([null, false])(
    "sends no community requests on startup, resume, or session end without general consent (%j)",
    async (consent) => {
      const settings = new SettingsStoreRepository(testDb.kysely);
      const previousGet = mockSettingsGet.getMockImplementation();
      mockSettingsGet.mockImplementation((key: string) =>
        key === "communityUploadsEnabled"
          ? settings.get("communityUploadsEnabled")
          : previousGet?.(key),
      );
      if (consent === false)
        await settings.set("communityUploadsEnabled", false);
      await testDb.kysely
        .deleteFrom("app_metadata")
        .where("key", "=", "community_drop_context_consent_v1")
        .execute();
      await addThreeCardsAndStop({ waitForCommunityUpload: true });
      await testDb.kysely
        .insertInto("community_upload_outbox")
        .values({
          identity_id: DEVICE_ID,
          game: "poe1",
          scope: LEAGUE,
          cards_json: JSON.stringify([{ card_name: "The Doctor", count: 2 }]),
        })
        .execute();

      resetSingletons(CommunityUploadService);
      communityUpload = CommunityUploadService.getInstance();
      await communityUpload.flushPendingUploads();
      getPowerMonitorHandler("resume")();
      await communityUpload.flushPendingUploads();
      await communityUpload.linkGggAccount();
      await communityUpload.backfillIfNeeded();
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
      await expect(getOutboxRows()).resolves.toHaveLength(1);
      await expect(getDropEventOutboxRows()).resolves.toHaveLength(3);
      await expect(getUploadedSnapshotRows()).resolves.toEqual([]);

      await settings.set("communityUploadsEnabled", true);
      mockCallEdgeFunction.mockResolvedValue(createEdgeResponse(1));
      await communityUpload.flushPendingUploads();
      expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(1);
      expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(0);
      await expect(getDropEventOutboxRows()).resolves.toHaveLength(3);
    },
  );

  it.each([null, false])(
    "preserves a legacy contributor's count uploads without extending consent to opening context (%j)",
    async (contextConsent) => {
      await testDb.kysely
        .insertInto("app_metadata")
        .values({
          key: `community_backfill_done_poe1_${LEAGUE}`,
          value: "true",
        })
        .execute();
      const repository = new CommunityUploadRepository(testDb.kysely);
      if (contextConsent === null) {
        await testDb.kysely
          .deleteFrom("app_metadata")
          .where("key", "=", "community_drop_context_consent_v1")
          .execute();
      } else {
        await repository.setDropContextConsent(false);
      }

      let settings = new SettingsStoreRepository(testDb.kysely);
      const previousGet = mockSettingsGet.getMockImplementation();
      mockSettingsGet.mockImplementation((key: string) =>
        key === "communityUploadsEnabled"
          ? settings.get("communityUploadsEnabled")
          : previousGet?.(key),
      );
      mockCallEdgeFunction.mockResolvedValue(createEdgeResponse(1));

      await addThreeCardsAndStop({ waitForCommunityUpload: true });
      expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(1);
      expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(0);
      await expect(getUploadedSnapshotRows()).resolves.toEqual([
        { card_name: "Rain of Chaos", count: 1 },
        { card_name: "The Doctor", count: 2 },
      ]);
      await expect(getDropEventOutboxRows()).resolves.toHaveLength(3);

      settings = new SettingsStoreRepository(testDb.kysely);
      resetSingletons(CommunityUploadService);
      communityUpload = CommunityUploadService.getInstance();
      await communityUpload.flushPendingUploads();
      getPowerMonitorHandler("resume")();
      await communityUpload.flushPendingUploads();
      await expect(settings.get("communityUploadsEnabled")).resolves.toBe(true);
      await expect(repository.getDropContextConsent()).resolves.toBe(
        contextConsent,
      );
      expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(1);
      expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(0);
      await expect(getDropEventOutboxRows()).resolves.toHaveLength(3);

      await repository.setDropContextConsent(true);
      mockCallEdgeFunction.mockResolvedValue(createDropEventResponse(3, 3));
      await communityUpload.flushPendingUploads();
      expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(1);
      await expect(getDropEventOutboxRows()).resolves.toEqual([]);
    },
  );

  it("finishes an in-flight verified upload before unlinking and sends subsequent counts without a GGG token", async () => {
    new CommunityIdentityRepository(testDb.kysely, testDb.db).activateVerified(
      DEVICE_ID,
      "account-a",
      false,
    );
    mockGetAccountId.mockResolvedValue("account-a");
    mockGetAccessToken.mockResolvedValue("valid-ggg-token");
    let finishUpload!: (result: ReturnType<typeof createEdgeResponse>) => void;
    let countRequests = 0;
    mockCallEdgeFunction.mockImplementation(
      (functionName: string, payload: { action?: string }) => {
        if (payload.action) throw new Error("Unexpected remote account action");
        if (functionName === "upload-community-drop-events")
          return Promise.resolve(createDropEventResponse(3, 3));
        countRequests += 1;
        if (countRequests === 1)
          return new Promise((resolve) => {
            finishUpload = resolve;
          });
        return Promise.resolve(createEdgeResponse(2));
      },
    );
    const ending = addThreeCardsAndStop({ waitForCommunityUpload: true });
    await vi.waitFor(() => expect(finishUpload).toBeTypeOf("function"));
    const clearSession = vi.fn(() => {
      mockGetAccessToken.mockResolvedValue(null);
      mockGetAccountId.mockResolvedValue(null);
    });
    const unlinking = communityUpload.unlinkGggAccount(clearSession);
    await communityUpload.linkGggAccount();
    expect(
      mockCallEdgeFunction.mock.calls.some(([, payload]) => payload.action),
    ).toBe(false);
    finishUpload({ ...createEdgeResponse(1), is_verified: true });
    await unlinking;
    await ending;
    expect(clearSession).toHaveBeenCalledOnce();
    await currentSession.startSession("poe1", LEAGUE);
    await currentSession.addCard("poe1", LEAGUE, "The Doctor", "after-unlink");
    await currentSession.stopSession("poe1", { waitForCommunityUpload: true });
    const countCalls = mockCallEdgeFunction.mock.calls.filter(
      ([name, payload]) =>
        name === "v2-upload-community-data" && !payload.action,
    );
    expect(countCalls).toHaveLength(2);
    expect(countCalls[0][2]).toEqual({ "X-GGG-Token": "valid-ggg-token" });
    expect(countCalls[1][2]).toEqual({});
  });

  it("discards a token captured before unlinking even if a settings read finishes later", async () => {
    new CommunityIdentityRepository(testDb.kysely, testDb.db).activateVerified(
      DEVICE_ID,
      "account-a",
      false,
    );
    mockGetAccountId.mockResolvedValue("account-a");
    const previousGet = mockSettingsGet.getMockImplementation();
    let finishSettingsRead!: (enabled: boolean) => void;
    mockGetAccessToken.mockImplementationOnce(async () => {
      mockSettingsGet.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            finishSettingsRead = resolve;
          }),
      );
      return "old-ggg-token";
    });
    mockCallEdgeFunction.mockImplementation((name: string) =>
      Promise.resolve(
        name === "upload-community-drop-events"
          ? createDropEventResponse(3, 3)
          : createEdgeResponse(1),
      ),
    );
    const ending = addThreeCardsAndStop({ waitForCommunityUpload: true });
    await vi.waitFor(() => expect(finishSettingsRead).toBeTypeOf("function"));
    mockSettingsGet.mockImplementation(previousGet!);
    mockGetAccessToken.mockResolvedValue("current-ggg-token");
    await communityUpload.unlinkGggAccount(() => {
      mockGetAccessToken.mockResolvedValue(null);
      mockGetAccountId.mockResolvedValue(null);
    });
    finishSettingsRead(true);
    await ending;
    expect(
      mockCallEdgeFunction.mock.calls.some(
        ([name, payload]) =>
          name === "v2-upload-community-data" && !payload.action,
      ),
    ).toBe(false);
    await expect(getOutboxRows()).resolves.toHaveLength(1);
    await communityUpload.flushPendingUploads();
    expect(
      mockCallEdgeFunction.mock.calls.some(
        ([name]) => name === "v2-upload-community-data",
      ),
    ).toBe(false);
    await expect(getOutboxRows()).resolves.toHaveLength(1);
  });

  it("unlinks offline without any server request and starts empty counters", async () => {
    await addThreeCardsAndStop({ waitForCommunityUpload: true });
    mockCallEdgeFunction.mockClear();
    mockIsConfigured.mockReturnValue(false);
    mockGetAccessToken.mockRejectedValue(new Error("offline"));
    const clearSession = vi.fn();
    const unlinking = communityUpload.unlinkGggAccount(clearSession);
    expect(communityUpload.unlinkGggAccount(clearSession)).toBe(unlinking);
    await unlinking;
    expect(clearSession).toHaveBeenCalledOnce();
    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    const identities = new CommunityIdentityRepository(
      testDb.kysely,
      testDb.db,
    );
    expect((await identities.getActive()).id).not.toBe(DEVICE_ID);
    expect(
      await testDb.kysely
        .selectFrom("community_upload_card_counts")
        .select("count")
        .where("identity_id", "=", (await identities.getActive()).id)
        .execute(),
    ).toEqual([]);
  });

  it("keeps queued counts local if consent is withdrawn while an account token is read", async () => {
    new CommunityIdentityRepository(testDb.kysely, testDb.db).activateVerified(
      DEVICE_ID,
      "account-a",
      false,
    );
    mockGetAccountId.mockResolvedValue("account-a");
    const settings = new SettingsStoreRepository(testDb.kysely);
    await settings.set("communityUploadsEnabled", true);
    const previousGet = mockSettingsGet.getMockImplementation();
    mockSettingsGet.mockImplementation((key: string) =>
      key === "communityUploadsEnabled"
        ? settings.get("communityUploadsEnabled")
        : previousGet?.(key),
    );
    mockGetAccessToken.mockImplementationOnce(async () => {
      await settings.set("communityUploadsEnabled", false);
      return null;
    });
    await addThreeCardsAndStop({ waitForCommunityUpload: true });
    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    await expect(getOutboxRows()).resolves.toHaveLength(1);
    await expect(getUploadedSnapshotRows()).resolves.toEqual([]);
  });

  it("records consent when the contribution banner is confirmed and keeps time sharing separate", async () => {
    testDb.db.exec(
      "CREATE TABLE dismissed_banners (banner_id TEXT PRIMARY KEY)",
    );
    const settings = new SettingsStoreRepository(testDb.kysely);
    const previousGet = mockSettingsGet.getMockImplementation();
    mockSettingsGet.mockImplementation((key: string) =>
      key === "communityUploadsEnabled"
        ? settings.get("communityUploadsEnabled")
        : previousGet?.(key),
    );
    mockSettingsSet.mockImplementation((key, value) =>
      settings.set(key, value),
    );
    await testDb.kysely
      .deleteFrom("app_metadata")
      .where("key", "=", "community_drop_context_consent_v1")
      .execute();
    await addThreeCardsAndStop({ waitForCommunityUpload: true });
    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    await expect(communityUpload.getBackfillLeagues()).resolves.toEqual([
      { game: "poe1", league: LEAGUE },
    ]);

    mockCallEdgeFunction.mockResolvedValue(createEdgeResponse(1));
    const handler = mockIpcHandle.mock.calls.find(
      ([channel]) => channel === CommunityUploadChannel.TriggerBackfill,
    )?.[1];
    expect(handler).toBeTypeOf("function");
    await expect(handler({ sender: { id: 1 } })).resolves.toEqual({
      success: true,
    });
    await expect(
      new SettingsStoreRepository(testDb.kysely).get("communityUploadsEnabled"),
    ).resolves.toBe(true);
    expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(1);
    expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(0);
  });

  it.each([null, false])(
    "keeps context local with consent %j while uploading card counts",
    async (consent) => {
      const repository = new CommunityUploadRepository(testDb.kysely);
      if (consent === false) {
        await repository.setDropContextConsent(false);
      } else {
        await testDb.kysely
          .deleteFrom("app_metadata")
          .where("key", "=", "community_drop_context_consent_v1")
          .execute();
      }
      mockCallEdgeFunction.mockResolvedValue(createEdgeResponse(1));

      await addThreeCardsAndStop({ waitForCommunityUpload: true });
      await communityUpload.flushPendingUploads();
      expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(1);
      expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(0);
      await expect(getDropEventOutboxRows()).resolves.toHaveLength(3);
      await expect(
        communityUpload.getDropContextUploadStatus(),
      ).resolves.toMatchObject({ pendingEvents: 0, isUploading: false });

      await repository.setDropContextConsent(true);
      mockCallEdgeFunction.mockResolvedValue(createDropEventResponse(3, 3));
      await communityUpload.flushPendingUploads();
      expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(1);
      await expect(getDropEventOutboxRows()).resolves.toEqual([]);
    },
  );

  it("stops the next batch when consent is withdrawn during an upload", async () => {
    const repository = new CommunityUploadRepository(testDb.kysely);
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values(
        Array.from({ length: 501 }, (_, index) => ({
          event_id: `aaaaaaaa-0000-4000-8000-${String(index).padStart(12, "0")}`,
          session_id: "pending-event-session",
          game: "poe1",
          scope: LEAGUE,
          card_name: "The Doctor",
          location: "Atlas Hideout",
          local_minute: 626,
          utc_offset_minutes: 60,
        })),
      )
      .execute();
    mockCallEdgeFunction.mockImplementation(async () => {
      await repository.setDropContextConsent(false);
      return createDropEventResponse(500, 500);
    });
    await communityUpload.flushPendingUploads();
    await expect(repository.getDropContextConsent()).resolves.toBe(false);
    expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(1);

    await communityUpload.flushPendingUploads();
    expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(1);
    await expect(getDropEventOutboxRows()).resolves.toHaveLength(1);
  });

  it("user ends a session, then app quit only drains the in-flight upload once", async () => {
    mockCallEdgeFunction.mockImplementation((functionName: string) =>
      Promise.resolve(
        functionName === "upload-community-drop-events"
          ? createDropEventResponse(3, 3)
          : createEdgeResponse(1),
      ),
    );

    await addThreeCardsAndStop();

    // This is the shutdown path after the session is already inactive:
    // there is no second stopSession call, only a drain of work already queued.
    await communityUpload.drainInFlightUploads();
    await communityUpload.drainInFlightUploads();

    expect(currentSession.isSessionActive("poe1")).toBe(false);
    expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(1);
    expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(1);
    expect(lastUploadPayload()).toMatchObject({
      league_name: LEAGUE,
      game: "poe1",
      device_id: DEVICE_ID,
      is_packaged: false,
    });
    expect(sortedCards(lastUploadPayload())).toEqual([
      { card_name: "Rain of Chaos", count: 1 },
      { card_name: "The Doctor", count: 2 },
    ]);
    await expect(getOutboxRows()).resolves.toEqual([]);
    await expect(getUploadedSnapshotRows()).resolves.toEqual([
      { card_name: "Rain of Chaos", count: 1 },
      { card_name: "The Doctor", count: 2 },
    ]);
  });

  it("system suspend stops the session and queues locally, then resume flushes it", async () => {
    mockCallEdgeFunction.mockImplementation((functionName: string) =>
      Promise.resolve(
        functionName === "upload-community-drop-events"
          ? createDropEventResponse(2, 2)
          : createEdgeResponse(1),
      ),
    );

    await currentSession.startSession("poe1", LEAGUE);
    await currentSession.addCard("poe1", LEAGUE, "The Doctor", "drop-1");
    await currentSession.addCard("poe1", LEAGUE, "Rain of Chaos", "drop-2");

    getPowerMonitorHandler("suspend")();

    await waitForCondition(async () => {
      const rows = await getOutboxRows();
      return rows.length === 1;
    }, "suspend did not queue a community upload");

    expect(currentSession.isSessionActive("poe1")).toBe(false);
    expect(mockCallEdgeFunction).not.toHaveBeenCalled();

    const queued = await getOutboxRows();
    expect(JSON.parse(queued[0].cards_json)).toEqual(
      expect.arrayContaining([
        { card_name: "The Doctor", count: 1 },
        { card_name: "Rain of Chaos", count: 1 },
      ]),
    );

    getPowerMonitorHandler("resume")();

    await waitForCondition(async () => {
      const rows = await getOutboxRows();
      return (
        edgeFunctionCallCount("v2-upload-community-data") === 1 &&
        edgeFunctionCallCount("upload-community-drop-events") === 1 &&
        rows.length === 0
      );
    }, "resume did not flush the queued community upload");

    expect(sortedCards(lastUploadPayload())).toEqual([
      { card_name: "Rain of Chaos", count: 1 },
      { card_name: "The Doctor", count: 1 },
    ]);
  });

  it("offline upload stays in the outbox and startup retry sends it later", async () => {
    let aggregateAttempts = 0;
    mockCallEdgeFunction.mockImplementation((functionName: string) => {
      if (functionName === "upload-community-drop-events") {
        return Promise.resolve(createDropEventResponse(3, 3));
      }
      aggregateAttempts += 1;
      return aggregateAttempts === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(createEdgeResponse(2));
    });

    await addThreeCardsAndStop({ waitForCommunityUpload: true });

    expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(1);
    expect(edgeFunctionCallCount("upload-community-drop-events")).toBe(1);
    let outboxRows = await getOutboxRows();
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]).toMatchObject({
      game: "poe1",
      scope: LEAGUE,
      attempts: 1,
      last_error: "offline",
    });
    await expect(getUploadedSnapshotRows()).resolves.toEqual([]);

    await testDb.kysely
      .updateTable("community_upload_outbox")
      .set({ next_attempt_at: new Date(0).toISOString() })
      .where("game", "=", "poe1")
      .where("scope", "=", LEAGUE)
      .execute();

    await communityUpload.flushPendingUploads();

    expect(edgeFunctionCallCount("v2-upload-community-data")).toBe(2);
    expect(sortedCards(lastUploadPayload())).toEqual([
      { card_name: "Rain of Chaos", count: 1 },
      { card_name: "The Doctor", count: 2 },
    ]);
    outboxRows = await getOutboxRows();
    expect(outboxRows).toEqual([]);
    await expect(getUploadedSnapshotRows()).resolves.toEqual([
      { card_name: "Rain of Chaos", count: 1 },
      { card_name: "The Doctor", count: 2 },
    ]);
  });

  it("uploads coarse drop context and removes its durable outbox row", async () => {
    mockCallEdgeFunction.mockImplementation((functionName: string) =>
      Promise.resolve(
        functionName === "upload-community-drop-events"
          ? createDropEventResponse()
          : createEdgeResponse(1),
      ),
    );
    await currentSession.startSession("poe1", LEAGUE);
    await currentSession.addCard(
      "poe1",
      LEAGUE,
      "The Doctor",
      "source-drop-1",
      {
        droppedAt: "2026-03-14T09:26:12.000Z",
        localMinute: 626,
        utcOffsetMinutes: 60,
        location: "Atlas Hideout",
      },
    );

    await currentSession.stopSession("poe1", {
      waitForCommunityUpload: true,
    });

    expect(lastDropEventPayload().events).toEqual([
      {
        event_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      },
    ]);
    await expect(getDropEventOutboxRows()).resolves.toEqual([]);

    const localEvent = await testDb.kysely
      .selectFrom("session_card_events")
      .select([
        "source_event_id",
        "location",
        "dropped_at",
        "utc_offset_minutes",
      ])
      .executeTakeFirstOrThrow();
    expect(localEvent).toEqual({
      source_event_id: "source-drop-1",
      location: "Atlas Hideout",
      dropped_at: "2026-03-14T09:26:12.000Z",
      utc_offset_minutes: 60,
    });
  });

  it("uploads time context when the opening location is unknown", async () => {
    mockCallEdgeFunction.mockImplementation((functionName: string) =>
      Promise.resolve(
        functionName === "upload-community-drop-events"
          ? createDropEventResponse()
          : createEdgeResponse(1),
      ),
    );
    await currentSession.startSession("poe1", LEAGUE);
    await currentSession.addCard(
      "poe1",
      LEAGUE,
      "The Doctor",
      "source-drop-without-location",
      {
        droppedAt: "2026-03-14T09:26:12.000Z",
        localMinute: 626,
        utcOffsetMinutes: 60,
        location: null,
      },
    );

    await currentSession.stopSession("poe1", {
      waitForCommunityUpload: true,
    });

    expect(lastDropEventPayload().events).toEqual([
      expect.objectContaining({
        card_name: "The Doctor",
        location: null,
        local_minute: 626,
        utc_offset_minutes: 60,
      }),
    ]);
    await expect(getDropEventOutboxRows()).resolves.toEqual([]);
  });

  it("retains drop context after failure and deletes it after retry", async () => {
    mockCallEdgeFunction
      .mockResolvedValueOnce(createEdgeResponse(1))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(createDropEventResponse());
    await currentSession.startSession("poe1", LEAGUE);
    await currentSession.addCard(
      "poe1",
      LEAGUE,
      "The Doctor",
      "source-drop-1",
      {
        droppedAt: "2026-03-14T09:26:12.000Z",
        localMinute: 626,
        utcOffsetMinutes: 60,
        location: "Atlas Hideout",
      },
    );
    await currentSession.stopSession("poe1", {
      waitForCommunityUpload: true,
    });

    const queuedEvents = await getDropEventOutboxRows();
    expect(queuedEvents).toHaveLength(1);
    expect(queuedEvents[0]).toMatchObject({
      location: "Atlas Hideout",
    });

    await testDb.kysely
      .updateTable("community_drop_event_upload_state")
      .set({ next_attempt_at: "2020-01-01T00:00:00.000Z" })
      .execute();

    await communityUpload.flushPendingUploads();

    expect(lastDropEventPayload().events).toHaveLength(1);
    await expect(getDropEventOutboxRows()).resolves.toEqual([]);
  });

  it("respects persisted drop-event backoff for interactive and background flushes", async () => {
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();
    await testDb.kysely
      .insertInto("community_drop_event_upload_state")
      .values({
        game: "poe1",
        scope: LEAGUE,
        attempts: 1,
        last_error: "offline",
        next_attempt_at: "2999-01-01T00:00:00.000Z",
      })
      .execute();

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);
    await communityUpload.flushPendingUploads();

    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    await expect(getDropEventOutboxRows()).resolves.toHaveLength(1);
  });

  it("backs off a scope when the process-wide drop-event request budget is exhausted", async () => {
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();
    (communityUpload as any).eventRateWindowStartedAt = Date.now();
    (communityUpload as any).eventRequestsInWindow = 240;

    await (communityUpload as any).flushPendingDropEvents(
      "poe1",
      LEAGUE,
      DEVICE_ID,
    );

    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    await expect(
      testDb.kysely
        .selectFrom("community_drop_event_upload_state")
        .select(["attempts", "last_error"])
        .where("game", "=", "poe1")
        .where("scope", "=", LEAGUE)
        .executeTakeFirst(),
    ).resolves.toEqual({
      attempts: 1,
      last_error: "Hourly card-drop upload request budget reached",
    });
  });

  it("uses the hourly backoff window when the drop-event endpoint rate-limits", async () => {
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();
    mockCallEdgeFunction.mockRejectedValue(
      new EdgeFunctionError(
        "upload-community-drop-events",
        429,
        "rate limited",
      ),
    );
    const beforeUpload = Date.now();

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    const state = await testDb.kysely
      .selectFrom("community_drop_event_upload_state")
      .select(["attempts", "last_error", "next_attempt_at"])
      .where("game", "=", "poe1")
      .where("scope", "=", LEAGUE)
      .executeTakeFirstOrThrow();
    expect(state).toMatchObject({
      attempts: 1,
      last_error:
        "Edge Function upload-community-drop-events failed (429): rate limited",
    });
    expect(
      new Date(state.next_attempt_at ?? 0).getTime(),
    ).toBeGreaterThanOrEqual(beforeUpload + 60 * 60_000);
  });

  it("sends an event-only retry through the dedicated endpoint", async () => {
    mockCallEdgeFunction.mockResolvedValue(createDropEventResponse());
    await seedCards(testDb.kysely, [
      {
        game: "poe1",
        scope: LEAGUE,
        cardName: "The Doctor",
        count: 2,
      },
    ]);
    await testDb.kysely
      .insertInto("community_upload_snapshot")
      .values({
        identity_id: DEVICE_ID,
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        count: 2,
      })
      .execute();
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    expect(mockCallEdgeFunction).toHaveBeenCalledTimes(1);
    expect(mockCallEdgeFunction).toHaveBeenCalledWith(
      "upload-community-drop-events",
      expect.any(Object),
    );
    expect(lastDropEventPayload()).toMatchObject({
      events: [
        {
          event_id: "aaaaaaaa-0000-4000-8000-000000000001",
          card_name: "The Doctor",
          location: "Atlas Hideout",
          local_minute: 626,
          utc_offset_minutes: 60,
        },
      ],
    });
    await expect(getDropEventOutboxRows()).resolves.toEqual([]);
  });

  it("handles prepared uploads without events", async () => {
    mockCallEdgeFunction.mockResolvedValue(createEdgeResponse(1));
    await testDb.kysely
      .insertInto("community_upload_outbox")
      .values({
        identity_id: DEVICE_ID,
        game: "poe1",
        scope: LEAGUE,
        cards_json: JSON.stringify([{ card_name: "The Doctor", count: 1 }]),
      })
      .execute();

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    expect(lastUploadPayload().events).toBeUndefined();
    await expect(getOutboxRows()).resolves.toEqual([]);
  });

  it("defensively ignores a non-array pending-event query result", async () => {
    const execute = vi.fn().mockResolvedValue(null);
    const chain = new Proxy(
      {},
      {
        get: (_target, property) =>
          property === "execute" ? execute : () => chain,
      },
    );
    const originalKysely = (communityUpload as any).kysely;
    (communityUpload as any).kysely = {
      selectFrom: () => chain,
    };

    await expect(
      (communityUpload as any).getPendingDropEvents("poe1", LEAGUE),
    ).resolves.toEqual([]);

    (communityUpload as any).kysely = originalKysely;
  });

  it("keeps events queued when the server does not acknowledge the full batch", async () => {
    const event = {
      event_id: "aaaaaaaa-0000-4000-8000-000000000001",
      card_name: "The Doctor",
      location: "Atlas Hideout",
      local_minute: 626,
      utc_offset_minutes: 60,
    };
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        ...event,
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
      })
      .execute();

    mockCallEdgeFunction.mockResolvedValue(createDropEventResponse(0, 0));

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    await expect(getDropEventOutboxRows()).resolves.toEqual([
      expect.objectContaining({
        event_id: event.event_id,
      }),
    ]);
  });

  it("keeps events queued when the server returns no acknowledgement object", async () => {
    const event = {
      event_id: "aaaaaaaa-0000-4000-8000-000000000001",
      card_name: "The Doctor",
      location: "Atlas Hideout",
      local_minute: 626,
      utc_offset_minutes: 60,
    };
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        ...event,
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
      })
      .execute();
    mockCallEdgeFunction.mockResolvedValue(null);

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    await expect(getDropEventOutboxRows()).resolves.toHaveLength(1);
  });

  it("normalizes non-Error card-drop upload failures", async () => {
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();
    mockCallEdgeFunction.mockRejectedValue("offline");

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[CommunityUpload] Card-drop context upload failed:",
      "offline",
    );
    expect(mockSentryCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "offline" }),
      expect.any(Object),
    );
  });

  it("retains an event when the server rejects its device parent", async () => {
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();
    mockCallEdgeFunction.mockRejectedValue(
      new EdgeFunctionError(
        "upload-community-drop-events",
        409,
        '{"code":"upload_not_found"}',
        { code: "upload_not_found" },
      ),
    );

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    await expect(getDropEventOutboxRows()).resolves.toHaveLength(1);
    expect(mockCallEdgeFunction).toHaveBeenCalledTimes(1);
    expect(mockSentryCaptureException).toHaveBeenCalledWith(
      expect.any(EdgeFunctionError),
      expect.any(Object),
    );
  });

  it("coalesces concurrent event flushes without deleting a replacement job", async () => {
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();

    let resolveUpload: ((value: unknown) => void) | undefined;
    mockCallEdgeFunction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const first = (communityUpload as any).flushPendingDropEvents(
      "poe1",
      LEAGUE,
      DEVICE_ID,
    );
    const second = (communityUpload as any).flushPendingDropEvents(
      "poe1",
      LEAGUE,
      DEVICE_ID,
    );
    await waitForCondition(
      () => typeof resolveUpload === "function",
      "event upload did not start",
    );

    const replacement = Promise.resolve();
    const key = `${DEVICE_ID}:poe1:${LEAGUE}`;
    (communityUpload as any).eventFlushJobs.set(key, replacement);
    resolveUpload?.(createDropEventResponse());
    await Promise.all([first, second]);

    expect(mockCallEdgeFunction).toHaveBeenCalledTimes(1);
    expect((communityUpload as any).eventFlushJobs.get(key)).toBe(replacement);
    (communityUpload as any).eventFlushJobs.clear();
  });

  it("ignores an empty event deletion batch", async () => {
    await expect(
      (communityUpload as any).deletePendingDropEvents([]),
    ).resolves.toBeUndefined();
  });

  it("publishes upload status and tolerates unavailable renderer windows", async () => {
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();
    (communityUpload as any).eventFlushJobs.set(
      `poe1:${LEAGUE}`,
      Promise.resolve(),
    );

    await (communityUpload as any).emitDropContextUploadStatus();

    expect(mockWebContentsSend).toHaveBeenCalledWith(
      "community:drop-context-upload-status-changed",
      {
        pendingEvents: 1,
        isUploading: true,
        revision: 1,
      },
    );

    mockWebContentsSend.mockClear();
    mockGetAllWindows.mockReturnValueOnce([
      {
        isDestroyed: () => true,
        webContents: { send: mockWebContentsSend },
      },
    ]);
    await (communityUpload as any).emitDropContextUploadStatus();

    expect(mockWebContentsSend).not.toHaveBeenCalled();
    (communityUpload as any).eventFlushJobs.clear();
  });

  it("logs status publication failures without rejecting upload work", async () => {
    const originalKysely = (communityUpload as any).kysely;
    (communityUpload as any).kysely = {
      selectFrom: () => {
        throw new Error("status query failed");
      },
    };

    await expect(
      (communityUpload as any).emitDropContextUploadStatus(),
    ).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[CommunityUpload] Failed to publish card-history upload status:",
      "status query failed",
    );

    (communityUpload as any).kysely = {
      selectFrom: () => {
        throw "status unavailable";
      },
    };
    await expect(
      (communityUpload as any).emitDropContextUploadStatus(),
    ).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[CommunityUpload] Failed to publish card-history upload status:",
      "status unavailable",
    );

    (communityUpload as any).kysely = originalKysely;
  });

  it("does not replay aggregate cards when the event endpoint rejects a parent", async () => {
    await seedCards(testDb.kysely, [
      {
        game: "poe1",
        scope: LEAGUE,
        cardName: "The Doctor",
        count: 2,
      },
    ]);
    await testDb.kysely
      .insertInto("community_upload_snapshot")
      .values({
        identity_id: DEVICE_ID,
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        count: 2,
      })
      .execute();
    await testDb.kysely
      .insertInto("community_drop_event_outbox")
      .values({
        event_id: "aaaaaaaa-0000-4000-8000-000000000001",
        session_id: "pending-event-session",
        game: "poe1",
        scope: LEAGUE,
        card_name: "The Doctor",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      })
      .execute();

    mockCallEdgeFunction.mockRejectedValueOnce(
      new EdgeFunctionError(
        "upload-community-drop-events",
        409,
        '{"code":"upload_not_found"}',
        { code: "upload_not_found" },
      ),
    );

    await communityUpload.uploadOnSessionEnd("poe1", LEAGUE);

    expect(mockCallEdgeFunction.mock.calls.map(([name]) => name)).toEqual([
      "upload-community-drop-events",
    ]);
    await expect(getDropEventOutboxRows()).resolves.toHaveLength(1);
  });
});
