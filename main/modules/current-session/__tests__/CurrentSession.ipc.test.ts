import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetAllWindows,
  mockWebContentsSend,
  mockGetKysely,
  mockRepoCreateSession,
  mockRepoUpdateSession,
  mockRepoGetActiveSession,
  mockRepoGetSessionById,
  mockRepoDeactivateAllSessions,
  mockRepoGetSessionTotalCount,
  mockRepoUpsertSessionCard,
  mockRepoIncrementCardCount,
  mockRepoGetSessionCards,
  mockRepoUpdateCardPriceVisibility,
  mockRepoGetProcessedIds,
  mockRepoReplaceProcessedIds,
  mockRepoClearProcessedIds,
  mockRepoSaveProcessedId,
  mockRepoGetRecentDrops,
  mockRepoClearRecentDrops,
  mockRepoGetLeagueId,
  mockRepoCreateSessionSummary,
  mockPerfLog,
  mockPerfStartTimer,
  mockPerfStartTimers,
  mockGetSnapshotForSession,
  mockLoadSnapshot,
  mockStartAutoRefresh,
  mockStopAutoRefresh,
  mockDataStoreAddCard,
  mockGetAllTimeStats,
  mockAssertGameType,
  mockAssertString,
  mockAssertBoolean,
  mockAssertCardName,
  mockAssertPriceSource,
  mockAssertSessionId,
  mockHandleValidationError,
  MockIpcValidationError,
} = vi.hoisted(() => {
  class _MockIpcValidationError extends Error {
    detail: string;
    constructor(channel: string, detail: string) {
      super(`[IPC Validation] ${channel}: ${detail}`);
      this.name = "IpcValidationError";
      this.detail = detail;
    }
  }

  return {
    mockIpcHandle: vi.fn(),
    mockGetAllWindows: vi.fn(),
    mockWebContentsSend: vi.fn(),
    mockGetKysely: vi.fn(),
    mockRepoCreateSession: vi.fn(),
    mockRepoUpdateSession: vi.fn(),
    mockRepoGetActiveSession: vi.fn(),
    mockRepoGetSessionById: vi.fn(),
    mockRepoDeactivateAllSessions: vi.fn(),
    mockRepoGetSessionTotalCount: vi.fn(),
    mockRepoUpsertSessionCard: vi.fn(),
    mockRepoIncrementCardCount: vi.fn(),
    mockRepoGetSessionCards: vi.fn(),
    mockRepoUpdateCardPriceVisibility: vi.fn(),
    mockRepoGetProcessedIds: vi.fn(),
    mockRepoReplaceProcessedIds: vi.fn(),
    mockRepoClearProcessedIds: vi.fn(),
    mockRepoSaveProcessedId: vi.fn(),
    mockRepoGetRecentDrops: vi.fn(),
    mockRepoClearRecentDrops: vi.fn(),
    mockRepoGetLeagueId: vi.fn(),
    mockRepoCreateSessionSummary: vi.fn(),
    mockPerfLog: vi.fn(),
    mockPerfStartTimer: vi.fn(),
    mockPerfStartTimers: vi.fn(),
    mockGetSnapshotForSession: vi.fn(),
    mockLoadSnapshot: vi.fn(),
    mockStartAutoRefresh: vi.fn(),
    mockStopAutoRefresh: vi.fn(),
    mockDataStoreAddCard: vi.fn(),
    mockGetAllTimeStats: vi.fn(),
    mockAssertGameType: vi.fn(),
    mockAssertString: vi.fn(),
    mockAssertBoolean: vi.fn(),
    mockAssertCardName: vi.fn(),
    mockAssertPriceSource: vi.fn(),
    mockAssertSessionId: vi.fn(),
    mockHandleValidationError: vi.fn(),
    MockIpcValidationError: _MockIpcValidationError,
  };
});

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

// ─── Mock node:crypto ────────────────────────────────────────────────────────
let uuidCounter = 0;
vi.mock("node:crypto", () => ({
  default: { randomUUID: () => `uuid-${++uuidCounter}` },
  randomUUID: () => `uuid-${++uuidCounter}`,
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
      log: mockPerfLog,
      startTimer: mockPerfStartTimer,
      startTimers: mockPerfStartTimers,
    })),
  },
}));

