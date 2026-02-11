import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockWatchFile,
  mockUnwatchFile,
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
  mockReadLastLines,
} = vi.hoisted(() => ({
  mockWatchFile: vi.fn(),
  mockUnwatchFile: vi.fn(),
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
  mockReadLastLines: vi.fn(),
}));

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-path"),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock node:fs ────────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  default: {
    watchFile: mockWatchFile,
    unwatchFile: mockUnwatchFile,
    promises: {
      open: vi.fn(),
      writeFile: vi.fn(),
    },
  },
  watchFile: mockWatchFile,
  unwatchFile: mockUnwatchFile,
  promises: {
    open: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: vi.fn(),
    })),
  },
}));

// ─── Mock PerformanceLoggerService ───────────────────────────────────────────
vi.mock("~/main/modules/performance-logger", () => ({
  PerformanceLoggerService: {
    getInstance: vi.fn(() => ({
      log: mockPerfLog,
      startTimer: mockPerfStartTimer,
      startTimers: mockPerfStartTimers,
    })),
  },
}));

// ─── Mock CurrentSessionService ──────────────────────────────────────────────
vi.mock("~/main/modules/current-session", () => ({
  CurrentSessionService: {
    getInstance: vi.fn(() => ({
      isSessionActive: mockIsSessionActive,
      getActiveSessionInfo: mockGetActiveSessionInfo,
      getAllProcessedIds: mockGetAllProcessedIds,
      addCard: mockAddCard,
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
      getAllSettings: vi.fn(),
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
    Poe1ClientTxtPath: "poe1ClientTxtPath",
    Poe2ClientTxtPath: "poe2ClientTxtPath",
  },
}));

// Also mock the barrel import path used by the service
vi.mock("~/main/modules", () => ({
  CurrentSessionService: {
    getInstance: vi.fn(() => ({
      isSessionActive: mockIsSessionActive,
      getActiveSessionInfo: mockGetActiveSessionInfo,
      getAllProcessedIds: mockGetAllProcessedIds,
      addCard: mockAddCard,
    })),
  },
  PerformanceLoggerService: {
    getInstance: vi.fn(() => ({
      log: mockPerfLog,
      startTimer: mockPerfStartTimer,
      startTimers: mockPerfStartTimers,
    })),
  },
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
      getAllSettings: vi.fn(),
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
    Poe1ClientTxtPath: "poe1ClientTxtPath",
    Poe2ClientTxtPath: "poe2ClientTxtPath",
  },
}));

// ─── Mock the parseCards and readLastLines utils ─────────────────────────────
vi.mock("../utils", () => ({
  parseCards: mockParseCards,
  readLastLines: mockReadLastLines,
}));

import { ClientLogReaderService } from "../ClientLogReader.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the file-change callback registered via fs.watchFile.
 * If watchFile was called multiple times, returns the callback from the given index.
 */
function getWatchCallback(callIndex = 0): () => Promise<void> {
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

const mockMainWindow = {
  webContents: { send: vi.fn() },
  isDestroyed: vi.fn(() => false),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ClientLogReaderService", () => {
  beforeEach(() => {
    // Reset all mocks
    mockWatchFile.mockReset();
    mockUnwatchFile.mockReset();
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
    mockReadLastLines.mockReset();

    // Default settings responses
    mockSettingsGet.mockImplementation(async (key: string) => {
      if (key === "selectedGame") return "poe1";
      if (key === "poe1ClientTxtPath") return null;
      return null;
    });

    // Reset singleton
    // @ts-expect-error accessing private static for testing
    ClientLogReaderService._instance = undefined;
  });

  afterEach(() => {
    // @ts-expect-error accessing private static for testing
    ClientLogReaderService._instance = undefined;
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

    it("should skip processing when there is no active session", async () => {
      mockIsSessionActive.mockReturnValue(false);

      const callback = getWatchCallback();
      await callback();

      expect(mockReadLastLines).not.toHaveBeenCalled();
      expect(mockParseCards).not.toHaveBeenCalled();
    });

    it("should skip processing when session info is null", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue(null);

      const callback = getWatchCallback();
      await callback();

      expect(mockReadLastLines).not.toHaveBeenCalled();
    });

    it("should read the last 10 lines from the client log", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      mockReadLastLines.mockResolvedValue("");
      mockParseCards.mockReturnValue({ totalCount: 0, cards: {} });

      const callback = getWatchCallback();
      await callback();

      expect(mockReadLastLines).toHaveBeenCalledWith("/game/client.txt", 10);
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
      mockReadLastLines.mockResolvedValue("some log text");
      mockParseCards.mockReturnValue({ totalCount: 0, cards: {} });

      const callback = getWatchCallback();
      await callback();

      expect(mockGetAllProcessedIds).toHaveBeenCalledWith("poe1");
      expect(mockParseCards).toHaveBeenCalledWith(
        "some log text",
        processedIds,
      );
    });

    it("should not call addCard when no new cards are found", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      mockReadLastLines.mockResolvedValue("no cards here");
      mockParseCards.mockReturnValue({ totalCount: 0, cards: {} });

      const callback = getWatchCallback();
      await callback();

      expect(mockAddCard).not.toHaveBeenCalled();
    });

    it("should call addCard for each new card and processedId found", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      mockReadLastLines.mockResolvedValue("log with cards");
      mockParseCards.mockReturnValue({
        totalCount: 3,
        cards: {
          "The Doctor": {
            count: 2,
            processedIds: ["id-100", "id-101"],
          },
          "Rain of Chaos": {
            count: 1,
            processedIds: ["id-200"],
          },
        },
      });

      const callback = getWatchCallback();
      await callback();

      // Should call addCard for each processedId
      expect(mockAddCard).toHaveBeenCalledTimes(3);
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "id-100",
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "id-101",
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "id-200",
      );
    });

    it("should handle errors during processing gracefully", async () => {
      mockIsSessionActive.mockReturnValue(true);
      mockGetActiveSessionInfo.mockReturnValue({
        sessionId: "session-1",
        league: "Settlers",
        startedAt: "2025-01-01T10:00:00Z",
      });
      mockReadLastLines.mockRejectedValue(new Error("File read error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const callback = getWatchCallback();
      // Should not throw
      await callback();

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
      mockReadLastLines.mockResolvedValue("log with cards");
      mockParseCards.mockReturnValue({
        totalCount: 1,
        cards: {
          "The Doctor": {
            count: 1,
            processedIds: ["id-100"],
          },
        },
      });
      mockAddCard.mockRejectedValue(new Error("DB error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const callback = getWatchCallback();
      await callback();

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
      mockReadLastLines.mockResolvedValue("log text");
      mockParseCards.mockReturnValue({ totalCount: 0, cards: {} });

      const callback = getWatchCallback();
      await callback();

      expect(mockIsSessionActive).toHaveBeenCalledWith("poe1");
      expect(mockGetActiveSessionInfo).toHaveBeenCalledWith("poe1");
      expect(mockGetAllProcessedIds).toHaveBeenCalledWith("poe1");
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
      mockReadLastLines.mockResolvedValue("log text");
      mockParseCards.mockReturnValue({ totalCount: 0, cards: {} });

      // Invoke the new watcher callback (second watchFile call)
      const callback = getWatchCallback(1);
      await callback();

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
      mockReadLastLines.mockResolvedValue("multi card log");
    });

    it("should process cards from multiple different card types", async () => {
      mockParseCards.mockReturnValue({
        totalCount: 5,
        cards: {
          "The Doctor": { count: 1, processedIds: ["a1"] },
          "Rain of Chaos": { count: 2, processedIds: ["b1", "b2"] },
          "The Nurse": { count: 2, processedIds: ["c1", "c2"] },
        },
      });

      const callback = getWatchCallback();
      await callback();

      expect(mockAddCard).toHaveBeenCalledTimes(5);

      // Verify each card+id combination
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "a1",
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "b1",
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "Rain of Chaos",
        "b2",
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Nurse",
        "c1",
      );
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Nurse",
        "c2",
      );
    });

    it("should handle a single card with a single processedId", async () => {
      mockParseCards.mockReturnValue({
        totalCount: 1,
        cards: {
          "The Wretched": { count: 1, processedIds: ["only-one"] },
        },
      });

      const callback = getWatchCallback();
      await callback();

      expect(mockAddCard).toHaveBeenCalledTimes(1);
      expect(mockAddCard).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Wretched",
        "only-one",
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
      mockReadLastLines.mockResolvedValue("log");
      mockParseCards.mockReturnValue({ totalCount: 0, cards: {} });

      const callback = getWatchCallback();
      await callback();

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
      mockReadLastLines.mockResolvedValue("card log");
      mockParseCards.mockReturnValue({
        totalCount: 1,
        cards: {
          "The Doctor": { count: 1, processedIds: ["id-perf"] },
        },
      });

      const callback = getWatchCallback();
      await callback();

      // Performance timer methods should have been called
      expect(mockTimers.start).toHaveBeenCalled();
      expect(mockTimers.end).toHaveBeenCalled();
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle parseCards returning cards with empty processedIds array", async () => {
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
      mockReadLastLines.mockResolvedValue("log");
      // totalCount > 0 but cards entry has empty processedIds
      mockParseCards.mockReturnValue({
        totalCount: 1,
        cards: {
          "The Doctor": { count: 0, processedIds: [] },
        },
      });

      const callback = getWatchCallback();
      await callback();

      // addCard should not be called since processedIds is empty
      expect(mockAddCard).not.toHaveBeenCalled();
    });

    it("should handle readLastLines returning empty string", async () => {
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
      mockReadLastLines.mockResolvedValue("");
      mockParseCards.mockReturnValue({ totalCount: 0, cards: {} });

      const callback = getWatchCallback();
      await callback();

      expect(mockParseCards).toHaveBeenCalledWith("", expect.any(Set));
      expect(mockAddCard).not.toHaveBeenCalled();
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

      // First call: one card
      mockReadLastLines.mockResolvedValue("first call");
      mockParseCards.mockReturnValue({
        totalCount: 1,
        cards: { "Card A": { count: 1, processedIds: ["id-1"] } },
      });
      await callback();
      expect(mockAddCard).toHaveBeenCalledTimes(1);

      // Second call: two cards
      mockReadLastLines.mockResolvedValue("second call");
      mockParseCards.mockReturnValue({
        totalCount: 2,
        cards: { "Card B": { count: 2, processedIds: ["id-2", "id-3"] } },
      });
      await callback();
      expect(mockAddCard).toHaveBeenCalledTimes(3); // 1 + 2
    });
  });
});
