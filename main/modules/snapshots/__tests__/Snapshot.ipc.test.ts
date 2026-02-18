import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetKysely,
  mockRepoGetRecentSnapshot,
  mockRepoGetLeagueByName,
  mockRepoCreateLeague,
  mockRepoLoadSnapshot,
  mockRepoGetSnapshotById,
  mockRepoGetSnapshotCardPrices,
  mockRepoCreateSnapshot,
  mockIsConfigured,
  mockGetLatestSnapshot,
  mockUpdateRaritiesFromPrices,
  mockAssertGameType,
  mockAssertBoundedString,
  mockHandleValidationError,
  mockGetAllWindows,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetKysely: vi.fn(),
  mockRepoGetRecentSnapshot: vi.fn(),
  mockRepoGetLeagueByName: vi.fn(),
  mockRepoCreateLeague: vi.fn(),
  mockRepoLoadSnapshot: vi.fn(),
  mockRepoGetSnapshotById: vi.fn(),
  mockRepoGetSnapshotCardPrices: vi.fn(),
  mockRepoCreateSnapshot: vi.fn(),
  mockIsConfigured: vi.fn(),
  mockGetLatestSnapshot: vi.fn(),
  mockUpdateRaritiesFromPrices: vi.fn(),
  mockAssertGameType: vi.fn(),
  mockAssertBoundedString: vi.fn(),
  mockHandleValidationError: vi.fn(),
  mockGetAllWindows: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
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

// ─── Mock SupabaseClientService ──────────────────────────────────────────────
vi.mock("~/main/modules/supabase", () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      isConfigured: mockIsConfigured,
      getLatestSnapshot: mockGetLatestSnapshot,
    })),
  },
}));

// ─── Mock DivinationCardsService ─────────────────────────────────────────────
vi.mock("~/main/modules/divination-cards", () => ({
  DivinationCardsService: {
    getInstance: vi.fn(() => ({
      updateRaritiesFromPrices: mockUpdateRaritiesFromPrices,
      initialize: vi.fn(),
    })),
  },
}));

