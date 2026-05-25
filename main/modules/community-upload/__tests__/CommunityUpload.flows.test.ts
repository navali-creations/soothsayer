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
  mockGetSnapshotForSession,
  mockLoadSnapshot,
  mockStartAutoRefresh,
  mockStopAutoRefresh,
  mockIsConfigured,
  mockCallEdgeFunction,
  mockGetAccessToken,
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
  mockGetSnapshotForSession: vi.fn(),
  mockLoadSnapshot: vi.fn(),
  mockStartAutoRefresh: vi.fn(),
  mockStopAutoRefresh: vi.fn(),
  mockIsConfigured: vi.fn(),
  mockCallEdgeFunction: vi.fn(),
  mockGetAccessToken: vi.fn(),
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
    mockSet: vi.fn().mockResolvedValue(undefined),
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
  }),
);

vi.mock("~/main/utils/ipc-validation", () => createIpcValidationMock());

vi.mock("~/main/modules/sentry/Sentry.reporter", () => ({
  captureSentryException: mockSentryCaptureException,
  captureSentryMessage: vi.fn(),
}));

import {
  createTestDatabase,
  seedLeague,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import { CurrentSessionService } from "~/main/modules/current-session/CurrentSession.service";

import { CommunityUploadService } from "../CommunityUpload.service";

interface UploadPayload {
  league_name: string;
  game: "poe1" | "poe2";
  device_id: string;
  cards: Array<{ card_name: string; count: number }>;
  is_packaged: boolean;
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

function getPowerMonitorHandler(eventName: "resume" | "suspend"): () => void {
  const handler = mockPowerMonitorOn.mock.calls.find(
    ([event]: [string]) => event === eventName,
  )?.[1];

  expect(handler).toEqual(expect.any(Function));
  return handler as () => void;
}

function lastUploadPayload(): UploadPayload {
  const call = mockCallEdgeFunction.mock.calls.at(-1);
  expect(call).toBeDefined();
  return call?.[1] as UploadPayload;
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
    currentSession = CurrentSessionService.getInstance();
  });

  afterEach(async () => {
    resetSingletons(CurrentSessionService, CommunityUploadService);
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

  it("user ends a session, then app quit only drains the in-flight upload once", async () => {
    mockCallEdgeFunction.mockResolvedValue(createEdgeResponse(1));

    await addThreeCardsAndStop();

    // This is the shutdown path after the session is already inactive:
    // there is no second stopSession call, only a drain of work already queued.
    await communityUpload.drainInFlightUploads();
    await communityUpload.drainInFlightUploads();

    expect(currentSession.isSessionActive("poe1")).toBe(false);
    expect(mockCallEdgeFunction).toHaveBeenCalledTimes(1);
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
    mockCallEdgeFunction.mockResolvedValue(createEdgeResponse(1));

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
    expect(JSON.parse(queued[0].cards_json)).toEqual([
      { card_name: "The Doctor", count: 1 },
      { card_name: "Rain of Chaos", count: 1 },
    ]);

    getPowerMonitorHandler("resume")();

    await waitForCondition(async () => {
      const rows = await getOutboxRows();
      return mockCallEdgeFunction.mock.calls.length === 1 && rows.length === 0;
    }, "resume did not flush the queued community upload");

    expect(sortedCards(lastUploadPayload())).toEqual([
      { card_name: "Rain of Chaos", count: 1 },
      { card_name: "The Doctor", count: 1 },
    ]);
  });

  it("offline upload stays in the outbox and startup retry sends it later", async () => {
    mockCallEdgeFunction
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(createEdgeResponse(2));

    await addThreeCardsAndStop({ waitForCommunityUpload: true });

    expect(mockCallEdgeFunction).toHaveBeenCalledTimes(1);
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

    expect(mockCallEdgeFunction).toHaveBeenCalledTimes(2);
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
});
