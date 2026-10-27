import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatabaseServiceMock,
  createElectronMock,
  createPerformanceLoggerMock,
  createSettingsStoreMock,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockAssertTrustedSender,
  mockWatchFile,
  mockUnwatchFile,
  mockOpenSync,
  mockCloseSync,
  mockReadSync,
  mockFstatSync,
  mockCreateReadStream,
  mockGetKysely,
  mockPerfLog,
  mockPerfStartTimer,
  mockPerfStartTimers,
  mockIsSessionActive,
  mockGetActiveSessionInfo,
  mockGetAllProcessedIds,
  mockAddCard,
  mockSettingsGet,
  mockSettingsSet,
  mockParseCards,
  mockFindLatestLocation,
  mockHasHistoricalCardEventsMissingContext,
  mockFindHistoricalCardEventCandidate,
  mockApplyHistoricalCardEventContexts,
  mockGetMetadata,
  mockSetMetadata,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockAssertTrustedSender: vi.fn(),
  mockWatchFile: vi.fn(),
  mockUnwatchFile: vi.fn(),
  mockOpenSync: vi.fn(() => 42), // fake fd
  mockCloseSync: vi.fn(),
  mockReadSync: vi.fn(() => 0),
  mockFstatSync: vi.fn(() => ({ size: 0 })),
  mockCreateReadStream: vi.fn(),
  mockGetKysely: vi.fn(),
  mockPerfLog: vi.fn(),
  mockPerfStartTimer: vi.fn(() => null),
  mockPerfStartTimers: vi.fn(() => null),
  mockIsSessionActive: vi.fn(),
  mockGetActiveSessionInfo: vi.fn(),
  mockGetAllProcessedIds: vi.fn(),
  mockAddCard: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockParseCards: vi.fn(),
  mockFindLatestLocation: vi.fn(() => null),
  mockHasHistoricalCardEventsMissingContext: vi.fn(async () => false),
  mockFindHistoricalCardEventCandidate: vi.fn(() => null),
  mockApplyHistoricalCardEventContexts: vi.fn(),
  mockGetMetadata: vi.fn(async () => null),
  mockSetMetadata: vi.fn(async () => undefined),
}));

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => createElectronMock({ mockIpcHandle }));

vi.mock("~/main/utils/ipc-validation", () => ({
  assertTrustedSender: mockAssertTrustedSender,
}));

// ─── Mock node:fs ────────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  default: {
    watchFile: mockWatchFile,
    unwatchFile: mockUnwatchFile,
    openSync: mockOpenSync,
    closeSync: mockCloseSync,
    readSync: mockReadSync,
    fstatSync: mockFstatSync,
    createReadStream: mockCreateReadStream,
    promises: {
      open: vi.fn(),
      writeFile: vi.fn(),
    },
  },
  watchFile: mockWatchFile,
  unwatchFile: mockUnwatchFile,
  openSync: mockOpenSync,
  closeSync: mockCloseSync,
  readSync: mockReadSync,
  fstatSync: mockFstatSync,
  createReadStream: mockCreateReadStream,
  promises: {
    open: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);

// ─── Mock PerformanceLoggerService ───────────────────────────────────────────
vi.mock("~/main/modules/performance-logger", () =>
  createPerformanceLoggerMock({
    mockLog: mockPerfLog,
    mockStartTimer: mockPerfStartTimer,
    mockStartTimers: mockPerfStartTimers,
  }),
);

