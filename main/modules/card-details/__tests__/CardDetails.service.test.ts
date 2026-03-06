import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardDetailsInitDTO } from "../CardDetails.dto";
import { cardNameToDetailsId } from "../CardDetails.service";

// ─── cardNameToDetailsId ─────────────────────────────────────────────────────

describe("cardNameToDetailsId", () => {
  it('should convert "House of Mirrors" to "house-of-mirrors"', () => {
    expect(cardNameToDetailsId("House of Mirrors")).toBe("house-of-mirrors");
  });

  it('should convert "The Doctor" to "the-doctor"', () => {
    expect(cardNameToDetailsId("The Doctor")).toBe("the-doctor");
  });

  it('should convert "A Chilling Wind" to "a-chilling-wind"', () => {
    expect(cardNameToDetailsId("A Chilling Wind")).toBe("a-chilling-wind");
  });

  it("should handle single-word names", () => {
    expect(cardNameToDetailsId("Chaotic")).toBe("chaotic");
  });

  it("should strip leading and trailing hyphens", () => {
    expect(cardNameToDetailsId("  The Doctor  ")).toBe("the-doctor");
  });

  it("should collapse multiple non-alphanumeric characters into a single hyphen", () => {
    expect(cardNameToDetailsId("The - Doctor")).toBe("the-doctor");
  });

  it("should handle apostrophes and special characters", () => {
    expect(cardNameToDetailsId("The King's Blade")).toBe("the-king-s-blade");
  });

  it("should handle names with numbers", () => {
    expect(cardNameToDetailsId("1000 Ribbons")).toBe("1000-ribbons");
  });

  it("should handle names with colons", () => {
    expect(cardNameToDetailsId("Rebirth: The Forgotten")).toBe(
      "rebirth-the-forgotten",
    );
  });

  it("should return empty string for empty input", () => {
    expect(cardNameToDetailsId("")).toBe("");
  });

  it("should handle names that are entirely special characters", () => {
    expect(cardNameToDetailsId("---")).toBe("");
  });

  it("should handle mixed case consistently", () => {
    expect(cardNameToDetailsId("THE DOCTOR")).toBe("the-doctor");
    expect(cardNameToDetailsId("the doctor")).toBe("the-doctor");
    expect(cardNameToDetailsId("The Doctor")).toBe("the-doctor");
  });
});

// ─── Hoisted mocks (available inside vi.mock factories) ─────────────────────

const {
  mockIpcMainHandle,
  mockGetKysely,
  mockLoggerLog,
  mockLoggerWarn,
  mockLoggerError,
  mockFetch,
  mockRepositoryHolder,
  mockMainWindowShow,
  mockMainWindowGetWebContents,
  mockMainWindowWebContentsSend,
  mockDivCardsGetAllByGame,
} = vi.hoisted(() => {
  const mockMainWindowWebContentsSend = vi.fn();
  const mockMainWindowWebContentsIsDestroyed = vi.fn().mockReturnValue(false);
  const mockDivCardsGetAllByGame = vi.fn().mockResolvedValue([]);

  const mockRepositoryHolder: {
    instance: {
      getCachedPriceHistory: ReturnType<typeof vi.fn>;
      upsertPriceHistory: ReturnType<typeof vi.fn>;
      isCacheStale: ReturnType<typeof vi.fn>;
      deleteCacheForLeague: ReturnType<typeof vi.fn>;
      deleteAll: ReturnType<typeof vi.fn>;
      getCardPersonalStats: ReturnType<typeof vi.fn>;
      getFromBoss: ReturnType<typeof vi.fn>;
      getProhibitedLibraryData: ReturnType<typeof vi.fn>;
      getDropTimeline: ReturnType<typeof vi.fn>;
      getTotalDecksOpenedAllSessions: ReturnType<typeof vi.fn>;
      getLeagueDateRanges: ReturnType<typeof vi.fn>;
      findCardsByRewardMatch: ReturnType<typeof vi.fn>;
      getCardRewardHtml: ReturnType<typeof vi.fn>;
      findCardByName: ReturnType<typeof vi.fn>;
      getFirstSessionStartDate: ReturnType<typeof vi.fn>;
    } | null;
  } = { instance: null };

  return {
    mockIpcMainHandle: vi.fn(),
    mockGetKysely: vi.fn(),
    mockLoggerLog: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
    mockFetch: vi.fn(),
    mockRepositoryHolder,
    mockMainWindowShow: vi.fn(),
    mockMainWindowGetWebContents: vi.fn(() => ({
      send: mockMainWindowWebContentsSend,
      isDestroyed: mockMainWindowWebContentsIsDestroyed,
    })),
    mockMainWindowWebContentsSend,
    mockMainWindowWebContentsIsDestroyed,
    mockDivCardsGetAllByGame,
  };
});

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
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
}));

vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
    })),
  },
}));

vi.mock("~/main/modules/main-window", () => ({
  MainWindowService: {
    getInstance: vi.fn(() => ({
      show: mockMainWindowShow,
      getWebContents: mockMainWindowGetWebContents,
    })),
  },
}));