// ─── Mock SnapshotService ────────────────────────────────────────────────────
vi.mock("~/main/modules/snapshots", () => ({
  SnapshotService: {
    getInstance: vi.fn(() => ({
      getSnapshotForSession: mockGetSnapshotForSession,
      loadSnapshot: mockLoadSnapshot,
      startAutoRefresh: mockStartAutoRefresh,
      stopAutoRefresh: mockStopAutoRefresh,
    })),
  },
}));

// ─── Mock DataStoreService ───────────────────────────────────────────────────
vi.mock("~/main/modules/data-store", () => ({
  DataStoreService: {
    getInstance: vi.fn(() => ({
      addCard: mockDataStoreAddCard,
      getAllTimeStats: mockGetAllTimeStats,
      getLeagueStats: vi.fn(),
      getGlobalStats: vi.fn(),
    })),
  },
}));

// ─── Mock CurrentSessionRepository ───────────────────────────────────────────
vi.mock("../CurrentSession.repository", () => ({
  CurrentSessionRepository: class MockCurrentSessionRepository {
    createSession = mockRepoCreateSession;
    updateSession = mockRepoUpdateSession;
    getActiveSession = mockRepoGetActiveSession;
    getSessionById = mockRepoGetSessionById;
    deactivateAllSessions = mockRepoDeactivateAllSessions;
    getSessionTotalCount = mockRepoGetSessionTotalCount;
    upsertSessionCard = mockRepoUpsertSessionCard;
    incrementCardCount = mockRepoIncrementCardCount;
    getSessionCards = mockRepoGetSessionCards;
    updateCardPriceVisibility = mockRepoUpdateCardPriceVisibility;
    getProcessedIds = mockRepoGetProcessedIds;
    replaceProcessedIds = mockRepoReplaceProcessedIds;
    clearProcessedIds = mockRepoClearProcessedIds;
    saveProcessedId = mockRepoSaveProcessedId;
    getRecentDrops = mockRepoGetRecentDrops;
    clearRecentDrops = mockRepoClearRecentDrops;
    getLeagueId = mockRepoGetLeagueId;
    createSessionSummary = mockRepoCreateSessionSummary;
  },
}));