// ─── Mock CurrentSessionService ──────────────────────────────────────────────
vi.mock("~/main/modules/current-session", () => ({
  CurrentSessionService: {
    getInstance: vi.fn(() => ({
      isSessionActive: mockIsSessionActive,
      getActiveSessionInfo: mockGetActiveSessionInfo,
      getAllProcessedIds: mockGetAllProcessedIds,
      addCard: mockAddCard,
      hasHistoricalCardEventsMissingContext:
        mockHasHistoricalCardEventsMissingContext,
      findHistoricalCardEventCandidate: mockFindHistoricalCardEventCandidate,
      applyHistoricalCardEventContexts: mockApplyHistoricalCardEventContexts,
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({
    mockGet: mockSettingsGet,
    mockSet: mockSettingsSet,
  }),
);

vi.mock("../ClientLogReader.repository", () => ({
  ClientLogReaderRepository: class {
    getMetadata = mockGetMetadata;
    setMetadata = mockSetMetadata;
  },
}));

// ─── Mock the parseCards util ────────────────────────────────────────────────
vi.mock("../utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils")>()),
  parseCards: (...args: unknown[]) => mockParseCards(...args),
  findLatestLocation: mockFindLatestLocation,
}));

import { ClientLogReaderService } from "../ClientLogReader.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the file-change callback registered via fs.watchFile.
 * If watchFile was called multiple times, returns the callback from the given index.
 *
 * The callback signature is `(curr: fs.Stats, prev: fs.Stats) => Promise<void>`.
 */
function getWatchCallback(
  callIndex = 0,
): (
  curr: { size: number; birthtimeMs: number },
  prev: { size: number; birthtimeMs: number },
) => Promise<void> {
  if (mockWatchFile.mock.calls.length <= callIndex) {
    throw new Error(
      `fs.watchFile was not called ${callIndex + 1} time(s). Actual calls: ${
        mockWatchFile.mock.calls.length
      }`,
    );
  }
  // fs.watchFile(path, { interval }, callback)
  return mockWatchFile.mock.calls[callIndex][2];
}

/** Helper: create a fake stats object for the watchFile callback. */
function makeStats(
  size: number,
  birthtimeMs = 1000,
): { size: number; birthtimeMs: number } {
  return { size, birthtimeMs };
}

function makeParseResult(
  processedIdsByCard: Record<string, readonly string[]> = {},
) {
  const events = Object.entries(processedIdsByCard).flatMap(
    ([cardName, processedIds]) =>
      processedIds.map((processedId) => ({
        cardName,
        processedId,
        droppedAt: "2026-03-14T09:26:12.000Z",
        localMinute: 626,
        utcOffsetMinutes: 60,
        location: null,
      })),
  );

  return { totalCount: events.length, events, lastLocation: null };
}

/**
 * Helper: configure mockReadSync to write the given string into the buffer
 * that fs.readSync receives, returning the byte length written.
 */
function mockReadSyncWith(text: string): void {
  mockReadSync.mockImplementation(
    (
      _fd: number,
      buf: Buffer,
      _offset: number,
      length: number,
      _position: number,
    ) => {
      const bytes = Buffer.from(text, "utf-8");
      const toCopy = Math.min(bytes.length, length);
      bytes.copy(buf, 0, 0, toCopy);
      return toCopy;
    },
  );
}

const mockMainWindow = {
  webContents: { send: vi.fn() },
  isDestroyed: vi.fn(() => false),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ClientLogReaderService", () => {
  beforeEach(() => {
    // Reset all mocks
    mockIpcHandle.mockReset();
    mockAssertTrustedSender.mockReset();
    mockWatchFile.mockReset();
    mockUnwatchFile.mockReset();
    mockOpenSync.mockReset().mockReturnValue(42);
    mockCloseSync.mockReset();
    mockReadSync.mockReset().mockReturnValue(0);
    mockFstatSync.mockReset().mockReturnValue({ size: 0 });
    mockCreateReadStream.mockReset().mockReturnValue(Readable.from([]));
    mockGetKysely.mockReset();
    mockPerfLog.mockReset();
    mockPerfStartTimer.mockReset().mockReturnValue(null);
    mockPerfStartTimers.mockReset().mockReturnValue(null);
    mockIsSessionActive.mockReset();
    mockGetActiveSessionInfo.mockReset();
    mockGetAllProcessedIds.mockReset().mockReturnValue(new Set());
    mockAddCard.mockReset().mockResolvedValue(undefined);
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockParseCards.mockReset();
    mockFindLatestLocation.mockReset().mockReturnValue(null);
    mockHasHistoricalCardEventsMissingContext
      .mockReset()
      .mockResolvedValue(false);
    mockFindHistoricalCardEventCandidate.mockReset().mockReturnValue(null);
    mockApplyHistoricalCardEventContexts.mockReset();
    mockGetMetadata.mockReset().mockResolvedValue(null);
    mockSetMetadata.mockReset().mockResolvedValue(undefined);

    // Default settings responses
    mockSettingsGet.mockImplementation(async (key: string) => {
      if (key === "selectedGame") return "poe1";
      if (key === "poe1ClientTxtPath") return null;
      return null;
    });

    // Reset singleton
    resetSingleton(ClientLogReaderService);
  });

  afterEach(() => {
    resetSingleton(ClientLogReaderService);
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", async () => {
      const instance1 = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      const instance2 = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      expect(instance1).toBe(instance2);
    });

    it("should throw when called without mainWindow on first initialization", async () => {
      await expect(ClientLogReaderService.getInstance()).rejects.toThrow(
        "ClientLogReaderService requires mainWindow for first initialization",
      );
    });

    it("should succeed without mainWindow on subsequent calls after instance exists", async () => {
      // First call with mainWindow creates the instance
      const instance1 = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      // Subsequent call without mainWindow should return the existing instance
      const instance2 = await ClientLogReaderService.getInstance();

      expect(instance2).toBe(instance1);
    });
  });

  // ─── Initialization ────────────────────────────────────────────────────

  describe("initialization", () => {
    it("should read the active game from settings", async () => {
      await ClientLogReaderService.getInstance(mockMainWindow as any);

      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
    });

    it("should read the client log path from settings", async () => {
      await ClientLogReaderService.getInstance(mockMainWindow as any);

      expect(mockSettingsGet).toHaveBeenCalledWith("poe1ClientTxtPath");
    });

    it("should start watching the file if client log path is configured", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "C:\\Games\\PoE\\client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      expect(mockWatchFile).toHaveBeenCalledWith(
        "C:\\Games\\PoE\\client.txt",
        { interval: 100 },
        expect.any(Function),
      );
    });

    it("should not start watching if client log path is null", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return null;
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      expect(mockWatchFile).not.toHaveBeenCalled();
    });

    it("should only initialize once even if getInstance is called multiple times", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/path/to/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);
      await ClientLogReaderService.getInstance(mockMainWindow as any);
      await ClientLogReaderService.getInstance(mockMainWindow as any);

      // watchFile should only be called once (from initialize), not three times
      expect(mockWatchFile).toHaveBeenCalledTimes(1);
    });

    it("returns immediately when initialize is invoked after startup", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockSettingsGet.mockClear();

      await (service as any).initialize();

      expect(mockSettingsGet).not.toHaveBeenCalled();
    });

    it("keeps watching when the client log cannot initially be opened", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });
      mockOpenSync.mockImplementationOnce(() => {
        throw new Error("missing");
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      expect((service as any).fd).toBeNull();
      expect((service as any).lastKnownSize).toBe(0);
      expect(mockWatchFile).toHaveBeenCalledOnce();
    });
  });

  // ─── watchFile behavior ─────────────────────────────────────────────────

  describe("watchFile", () => {
    it("should call fs.watchFile with the given path and 100ms interval", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      expect(mockWatchFile).toHaveBeenCalledWith(
        "/game/client.txt",
        { interval: 100 },
        expect.any(Function),
      );
    });

    it("should not process if game is not set", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return null;
        if (key === "poe1ClientTxtPath") return null;
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      // Manually call watchFile — since game is null, it should warn and return
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      service.watchFile("/some/path.txt");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot watch file"),
      );
      expect(mockWatchFile).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ─── File change callback behavior ──────────────────────────────────────

  describe("file change callback", () => {
    let _service: ClientLogReaderService;

    beforeEach(async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      _service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
    });

    it("should skip processing when file size has not changed", async () => {
      const callback = getWatchCallback();
      // curr.size === 0 (same as lastKnownSize after init with empty file)
      await callback(makeStats(0), makeStats(0));

      expect(mockParseCards).not.toHaveBeenCalled();
    });

    it("returns if the active game disappears after the watcher starts", async () => {
      const callback = getWatchCallback();
      (_service as any).game = null;

      await callback(makeStats(10), makeStats(0));

      expect(mockReadSync).not.toHaveBeenCalled();
    });

    it("reopens a log that was truncated or rotated", async () => {
      (_service as any).lastKnownSize = 20;
      mockOpenSync.mockClear();
      mockFstatSync.mockReturnValue({ size: 5 });
      const callback = getWatchCallback();

      await callback(makeStats(5), makeStats(20));

      expect(mockOpenSync).toHaveBeenCalledWith("/game/client.txt", "r");
      expect((_service as any).lastKnownSize).toBe(5);
    });

    it("reopens a descriptor that becomes available after startup", async () => {
      (_service as any).fd = null;
      mockOpenSync.mockClear();
      mockFstatSync.mockReturnValue({ size: 10 });
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      const callback = getWatchCallback();

      await callback(makeStats(10), makeStats(0));

      expect(mockOpenSync).toHaveBeenCalledWith("/game/client.txt", "r");
      expect(mockReadSync).not.toHaveBeenCalled();
    });

    it("parses complete lines and buffers a trailing partial line", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      const newData = "complete line\npartial line";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(makeParseResult());
      const callback = getWatchCallback();

      await callback(makeStats(newData.length), makeStats(0));

      expect(mockParseCards).toHaveBeenCalledWith(
        "complete line\n",
        expect.any(Set),
        null,
      );
      expect((_service as any).partialLine).toBe("partial line");
    });

    it("should track log context without adding cards when there is no active session", async () => {
      mockIsSessionActive.mockReturnValue(false);
      mockParseCards.mockReturnValue({
        totalCount: 0,
        events: [],
        lastLocation: "Atlas Hideout",
      });

      const newData = "some log line\n";
      mockReadSyncWith(newData);

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockParseCards).toHaveBeenCalledOnce();
      expect(mockAddCard).not.toHaveBeenCalled();
      expect((_service as any).currentLocation).toBe("Atlas Hideout");
    });

    it("should skip processing when session info is null", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue(null);
      mockParseCards.mockReturnValue({
        totalCount: 0,
        events: [],
        lastLocation: null,
      });

      const newData = "some log line\n";
      mockReadSyncWith(newData);

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockParseCards).toHaveBeenCalledOnce();
      expect(mockAddCard).not.toHaveBeenCalled();
    });

    it("should read only new bytes via fs.readSync", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "a new log line\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(makeParseResult());

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      // Should have called readSync with the fd, reading newData.length bytes from offset 0
      expect(mockReadSync).toHaveBeenCalledWith(
        42, // fd
        expect.any(Buffer),
        0,
        newData.length,
        0, // lastKnownSize was 0 (seeded from fstatSync returning { size: 0 })
      );
    });

    it("should pass processed IDs to parseCards for deduplication", async () => {
      const processedIds = new Set(["111", "222"]);
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      mockGetAllProcessedIds.mockReturnValue(processedIds);

      const newData = "some log text\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(makeParseResult());

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockGetAllProcessedIds).toHaveBeenCalledWith("poe1");
      expect(mockParseCards).toHaveBeenCalledWith(newData, processedIds, null);
    });

    it("should not call addCard when no new cards are found", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "no cards here\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(makeParseResult());

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockAddCard).not.toHaveBeenCalled();
    });

    it("should call addCard for each new card and processedId found", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "log with cards\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(
        makeParseResult({
          "The Doctor": ["id-100", "id-101"],
          "Rain of Chaos": ["id-200"],
        }),
      );

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      // Should call addCard for each processedId
      expect(mockAddCard).toHaveBeenCalledTimes(3);
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "id-100",
        expect.objectContaining({ processedId: "id-100" }),
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "id-101",
        expect.objectContaining({ processedId: "id-101" }),
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "id-200",
        expect.objectContaining({ processedId: "id-200" }),
      );
    });

    it("passes parsed location and time context to the session", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2026-03-14T09:00:00.000Z",
      });
      const event = {
        cardName: "The Scholar",
        processedId: "249522781",
        droppedAt: "2026-03-14T09:26:12.000Z",
        localMinute: 626,
        utcOffsetMinutes: 60,
        location: "Atlas Hideout",
      };
      const newData = "location-aware card drop\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue({
        totalCount: 1,
        events: [event],
        lastLocation: "Atlas Hideout",
      });

      await getWatchCallback()(makeStats(newData.length), makeStats(0));

      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Scholar",
        "249522781",
        event,
      );
    });

    it("should handle errors during processing gracefully", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      mockReadSync.mockImplementation(() => {
        throw new Error("File read error");
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const callback = getWatchCallback();
      // Should not throw
      await callback(makeStats(100), makeStats(0));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Processing failed"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle addCard errors gracefully", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "log with cards\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "The Doctor": ["id-100"] }),
      );
      mockAddCard.mockRejectedValue(new Error("DB error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Processing failed"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should use the correct game when calling session methods", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Dawn",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "log text\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(makeParseResult());

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockIsSessionActive).toHaveBeenCalledWith("poe1");
      expect(mockGetActiveSessionInfo).toHaveBeenCalledWith("poe1");
      expect(mockGetAllProcessedIds).toHaveBeenCalledWith("poe1");
    });
  });

  describe("historical card context backfill", () => {
    const historicalDropDate = new Date(2026, 2, 14, 10, 26, 12);
    const candidate = {
      id: 1,
      eventId: "aaaaaaaa-0000-4000-8000-000000000001",
      sessionId: "session-1",
      cardName: "The Scholar",
      league: "Keepers",
    };
    const updates = [
      {
        id: 1,
        eventId: "aaaaaaaa-0000-4000-8000-000000000001",
        sessionId: "session-1",
        sourceEventId: "249522781",
        cardName: "The Scholar",
        droppedAt: historicalDropDate.toISOString(),
        location: "Atlas Hideout",
        localMinute: 626,
        utcOffsetMinutes: 0 - historicalDropDate.getTimezoneOffset(),
        league: "Keepers",
      },
    ];

    it("streams the log and applies only confidently matched updates", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      const stream = Readable.from([
        "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.\n",
        "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}\n",
      ]);
      mockCreateReadStream.mockReturnValue(stream);
      mockFindHistoricalCardEventCandidate.mockReturnValue(candidate);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await expect(
        (service as any).backfillHistoricalCardContexts(
          "/game/client.txt",
          "poe1",
        ),
      ).resolves.toBe(1);

      expect(mockCreateReadStream).toHaveBeenCalledWith("/game/client.txt", {
        encoding: "utf8",
      });
      expect(mockFindHistoricalCardEventCandidate).toHaveBeenCalledWith(
        "poe1",
        "The Scholar",
        historicalDropDate.toISOString(),
        expect.any(Set),
      );
      expect(mockApplyHistoricalCardEventContexts).toHaveBeenCalledWith(
        "poe1",
        updates,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ClientLogReader] Enriched 1 historical card event(s) for poe1",
      );

      mockCreateReadStream.mockReturnValue(Readable.from(["invalid\n"]));
      mockFindHistoricalCardEventCandidate.mockReturnValue(null);
      await expect(
        (service as any).backfillHistoricalCardContexts(
          "/game/client.txt",
          "poe1",
        ),
      ).resolves.toBe(0);
      expect(mockApplyHistoricalCardEventContexts).toHaveBeenCalledOnce();
      consoleSpy.mockRestore();
    });

    it("collects time without a location and flushes large scans in bounded batches", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      const cardLine = (processedId: number) =>
        `2026/03/14 10:26:12 ${processedId} cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}\n`;
      mockCreateReadStream.mockReturnValue(
        Readable.from([
          cardLine(249522700),
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.\n",
          cardLine(249522701),
          ...Array.from({ length: 100 }, (_, index) =>
            cardLine(249522702 + index),
          ),
        ]),
      );
      mockFindHistoricalCardEventCandidate
        .mockReturnValueOnce(null)
        .mockImplementation((_game, _cardName, _droppedAt, excludedIds) => {
          const id = excludedIds.size + 1;
          return {
            ...candidate,
            id,
            eventId: `aaaaaaaa-0000-4000-8000-${id.toString().padStart(12, "0")}`,
          };
        });

      await expect(
        (service as any).backfillHistoricalCardContexts(
          "/game/client.txt",
          "poe1",
        ),
      ).resolves.toBe(101);

      expect(mockFindHistoricalCardEventCandidate).toHaveBeenCalledTimes(102);
      expect(mockApplyHistoricalCardEventContexts).toHaveBeenCalledTimes(2);
      expect(
        mockApplyHistoricalCardEventContexts.mock.calls[0][1],
      ).toHaveLength(100);
      expect(
        mockApplyHistoricalCardEventContexts.mock.calls[1][1],
      ).toHaveLength(1);
    });

    it("returns immediately after the feature backfill has completed", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockGetMetadata.mockResolvedValue("complete");

      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "already-completed", enrichedEvents: 0 },
      );

      expect(mockHasHistoricalCardEventsMissingContext).not.toHaveBeenCalled();
      expect((service as any).historicalBackfill).toBeNull();
    });

    it("defers historical log enrichment while community uploads are disabled", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockSettingsGet.mockImplementation(async (key: string) =>
        key === "communityUploadsEnabled" ? false : null,
      );

      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "deferred", enrichedEvents: 0 },
      );

      expect(mockHasHistoricalCardEventsMissingContext).not.toHaveBeenCalled();
      expect(mockCreateReadStream).not.toHaveBeenCalled();
      expect(mockSetMetadata).not.toHaveBeenCalled();
    });

    it("runs once for concurrent startup hydration requests", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      let releaseMetadata!: (value: string) => void;
      mockGetMetadata.mockReturnValue(
        new Promise((resolve) => {
          releaseMetadata = resolve;
        }),
      );

      const first = service.runHistoricalContextBackfillOnce();
      const second = service.runHistoricalContextBackfillOnce();
      expect(second).toBe(first);
      releaseMetadata("complete");

      await expect(first).resolves.toEqual({
        status: "already-completed",
        enrichedEvents: 0,
      });
      expect(mockGetMetadata).toHaveBeenCalledTimes(2);
    });

    it("completes and marks the one-time startup scan", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockHasHistoricalCardEventsMissingContext
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockSettingsGet.mockImplementation(async (key: string) =>
        key === "poe1ClientTxtPath" ? "/game/client.txt" : null,
      );
      mockCreateReadStream.mockReturnValue(
        Readable.from([
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.\n",
          "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}\n",
        ]),
      );
      mockFindHistoricalCardEventCandidate.mockReturnValue(candidate);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "completed", enrichedEvents: 1 },
      );

      expect(mockSetMetadata).toHaveBeenCalledWith(
        "historical_card_time_context_backfill_v2:poe1",
        "complete",
      );
      expect(mockSetMetadata).toHaveBeenCalledWith(
        "historical_card_time_context_backfill_v2:poe2",
        "complete",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ClientLogReader] Historical card context backfill completed with 1 enriched event(s)",
      );
      consoleSpy.mockRestore();
    });

    it("marks a scan complete when there are no historical candidates", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockSettingsGet.mockClear();

      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "completed", enrichedEvents: 0 },
      );

      expect(mockSettingsGet).not.toHaveBeenCalledWith("poe1ClientTxtPath");
      expect(mockSetMetadata).toHaveBeenCalledTimes(2);
      expect(mockSetMetadata).toHaveBeenNthCalledWith(
        1,
        "historical_card_time_context_backfill_v2:poe1",
        "complete",
      );
      expect(mockSetMetadata).toHaveBeenNthCalledWith(
        2,
        "historical_card_time_context_backfill_v2:poe2",
        "complete",
      );
    });

    it("defers the scan when candidates exist but their log is not configured", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockHasHistoricalCardEventsMissingContext
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "deferred", enrichedEvents: 0 },
      );

      expect(mockCreateReadStream).not.toHaveBeenCalled();
      expect(mockSetMetadata).toHaveBeenCalledOnce();
      expect(mockSetMetadata).toHaveBeenCalledWith(
        "historical_card_time_context_backfill_v2:poe2",
        "complete",
      );
    });

    it("does not rescan a completed game while another game remains deferred", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      const completedKeys = new Set<string>();
      mockGetMetadata.mockImplementation(async (key: string) =>
        completedKeys.has(key) ? "complete" : null,
      );
      mockSetMetadata.mockImplementation(async (key: string) => {
        completedKeys.add(key);
      });
      mockHasHistoricalCardEventsMissingContext.mockResolvedValue(true);
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "communityUploadsEnabled") return true;
        if (key === "poe1ClientTxtPath") return "/game/poe1-client.txt";
        return null;
      });
      mockCreateReadStream.mockReturnValue(Readable.from(["invalid\n"]));

      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "deferred", enrichedEvents: 0 },
      );
      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "deferred", enrichedEvents: 0 },
      );

      expect(mockCreateReadStream).toHaveBeenCalledOnce();
      expect(mockCreateReadStream).toHaveBeenCalledWith(
        "/game/poe1-client.txt",
        { encoding: "utf8" },
      );
      expect(completedKeys).toContain(
        "historical_card_time_context_backfill_v2:poe1",
      );
      expect(completedKeys).not.toContain(
        "historical_card_time_context_backfill_v2:poe2",
      );
    });

    it("defers unreadable logs without blocking other games", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockHasHistoricalCardEventsMissingContext.mockResolvedValue(true);
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "poe1ClientTxtPath") return "/game/poe1-client.txt";
        if (key === "poe2ClientTxtPath") return "/game/poe2-client.txt";
        return null;
      });
      mockCreateReadStream
        .mockImplementationOnce(() => {
          throw new Error("unreadable");
        })
        .mockImplementationOnce(() => {
          throw "rotated";
        });
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(service.runHistoricalContextBackfillOnce()).resolves.toEqual(
        { status: "deferred", enrichedEvents: 0 },
      );

      expect(consoleSpy).toHaveBeenNthCalledWith(
        1,
        "[ClientLogReader] Historical card context backfill deferred for poe1:",
        "unreadable",
      );
      expect(consoleSpy).toHaveBeenNthCalledWith(
        2,
        "[ClientLogReader] Historical card context backfill deferred for poe2:",
        "rotated",
      );
      expect(mockSetMetadata).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("contains Error and non-Error startup failures for a later retry", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockGetMetadata
        .mockRejectedValueOnce(new Error("database closed"))
        .mockRejectedValueOnce("database busy");

      for (const message of ["database closed", "database busy"]) {
        await expect(
          service.runHistoricalContextBackfillOnce(),
        ).resolves.toEqual({ status: "deferred", enrichedEvents: 0 });
        expect(consoleSpy).toHaveBeenLastCalledWith(
          "[ClientLogReader] Historical card context backfill deferred:",
          message,
        );
      }
      consoleSpy.mockRestore();
    });

    it("exposes the one-time scan through trusted IPC", async () => {
      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );
      mockGetMetadata.mockResolvedValue("complete");
      const handler = mockIpcHandle.mock.calls.find(
        ([channel]: [string]) =>
          channel === "client-log-reader:run-historical-context-backfill",
      )?.[1];
      const event = { sender: { id: 1 } };

      await expect(handler(event)).resolves.toEqual({
        status: "already-completed",
        enrichedEvents: 0,
      });

      expect(mockAssertTrustedSender).toHaveBeenCalledWith(
        event,
        "client-log-reader:run-historical-context-backfill",
      );
      expect(service).toBeDefined();
    });
  });

  // ─── stopWatchFile ──────────────────────────────────────────────────────

  describe("stopWatchFile", () => {
    it("should call fs.unwatchFile with the client log path", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      service.stopWatchFile();

      expect(mockUnwatchFile).toHaveBeenCalledWith("/game/client.txt");
    });

    it("should close the file descriptor when stopping", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      // openSync was called during watchFile
      expect(mockOpenSync).toHaveBeenCalled();
      mockCloseSync.mockReset();

      service.stopWatchFile();

      expect(mockCloseSync).toHaveBeenCalledWith(42);
    });

    it("should not call unwatchFile if clientLogPath was never set", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return null;
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      service.stopWatchFile();

      expect(mockUnwatchFile).not.toHaveBeenCalled();
    });
  });

  // ─── setClientLogPath ───────────────────────────────────────────────────

  describe("setClientLogPath", () => {
    it("should stop watching the old file and start watching the new one", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/old/client.txt";
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      // Should have watched old path during init
      expect(mockWatchFile).toHaveBeenCalledTimes(1);
      expect(mockWatchFile.mock.calls[0][0]).toBe("/old/client.txt");

      service.setClientLogPath("/new/client.txt", "poe2");

      // Should have unwatched old and watched new
      expect(mockUnwatchFile).toHaveBeenCalledWith("/old/client.txt");
      expect(mockWatchFile).toHaveBeenCalledTimes(2);
      expect(mockWatchFile.mock.calls[1][0]).toBe("/new/client.txt");
    });

    it("should update the game type for future processing", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      // Switch to poe2
      service.setClientLogPath("/poe2/client.txt", "poe2");

      // Set up the new callback
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-poe2",
        league: "Dawn",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "log text\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(makeParseResult());

      // Invoke the new watcher callback (second watchFile call)
      const callback = getWatchCallback(1);
      await callback(makeStats(newData.length), makeStats(0));

      // Session methods should be called with poe2
      expect(mockIsSessionActive).toHaveBeenCalledWith("poe2");
      expect(mockGetActiveSessionInfo).toHaveBeenCalledWith("poe2");
      expect(mockGetAllProcessedIds).toHaveBeenCalledWith("poe2");
    });

    it("should allow calling setClientLogPath when no previous path was set", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return null;
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      // No initial watch
      expect(mockWatchFile).not.toHaveBeenCalled();

      service.setClientLogPath("/new/client.txt", "poe1");

      // Should start watching the new path
      expect(mockWatchFile).toHaveBeenCalledTimes(1);
      expect(mockWatchFile.mock.calls[0][0]).toBe("/new/client.txt");
    });
  });

  // ─── Multiple card processing ──────────────────────────────────────────

  describe("multiple cards in a single file change", () => {
    let _service: ClientLogReaderService;

    beforeEach(async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      _service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-multi",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
    });

    it("should process cards from multiple different card types", async () => {
      const newData = "multi card log\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(
        makeParseResult({
          "The Doctor": ["a1"],
          "Rain of Chaos": ["b1", "b2"],
          "The Nurse": ["c1", "c2"],
        }),
      );

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockAddCard).toHaveBeenCalledTimes(5);

      // Verify each card+id combination
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "a1",
        expect.objectContaining({ processedId: "a1" }),
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "b1",
        expect.objectContaining({ processedId: "b1" }),
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "b2",
        expect.objectContaining({ processedId: "b2" }),
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Nurse",
        "c1",
        expect.objectContaining({ processedId: "c1" }),
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Nurse",
        "c2",
        expect.objectContaining({ processedId: "c2" }),
      );
    });

    it("should handle a single card with a single processedId", async () => {
      const newData = "single card log\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "The Wretched": ["only-one"] }),
      );

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockAddCard).toHaveBeenCalledTimes(1);
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Wretched",
        "only-one",
        expect.objectContaining({ processedId: "only-one" }),
      );
    });
  });

  // ─── Performance logging ───────────────────────────────────────────────

  describe("performance logging", () => {
    it("should call perfLogger.startTimers when processing file changes", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "log\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(makeParseResult());

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      expect(mockPerfStartTimers).toHaveBeenCalled();
    });

    it("should log performance metrics when cards are found", async () => {
      // Enable perf timers so the logging path fires
      const mockTimers = {
        start: vi.fn(),
        end: vi.fn().mockReturnValue(1.5),
        log: vi.fn(),
      };
      mockPerfStartTimers.mockReturnValue(mockTimers as any);
      mockPerfStartTimer.mockReturnValue(vi.fn() as any);

      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "card log\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "The Doctor": ["id-perf"] }),
      );

      const callback = getWatchCallback();
      await callback(makeStats(newData.length), makeStats(0));

      // Performance timer methods should have been called
      expect(mockTimers.start).toHaveBeenCalled();
      expect(mockTimers.end).toHaveBeenCalled();
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should skip processing when a previous callback is still running (re-entrancy guard)", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "log line\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "The Doctor": ["id-1"] }),
      );

      // Make addCard hang so the first callback never finishes
      let resolveAddCard!: () => void;
      mockAddCard.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveAddCard = resolve;
        }),
      );

      const callback = getWatchCallback();

      // Start the first callback — it will block on addCard
      const firstCall = callback(makeStats(newData.length), makeStats(0));

      // Allow microtasks to run so the first callback enters the processing path
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Fire a second callback while the first is still running
      mockParseCards.mockReturnValue(
        makeParseResult({ "Rain of Chaos": ["id-2"] }),
      );
      const secondData = "another log line\n";
      mockReadSyncWith(secondData);
      await callback(
        makeStats(newData.length + secondData.length),
        makeStats(newData.length),
      );

      // The second callback should have been skipped entirely
      expect(mockAddCard).toHaveBeenCalledTimes(1);
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "id-1",
        expect.objectContaining({ processedId: "id-1" }),
      );

      // Let the first callback finish
      resolveAddCard();
      await firstCall;
    });

    it("should resume processing on the next tick after a blocked callback completes", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const firstData = "first line\n";
      mockReadSyncWith(firstData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "The Doctor": ["id-1"] }),
      );

      // Make first addCard hang then resolve
      let resolveAddCard!: () => void;
      mockAddCard.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveAddCard = resolve;
        }),
      );

      const callback = getWatchCallback();

      // Start and complete the first (blocked) callback
      const firstCall = callback(makeStats(firstData.length), makeStats(0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      resolveAddCard();
      await firstCall;

      // Now fire a second callback — it should process normally
      mockAddCard.mockResolvedValue(undefined);
      const secondData = "second line\n";
      mockReadSyncWith(secondData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "Rain of Chaos": ["id-2"] }),
      );

      await callback(
        makeStats(firstData.length + secondData.length),
        makeStats(firstData.length),
      );

      expect(mockAddCard).toHaveBeenCalledTimes(2);
      expect(mockAddCard).toHaveBeenLastCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "id-2",
        expect.objectContaining({ processedId: "id-2" }),
      );
    });

    it("should release the re-entrancy guard even when processing throws", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const errorData = "error line\n";
      mockReadSyncWith(errorData);
      mockParseCards.mockImplementation(() => {
        throw new Error("parse explosion");
      });

      const callback = getWatchCallback();

      // First callback throws — should be caught and guard released
      await callback(makeStats(errorData.length), makeStats(0));

      // Second callback should process normally (guard was released)
      mockParseCards.mockReturnValue(
        makeParseResult({ "The Doctor": ["id-1"] }),
      );
      const secondData = "second line\n";
      mockReadSyncWith(secondData);
      mockAddCard.mockResolvedValue(undefined);

      await callback(
        makeStats(errorData.length + secondData.length),
        makeStats(errorData.length),
      );

      expect(mockAddCard).toHaveBeenCalledTimes(1);
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "id-1",
        expect.objectContaining({ processedId: "id-1" }),
      );
    });

    it("should reset the re-entrancy guard when stopWatchFile is called", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      const service = await ClientLogReaderService.getInstance(
        mockMainWindow as any,
      );

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const newData = "log line\n";
      mockReadSyncWith(newData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "The Doctor": ["id-1"] }),
      );

      // Make addCard hang indefinitely
      mockAddCard.mockReturnValue(new Promise<void>(() => {}));

      const callback = getWatchCallback();
      // Start a callback that will never finish
      callback(makeStats(newData.length), makeStats(0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Stop watching — this should reset the guard
      service.stopWatchFile();

      // Start watching again with a new path
      mockOpenSync.mockReturnValue(99);
      mockFstatSync.mockReturnValue({ size: 0 });
      service.setClientLogPath("/game/new-client.txt", "poe1");

      // The new callback should process normally (guard was reset by stop)
      mockAddCard.mockResolvedValue(undefined);
      const freshData = "fresh line\n";
      mockReadSyncWith(freshData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "Rain of Chaos": ["id-2"] }),
      );

      const newCallback = getWatchCallback(1);
      await newCallback(makeStats(freshData.length), makeStats(0));

      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "id-2",
        expect.objectContaining({ processedId: "id-2" }),
      );
    });

    it("should handle file deletion (stats with zero birthtimeMs)", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      const callback = getWatchCallback();
      // Simulate file deleted: size=0 and birthtimeMs=0
      await callback({ size: 0, birthtimeMs: 0 }, makeStats(100));

      expect(mockParseCards).not.toHaveBeenCalled();
      // Should have closed the fd
      expect(mockCloseSync).toHaveBeenCalled();
    });

    it("should handle consecutive file change callbacks correctly", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const callback = getWatchCallback();

      // First call: one card — file grew from 0 to 20
      const firstData = "first call\n";
      mockReadSyncWith(firstData);
      mockParseCards.mockReturnValue(makeParseResult({ "Card A": ["id-1"] }));
      await callback(makeStats(firstData.length), makeStats(0));
      expect(mockAddCard).toHaveBeenCalledTimes(1);

      // Second call: two more cards — file grew further
      const secondData = "second call\n";
      mockReadSyncWith(secondData);
      mockParseCards.mockReturnValue(
        makeParseResult({ "Card B": ["id-2", "id-3"] }),
      );
      await callback(
        makeStats(firstData.length + secondData.length),
        makeStats(firstData.length),
      );
      expect(mockAddCard).toHaveBeenCalledTimes(3); // 1 + 2
    });

    it("should buffer partial lines across ticks", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedGame") return "poe1";
        if (key === "poe1ClientTxtPath") return "/game/client.txt";
        return null;
      });

      await ClientLogReaderService.getInstance(mockMainWindow as any);

      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });

      const callback = getWatchCallback();

      // First tick: data does NOT end with newline (partial line)
      const partialData = "incomplete line without newline";
      mockReadSyncWith(partialData);
      mockParseCards.mockReturnValue(makeParseResult());

      await callback(makeStats(partialData.length), makeStats(0));

      // parseCards should NOT have been called since there's no complete line
      expect(mockParseCards).not.toHaveBeenCalled();

      // Second tick: rest of the line arrives with a newline
      const restData = " finished\n";
      mockReadSyncWith(restData);
      mockParseCards.mockReturnValue(makeParseResult());

      await callback(
        makeStats(partialData.length + restData.length),
        makeStats(partialData.length),
      );

      // Now parseCards should have been called with the full combined line
      expect(mockParseCards).toHaveBeenCalledWith(
        "incomplete line without newline finished\n",
        expect.anything(),
        null,
      );
    });
  });
});