vi.mock("~/main/modules/logger", () => ({
  LoggerService: {
    createLogger: vi.fn(() => ({
      log: mockLoggerLog,
      warn: mockLoggerWarn,
      error: mockLoggerError,
      debug: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

vi.mock("~/main/modules/divination-cards/DivinationCards.service", () => ({
  DivinationCardsService: {
    getInstance: vi.fn(() => ({
      getRepository: vi.fn(() => ({
        getAllByGame: mockDivCardsGetAllByGame,
      })),
    })),
  },
}));

// Mock the repository class — must use a real class so `new` works
vi.mock("../CardDetails.repository", () => {
  return {
    CardDetailsRepository: class MockCardDetailsRepository {
      constructor() {
        mockRepositoryHolder.instance = {
          getCachedPriceHistory: vi.fn().mockResolvedValue(null),
          upsertPriceHistory: vi.fn().mockResolvedValue(undefined),
          isCacheStale: vi.fn().mockReturnValue(true),
          deleteCacheForLeague: vi.fn().mockResolvedValue(undefined),
          deleteAll: vi.fn().mockResolvedValue(undefined),
          getCardPersonalStats: vi.fn().mockResolvedValue({
            totalDrops: 0,
            firstDiscoveredAt: null,
            lastSeenAt: null,
            sessionCount: 0,
          }),
          getFromBoss: vi.fn().mockResolvedValue(false),
          getProhibitedLibraryData: vi.fn().mockResolvedValue(null),
          getDropTimeline: vi.fn().mockResolvedValue([]),
          getTotalDecksOpenedAllSessions: vi.fn().mockResolvedValue(0),
          getLeagueDateRanges: vi.fn().mockResolvedValue([]),
          findCardsByRewardMatch: vi.fn().mockResolvedValue([]),
          getCardRewardHtml: vi.fn().mockResolvedValue(null),
          findCardByName: vi.fn().mockResolvedValue(null),
          getFirstSessionStartDate: vi.fn().mockResolvedValue(null),
        };
        Object.assign(this, mockRepositoryHolder.instance);
      }
    },
  };
});

// Mock global fetch
vi.stubGlobal("fetch", mockFetch);

// ─── Import under test ──────────────────────────────────────────────────────
import { CardDetailsService } from "../CardDetails.service";

// ─── Helper to access the current repository mock ───────────────────────────

function getRepoMock() {
  if (!mockRepositoryHolder.instance) {
    throw new Error("Repository mock has not been instantiated yet");
  }
  return mockRepositoryHolder.instance;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makePoeNinjaApiResponse() {
  return {
    item: {
      id: "the-doctor",
      name: "The Doctor",
      category: "Cards",
      detailsId: "the-doctor",
    },
    pairs: [
      { id: "chaos", volumePrimaryValue: 0, history: [] },
      {
        id: "divine",
        rate: 6.5,
        volumePrimaryValue: 1200000,
        history: [
          {
            timestamp: "2026-03-01T00:00:00Z",
            rate: 6.0,
            volumePrimaryValue: 1000000,
          },
          {
            timestamp: "2026-03-05T00:00:00Z",
            rate: 6.5,
            volumePrimaryValue: 1200000,
          },
        ],
      },
    ],
    core: {
      items: [],
      rates: { divine: 0.00125 },
      primary: "chaos",
      secondary: "divine",
    },
  };
}

function makeCachedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    game: "poe1",
    league: "Settlers",
    details_id: "the-doctor",
    card_name: "The Doctor",
    response_data: JSON.stringify({
      cardName: "The Doctor",
      detailsId: "the-doctor",
      game: "poe1",
      league: "Settlers",
      currentDivineRate: 6.0,
      currentVolume: 1000000,
      chaosToDivineRatio: 0.00125,
      priceHistory: [],
      priceChanges: {},
      fetchedAt: "2026-03-05T12:00:00Z",
      isFromCache: false,
    }),
    fetched_at: "2026-03-05T12:00:00Z",
    created_at: "2026-03-05T12:00:00Z",
    updated_at: "2026-03-05T12:00:00Z",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CardDetailsService", () => {
  let service: CardDetailsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    CardDetailsService._instance = undefined;

    service = CardDetailsService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    CardDetailsService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = CardDetailsService.getInstance();
      const instance2 = CardDetailsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetting the singleton", () => {
      const instance1 = CardDetailsService.getInstance();
      // @ts-expect-error — accessing private static for testing
      CardDetailsService._instance = undefined;
      const instance2 = CardDetailsService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ─── IPC Handler Registration ────────────────────────────────────────────

  describe("IPC handler registration", () => {
    it("should register the GetPriceHistory channel handler", () => {
      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        "card-details:get-price-history",
        expect.any(Function),
      );
    });

    it("should register the GetPersonalAnalytics channel handler", () => {
      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        "card-details:get-personal-analytics",
        expect.any(Function),
      );
    });

    it("should register the OpenInMainWindow channel handler", () => {
      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        "card-details:open-in-main-window",
        expect.any(Function),
      );
    });

    it("should register the GetRelatedCards channel handler", () => {
      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        "card-details:get-related-cards",
        expect.any(Function),
      );
    });
  });

  // ─── getPriceHistory ─────────────────────────────────────────────────────

  describe("getPriceHistory", () => {
    // ─── Input Validation ──────────────────────────────────────────────

    describe("input validation (via IPC handler)", () => {
      function getIpcHandler(): (...args: unknown[]) => Promise<unknown> {
        const call = mockIpcMainHandle.mock.calls.find(
          ([ch]: [string]) => ch === "card-details:get-price-history",
        );
        if (!call)
          throw new Error("GetPriceHistory handler was not registered");
        return call[1];
      }

      it("should return null when game is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "",
          "Settlers",
          "The Doctor",
        );
        expect(result).toBeNull();
      });

      it("should return null when league is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe1",
          "",
          "The Doctor",
        );
        expect(result).toBeNull();
      });

      it("should return null when cardName is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe1",
          "Settlers",
          "",
        );
        expect(result).toBeNull();
      });

      it("should return null for invalid game type", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe3",
          "Settlers",
          "The Doctor",
        );
        expect(result).toBeNull();
      });
    });

    // ─── Fresh Cache Hit ───────────────────────────────────────────────

    describe("fresh cache hit", () => {
      it("should return cached data without fetching from poe.ninja", async () => {
        const repo = getRepoMock();
        const cachedRow = makeCachedRow();
        repo.getCachedPriceHistory.mockResolvedValue(cachedRow);
        repo.isCacheStale.mockReturnValue(false);

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).not.toBeNull();
        expect(result!.isFromCache).toBe(true);
        expect(result!.cardName).toBe("The Doctor");
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should not upsert the cache on a fresh hit", async () => {
        const repo = getRepoMock();
        const cachedRow = makeCachedRow();
        repo.getCachedPriceHistory.mockResolvedValue(cachedRow);
        repo.isCacheStale.mockReturnValue(false);

        await service.getPriceHistory("poe1", "Settlers", "The Doctor");

        expect(repo.upsertPriceHistory).not.toHaveBeenCalled();
      });
    });

    // ─── Stale Cache → Re-fetch ────────────────────────────────────────

    describe("stale cache triggers re-fetch", () => {
      it("should fetch from poe.ninja when cache is stale", async () => {
        const repo = getRepoMock();
        const cachedRow = makeCachedRow();
        repo.getCachedPriceHistory.mockResolvedValue(cachedRow);
        repo.isCacheStale.mockReturnValue(true);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).not.toBeNull();
        expect(result!.isFromCache).toBe(false);
        expect(result!.currentDivineRate).toBe(6.5);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("should upsert fresh data into the cache", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);
        repo.isCacheStale.mockReturnValue(true);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        await service.getPriceHistory("poe1", "Settlers", "The Doctor");

        expect(repo.upsertPriceHistory).toHaveBeenCalledTimes(1);
        expect(repo.upsertPriceHistory).toHaveBeenCalledWith(
          "poe1",
          "Settlers",
          "the-doctor",
          "The Doctor",
          expect.any(String), // JSON stringified DTO
          expect.any(String), // fetchedAt ISO timestamp
        );
      });
    });

    // ─── Cache Miss → Fetch ────────────────────────────────────────────

    describe("cache miss triggers fetch", () => {
      it("should fetch from poe.ninja when no cache exists", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).not.toBeNull();
        expect(result!.isFromCache).toBe(false);
        expect(result!.cardName).toBe("The Doctor");
        expect(result!.detailsId).toBe("the-doctor");
      });

      it("should call poe.ninja with the correct URL", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        await service.getPriceHistory("poe1", "Settlers", "The Doctor");

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(
            "https://poe.ninja/poe1/api/economy/exchange/current/details",
          ),
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: "application/json",
            }),
          }),
        );

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain("league=Settlers");
        expect(url).toContain("type=DivinationCard");
        expect(url).toContain("id=the-doctor");
      });

      it("should use poe2 prefix for poe2 game type", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        await service.getPriceHistory("poe2", "TestLeague", "The Doctor");

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain("https://poe.ninja/poe2/");
        expect(url).toContain("league=TestLeague");
      });
    });

    // ─── Fetch Failure with Stale Cache Fallback ───────────────────────

    describe("fetch failure with stale cache fallback", () => {
      it("should return stale cache when poe.ninja is unreachable", async () => {
        const repo = getRepoMock();
        const cachedRow = makeCachedRow();
        repo.getCachedPriceHistory.mockResolvedValue(cachedRow);
        repo.isCacheStale.mockReturnValue(true);

        mockFetch.mockRejectedValue(new Error("Network error"));

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).not.toBeNull();
        expect(result!.isFromCache).toBe(true);
        expect(result!.cardName).toBe("The Doctor");
      });

      it("should return stale cache when poe.ninja returns non-OK status", async () => {
        const repo = getRepoMock();
        const cachedRow = makeCachedRow();
        repo.getCachedPriceHistory.mockResolvedValue(cachedRow);
        repo.isCacheStale.mockReturnValue(true);

        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).not.toBeNull();
        expect(result!.isFromCache).toBe(true);
      });

      it("should log an error when fetch fails", async () => {
        const repo = getRepoMock();
        const cachedRow = makeCachedRow();
        repo.getCachedPriceHistory.mockResolvedValue(cachedRow);
        repo.isCacheStale.mockReturnValue(true);

        mockFetch.mockRejectedValue(new Error("Connection refused"));

        await service.getPriceHistory("poe1", "Settlers", "The Doctor");

        expect(mockLoggerError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to fetch price history"),
          expect.any(Error),
        );
      });
    });

    // ─── Fetch Failure with No Cache ───────────────────────────────────

    describe("fetch failure with no cache", () => {
      it("should return null when fetch fails and no cache exists", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockRejectedValue(new Error("Network error"));

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).toBeNull();
      });

      it("should log a warning when no data is available at all", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockRejectedValue(new Error("Network error"));

        await service.getPriceHistory("poe1", "Settlers", "The Doctor");

        expect(mockLoggerWarn).toHaveBeenCalledWith(
          expect.stringContaining("No data available"),
        );
      });
    });

    // ─── URL Encoding ──────────────────────────────────────────────────

    describe("URL encoding", () => {
      it("should encode league names with special characters", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        await service.getPriceHistory(
          "poe1",
          "Settlers & Explorers",
          "The Doctor",
        );

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain("league=Settlers%20%26%20Explorers");
      });

      it("should encode details IDs with special characters", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        await service.getPriceHistory("poe1", "Settlers", "The King's Blade");

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain("id=the-king-s-blade");
      });
    });

    // ─── Correct Slug Derivation ───────────────────────────────────────

    describe("correct slug derivation in cache lookup", () => {
      it("should derive the correct detailsId for cache lookup", async () => {
        const repo = getRepoMock();
        repo.getCachedPriceHistory.mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        await service.getPriceHistory("poe1", "Settlers", "House of Mirrors");

        expect(repo.getCachedPriceHistory).toHaveBeenCalledWith(
          "poe1",
          "Settlers",
          "house-of-mirrors",
        );
      });
    });

    // ─── Corrupted Cache Handling ──────────────────────────────────────

    describe("corrupted cache handling", () => {
      it("should re-fetch when cached response_data is not valid JSON", async () => {
        const repo = getRepoMock();
        const corruptedRow = makeCachedRow({
          response_data: "not valid json {{{",
        });
        repo.getCachedPriceHistory.mockResolvedValue(corruptedRow);
        repo.isCacheStale.mockReturnValue(false);

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(makePoeNinjaApiResponse()),
        });

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        // Should have fallen through to fetch since JSON.parse failed
        expect(result).not.toBeNull();
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    // ─── getRepository ─────────────────────────────────────────────────

    describe("corrupted stale cache fallback", () => {
      it("should return null when stale cache has corrupted JSON and fetch also fails", async () => {
        const repo = getRepoMock();
        const corruptedRow = makeCachedRow({
          response_data: "NOT VALID JSON {{{{",
        });
        repo.getCachedPriceHistory.mockResolvedValue(corruptedRow);
        repo.isCacheStale.mockReturnValue(true);

        // Fetch also fails
        mockFetch.mockRejectedValue(new Error("Network error"));

        const result = await service.getPriceHistory(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        // Stale cache parse fails, no fresh data available → null
        expect(result).toBeNull();
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          expect.stringContaining("Failed to parse stale cached data"),
        );
      });
    });

    describe("getRepository", () => {
      it("should return the repository instance", () => {
        const repo = service.getRepository();
        expect(repo).toBeDefined();
        // The repository is the class instance created by the mock constructor,
        // which has the same methods assigned via Object.assign
        expect(typeof repo.getCachedPriceHistory).toBe("function");
        expect(typeof repo.upsertPriceHistory).toBe("function");
        expect(typeof repo.isCacheStale).toBe("function");
      });
    });
  });

  // ─── getPersonalAnalytics ──────────────────────────────────────────────

  describe("getPersonalAnalytics", () => {
    // ─── Input validation (via IPC handler) ──────────────────────────────

    describe("input validation (via IPC handler)", () => {
      function getIpcHandler() {
        const call = mockIpcMainHandle.mock.calls.find(
          ([channel]: [string]) =>
            channel === "card-details:get-personal-analytics",
        );
        return call?.[1];
      }

      it("should return null when game is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "",
          "Settlers",
          "The Doctor",
        );
        expect(result).toBeNull();
      });

      it("should return null when league is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe1",
          "",
          "The Doctor",
        );
        expect(result).toBeNull();
      });

      it("should return null when cardName is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe1",
          "Settlers",
          "",
        );
        expect(result).toBeNull();
      });

      it("should return null for invalid game type", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe3",
          "Settlers",
          "The Doctor",
        );
        expect(result).toBeNull();
      });
    });

    // ─── Card with drops across multiple sessions ─────────────────────────

    describe("card with drops across multiple sessions", () => {
      it("should return aggregated personal analytics", async () => {
        const repo = getRepoMock();
        repo.getCardPersonalStats.mockResolvedValue({
          totalDrops: 5,
          firstDiscoveredAt: "2025-06-01T10:00:00Z",
          lastSeenAt: "2025-06-15T11:00:00Z",
          sessionCount: 2,
        });
        repo.getFromBoss.mockResolvedValue(false);
        repo.getProhibitedLibraryData.mockResolvedValue({
          weight: 1,
          rarity: 1,
          fromBoss: false,
        });
        repo.getDropTimeline.mockResolvedValue([
          {
            sessionId: "s1",
            sessionStartedAt: "2025-06-01T10:00:00Z",
            count: 2,
            totalDecksOpened: 100,
            league: "Settlers",
          },
          {
            sessionId: "s2",
            sessionStartedAt: "2025-06-15T10:00:00Z",
            count: 3,
            totalDecksOpened: 200,
            league: "Settlers",
          },
        ]);
        repo.getTotalDecksOpenedAllSessions.mockResolvedValue(300);

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).not.toBeNull();
        expect(result!.cardName).toBe("The Doctor");
        expect(result!.totalLifetimeDrops).toBe(5);
        expect(result!.firstDiscoveredAt).toBe("2025-06-01T10:00:00Z");
        expect(result!.lastSeenAt).toBe("2025-06-15T11:00:00Z");
        expect(result!.sessionCount).toBe(2);
        expect(result!.averageDropsPerSession).toBe(2.5);
        expect(result!.fromBoss).toBe(false);
        expect(result!.prohibitedLibrary).toEqual({
          weight: 1,
          rarity: 1,
          fromBoss: false,
        });
        expect(result!.totalDecksOpenedAllSessions).toBe(300);
      });

      it("should compute cumulative counts in drop timeline", async () => {
        const repo = getRepoMock();
        repo.getCardPersonalStats.mockResolvedValue({
          totalDrops: 6,
          firstDiscoveredAt: "2025-06-01T10:00:00Z",
          lastSeenAt: "2025-06-20T10:00:00Z",
          sessionCount: 3,
        });
        repo.getDropTimeline.mockResolvedValue([
          {
            sessionId: "s1",
            sessionStartedAt: "2025-06-01T10:00:00Z",
            count: 1,
            totalDecksOpened: 50,
            league: "Settlers",
          },
          {
            sessionId: "s2",
            sessionStartedAt: "2025-06-10T10:00:00Z",
            count: 2,
            totalDecksOpened: 100,
            league: "Settlers",
          },
          {
            sessionId: "s3",
            sessionStartedAt: "2025-06-20T10:00:00Z",
            count: 3,
            totalDecksOpened: 150,
            league: "Settlers",
          },
        ]);
        repo.getTotalDecksOpenedAllSessions.mockResolvedValue(300);

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result!.dropTimeline).toHaveLength(3);
        expect(result!.dropTimeline[0].cumulativeCount).toBe(1);
        expect(result!.dropTimeline[1].cumulativeCount).toBe(3);
        expect(result!.dropTimeline[2].cumulativeCount).toBe(6);
      });
    });

    // ─── Card never dropped ───────────────────────────────────────────────

    describe("card never dropped", () => {
      it("should return zeros and nulls", async () => {
        const repo = getRepoMock();
        repo.getCardPersonalStats.mockResolvedValue({
          totalDrops: 0,
          firstDiscoveredAt: null,
          lastSeenAt: null,
          sessionCount: 0,
        });
        repo.getFromBoss.mockResolvedValue(false);
        repo.getProhibitedLibraryData.mockResolvedValue(null);
        repo.getDropTimeline.mockResolvedValue([]);
        repo.getTotalDecksOpenedAllSessions.mockResolvedValue(500);

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "Rain of Chaos",
        );

        expect(result).not.toBeNull();
        expect(result!.totalLifetimeDrops).toBe(0);
        expect(result!.firstDiscoveredAt).toBeNull();
        expect(result!.lastSeenAt).toBeNull();
        expect(result!.sessionCount).toBe(0);
        expect(result!.averageDropsPerSession).toBe(0);
        expect(result!.prohibitedLibrary).toBeNull();
        expect(result!.dropTimeline).toEqual([]);
        expect(result!.totalDecksOpenedAllSessions).toBe(500);
      });
    });

    // ─── Boss-exclusive card ──────────────────────────────────────────────

    describe("boss-exclusive card", () => {
      it("should return fromBoss true", async () => {
        const repo = getRepoMock();
        repo.getFromBoss.mockResolvedValue(true);
        repo.getProhibitedLibraryData.mockResolvedValue({
          weight: 0,
          rarity: 2,
          fromBoss: true,
        });

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Wretched",
        );

        expect(result).not.toBeNull();
        expect(result!.fromBoss).toBe(true);
        expect(result!.prohibitedLibrary!.fromBoss).toBe(true);
        expect(result!.prohibitedLibrary!.weight).toBe(0);
      });
    });

    // ─── Card with no PL data ─────────────────────────────────────────────

    describe("card with no Prohibited Library data", () => {
      it("should return null prohibitedLibrary", async () => {
        const repo = getRepoMock();
        repo.getProhibitedLibraryData.mockResolvedValue(null);

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "Unknown Card",
        );

        expect(result).not.toBeNull();
        expect(result!.prohibitedLibrary).toBeNull();
      });
    });

    // ─── Card in one session only ─────────────────────────────────────────

    describe("card in one session only", () => {
      it("should return sessionCount 1 and average equal to total", async () => {
        const repo = getRepoMock();
        repo.getCardPersonalStats.mockResolvedValue({
          totalDrops: 10,
          firstDiscoveredAt: "2025-06-01T10:00:00Z",
          lastSeenAt: "2025-06-01T11:00:00Z",
          sessionCount: 1,
        });
        repo.getDropTimeline.mockResolvedValue([
          {
            sessionId: "s1",
            sessionStartedAt: "2025-06-01T10:00:00Z",
            count: 10,
            totalDecksOpened: 100,
            league: "Settlers",
          },
        ]);

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "Rain of Chaos",
        );

        expect(result!.sessionCount).toBe(1);
        expect(result!.averageDropsPerSession).toBe(10);
        expect(result!.dropTimeline).toHaveLength(1);
        expect(result!.dropTimeline[0].cumulativeCount).toBe(10);
      });
    });

    // ─── Error handling ───────────────────────────────────────────────────

    describe("error handling", () => {
      it("should return null when a repository query throws", async () => {
        const repo = getRepoMock();
        repo.getCardPersonalStats.mockRejectedValue(
          new Error("DB connection failed"),
        );

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).toBeNull();
        expect(mockLoggerError).toHaveBeenCalled();
      });

      it("should log error details when analytics query fails", async () => {
        const repo = getRepoMock();
        repo.getFromBoss.mockRejectedValue(new Error("SQLite busy"));

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        expect(result).toBeNull();
        expect(mockLoggerError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to get personal analytics"),
          expect.any(Error),
        );
      });
    });

    // ─── Parallel query execution ─────────────────────────────────────────

    describe("parallel query execution", () => {
      it("should call all repository methods", async () => {
        const repo = getRepoMock();

        await service.getPersonalAnalytics("poe1", "Settlers", "The Doctor");

        expect(repo.getCardPersonalStats).toHaveBeenCalledWith(
          "poe1",
          "The Doctor",
          undefined,
        );
        expect(repo.getFromBoss).toHaveBeenCalledWith("poe1", "The Doctor");
        expect(repo.getProhibitedLibraryData).toHaveBeenCalledWith(
          "poe1",
          "Settlers",
          "The Doctor",
        );
        expect(repo.getDropTimeline).toHaveBeenCalledWith(
          "poe1",
          "The Doctor",
          undefined,
        );
        expect(repo.getTotalDecksOpenedAllSessions).toHaveBeenCalledWith(
          "poe1",
          undefined,
        );
        expect(repo.getFirstSessionStartDate).toHaveBeenCalledWith(
          "poe1",
          undefined,
        );
      });
    });

    // ─── Average drops rounding ───────────────────────────────────────────

    describe("average drops rounding", () => {
      it("should round averageDropsPerSession to 2 decimal places", async () => {
        const repo = getRepoMock();
        repo.getCardPersonalStats.mockResolvedValue({
          totalDrops: 7,
          firstDiscoveredAt: "2025-06-01T10:00:00Z",
          lastSeenAt: "2025-06-15T11:00:00Z",
          sessionCount: 3,
        });

        const result = await service.getPersonalAnalytics(
          "poe1",
          "Settlers",
          "The Doctor",
        );

        // 7 / 3 = 2.333... → should be rounded to 2.33
        expect(result!.averageDropsPerSession).toBe(2.33);
      });
    });
  });

  // ─── getRelatedCards (Milestone 6) ──────────────────────────────────────

  describe("getRelatedCards", () => {
    describe("input validation (via IPC handler)", () => {
      function getIpcHandler(): (...args: unknown[]) => Promise<unknown> {
        const call = mockIpcMainHandle.mock.calls.find(
          ([ch]: [string]) => ch === "card-details:get-related-cards",
        );
        if (!call)
          throw new Error("GetRelatedCards handler was not registered");
        return call[1];
      }

      const emptyResult = { similarCards: [], chainCards: [] };

      it("should return empty result when game is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "",
          "The Doctor",
          "<span>Headhunter</span>",
        );
        expect(result).toEqual(emptyResult);
      });

      it("should return empty result when cardName is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe1",
          "",
          "<span>Headhunter</span>",
        );
        expect(result).toEqual(emptyResult);
      });

      it("should return empty result for invalid game type", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe3",
          "The Doctor",
          "<span>Headhunter</span>",
        );
        expect(result).toEqual(emptyResult);
      });
    });

    it("should look up raw reward_html from DB and find related cards by terminal reward", async () => {
      const repo = getRepoMock();
      // The service now fetches raw reward_html from DB instead of using
      // the cleaned version passed from the renderer
      repo.getCardRewardHtml.mockResolvedValueOnce(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      );
      const mockSimilar = [
        {
          name: "The Fiend",
          artSrc: "https://example.com/fiend.png",
          stackSize: 11,
          description: "Test description",
          rewardHtml: "<span>Headhunter</span>",
          flavourHtml: "<i>Flavour</i>",
          rarity: 1,
          filterRarity: null,
          fromBoss: false,
        },
      ];
      // Terminal reward search returns The Fiend (also rewards Headhunter).
      // Upstream search for "The Doctor" returns empty — no card rewards it
      // in this scenario.
      repo.findCardsByRewardMatch
        .mockResolvedValueOnce(mockSimilar) // terminal: "Headhunter"
        .mockResolvedValueOnce([]); // upstream: "The Doctor"

      const result = await service.getRelatedCards("poe1", "The Doctor");

      // Should have looked up the raw reward_html from DB
      expect(repo.getCardRewardHtml).toHaveBeenCalledWith("poe1", "The Doctor");
      // Should search for the terminal reward "Headhunter"
      expect(repo.findCardsByRewardMatch).toHaveBeenCalledWith(
        "poe1",
        "Headhunter",
        "The Doctor",
        20,
        undefined,
      );
      // Results should be in the similarCards array with relationship type "similar"
      expect(result).toEqual({
        similarCards: mockSimilar.map((c) => ({
          ...c,
          relationship: "similar",
        })),
        chainCards: [],
      });
    });

    it("should return empty result when reward_html is not found in DB", async () => {
      const repo = getRepoMock();
      repo.getCardRewardHtml.mockResolvedValueOnce(null);

      const result = await service.getRelatedCards("poe1", "The Doctor");

      expect(result).toEqual({ similarCards: [], chainCards: [] });
    });

    it("should return empty result when reward HTML has no wiki links", async () => {
      const repo = getRepoMock();
      repo.getCardRewardHtml.mockResolvedValueOnce("<span>HH</span>");

      const result = await service.getRelatedCards("poe1", "The Doctor");

      expect(result).toEqual({ similarCards: [], chainCards: [] });
    });

    it("should return empty result when repository throws", async () => {
      const repo = getRepoMock();
      repo.getCardRewardHtml.mockResolvedValueOnce(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      );
      repo.findCardsByRewardMatch.mockRejectedValue(new Error("DB error"));

      const result = await service.getRelatedCards("poe1", "The Doctor");

      expect(result).toEqual({ similarCards: [], chainCards: [] });
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get related cards"),
        expect.any(Error),
      );
    });

    it("should follow divination card reward chains and tag chain cards", async () => {
      const repo = getRepoMock();

      // Step 0: Look up The Nurse's raw reward_html
      // The Nurse rewards The Doctor (a divination card)
      repo.getCardRewardHtml
        .mockResolvedValueOnce(
          '<span class="tc -divination">[[The Doctor|The Doctor]]</span>',
        )
        // Chain resolution: The Doctor rewards Headhunter (terminal)
        .mockResolvedValueOnce(
          '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
        );

      // findCardByName returns The Doctor's card data (chain card)
      repo.findCardByName.mockResolvedValueOnce({
        name: "The Doctor",
        artSrc: "doctor.png",
        stackSize: 8,
        description: "Test description",
        rewardHtml: "<span>Headhunter</span>",
        flavourHtml: "<i>Flavour</i>",
        rarity: 1,
        filterRarity: null,
        fromBoss: false,
      });

      repo.findCardsByRewardMatch.mockResolvedValue([]);

      const result = await service.getRelatedCards("poe1", "The Nurse");

      // Should have followed the chain: The Nurse → The Doctor → Headhunter
      expect(repo.getCardRewardHtml).toHaveBeenCalledWith("poe1", "The Nurse");
      expect(repo.getCardRewardHtml).toHaveBeenCalledWith("poe1", "The Doctor");
      // Should search for "Headhunter" (terminal reward) as similar cards
      expect(repo.findCardsByRewardMatch).toHaveBeenCalledWith(
        "poe1",
        "Headhunter",
        "The Nurse",
        20,
        undefined,
      );
      // Should include The Doctor as a chain card
      expect(repo.findCardByName).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        undefined,
      );
      expect(result.chainCards).toContainEqual(
        expect.objectContaining({ name: "The Doctor", relationship: "chain" }),
      );
    });

    it("should skip Corrupted and Two-Implicit modifier tags in reward HTML", async () => {
      const repo = getRepoMock();
      repo.getCardRewardHtml.mockResolvedValueOnce(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span><br><span class="tc -corrupted">[[Corrupted]]</span>',
      );
      repo.findCardsByRewardMatch.mockResolvedValue([]);

      await service.getRelatedCards("poe1", "The Fiend");

      // Should extract "Headhunter", not "Corrupted"
      expect(repo.findCardsByRewardMatch).toHaveBeenCalledWith(
        "poe1",
        "Headhunter",
        "The Fiend",
        20,
        undefined,
      );
    });

    it("should also search for cards that reward the current card (upstream)", async () => {
      const repo = getRepoMock();
      repo.getCardRewardHtml.mockResolvedValueOnce(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      );
      repo.findCardsByRewardMatch.mockResolvedValue([]);

      await service.getRelatedCards("poe1", "The Doctor");

      // Should search for "The Doctor" to find upstream cards (e.g. The Nurse)
      expect(repo.findCardsByRewardMatch).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        "The Doctor",
        10,
        undefined,
      );
    });

    it("should add upstream cards that reward the current card into chainCards (4c path)", async () => {
      const repo = getRepoMock();
      // The Doctor rewards Headhunter (terminal, not a div card)
      repo.getCardRewardHtml.mockResolvedValueOnce(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      );

      const nurseCard = {
        name: "The Nurse",
        artSrc: "nurse.png",
        stackSize: 8,
        description: "Rewards The Doctor",
        rewardHtml: "<span>The Doctor</span>",
        flavourHtml: "<i>Flavour</i>",
        rarity: 2,
        filterRarity: null,
        prohibitedLibraryRarity: null,
        fromBoss: false,
      };

      repo.findCardsByRewardMatch
        .mockResolvedValueOnce([]) // terminal: "Headhunter" — no similar cards
        .mockResolvedValueOnce([nurseCard]); // upstream: cards that reward "The Doctor"

      const result = await service.getRelatedCards("poe1", "The Doctor");

      expect(result.chainCards).toHaveLength(1);
      expect(result.chainCards[0].name).toBe("The Nurse");
      expect(result.chainCards[0].relationship).toBe("chain");
    });

    it("should add upstream cards that reward chain cards into chainCards (4b path)", async () => {
      const repo = getRepoMock();

      // The Patient rewards The Nurse (a div card)
      repo.getCardRewardHtml
        .mockResolvedValueOnce(
          '<span class="tc -divination">[[The Nurse|The Nurse]]</span>',
        )
        // The Nurse rewards The Doctor (a div card)
        .mockResolvedValueOnce(
          '<span class="tc -divination">[[The Doctor|The Doctor]]</span>',
        )
        // The Doctor rewards Headhunter (terminal)
        .mockResolvedValueOnce(
          '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
        );

      // findCardByName resolves chain cards discovered during traversal
      const nurseCard = {
        name: "The Nurse",
        artSrc: "nurse.png",
        stackSize: 8,
        description: "Rewards The Doctor",
        rewardHtml: "<span>The Doctor</span>",
        flavourHtml: "<i>Flavour</i>",
        rarity: 2,
        filterRarity: null,
        prohibitedLibraryRarity: null,
        fromBoss: false,
      };
      const doctorCard = {
        name: "The Doctor",
        artSrc: "doctor.png",
        stackSize: 8,
        description: "Rewards Headhunter",
        rewardHtml: "<span>Headhunter</span>",
        flavourHtml: "<i>Flavour</i>",
        rarity: 1,
        filterRarity: null,
        prohibitedLibraryRarity: null,
        fromBoss: false,
      };

      repo.findCardByName
        .mockResolvedValueOnce(nurseCard) // chain card: The Nurse
        .mockResolvedValueOnce(doctorCard); // chain card: The Doctor

      // 4b upstream: find cards that reward "The Nurse" or "The Doctor"
      const upstreamOfNurse = {
        name: "The Intern",
        artSrc: "intern.png",
        stackSize: 12,
        description: "Rewards The Nurse",
        rewardHtml: "<span>The Nurse</span>",
        flavourHtml: "<i>Flavour</i>",
        rarity: 3,
        filterRarity: null,
        prohibitedLibraryRarity: null,
        fromBoss: false,
      };

      repo.findCardsByRewardMatch
        .mockResolvedValueOnce([]) // terminal search: Headhunter
        .mockResolvedValueOnce([upstreamOfNurse]) // 4b: cards that reward "The Nurse"
        .mockResolvedValueOnce([]) // 4b: cards that reward "The Doctor"
        .mockResolvedValueOnce([]); // 4c: cards that reward "The Patient" (current card)

      const result = await service.getRelatedCards("poe1", "The Patient");

      // The Intern should appear as a chain card (found via 4b upstream path)
      expect(result.chainCards).toContainEqual(
        expect.objectContaining({ name: "The Intern", relationship: "chain" }),
      );
      // The Nurse and The Doctor should also be chain cards (from traversal)
      expect(result.chainCards).toContainEqual(
        expect.objectContaining({ name: "The Nurse", relationship: "chain" }),
      );
      expect(result.chainCards).toContainEqual(
        expect.objectContaining({ name: "The Doctor", relationship: "chain" }),
      );
    });

    it("should sort related cards by rarity (rarest first) using PL rarity when available", async () => {
      const repo = getRepoMock();
      repo.getCardRewardHtml.mockResolvedValueOnce(
        '<span class="tc -unique">[[Headhunter|Headhunter]]</span>',
      );

      const cardA = {
        name: "Alpha Card",
        artSrc: "a.png",
        stackSize: 1,
        description: "",
        rewardHtml: "<span>Headhunter</span>",
        flavourHtml: "",
        rarity: 3, // poe.ninja rarity
        filterRarity: null,
        prohibitedLibraryRarity: 1, // PL rarity overrides → rare
        fromBoss: false,
      };
      const cardB = {
        name: "Beta Card",
        artSrc: "b.png",
        stackSize: 1,
        description: "",
        rewardHtml: "<span>Headhunter</span>",
        flavourHtml: "",
        rarity: 0, // poe.ninja rarity
        filterRarity: null,
        prohibitedLibraryRarity: null, // no PL data → falls back to poe.ninja rarity 0
        fromBoss: false,
      };
      const cardC = {
        name: "Zeta Card",
        artSrc: "z.png",
        stackSize: 1,
        description: "",
        rewardHtml: "<span>Headhunter</span>",
        flavourHtml: "",
        rarity: 2,
        filterRarity: null,
        prohibitedLibraryRarity: null, // falls back to poe.ninja rarity 2
        fromBoss: false,
      };
      // Same effective rarity as cardC (2) to test alphabetical tie-breaking
      const cardD = {
        name: "Delta Card",
        artSrc: "d.png",
        stackSize: 1,
        description: "",
        rewardHtml: "<span>Headhunter</span>",
        flavourHtml: "",
        rarity: 2,
        filterRarity: null,
        prohibitedLibraryRarity: null, // falls back to poe.ninja rarity 2
        fromBoss: false,
      };

      repo.findCardsByRewardMatch
        .mockResolvedValueOnce([cardA, cardB, cardC, cardD]) // terminal: Headhunter
        .mockResolvedValueOnce([]); // upstream

      const result = await service.getRelatedCards("poe1", "Some Card");

      // Expected sort order by effective rarity (ascending = rarest first):
      // Beta (0), Alpha (PL=1), Delta (2, alphabetically before Zeta), Zeta (2)
      expect(result.similarCards).toHaveLength(4);
      expect(result.similarCards[0].name).toBe("Beta Card");
      expect(result.similarCards[1].name).toBe("Alpha Card");
      expect(result.similarCards[2].name).toBe("Delta Card");
      expect(result.similarCards[3].name).toBe("Zeta Card");
    });
  });

  // ─── openCardInMainWindow (Milestone 5) ─────────────────────────────────

  describe("openCardInMainWindow (via IPC handler)", () => {
    function getIpcHandler(): (...args: unknown[]) => Promise<unknown> {
      const call = mockIpcMainHandle.mock.calls.find(
        ([channel]: [string]) => channel === "card-details:open-in-main-window",
      );
      if (!call) throw new Error("OpenInMainWindow handler not registered");
      return call[1];
    }

    it("should focus the main window and send NavigateToCard event", async () => {
      const handler = getIpcHandler();
      await handler(null, "The Doctor");

      expect(mockMainWindowShow).toHaveBeenCalled();
      expect(mockMainWindowGetWebContents).toHaveBeenCalled();
      expect(mockMainWindowWebContentsSend).toHaveBeenCalledWith(
        "card-details:navigate-to-card",
        "The Doctor",
      );
    });

    it("should return early and log warning for empty cardName", async () => {
      const handler = getIpcHandler();
      await handler(null, "");

      expect(mockMainWindowShow).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "OpenInMainWindow called with invalid cardName:",
        "",
      );
    });

    it("should return early and log warning for null cardName", async () => {
      const handler = getIpcHandler();
      await handler(null, null);

      expect(mockMainWindowShow).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "OpenInMainWindow called with invalid cardName:",
        null,
      );
    });

    it("should return early and log warning for non-string cardName", async () => {
      const handler = getIpcHandler();
      await handler(null, 42);

      expect(mockMainWindowShow).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "OpenInMainWindow called with invalid cardName:",
        42,
      );
    });

    it("should handle case where webContents is null", async () => {
      mockMainWindowGetWebContents.mockReturnValueOnce(null as any);

      const handler = getIpcHandler();
      await handler(null, "The Doctor");

      expect(mockMainWindowShow).toHaveBeenCalled();
      expect(mockMainWindowWebContentsSend).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("Cannot navigate to"),
      );
    });

    it("should handle case where webContents is destroyed", async () => {
      mockMainWindowGetWebContents.mockReturnValueOnce({
        send: mockMainWindowWebContentsSend,
        isDestroyed: vi.fn().mockReturnValue(true),
      });

      const handler = getIpcHandler();
      await handler(null, "The Doctor");

      expect(mockMainWindowShow).toHaveBeenCalled();
      expect(mockMainWindowWebContentsSend).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining("Cannot navigate to"),
      );
    });

    it("should log success after sending navigation event", async () => {
      const handler = getIpcHandler();
      await handler(null, "House of Mirrors");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("House of Mirrors"),
      );
    });
  });

  // ─── resolveCardBySlug ──────────────────────────────────────────────────

  describe("resolveCardBySlug", () => {
    const mockCard = {
      name: "The Doctor",
      artSrc: "https://example.com/doctor.png",
      stackSize: 8,
      description: "8/8 Headhunter",
      rewardHtml: "<span>Headhunter</span>",
      flavourHtml: "<i>Flavour</i>",
      rarity: 3,
      filterRarity: null,
      fromBoss: false,
    };

    describe("IPC handler registration", () => {
      it("should register the ResolveCardBySlug channel handler", () => {
        expect(mockIpcMainHandle).toHaveBeenCalledWith(
          "card-details:resolve-card-by-slug",
          expect.any(Function),
        );
      });
    });

    describe("input validation (via IPC handler)", () => {
      function getIpcHandler(): (...args: unknown[]) => Promise<unknown> {
        const call = mockIpcMainHandle.mock.calls.find(
          ([ch]: [string]) => ch === "card-details:resolve-card-by-slug",
        );
        if (!call)
          throw new Error("ResolveCardBySlug handler was not registered");
        return call[1];
      }

      it("should return null when game is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "",
          "the-doctor",
        );
        expect(result).toBeNull();
      });

      it("should return null when cardSlug is missing", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe1",
          "",
        );
        expect(result).toBeNull();
      });

      it("should return null for invalid game type", async () => {
        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe3",
          "the-doctor",
        );
        expect(result).toBeNull();
      });

      it("should delegate to resolveCardBySlug on valid input", async () => {
        mockDivCardsGetAllByGame.mockResolvedValue([
          { ...mockCard, name: "The Doctor" },
        ]);
        const repo = getRepoMock();
        repo.getCardRewardHtml.mockResolvedValue(null);

        const handler = getIpcHandler();
        const result = await handler(
          {} as Electron.IpcMainInvokeEvent,
          "poe1",
          "the-doctor",
          "Settlers",
          "Keepers",
        );

        expect(result).not.toBeNull();
        expect((result as CardDetailsInitDTO).card.name).toBe("The Doctor");
      });
    });

    describe("slug resolution", () => {
      it("should resolve slug to card and return unified DTO", async () => {
        mockDivCardsGetAllByGame.mockResolvedValue([
          { ...mockCard, name: "Rain of Chaos" },
          { ...mockCard, name: "The Doctor" },
          { ...mockCard, name: "House of Mirrors" },
        ]);

        const repo = getRepoMock();
        repo.getCardRewardHtml.mockResolvedValue(null);

        const result = await service.resolveCardBySlug(
          "poe1",
          "the-doctor",
          "Settlers",
        );

        expect(result).not.toBeNull();
        expect((result as { card: { name: string } }).card.name).toBe(
          "The Doctor",
        );
      });

      it("should return null when slug does not match any card", async () => {
        mockDivCardsGetAllByGame.mockResolvedValue([
          { ...mockCard, name: "The Doctor" },
        ]);

        const result = await service.resolveCardBySlug(
          "poe1",
          "nonexistent-card",
          "Settlers",
        );

        expect(result).toBeNull();
      });

      it("should pass plLeague and selectedLeague to getAllByGame and getPersonalAnalytics", async () => {
        mockDivCardsGetAllByGame.mockResolvedValue([
          { ...mockCard, name: "The Doctor" },
        ]);

        const repo = getRepoMock();
        repo.getCardRewardHtml.mockResolvedValue(null);

        await service.resolveCardBySlug(
          "poe1",
          "the-doctor",
          "Settlers",
          "Keepers",
        );

        expect(mockDivCardsGetAllByGame).toHaveBeenCalledWith(
          "poe1",
          undefined,
          null,
          "Settlers",
        );

        // selectedLeague "Keepers" should be passed through to getPersonalAnalytics
        // which translates it to leagueFilter for repo calls
        expect(repo.getCardPersonalStats).toHaveBeenCalledWith(
          "poe1",
          "The Doctor",
          "Keepers",
        );
      });

      it("should skip personal analytics when plLeague is not provided", async () => {
        mockDivCardsGetAllByGame.mockResolvedValue([
          { ...mockCard, name: "The Doctor" },
        ]);

        const repo = getRepoMock();
        repo.getCardRewardHtml.mockResolvedValue(null);

        const result = await service.resolveCardBySlug("poe1", "the-doctor");

        expect(result).not.toBeNull();
        expect(result!.personalAnalytics).toBeNull();
        expect(repo.getCardPersonalStats).not.toHaveBeenCalled();
      });

      it("should return empty relatedCards when getRelatedCards encounters an error", async () => {
        mockDivCardsGetAllByGame.mockResolvedValue([
          { ...mockCard, name: "The Doctor" },
        ]);

        const repo = getRepoMock();
        repo.getCardRewardHtml.mockRejectedValue(new Error("DB error"));

        const result = await service.resolveCardBySlug(
          "poe1",
          "the-doctor",
          "Settlers",
        );

        expect(result).not.toBeNull();
        // getRelatedCards catches internally and returns empty result
        expect(result!.relatedCards).toEqual({
          similarCards: [],
          chainCards: [],
        });
      });

      it("should return null when DivinationCardsService throws", async () => {
        mockDivCardsGetAllByGame.mockRejectedValue(
          new Error("Service unavailable"),
        );

        const result = await service.resolveCardBySlug(
          "poe1",
          "the-doctor",
          "Settlers",
        );

        expect(result).toBeNull();
        expect(mockLoggerError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to resolve card by slug"),
          expect.any(Error),
        );
      });

      it("should handle special characters in slug matching", async () => {
        mockDivCardsGetAllByGame.mockResolvedValue([
          { ...mockCard, name: "The King's Blade" },
        ]);

        const repo = getRepoMock();
        repo.getCardRewardHtml.mockResolvedValue(null);

        const result = await service.resolveCardBySlug(
          "poe1",
          "the-king-s-blade",
          "Settlers",
        );

        expect(result).not.toBeNull();
        expect(result!.card.name).toBe("The King's Blade");
      });
    });
  });

  // ─── getPersonalAnalytics — selectedLeague filter ───────────────────────

  describe("getPersonalAnalytics — selectedLeague filter", () => {
    it("should pass selectedLeague as leagueFilter to repository queries", async () => {
      const repo = getRepoMock();

      await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
        "Keepers",
      );

      expect(repo.getCardPersonalStats).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        "Keepers",
      );
      expect(repo.getDropTimeline).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        "Keepers",
      );
      expect(repo.getTotalDecksOpenedAllSessions).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
      expect(repo.getFirstSessionStartDate).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
    });

    it('should pass undefined leagueFilter when selectedLeague is "all"', async () => {
      const repo = getRepoMock();

      await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
        "all",
      );

      expect(repo.getCardPersonalStats).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        undefined,
      );
      expect(repo.getDropTimeline).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        undefined,
      );
      expect(repo.getTotalDecksOpenedAllSessions).toHaveBeenCalledWith(
        "poe1",
        undefined,
      );
    });

    it("should pass undefined leagueFilter when selectedLeague is not provided", async () => {
      const repo = getRepoMock();

      await service.getPersonalAnalytics("poe1", "Settlers", "The Doctor");

      expect(repo.getCardPersonalStats).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        undefined,
      );
    });
  });

  // ─── getPersonalAnalytics — timelineEndDate computation ────────────────

  describe("getPersonalAnalytics — timelineEndDate", () => {
    it("should use league endDate when available", async () => {
      const repo = getRepoMock();
      repo.getLeagueDateRanges.mockResolvedValue([
        {
          name: "Settlers",
          startDate: "2025-01-01T00:00:00Z",
          endDate: "2025-04-01T00:00:00Z",
        },
      ]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.timelineEndDate).toBe("2025-04-01T00:00:00Z");
    });

    it("should approximate end date when league has startDate but no endDate", async () => {
      const repo = getRepoMock();
      // Use a start date far enough in the past that approxEnd < now
      const pastStartDate = "2024-01-01T00:00:00Z";
      repo.getLeagueDateRanges.mockResolvedValue([
        {
          name: "Settlers",
          startDate: pastStartDate,
          endDate: null,
        },
      ]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      // The approxEnd would be startDate + ~4 months. Since that's in the past
      // relative to Date.now(), it should use Date.now() (whichever is later).
      const timelineEnd = new Date(result!.timelineEndDate).getTime();
      // Should be approximately "now" (within a few seconds)
      expect(timelineEnd).toBeGreaterThan(Date.now() - 5000);
      expect(timelineEnd).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it("should use approximate end when it is in the future", async () => {
      const repo = getRepoMock();
      // Use a very recent start date so approxEnd > now
      const futureLeagueStart = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 1 week ago
      repo.getLeagueDateRanges.mockResolvedValue([
        {
          name: "Settlers",
          startDate: futureLeagueStart,
          endDate: null,
        },
      ]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      const timelineEnd = new Date(result!.timelineEndDate).getTime();
      // approxEnd = start + 4 months ≈ start + 120 days, which is in the future
      const approxEnd =
        new Date(futureLeagueStart).getTime() + 4 * 30 * 24 * 60 * 60 * 1000;
      // Should use approxEnd since it's in the future
      expect(timelineEnd).toBeCloseTo(approxEnd, -3); // within 1 second
    });

    it("should fall back to now when league has no startDate or endDate", async () => {
      const repo = getRepoMock();
      repo.getLeagueDateRanges.mockResolvedValue([
        {
          name: "Settlers",
          startDate: null,
          endDate: null,
        },
      ]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      const timelineEnd = new Date(result!.timelineEndDate).getTime();
      expect(timelineEnd).toBeGreaterThan(Date.now() - 5000);
      expect(timelineEnd).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it("should fall back to now when no leagues exist", async () => {
      const repo = getRepoMock();
      repo.getLeagueDateRanges.mockResolvedValue([]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      const timelineEnd = new Date(result!.timelineEndDate).getTime();
      expect(timelineEnd).toBeGreaterThan(Date.now() - 5000);
      expect(timelineEnd).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it("should use the most recent league's endDate when multiple leagues exist", async () => {
      const repo = getRepoMock();
      repo.getLeagueDateRanges.mockResolvedValue([
        {
          name: "Settlers",
          startDate: "2025-01-01T00:00:00Z",
          endDate: "2025-04-01T00:00:00Z",
        },
        {
          name: "Keepers",
          startDate: "2025-06-01T00:00:00Z",
          endDate: "2025-09-01T00:00:00Z",
        },
      ]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      // Should use the last league's endDate (Keepers)
      expect(result!.timelineEndDate).toBe("2025-09-01T00:00:00Z");
    });
  });

  // ─── getPersonalAnalytics — leagueDateRanges and firstSessionStartedAt ─

  describe("getPersonalAnalytics — leagueDateRanges and firstSessionStartedAt", () => {
    it("should pass through leagueDateRanges from repository", async () => {
      const repo = getRepoMock();
      repo.getLeagueDateRanges.mockResolvedValue([
        {
          name: "Settlers",
          startDate: "2025-01-01T00:00:00Z",
          endDate: "2025-04-01T00:00:00Z",
        },
        {
          name: "Keepers",
          startDate: "2025-06-01T00:00:00Z",
          endDate: null,
        },
      ]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.leagueDateRanges).toHaveLength(2);
      expect(result!.leagueDateRanges[0]).toEqual({
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-04-01T00:00:00Z",
      });
      expect(result!.leagueDateRanges[1]).toEqual({
        name: "Keepers",
        startDate: "2025-06-01T00:00:00Z",
        endDate: null,
      });
    });

    it("should return empty leagueDateRanges when none exist", async () => {
      const repo = getRepoMock();
      repo.getLeagueDateRanges.mockResolvedValue([]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.leagueDateRanges).toEqual([]);
    });

    it("should pass through firstSessionStartedAt from repository", async () => {
      const repo = getRepoMock();
      repo.getFirstSessionStartDate.mockResolvedValue("2024-12-01T08:00:00Z");

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.firstSessionStartedAt).toBe("2024-12-01T08:00:00Z");
    });

    it("should return null firstSessionStartedAt when no sessions exist", async () => {
      const repo = getRepoMock();
      repo.getFirstSessionStartDate.mockResolvedValue(null);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.firstSessionStartedAt).toBeNull();
    });
  });

  // ─── getPersonalAnalytics — drop timeline league passthrough ────────────

  describe("getPersonalAnalytics — drop timeline league passthrough", () => {
    it("should include league name in each drop timeline entry", async () => {
      const repo = getRepoMock();
      repo.getCardPersonalStats.mockResolvedValue({
        totalDrops: 3,
        firstDiscoveredAt: "2025-06-01T10:00:00Z",
        lastSeenAt: "2025-06-15T10:00:00Z",
        sessionCount: 2,
      });
      repo.getDropTimeline.mockResolvedValue([
        {
          sessionId: "s1",
          sessionStartedAt: "2025-06-01T10:00:00Z",
          count: 1,
          totalDecksOpened: 50,
          league: "Settlers",
        },
        {
          sessionId: "s2",
          sessionStartedAt: "2025-06-15T10:00:00Z",
          count: 2,
          totalDecksOpened: 80,
          league: "Keepers",
        },
      ]);

      const result = await service.getPersonalAnalytics(
        "poe1",
        "Settlers",
        "The Doctor",
      );

      expect(result).not.toBeNull();
      expect(result!.dropTimeline[0].league).toBe("Settlers");
      expect(result!.dropTimeline[1].league).toBe("Keepers");
    });
  });
});
