import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetKysely,
  mockRepoGetMostCommonCards,
  mockRepoGetHighestValueCards,
  mockRepoGetCardPriceHistory,
  mockRepoGetLeagueStats,
  mockRepoGetLeagueSessionCount,
  mockRepoCompareSessions,
  mockRepoGetOccurrenceRatios,
  mockAssertGameType,
  mockAssertBoundedString,
  mockAssertLimit,
  mockAssertPriceSource,
  mockAssertCardName,
  mockAssertSessionId,
  mockHandleValidationError,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetKysely: vi.fn(),
  mockRepoGetMostCommonCards: vi.fn(),
  mockRepoGetHighestValueCards: vi.fn(),
  mockRepoGetCardPriceHistory: vi.fn(),
  mockRepoGetLeagueStats: vi.fn(),
  mockRepoGetLeagueSessionCount: vi.fn(),
  mockRepoCompareSessions: vi.fn(),
  mockRepoGetOccurrenceRatios: vi.fn(),
  mockAssertGameType: vi.fn(),
  mockAssertBoundedString: vi.fn(),
  mockAssertLimit: vi.fn(),
  mockAssertPriceSource: vi.fn(),
  mockAssertCardName: vi.fn(),
  mockAssertSessionId: vi.fn(),
  mockHandleValidationError: vi.fn(),
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