// ─── Mock FilterService ─────────────────────────────────────────────────────
vi.mock("~/main/modules/filters/Filter.service", () => ({
  FilterService: {
    getInstance: vi.fn(() => ({
      applyFilterRarities: vi.fn().mockResolvedValue(undefined),
      ensureFilterParsed: vi.fn().mockResolvedValue(null),
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      getAllSettings: vi.fn().mockResolvedValue({}),
    })),
  },
  SettingsKey: {
    RaritySource: "raritySource",
    SelectedFilterId: "selectedFilterId",
    ActiveGame: "selectedGame",
    Poe1SelectedLeague: "poe1SelectedLeague",
    Poe2SelectedLeague: "poe2SelectedLeague",
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertGameType: mockAssertGameType,
  assertString: mockAssertString,
  assertBoolean: mockAssertBoolean,
  assertCardName: mockAssertCardName,
  assertPriceSource: mockAssertPriceSource,
  assertSessionId: mockAssertSessionId,
  handleValidationError: mockHandleValidationError,
  IpcValidationError: MockIpcValidationError,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { CurrentSessionChannel } from "../CurrentSession.channels";
import { CurrentSessionService } from "../CurrentSession.service";

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

const MOCK_SNAPSHOT = {
  snapshotId: "snap-1",
  data: {
    timestamp: "2025-01-15T10:00:00Z",
    stackedDeckChaosCost: 3,
    exchange: {
      chaosToDivineRatio: 200,
      cardPrices: {
        "The Doctor": { chaosValue: 1200, divineValue: 6.0 },
      },
    },
    stash: {
      chaosToDivineRatio: 195,
      cardPrices: {
        "The Doctor": { chaosValue: 1100, divineValue: 5.64 },
      },
    },
  },
};

const mockMainWindow = {
  webContents: { send: mockWebContentsSend },
  isDestroyed: vi.fn(() => false),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CurrentSessionService — IPC handlers", () => {
  let _service: CurrentSessionService;

  beforeEach(() => {
    uuidCounter = 0;
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    CurrentSessionService._instance = undefined;

    // Reset validation mocks to no-op implementations
    // (clearAllMocks does not reset implementations set via mockImplementation)
    mockAssertGameType.mockImplementation(() => {});
    mockAssertString.mockImplementation(() => {});
    mockAssertBoolean.mockImplementation(() => {});
    mockAssertCardName.mockImplementation(() => {});
    mockAssertPriceSource.mockImplementation(() => {});
    mockAssertSessionId.mockImplementation(() => {});
    mockHandleValidationError.mockImplementation(() => ({
      success: false,
      error: "Validation error",
    }));

    // Default mock return values
    mockRepoGetProcessedIds.mockResolvedValue([]);
    mockRepoCreateSession.mockResolvedValue(undefined);
    mockRepoUpdateSession.mockResolvedValue(undefined);
    mockRepoDeactivateAllSessions.mockResolvedValue(undefined);
    mockRepoClearRecentDrops.mockResolvedValue(undefined);
    mockRepoGetLeagueId.mockResolvedValue("league-1");
    mockRepoGetSessionById.mockResolvedValue({
      id: "uuid-1",
      game: "poe1",
      leagueId: "league-1",
      snapshotId: "snap-1",
      startedAt: "2025-01-15T10:00:00Z",
      endedAt: null,
      totalCount: 0,
      isActive: true,
    });
    mockRepoGetSessionTotalCount.mockResolvedValue(0);
    mockRepoGetSessionCards.mockResolvedValue([]);
    mockRepoSaveProcessedId.mockResolvedValue(undefined);
    mockRepoIncrementCardCount.mockResolvedValue(undefined);
    mockRepoUpdateCardPriceVisibility.mockResolvedValue(undefined);
    mockRepoCreateSessionSummary.mockResolvedValue(undefined);
    mockRepoGetRecentDrops.mockResolvedValue([]);
    mockGetSnapshotForSession.mockResolvedValue(MOCK_SNAPSHOT);
    mockLoadSnapshot.mockResolvedValue(MOCK_SNAPSHOT.data);
    mockStartAutoRefresh.mockReturnValue(undefined);
    mockStopAutoRefresh.mockReturnValue(undefined);
    mockDataStoreAddCard.mockResolvedValue(undefined);
    mockGetAllWindows.mockReturnValue([mockMainWindow]);
    mockPerfStartTimer.mockReturnValue(null);
    mockPerfStartTimers.mockReturnValue(null);

    _service = CurrentSessionService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    CurrentSessionService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Handler registration ────────────────────────────────────────────────

  describe("handler registration", () => {
    it("should register handlers for all current session channels", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(CurrentSessionChannel.Start);
      expect(registeredChannels).toContain(CurrentSessionChannel.Stop);
      expect(registeredChannels).toContain(CurrentSessionChannel.IsActive);
      expect(registeredChannels).toContain(CurrentSessionChannel.Get);
      expect(registeredChannels).toContain(CurrentSessionChannel.Info);
      expect(registeredChannels).toContain(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
    });
  });

  // ─── Start handler ──────────────────────────────────────────────────────

  describe("Start handler", () => {
    it("should validate inputs and return success on valid start", async () => {
      const handler = getIpcHandler(CurrentSessionChannel.Start);
      const result = await handler(null, "poe1", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        CurrentSessionChannel.Start,
      );
      expect(mockAssertString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        CurrentSessionChannel.Start,
      );
      expect(result).toEqual({ success: true });
    });

    it("should call startSession with validated game and league", async () => {
      const handler = getIpcHandler(CurrentSessionChannel.Start);
      await handler(null, "poe1", "Settlers");

      // startSession internally calls getLeagueId, createSession, etc.
      expect(mockRepoGetLeagueId).toHaveBeenCalledWith("poe1", "Settlers");
      expect(mockRepoCreateSession).toHaveBeenCalled();
    });

    it("should return error with detail when IpcValidationError is thrown", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.Start,
          'Expected "game" to be one of [poe1, poe2], got "bad"',
        );
      });

      const handler = getIpcHandler(CurrentSessionChannel.Start);
      const result = await handler(null, "bad", "Settlers");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
      expect(result.error).toContain("Expected");
    });

    it("should return error message for generic errors", async () => {
      // Make startSession throw a generic Error (e.g., league not found)
      mockRepoGetLeagueId.mockResolvedValue(null);

      const handler = getIpcHandler(CurrentSessionChannel.Start);
      const result = await handler(null, "poe1", "NonExistentLeague");

      expect(result).toEqual({
        success: false,
        error: expect.any(String),
      });
    });

    it("should return 'Unknown error' for non-Error throws", async () => {
      mockRepoGetLeagueId.mockRejectedValue("string-error");

      const handler = getIpcHandler(CurrentSessionChannel.Start);
      const result = await handler(null, "poe1", "Settlers");

      expect(result).toEqual({
        success: false,
        error: "Unknown error",
      });
    });

    it("should not call handleValidationError (uses custom error handling)", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new MockIpcValidationError(CurrentSessionChannel.Start, "bad");
      });

      const handler = getIpcHandler(CurrentSessionChannel.Start);
      await handler(null, "bad", "Settlers");

      // Start handler does NOT use handleValidationError, it handles errors directly
      expect(mockHandleValidationError).not.toHaveBeenCalled();
    });

    it("should handle assertString validation errors", async () => {
      mockAssertString.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.Start,
          'Expected "league" to be a string, got number',
        );
      });

      const handler = getIpcHandler(CurrentSessionChannel.Start);
      const result = await handler(null, "poe1", 12345);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
    });
  });

  // ─── Stop handler ───────────────────────────────────────────────────────

  describe("Stop handler", () => {
    async function startASession(game = "poe1") {
      const startHandler = getIpcHandler(CurrentSessionChannel.Start);
      await startHandler(null, game, "Settlers");
    }

    it("should validate game type and return success with session data", async () => {
      await startASession();

      const handler = getIpcHandler(CurrentSessionChannel.Stop);
      const result = await handler(null, "poe1");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        CurrentSessionChannel.Stop,
      );
      expect(result.success).toBe(true);
      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("durationMs");
      expect(result).toHaveProperty("league");
      expect(result).toHaveProperty("game");
    });

    it("should return error with detail when IpcValidationError is thrown", async () => {
      mockAssertGameType
        .mockImplementationOnce(() => {}) // for start
        .mockImplementationOnce(() => {
          throw new MockIpcValidationError(
            CurrentSessionChannel.Stop,
            "bad game",
          );
        });

      await startASession();
      const handler = getIpcHandler(CurrentSessionChannel.Stop);
      const result = await handler(null, "bad");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
    });

    it("should return error message for generic errors (no active session)", async () => {
      // Don't start a session → stopSession will throw "No active session"
      const handler = getIpcHandler(CurrentSessionChannel.Stop);
      const result = await handler(null, "poe1");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("No active session"),
      });
    });

    it("should return 'Unknown error' for non-Error throws", async () => {
      await startASession();

      // Make stopSession throw a non-Error
      mockRepoGetSessionTotalCount.mockRejectedValue(42);

      const handler = getIpcHandler(CurrentSessionChannel.Stop);
      const result = await handler(null, "poe1");

      expect(result).toEqual({
        success: false,
        error: "Unknown error",
      });
    });

    it("should not call handleValidationError (uses custom error handling)", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new MockIpcValidationError(CurrentSessionChannel.Stop, "bad");
      });

      const handler = getIpcHandler(CurrentSessionChannel.Stop);
      await handler(null, "bad");

      expect(mockHandleValidationError).not.toHaveBeenCalled();
    });
  });

  // ─── IsActive handler ──────────────────────────────────────────────────

  describe("IsActive handler", () => {
    it("should validate game type and return false when no session is active", () => {
      const handler = getIpcHandler(CurrentSessionChannel.IsActive);
      const result = handler(null, "poe1");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        CurrentSessionChannel.IsActive,
      );
      expect(result).toBe(false);
    });

    it("should return true when a session is active", async () => {
      const startHandler = getIpcHandler(CurrentSessionChannel.Start);
      await startHandler(null, "poe1", "Settlers");

      const handler = getIpcHandler(CurrentSessionChannel.IsActive);
      const result = handler(null, "poe1");

      expect(result).toBe(true);
    });

    it("should delegate to handleValidationError on validation failure", () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(CurrentSessionChannel.IsActive);
      handler(null, "bad");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        CurrentSessionChannel.IsActive,
      );
    });

    it("should return the result from handleValidationError", () => {
      const errorPayload = { success: false, error: "Bad game type" };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(CurrentSessionChannel.IsActive);
      const result = handler(null, "bad");

      expect(result).toEqual(errorPayload);
    });
  });

  // ─── Get handler ────────────────────────────────────────────────────────

  describe("Get handler", () => {
    it("should validate game type and return null when no session is active", async () => {
      const handler = getIpcHandler(CurrentSessionChannel.Get);
      const result = await handler(null, "poe1");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        CurrentSessionChannel.Get,
      );
      expect(result).toBeNull();
    });

    it("should return session data when a session is active", async () => {
      const startHandler = getIpcHandler(CurrentSessionChannel.Start);
      await startHandler(null, "poe1", "Settlers");

      const handler = getIpcHandler(CurrentSessionChannel.Get);
      const result = await handler(null, "poe1");

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("cards");
      expect(result).toHaveProperty("league", "Settlers");
    });

    it("should delegate to handleValidationError on validation failure", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(CurrentSessionChannel.Get);
      await handler(null, "bad");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        CurrentSessionChannel.Get,
      );
    });

    it("should return the result from handleValidationError", async () => {
      const errorPayload = { success: false, error: "Game type invalid" };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(CurrentSessionChannel.Get);
      const result = await handler(null, "bad");

      expect(result).toEqual(errorPayload);
    });
  });

  // ─── Info handler ───────────────────────────────────────────────────────

  describe("Info handler", () => {
    it("should validate game type and return null when no session is active", () => {
      const handler = getIpcHandler(CurrentSessionChannel.Info);
      const result = handler(null, "poe1");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        CurrentSessionChannel.Info,
      );
      expect(result).toBeNull();
    });

    it("should return session info when a session is active", async () => {
      const startHandler = getIpcHandler(CurrentSessionChannel.Start);
      await startHandler(null, "poe1", "Settlers");

      const handler = getIpcHandler(CurrentSessionChannel.Info);
      const result = handler(null, "poe1");

      expect(result).toEqual(
        expect.objectContaining({
          league: "Settlers",
          sessionId: expect.any(String),
          startedAt: expect.any(String),
        }),
      );
    });

    it("should delegate to handleValidationError on validation failure", () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(CurrentSessionChannel.Info);
      handler(null, "bad");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        CurrentSessionChannel.Info,
      );
    });

    it("should return the result from handleValidationError", () => {
      const errorPayload = { success: false, error: "Bad game" };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(CurrentSessionChannel.Info);
      const result = handler(null, "bad");

      expect(result).toEqual(errorPayload);
    });
  });

  // ─── UpdateCardPriceVisibility handler ──────────────────────────────────

  describe("UpdateCardPriceVisibility handler", () => {
    async function startASession() {
      const startHandler = getIpcHandler(CurrentSessionChannel.Start);
      await startHandler(null, "poe1", "Settlers");
    }

    it("should validate all 5 inputs and return success", async () => {
      await startASession();

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(
        null,
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      expect(mockAssertSessionId).toHaveBeenCalledWith(
        "current",
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      expect(mockAssertPriceSource).toHaveBeenCalledWith(
        "exchange",
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      expect(mockAssertCardName).toHaveBeenCalledWith(
        "The Doctor",
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      expect(mockAssertBoolean).toHaveBeenCalledWith(
        true,
        "hidePrice",
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      expect(result).toEqual({ success: true });
    });

    it("should call updateCardPriceVisibility on the repository", async () => {
      await startASession();

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      await handler(null, "poe1", "current", "exchange", "The Doctor", true);

      expect(mockRepoUpdateCardPriceVisibility).toHaveBeenCalled();
    });

    it("should return error with detail when IpcValidationError is thrown for game", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.UpdateCardPriceVisibility,
          "bad game",
        );
      });

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(
        null,
        "bad",
        "session-1",
        "exchange",
        "Card",
        true,
      );

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
    });

    it("should return error with detail when IpcValidationError is thrown for sessionId", async () => {
      mockAssertSessionId.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.UpdateCardPriceVisibility,
          "bad session ID",
        );
      });

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(null, "poe1", 123, "exchange", "Card", true);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
    });

    it("should return error with detail when IpcValidationError is thrown for priceSource", async () => {
      mockAssertPriceSource.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.UpdateCardPriceVisibility,
          "bad price source",
        );
      });

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(
        null,
        "poe1",
        "session-1",
        "wrong",
        "Card",
        true,
      );

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
    });

    it("should return error with detail when IpcValidationError is thrown for cardName", async () => {
      mockAssertCardName.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.UpdateCardPriceVisibility,
          "bad card name",
        );
      });

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(
        null,
        "poe1",
        "session-1",
        "exchange",
        999,
        true,
      );

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
    });

    it("should return error with detail when IpcValidationError is thrown for hidePrice", async () => {
      mockAssertBoolean.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.UpdateCardPriceVisibility,
          "bad boolean",
        );
      });

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(
        null,
        "poe1",
        "session-1",
        "exchange",
        "Card",
        "not-a-bool",
      );

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input:"),
      });
    });

    it("should return generic error for non-validation errors", async () => {
      // "current" sessionId with no active session → throws generic Error
      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(
        null,
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      expect(result).toEqual({
        success: false,
        error: expect.any(String),
      });
    });

    it("should return 'Unknown error' for non-Error throws", async () => {
      await startASession();

      mockRepoUpdateCardPriceVisibility.mockRejectedValue("kaboom");

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      const result = await handler(
        null,
        "poe1",
        "current",
        "exchange",
        "The Doctor",
        true,
      );

      expect(result).toEqual({
        success: false,
        error: "Unknown error",
      });
    });

    it("should not call handleValidationError (uses custom error handling)", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new MockIpcValidationError(
          CurrentSessionChannel.UpdateCardPriceVisibility,
          "bad",
        );
      });

      const handler = getIpcHandler(
        CurrentSessionChannel.UpdateCardPriceVisibility,
      );
      await handler(null, "bad", "s", "exchange", "Card", true);

      expect(mockHandleValidationError).not.toHaveBeenCalled();
    });
  });

  // ─── Cross-cutting concerns ──────────────────────────────────────────────

  describe("cross-cutting concerns", () => {
    it("handlers with handleValidationError pattern should all use it consistently", () => {
      const validationError = new Error("bad");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const isActiveHandler = getIpcHandler(CurrentSessionChannel.IsActive);
      isActiveHandler(null, "bad");
      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        CurrentSessionChannel.IsActive,
      );

      mockHandleValidationError.mockClear();

      const infoHandler = getIpcHandler(CurrentSessionChannel.Info);
      infoHandler(null, "bad");
      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        CurrentSessionChannel.Info,
      );
    });

    it("handlers with custom error handling should differentiate IpcValidationError from other errors", async () => {
      // Test Start handler with IpcValidationError
      mockAssertGameType.mockImplementationOnce(() => {
        throw new MockIpcValidationError(CurrentSessionChannel.Start, "bad");
      });

      const startHandler = getIpcHandler(CurrentSessionChannel.Start);
      const ipcResult = await startHandler(null, "bad", "Settlers");
      expect(ipcResult.error).toContain("Invalid input:");

      // Test Start handler with generic Error
      mockAssertGameType.mockImplementationOnce(() => {}); // pass validation
      mockRepoGetLeagueId.mockResolvedValueOnce(null); // cause generic error

      const genericResult = await startHandler(null, "poe1", "MissingLeague");
      expect(genericResult.error).not.toContain("Invalid input:");
    });
  });
});
