import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetKysely,
  mockRepoGetCardsByScope,
  mockRepoGetTotalCountByScope,
  mockRepoGetLastUpdatedByScope,
  mockRepoGetGlobalStat,
  mockRepoIncrementGlobalStat,
  mockRepoUpsertCard,
  mockRepoDeleteCardsByScope,
  mockRepoResetGlobalStat,
  mockRepoGetAvailableLeagues,
  mockAssertGameType,
  mockAssertBoundedString,
  mockHandleValidationError,
  mockPerfLog,
  mockPerfStartTimers,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetKysely: vi.fn(),
  mockRepoGetCardsByScope: vi.fn(),
  mockRepoGetTotalCountByScope: vi.fn(),
  mockRepoGetLastUpdatedByScope: vi.fn(),
  mockRepoGetGlobalStat: vi.fn(),
  mockRepoIncrementGlobalStat: vi.fn(),
  mockRepoUpsertCard: vi.fn(),
  mockRepoDeleteCardsByScope: vi.fn(),
  mockRepoResetGlobalStat: vi.fn(),
  mockRepoGetAvailableLeagues: vi.fn(),
  mockAssertGameType: vi.fn(),
  mockAssertBoundedString: vi.fn(),
  mockHandleValidationError: vi.fn(),
  mockPerfLog: vi.fn(),
  mockPerfStartTimers: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
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

// ─── Mock DatabaseService ────────────────────────────────────────────────────
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
      startTimers: mockPerfStartTimers,
      log: mockPerfLog,
      startTimer: vi.fn(),
      time: vi.fn(),
    })),
  },
}));