// ─── Mock SnapshotRepository ─────────────────────────────────────────────────
vi.mock("../Snapshot.repository", () => ({
  SnapshotRepository: class MockSnapshotRepository {
    getRecentSnapshot = mockRepoGetRecentSnapshot;
    getLeagueByName = mockRepoGetLeagueByName;
    createLeague = mockRepoCreateLeague;
    loadSnapshot = mockRepoLoadSnapshot;
    getSnapshotById = mockRepoGetSnapshotById;
    getSnapshotCardPrices = mockRepoGetSnapshotCardPrices;
    createSnapshot = mockRepoCreateSnapshot;
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertGameType: mockAssertGameType,
  assertBoundedString: mockAssertBoundedString,
  handleValidationError: mockHandleValidationError,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { SnapshotChannel } from "../Snapshot.channels";
import { SnapshotService } from "../Snapshot.service";

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

const SAMPLE_LEAGUE = {
  id: "league-1",
  game: "poe1",
  name: "Settlers",
  startDate: null,
};

const SAMPLE_RECENT_SNAPSHOT = {
  id: "snap-1",
  leagueId: "league-1",
  fetchedAt: "2025-01-15T10:00:00Z",
  exchangeChaosToDivine: 200,
  stashChaosToDivine: 195,
  stackedDeckChaosCost: 10,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SnapshotService — IPC handlers", () => {
  let service: SnapshotService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    SnapshotService._instance = undefined;

    // Reset validation mocks to no-op / pass-through implementations
    mockAssertGameType.mockImplementation(() => {});
    mockAssertBoundedString.mockImplementation(() => {});
    mockHandleValidationError.mockImplementation(() => ({
      success: false,
      error: "Validation error",
    }));

    // Default mock return values
    mockRepoGetLeagueByName.mockResolvedValue(SAMPLE_LEAGUE);
    mockRepoGetRecentSnapshot.mockResolvedValue(SAMPLE_RECENT_SNAPSHOT);
    mockRepoCreateLeague.mockResolvedValue(undefined);
    mockGetAllWindows.mockReturnValue([]);
    mockIsConfigured.mockReturnValue(true);

    service = SnapshotService.getInstance();
  });

  afterEach(() => {
    // Stop all auto-refresh intervals to prevent leaks
    service.stopAllAutoRefresh();
    // @ts-expect-error — accessing private static for testing
    SnapshotService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Handler registration ────────────────────────────────────────────────

  describe("handler registration", () => {
    it("should register the GetLatestSnapshot IPC handler", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(SnapshotChannel.GetLatestSnapshot);
    });

    it("should register the RefreshPrices IPC handler", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(SnapshotChannel.RefreshPrices);
    });

    it("should register the GetRefreshStatus IPC handler", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(SnapshotChannel.GetRefreshStatus);
    });

    it("should register exactly 3 IPC handlers", () => {
      expect(mockIpcHandle).toHaveBeenCalledTimes(3);
    });
  });

  // ─── GetLatestSnapshot handler ───────────────────────────────────────────

  describe("GetLatestSnapshot handler", () => {
    it("should validate game type and league then return recent snapshot", async () => {
      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      const result = await handler({}, "poe1", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        SnapshotChannel.GetLatestSnapshot,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        SnapshotChannel.GetLatestSnapshot,
        256,
      );
      expect(result).toEqual(SAMPLE_RECENT_SNAPSHOT);
    });

    it("should call ensureLeague to resolve the league id", async () => {
      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", "Settlers");

      expect(mockRepoGetLeagueByName).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("should call getRecentSnapshot with the resolved league id", async () => {
      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", "Settlers");

      expect(mockRepoGetRecentSnapshot).toHaveBeenCalledWith(
        "league-1",
        6, // SNAPSHOT_REUSE_THRESHOLD_HOURS
      );
    });

    it("should return null when no recent snapshot exists", async () => {
      mockRepoGetRecentSnapshot.mockResolvedValue(null);

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      const result = await handler({}, "poe1", "Settlers");

      expect(result).toBeNull();
    });

    it("should create a new league if it does not exist", async () => {
      mockRepoGetLeagueByName.mockResolvedValue(null);

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", "NewLeague");

      expect(mockRepoCreateLeague).toHaveBeenCalledWith(
        expect.objectContaining({
          game: "poe1",
          name: "NewLeague",
        }),
      );
    });

    it("should not create a new league if it already exists", async () => {
      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", "Settlers");

      expect(mockRepoCreateLeague).not.toHaveBeenCalled();
    });

    it("should work with poe2 game type", async () => {
      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe2", "SomeLeague");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        SnapshotChannel.GetLatestSnapshot,
      );
      expect(mockRepoGetLeagueByName).toHaveBeenCalledWith(
        "poe2",
        "SomeLeague",
      );
    });

    // ─── Validation failure paths ──────────────────────────────────────────

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game type");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "invalid-game", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SnapshotChannel.GetLatestSnapshot,
      );
    });

    it("should handle validation errors for invalid league string", async () => {
      const validationError = new Error("league must be a string");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", 12345);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SnapshotChannel.GetLatestSnapshot,
      );
    });

    it("should handle validation errors for league exceeding max length", async () => {
      const validationError = new Error("league exceeds max length");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const longLeague = "x".repeat(257);
      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", longLeague);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SnapshotChannel.GetLatestSnapshot,
      );
    });

    it("should not call repository when game type validation fails", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("Invalid game type");
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "bad", "Settlers");

      expect(mockRepoGetLeagueByName).not.toHaveBeenCalled();
      expect(mockRepoGetRecentSnapshot).not.toHaveBeenCalled();
    });

    it("should not call repository when league validation fails", async () => {
      mockAssertBoundedString.mockImplementation(() => {
        throw new Error("league must be a string");
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", null);

      expect(mockRepoGetLeagueByName).not.toHaveBeenCalled();
      expect(mockRepoGetRecentSnapshot).not.toHaveBeenCalled();
    });

    it("should return validation error result when game validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "game must be poe1 or poe2",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      const result = await handler({}, 123, "Settlers");

      expect(result).toEqual(errorPayload);
    });

    it("should return validation error result when league validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "league must be a string",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertBoundedString.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      const result = await handler({}, "poe1", undefined);

      expect(result).toEqual(errorPayload);
    });

    it("should return validation error result for non-string game", async () => {
      const validationError = new Error("game is required");
      const errorPayload = {
        success: false as const,
        error: "game is required",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      const result = await handler({}, null, "Settlers");

      expect(result).toEqual(errorPayload);
      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SnapshotChannel.GetLatestSnapshot,
      );
    });
  });

  // ─── Cross-cutting concerns ──────────────────────────────────────────────

  describe("cross-cutting concerns", () => {
    it("should return handleValidationError result when any validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "Mocked validation error",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      const result = await handler({}, null, "Settlers");

      expect(result).toEqual(errorPayload);
    });

    it("should not call any repository methods when validation fails on game", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "bad", "Settlers");

      expect(mockRepoGetLeagueByName).not.toHaveBeenCalled();
      expect(mockRepoCreateLeague).not.toHaveBeenCalled();
      expect(mockRepoGetRecentSnapshot).not.toHaveBeenCalled();
    });

    it("should not call any repository methods when validation fails on league", async () => {
      mockAssertBoundedString.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", null);

      expect(mockRepoGetLeagueByName).not.toHaveBeenCalled();
      expect(mockRepoCreateLeague).not.toHaveBeenCalled();
      expect(mockRepoGetRecentSnapshot).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors from ensureLeague gracefully", async () => {
      mockRepoGetLeagueByName.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        expect.any(Error),
        SnapshotChannel.GetLatestSnapshot,
      );
    });

    it("should handle unexpected errors from getRecentSnapshot gracefully", async () => {
      mockRepoGetRecentSnapshot.mockRejectedValue(new Error("Query failed"));

      const handler = getIpcHandler(SnapshotChannel.GetLatestSnapshot);
      await handler({}, "poe1", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        expect.any(Error),
        SnapshotChannel.GetLatestSnapshot,
      );
    });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  // ─── RefreshPrices handler ─────────────────────────────────────────────

  describe("RefreshPrices handler", () => {
    it("should validate game type and league", async () => {
      // getSnapshotForSession calls ensureLeague → getLeagueByName internally,
      // then repository methods. We need the full chain to resolve so mock
      // the Supabase fetch path as well.
      mockIsConfigured.mockReturnValue(false);
      mockRepoGetRecentSnapshot.mockResolvedValue(null);

      const handler = getIpcHandler(SnapshotChannel.RefreshPrices);
      // Will throw deep in getSnapshotForSession because Supabase is not
      // configured and no recent snapshot exists — that's OK, we just want
      // to verify that validation runs first.
      await handler({}, "poe1", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        SnapshotChannel.RefreshPrices,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        SnapshotChannel.RefreshPrices,
        256,
      );
    });

    it("should return validation error when game type is invalid", async () => {
      const errorPayload = {
        success: false as const,
        error: "Invalid game type",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.RefreshPrices);
      const result = await handler({}, "invalid", "Settlers");

      expect(result).toEqual(errorPayload);
    });

    it("should return validation error when league is invalid", async () => {
      const errorPayload = {
        success: false as const,
        error: "Invalid league",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertBoundedString.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.RefreshPrices);
      const result = await handler({}, "poe1", null);

      expect(result).toEqual(errorPayload);
    });
  });

  // ─── GetRefreshStatus handler ──────────────────────────────────────────

  describe("GetRefreshStatus handler", () => {
    it("should validate game type and league then return refresh status", async () => {
      const handler = getIpcHandler(SnapshotChannel.GetRefreshStatus);
      const result = await handler({}, "poe1", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        SnapshotChannel.GetRefreshStatus,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        SnapshotChannel.GetRefreshStatus,
        256,
      );
      expect(result).toHaveProperty(
        "fetchedAt",
        SAMPLE_RECENT_SNAPSHOT.fetchedAt,
      );
      expect(result).toHaveProperty("refreshableAt");
      expect(typeof result.refreshableAt).toBe("string");
    });

    it("should return null fields when no recent snapshot exists", async () => {
      mockRepoGetRecentSnapshot.mockResolvedValue(null);

      const handler = getIpcHandler(SnapshotChannel.GetRefreshStatus);
      const result = await handler({}, "poe1", "Settlers");

      expect(result).toEqual({ fetchedAt: null, refreshableAt: null });
    });

    it("should compute refreshableAt as fetchedAt + AUTO_REFRESH_INTERVAL_HOURS", async () => {
      const handler = getIpcHandler(SnapshotChannel.GetRefreshStatus);
      const result = await handler({}, "poe1", "Settlers");

      const expectedRefreshableAt = new Date(
        new Date(SAMPLE_RECENT_SNAPSHOT.fetchedAt).getTime() +
          4 * 60 * 60 * 1000, // AUTO_REFRESH_INTERVAL_HOURS = 4
      ).toISOString();

      expect(result.refreshableAt).toBe(expectedRefreshableAt);
    });

    it("should return validation error when game type is invalid", async () => {
      const errorPayload = {
        success: false as const,
        error: "Invalid game type",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetRefreshStatus);
      const result = await handler({}, "invalid", "Settlers");

      expect(result).toEqual(errorPayload);
    });

    it("should return validation error when league is invalid", async () => {
      const errorPayload = {
        success: false as const,
        error: "Invalid league",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertBoundedString.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetRefreshStatus);
      const result = await handler({}, "poe1", null);

      expect(result).toEqual(errorPayload);
    });

    it("should not call repository when game validation fails", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SnapshotChannel.GetRefreshStatus);
      await handler({}, "bad", "Settlers");

      expect(mockRepoGetLeagueByName).not.toHaveBeenCalled();
      expect(mockRepoGetRecentSnapshot).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors from ensureLeague gracefully", async () => {
      mockRepoGetLeagueByName.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const handler = getIpcHandler(SnapshotChannel.GetRefreshStatus);
      await handler({}, "poe1", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        expect.any(Error),
        SnapshotChannel.GetRefreshStatus,
      );
    });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = SnapshotService.getInstance();
      const instance2 = SnapshotService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