// ─── Mock AnalyticsRepository ────────────────────────────────────────────────
vi.mock("../Analytics.repository", () => ({
  AnalyticsRepository: class MockAnalyticsRepository {
    getMostCommonCards = mockRepoGetMostCommonCards;
    getHighestValueCards = mockRepoGetHighestValueCards;
    getCardPriceHistory = mockRepoGetCardPriceHistory;
    getLeagueStats = mockRepoGetLeagueStats;
    getLeagueSessionCount = mockRepoGetLeagueSessionCount;
    compareSessions = mockRepoCompareSessions;
    getOccurrenceRatios = mockRepoGetOccurrenceRatios;
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertGameType: mockAssertGameType,
  assertBoundedString: mockAssertBoundedString,
  assertLimit: mockAssertLimit,
  assertPriceSource: mockAssertPriceSource,
  assertCardName: mockAssertCardName,
  assertSessionId: mockAssertSessionId,
  handleValidationError: mockHandleValidationError,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { AnalyticsChannel } from "../Analytics.channels";
import { AnalyticsService } from "../Analytics.service";

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

const SAMPLE_COMMON_CARDS = [
  { cardName: "Rain of Chaos", totalCount: 50, percentage: 62.5 },
  { cardName: "The Doctor", totalCount: 10, percentage: 12.5 },
];

const SAMPLE_PRICE_PEAKS = [
  { cardName: "The Doctor", peakChaosValue: 1200, peakDivineValue: 6.0 },
  { cardName: "Unrequited Love", peakChaosValue: 800, peakDivineValue: 4.0 },
];

const SAMPLE_PRICE_HISTORY = [
  {
    cardName: "The Doctor",
    chaosValue: 1200,
    divineValue: 6.0,
    fetchedAt: "2025-01-15T10:00:00Z",
  },
  {
    cardName: "The Doctor",
    chaosValue: 1150,
    divineValue: 5.75,
    fetchedAt: "2025-01-14T10:00:00Z",
  },
];

const SAMPLE_LEAGUE_STATS = { totalCards: 100, uniqueCards: 20 };

const SAMPLE_SESSION_COMPARISONS = [
  { cardName: "The Doctor", session1Count: 5, session2Count: 3, difference: 2 },
];

const SAMPLE_OCCURRENCE_RATIOS = [
  { cardName: "Rain of Chaos", count: 50, ratio: 0.625 },
  { cardName: "The Doctor", count: 10, ratio: 0.125 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AnalyticsService — IPC handlers", () => {
  let _service: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    AnalyticsService._instance = undefined;

    // Reset validation mocks to no-op implementations
    // (clearAllMocks does not reset implementations set via mockImplementation)
    mockAssertGameType.mockImplementation(() => {});
    mockAssertBoundedString.mockImplementation(() => {});
    mockAssertLimit.mockImplementation(() => 10);
    mockAssertPriceSource.mockImplementation(() => {});
    mockAssertCardName.mockImplementation(() => {});
    mockAssertSessionId.mockImplementation(() => {});
    mockHandleValidationError.mockImplementation(() => ({
      success: false,
      error: "Validation error",
    }));

    // Default mock return values
    mockAssertLimit.mockReturnValue(10);
    mockRepoGetMostCommonCards.mockResolvedValue(SAMPLE_COMMON_CARDS);
    mockRepoGetHighestValueCards.mockResolvedValue(SAMPLE_PRICE_PEAKS);
    mockRepoGetCardPriceHistory.mockResolvedValue(SAMPLE_PRICE_HISTORY);
    mockRepoGetLeagueStats.mockResolvedValue(SAMPLE_LEAGUE_STATS);
    mockRepoGetLeagueSessionCount.mockResolvedValue(3);
    mockRepoCompareSessions.mockResolvedValue(SAMPLE_SESSION_COMPARISONS);
    mockRepoGetOccurrenceRatios.mockResolvedValue(SAMPLE_OCCURRENCE_RATIOS);

    _service = AnalyticsService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    AnalyticsService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Handler registration ────────────────────────────────────────────────

  describe("handler registration", () => {
    it("should register handlers for all analytics channels", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(AnalyticsChannel.GetMostCommonCards);
      expect(registeredChannels).toContain(
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(registeredChannels).toContain(
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(registeredChannels).toContain(AnalyticsChannel.GetLeagueAnalytics);
      expect(registeredChannels).toContain(AnalyticsChannel.CompareSessions);
      expect(registeredChannels).toContain(
        AnalyticsChannel.GetOccurrenceRatios,
      );
    });
  });

  // ─── GetMostCommonCards ──────────────────────────────────────────────────

  describe("GetMostCommonCards handler", () => {
    it("should validate inputs and return results on success", async () => {
      const handler = getIpcHandler(AnalyticsChannel.GetMostCommonCards);
      const result = await handler(null, "poe1", "Settlers", 10);

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        AnalyticsChannel.GetMostCommonCards,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        AnalyticsChannel.GetMostCommonCards,
        256,
      );
      expect(mockAssertLimit).toHaveBeenCalledWith(
        10,
        AnalyticsChannel.GetMostCommonCards,
      );
      expect(mockRepoGetMostCommonCards).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        10,
      );
      expect(result).toEqual(SAMPLE_COMMON_CARDS);
    });

    it("should use the validated limit from assertLimit", async () => {
      mockAssertLimit.mockReturnValue(25);
      const handler = getIpcHandler(AnalyticsChannel.GetMostCommonCards);
      await handler(null, "poe1", "Settlers", 25);

      expect(mockRepoGetMostCommonCards).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        25,
      );
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetMostCommonCards);
      await handler(null, "invalid", "Settlers", 10);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetMostCommonCards,
      );
      expect(mockRepoGetMostCommonCards).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid league", async () => {
      const validationError = new Error("Invalid league");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetMostCommonCards);
      await handler(null, "poe1", 123, 10);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetMostCommonCards,
      );
      expect(mockRepoGetMostCommonCards).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid limit", async () => {
      const validationError = new Error("Invalid limit");
      mockAssertLimit.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetMostCommonCards);
      await handler(null, "poe1", "Settlers", -5);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetMostCommonCards,
      );
      expect(mockRepoGetMostCommonCards).not.toHaveBeenCalled();
    });
  });

  // ─── GetHighestValueCards ────────────────────────────────────────────────

  describe("GetHighestValueCards handler", () => {
    it("should validate inputs and return results on success", async () => {
      const handler = getIpcHandler(AnalyticsChannel.GetHighestValueCards);
      const result = await handler(null, "poe1", "Settlers", "exchange", 10);

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        AnalyticsChannel.GetHighestValueCards,
        256,
      );
      expect(mockAssertPriceSource).toHaveBeenCalledWith(
        "exchange",
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(mockAssertLimit).toHaveBeenCalledWith(
        10,
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(mockRepoGetHighestValueCards).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "exchange",
        10,
      );
      expect(result).toEqual(SAMPLE_PRICE_PEAKS);
    });

    it("should pass stash price source correctly", async () => {
      const handler = getIpcHandler(AnalyticsChannel.GetHighestValueCards);
      await handler(null, "poe2", "Standard", "stash", 5);

      mockAssertLimit.mockReturnValue(5);
      expect(mockAssertPriceSource).toHaveBeenCalledWith(
        "stash",
        AnalyticsChannel.GetHighestValueCards,
      );
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetHighestValueCards);
      await handler(null, "bad", "Settlers", "exchange", 10);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(mockRepoGetHighestValueCards).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid price source", async () => {
      const validationError = new Error("Invalid price source");
      mockAssertPriceSource.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetHighestValueCards);
      await handler(null, "poe1", "Settlers", "bogus", 10);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(mockRepoGetHighestValueCards).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid league", async () => {
      const validationError = new Error("Invalid league");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetHighestValueCards);
      await handler(null, "poe1", null, "exchange", 10);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(mockRepoGetHighestValueCards).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid limit", async () => {
      const validationError = new Error("Invalid limit");
      mockAssertLimit.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetHighestValueCards);
      await handler(null, "poe1", "Settlers", "exchange", "not-a-number");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetHighestValueCards,
      );
      expect(mockRepoGetHighestValueCards).not.toHaveBeenCalled();
    });
  });

  // ─── GetCardPriceHistory ─────────────────────────────────────────────────

  describe("GetCardPriceHistory handler", () => {
    it("should validate inputs and return results on success", async () => {
      const handler = getIpcHandler(AnalyticsChannel.GetCardPriceHistory);
      const result = await handler(
        null,
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        AnalyticsChannel.GetCardPriceHistory,
        256,
      );
      expect(mockAssertCardName).toHaveBeenCalledWith(
        "The Doctor",
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(mockAssertPriceSource).toHaveBeenCalledWith(
        "exchange",
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(mockRepoGetCardPriceHistory).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        "The Doctor",
        "exchange",
      );
      expect(result).toEqual(SAMPLE_PRICE_HISTORY);
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetCardPriceHistory);
      await handler(null, 999, "Settlers", "The Doctor", "exchange");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(mockRepoGetCardPriceHistory).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid card name", async () => {
      const validationError = new Error("Invalid card name");
      mockAssertCardName.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetCardPriceHistory);
      await handler(null, "poe1", "Settlers", 42, "exchange");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(mockRepoGetCardPriceHistory).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid price source", async () => {
      const validationError = new Error("Invalid price source");
      mockAssertPriceSource.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetCardPriceHistory);
      await handler(null, "poe1", "Settlers", "The Doctor", "wrong");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(mockRepoGetCardPriceHistory).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid league", async () => {
      const validationError = new Error("Invalid league");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetCardPriceHistory);
      await handler(null, "poe1", undefined, "The Doctor", "exchange");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetCardPriceHistory,
      );
      expect(mockRepoGetCardPriceHistory).not.toHaveBeenCalled();
    });
  });

  // ─── GetLeagueAnalytics ──────────────────────────────────────────────────

  describe("GetLeagueAnalytics handler", () => {
    it("should validate inputs and return results on success", async () => {
      const handler = getIpcHandler(AnalyticsChannel.GetLeagueAnalytics);
      const result = await handler(null, "poe1", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        AnalyticsChannel.GetLeagueAnalytics,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        AnalyticsChannel.GetLeagueAnalytics,
        256,
      );
      // getLeagueAnalytics calls getLeagueStats, getLeagueSessionCount,
      // getMostCommonCards, getHighestValueCards
      expect(mockRepoGetLeagueStats).toHaveBeenCalledWith("poe1", "Settlers");
      expect(mockRepoGetLeagueSessionCount).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
      expect(result).toEqual(
        expect.objectContaining({
          leagueName: "Settlers",
          totalCards: 100,
          uniqueCards: 20,
          sessionCount: 3,
        }),
      );
    });

    it("should return zeroed analytics when league stats are null", async () => {
      mockRepoGetLeagueStats.mockResolvedValue(null);
      mockRepoGetLeagueSessionCount.mockResolvedValue(0);
      mockRepoGetMostCommonCards.mockResolvedValue([]);
      mockRepoGetHighestValueCards.mockResolvedValue([]);

      const handler = getIpcHandler(AnalyticsChannel.GetLeagueAnalytics);
      const result = await handler(null, "poe1", "EmptyLeague");

      expect(result).toEqual(
        expect.objectContaining({
          leagueName: "EmptyLeague",
          totalCards: 0,
          uniqueCards: 0,
          sessionCount: 0,
          mostCommon: [],
          highestValue: [],
        }),
      );
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetLeagueAnalytics);
      await handler(null, "badgame", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetLeagueAnalytics,
      );
      expect(mockRepoGetLeagueStats).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid league", async () => {
      const validationError = new Error("Invalid league");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetLeagueAnalytics);
      await handler(null, "poe1", 12345);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetLeagueAnalytics,
      );
      expect(mockRepoGetLeagueStats).not.toHaveBeenCalled();
    });
  });

  // ─── CompareSessions ────────────────────────────────────────────────────

  describe("CompareSessions handler", () => {
    it("should validate inputs and return results on success", async () => {
      const handler = getIpcHandler(AnalyticsChannel.CompareSessions);
      const result = await handler(null, "session-1", "session-2");

      expect(mockAssertSessionId).toHaveBeenCalledWith(
        "session-1",
        AnalyticsChannel.CompareSessions,
      );
      expect(mockAssertSessionId).toHaveBeenCalledWith(
        "session-2",
        AnalyticsChannel.CompareSessions,
      );
      expect(mockRepoCompareSessions).toHaveBeenCalledWith(
        "session-1",
        "session-2",
      );
      expect(result).toEqual(SAMPLE_SESSION_COMPARISONS);
    });

    it("should validate both session IDs", async () => {
      const handler = getIpcHandler(AnalyticsChannel.CompareSessions);
      await handler(null, "abc", "def");

      expect(mockAssertSessionId).toHaveBeenCalledTimes(2);
      expect(mockAssertSessionId).toHaveBeenNthCalledWith(
        1,
        "abc",
        AnalyticsChannel.CompareSessions,
      );
      expect(mockAssertSessionId).toHaveBeenNthCalledWith(
        2,
        "def",
        AnalyticsChannel.CompareSessions,
      );
    });

    it("should handle validation errors for invalid first session ID", async () => {
      const validationError = new Error("Invalid session ID");
      mockAssertSessionId.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.CompareSessions);
      await handler(null, 123, "session-2");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.CompareSessions,
      );
      expect(mockRepoCompareSessions).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid second session ID", async () => {
      const validationError = new Error("Invalid session ID");
      // First call passes, second throws
      mockAssertSessionId
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw validationError;
        });

      const handler = getIpcHandler(AnalyticsChannel.CompareSessions);
      await handler(null, "session-1", null);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.CompareSessions,
      );
      expect(mockRepoCompareSessions).not.toHaveBeenCalled();
    });
  });

  // ─── GetOccurrenceRatios ─────────────────────────────────────────────────

  describe("GetOccurrenceRatios handler", () => {
    it("should validate inputs and return results on success", async () => {
      const handler = getIpcHandler(AnalyticsChannel.GetOccurrenceRatios);
      const result = await handler(null, "poe1", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        AnalyticsChannel.GetOccurrenceRatios,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        AnalyticsChannel.GetOccurrenceRatios,
        256,
      );
      expect(mockRepoGetOccurrenceRatios).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
      expect(result).toEqual(SAMPLE_OCCURRENCE_RATIOS);
    });

    it("should work with poe2 game type", async () => {
      const handler = getIpcHandler(AnalyticsChannel.GetOccurrenceRatios);
      await handler(null, "poe2", "Standard");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        AnalyticsChannel.GetOccurrenceRatios,
      );
      expect(mockRepoGetOccurrenceRatios).toHaveBeenCalledWith(
        "poe2",
        "Standard",
      );
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetOccurrenceRatios);
      await handler(null, undefined, "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetOccurrenceRatios,
      );
      expect(mockRepoGetOccurrenceRatios).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid league", async () => {
      const validationError = new Error("Invalid league");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(AnalyticsChannel.GetOccurrenceRatios);
      await handler(null, "poe1", { evil: true });

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        AnalyticsChannel.GetOccurrenceRatios,
      );
      expect(mockRepoGetOccurrenceRatios).not.toHaveBeenCalled();
    });
  });

  // ─── Cross-cutting concerns ──────────────────────────────────────────────

  describe("cross-cutting concerns", () => {
    it("should return handleValidationError result when validation fails", async () => {
      const errorPayload = { success: false, error: "Game type is invalid" };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad game");
      });

      const handler = getIpcHandler(AnalyticsChannel.GetMostCommonCards);
      const result = await handler(null, "bad", "Settlers", 10);

      expect(result).toEqual(errorPayload);
    });

    it("should not call repository methods when validation fails early", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const getMostCommon = getIpcHandler(AnalyticsChannel.GetMostCommonCards);
      const getHighestValue = getIpcHandler(
        AnalyticsChannel.GetHighestValueCards,
      );
      const getPriceHistory = getIpcHandler(
        AnalyticsChannel.GetCardPriceHistory,
      );
      const getLeague = getIpcHandler(AnalyticsChannel.GetLeagueAnalytics);
      const compare = getIpcHandler(AnalyticsChannel.CompareSessions);
      const getOccurrence = getIpcHandler(AnalyticsChannel.GetOccurrenceRatios);

      // CompareSessions uses assertSessionId not assertGameType,
      // so reset its mock separately
      mockAssertSessionId.mockImplementation(() => {
        throw new Error("bad");
      });

      await getMostCommon(null, "bad", "L", 1);
      await getHighestValue(null, "bad", "L", "exchange", 1);
      await getPriceHistory(null, "bad", "L", "C", "exchange");
      await getLeague(null, "bad", "L");
      await compare(null, "bad-id", "bad-id-2");
      await getOccurrence(null, "bad", "L");

      expect(mockRepoGetMostCommonCards).not.toHaveBeenCalled();
      expect(mockRepoGetHighestValueCards).not.toHaveBeenCalled();
      expect(mockRepoGetCardPriceHistory).not.toHaveBeenCalled();
      expect(mockRepoGetLeagueStats).not.toHaveBeenCalled();
      expect(mockRepoGetLeagueSessionCount).not.toHaveBeenCalled();
      expect(mockRepoCompareSessions).not.toHaveBeenCalled();
      expect(mockRepoGetOccurrenceRatios).not.toHaveBeenCalled();
    });
  });
});