// ─── Mock DataStoreRepository ────────────────────────────────────────────────
vi.mock("../DataStore.repository", () => ({
  DataStoreRepository: class MockDataStoreRepository {
    getCardsByScope = mockRepoGetCardsByScope;
    getTotalCountByScope = mockRepoGetTotalCountByScope;
    getLastUpdatedByScope = mockRepoGetLastUpdatedByScope;
    getGlobalStat = mockRepoGetGlobalStat;
    incrementGlobalStat = mockRepoIncrementGlobalStat;
    upsertCard = mockRepoUpsertCard;
    deleteCardsByScope = mockRepoDeleteCardsByScope;
    resetGlobalStat = mockRepoResetGlobalStat;
    getAvailableLeagues = mockRepoGetAvailableLeagues;
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertGameType: mockAssertGameType,
  assertBoundedString: mockAssertBoundedString,
  handleValidationError: mockHandleValidationError,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { DataStoreChannel } from "../DataStore.channels";
import { DataStoreService } from "../DataStore.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => any {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel,
  );
  if (!call) {
    const registered = mockIpcHandle.mock.calls
      .map(([ch]: [string]) => ch)
      .join(", ");
    throw new Error(
      `ipcMain.handle was not called with "${channel}". Registered: ${registered}`,
    );
  }
  return call[1];
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_CARDS = [
  { cardName: "Rain of Chaos", count: 25 },
  { cardName: "The Doctor", count: 3 },
];

const SAMPLE_GLOBAL_STAT = { key: "totalStackedDecksOpened", value: 42 };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DataStoreService — IPC handlers", () => {
  let _service: DataStoreService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    DataStoreService._instance = undefined;

    // Reset validation mocks to no-op implementations
    mockAssertGameType.mockImplementation(() => {});
    mockAssertBoundedString.mockImplementation(() => {});
    mockHandleValidationError.mockImplementation(() => ({
      success: false,
      error: "Validation error",
    }));

    // Default mock return values
    mockRepoGetCardsByScope.mockResolvedValue(SAMPLE_CARDS);
    mockRepoGetTotalCountByScope.mockResolvedValue(28);
    mockRepoGetLastUpdatedByScope.mockResolvedValue("2025-01-15T10:00:00Z");
    mockRepoGetGlobalStat.mockResolvedValue(SAMPLE_GLOBAL_STAT);
    mockRepoGetAvailableLeagues.mockResolvedValue(["Settlers", "Necropolis"]);

    _service = DataStoreService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    DataStoreService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Handler registration ────────────────────────────────────────────────

  describe("handler registration", () => {
    it("should register handlers for all expected IPC channels", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(DataStoreChannel.GetAllTimeStats);
      expect(registeredChannels).toContain(DataStoreChannel.GetLeagueStats);
      expect(registeredChannels).toContain(DataStoreChannel.GetLeagues);
      expect(registeredChannels).toContain(DataStoreChannel.GetGlobal);
    });

    it("should register exactly 4 IPC handlers", () => {
      expect(mockIpcHandle).toHaveBeenCalledTimes(4);
    });
  });

  // ─── GetAllTimeStats handler ─────────────────────────────────────────────

  describe("GetAllTimeStats handler", () => {
    it("should validate game type and return all-time stats on success", async () => {
      const handler = getIpcHandler(DataStoreChannel.GetAllTimeStats);
      const result = await handler({}, "poe1");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        DataStoreChannel.GetAllTimeStats,
      );
      expect(mockRepoGetCardsByScope).toHaveBeenCalledWith("poe1", "all-time");
      expect(mockRepoGetTotalCountByScope).toHaveBeenCalledWith(
        "poe1",
        "all-time",
      );
      expect(mockRepoGetLastUpdatedByScope).toHaveBeenCalledWith(
        "poe1",
        "all-time",
      );
      expect(result).toEqual({
        totalCount: 28,
        cards: {
          "Rain of Chaos": { count: 25 },
          "The Doctor": { count: 3 },
        },
        lastUpdated: "2025-01-15T10:00:00Z",
      });
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      validationError.name = "IpcValidationError";
      mockAssertGameType.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(DataStoreChannel.GetAllTimeStats);
      await handler({}, "invalid");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        DataStoreChannel.GetAllTimeStats,
      );
    });

    it("should not call repository when validation fails", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetAllTimeStats);
      await handler({}, 123);

      expect(mockRepoGetCardsByScope).not.toHaveBeenCalled();
      expect(mockRepoGetTotalCountByScope).not.toHaveBeenCalled();
      expect(mockRepoGetLastUpdatedByScope).not.toHaveBeenCalled();
    });

    it("should return undefined lastUpdated when repo returns null", async () => {
      mockRepoGetLastUpdatedByScope.mockResolvedValue(null);

      const handler = getIpcHandler(DataStoreChannel.GetAllTimeStats);
      const result = await handler({}, "poe1");

      expect(result.lastUpdated).toBeUndefined();
    });

    it("should return empty cards object when no cards exist", async () => {
      mockRepoGetCardsByScope.mockResolvedValue([]);
      mockRepoGetTotalCountByScope.mockResolvedValue(0);

      const handler = getIpcHandler(DataStoreChannel.GetAllTimeStats);
      const result = await handler({}, "poe2");

      expect(result).toEqual({
        totalCount: 0,
        cards: {},
        lastUpdated: "2025-01-15T10:00:00Z",
      });
    });
  });

  // ─── GetLeagueStats handler ──────────────────────────────────────────────

  describe("GetLeagueStats handler", () => {
    it("should validate game and league then return league stats", async () => {
      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      const result = await handler({}, "poe1", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        DataStoreChannel.GetLeagueStats,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        DataStoreChannel.GetLeagueStats,
        256,
      );
      expect(mockRepoGetCardsByScope).toHaveBeenCalledWith("poe1", "Settlers");
      expect(mockRepoGetTotalCountByScope).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
      expect(mockRepoGetLastUpdatedByScope).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
      expect(result).toEqual({
        totalCount: 28,
        cards: {
          "Rain of Chaos": { count: 25 },
          "The Doctor": { count: 3 },
        },
        lastUpdated: "2025-01-15T10:00:00Z",
      });
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      validationError.name = "IpcValidationError";
      mockAssertGameType.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      await handler({}, "invalid", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        DataStoreChannel.GetLeagueStats,
      );
    });

    it("should handle validation errors for invalid league string", async () => {
      const validationError = new Error("Invalid league");
      validationError.name = "IpcValidationError";
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      await handler({}, "poe1", 12345);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        DataStoreChannel.GetLeagueStats,
      );
    });

    it("should not call repository when game validation fails", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      await handler({}, null, "Settlers");

      expect(mockRepoGetCardsByScope).not.toHaveBeenCalled();
    });

    it("should not call repository when league validation fails", async () => {
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      await handler({}, "poe1", "");

      expect(mockRepoGetCardsByScope).not.toHaveBeenCalled();
    });

    it("should work with poe2 game type", async () => {
      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      const result = await handler({}, "poe2", "Standard");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        DataStoreChannel.GetLeagueStats,
      );
      expect(mockRepoGetCardsByScope).toHaveBeenCalledWith("poe2", "Standard");
      expect(result.totalCount).toBe(28);
    });
  });

  // ─── data-store:get-leagues handler ──────────────────────────────────────

  describe("data-store:get-leagues handler", () => {
    it("should validate game type and return available leagues", async () => {
      const handler = getIpcHandler(DataStoreChannel.GetLeagues);
      const result = await handler({}, "poe1");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        DataStoreChannel.GetLeagues,
      );
      expect(mockRepoGetAvailableLeagues).toHaveBeenCalledWith("poe1");
      expect(result).toEqual(["Settlers", "Necropolis"]);
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      validationError.name = "IpcValidationError";
      mockAssertGameType.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagues);
      await handler({}, "bad-game");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        DataStoreChannel.GetLeagues,
      );
    });

    it("should not call repository when validation fails", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagues);
      await handler({}, undefined);

      expect(mockRepoGetAvailableLeagues).not.toHaveBeenCalled();
    });

    it("should return empty array when no leagues exist", async () => {
      mockRepoGetAvailableLeagues.mockResolvedValue([]);

      const handler = getIpcHandler(DataStoreChannel.GetLeagues);
      const result = await handler({}, "poe2");

      expect(result).toEqual([]);
    });

    it("should work with poe2 game type", async () => {
      mockRepoGetAvailableLeagues.mockResolvedValue(["Standard"]);

      const handler = getIpcHandler(DataStoreChannel.GetLeagues);
      const result = await handler({}, "poe2");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        DataStoreChannel.GetLeagues,
      );
      expect(result).toEqual(["Standard"]);
    });

    it("should return validation error result for non-string game", async () => {
      const validationError = new Error("Not a string");
      validationError.name = "IpcValidationError";
      mockAssertGameType.mockImplementationOnce(() => {
        throw validationError;
      });
      const errorPayload = { success: false, error: "Invalid input" };
      mockHandleValidationError.mockReturnValueOnce(errorPayload);

      const handler = getIpcHandler(DataStoreChannel.GetLeagues);
      const result = await handler({}, 42);

      expect(result).toEqual(errorPayload);
    });
  });

  // ─── data-store:get-global handler ───────────────────────────────────────

  describe("data-store:get-global handler", () => {
    it("should return global stats", async () => {
      const handler = getIpcHandler(DataStoreChannel.GetGlobal);
      const result = await handler({});

      expect(mockRepoGetGlobalStat).toHaveBeenCalledWith(
        "totalStackedDecksOpened",
      );
      expect(result).toEqual({
        totalStackedDecksOpened: 42,
      });
    });

    it("should return zero totalStackedDecksOpened when no stat exists", async () => {
      mockRepoGetGlobalStat.mockResolvedValue(null);

      const handler = getIpcHandler(DataStoreChannel.GetGlobal);
      const result = await handler({});

      expect(result).toEqual({
        totalStackedDecksOpened: 0,
      });
    });

    it("should not require any arguments", async () => {
      const handler = getIpcHandler(DataStoreChannel.GetGlobal);
      const result = await handler({});

      // Should not call any validation functions
      // (assertGameType and assertBoundedString should NOT be called for this handler)
      // We check that the handler works without game/league params
      expect(result).toBeDefined();
      expect(result.totalStackedDecksOpened).toBe(42);
    });

    it("should return the value from the global stat record", async () => {
      mockRepoGetGlobalStat.mockResolvedValue({
        key: "totalStackedDecksOpened",
        value: 999,
      });

      const handler = getIpcHandler(DataStoreChannel.GetGlobal);
      const result = await handler({});

      expect(result.totalStackedDecksOpened).toBe(999);
    });
  });

  // ─── Cross-cutting concerns ──────────────────────────────────────────────

  describe("cross-cutting concerns", () => {
    it("should return handleValidationError result when validation fails", async () => {
      const errorPayload = { success: false, error: "Invalid input: bad game" };
      mockHandleValidationError.mockReturnValueOnce(errorPayload);
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("bad game");
      });

      const handler = getIpcHandler(DataStoreChannel.GetAllTimeStats);
      const result = await handler({}, "invalid");

      expect(result).toEqual(errorPayload);
    });

    it("should not call repository methods when GetAllTimeStats validation fails", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetAllTimeStats);
      await handler({}, null);

      expect(mockRepoGetCardsByScope).not.toHaveBeenCalled();
      expect(mockRepoGetTotalCountByScope).not.toHaveBeenCalled();
      expect(mockRepoGetLastUpdatedByScope).not.toHaveBeenCalled();
    });

    it("should not call repository methods when GetLeagueStats validation fails on game", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      await handler({}, false, "Settlers");

      expect(mockRepoGetCardsByScope).not.toHaveBeenCalled();
      expect(mockRepoGetTotalCountByScope).not.toHaveBeenCalled();
      expect(mockRepoGetLastUpdatedByScope).not.toHaveBeenCalled();
    });

    it("should not call repository methods when GetLeagueStats validation fails on league", async () => {
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagueStats);
      await handler({}, "poe1", null);

      expect(mockRepoGetCardsByScope).not.toHaveBeenCalled();
    });

    it("should not call repository methods when get-leagues validation fails", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(DataStoreChannel.GetLeagues);
      await handler({}, []);

      expect(mockRepoGetAvailableLeagues).not.toHaveBeenCalled();
    });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = DataStoreService.getInstance();
      const instance2 = DataStoreService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
