import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetKysely,
  mockRepoGetSessionCount,
  mockRepoGetSessionsPage,
  mockRepoGetSessionById,
  mockRepoGetSessionCards,
  mockRepoGetSessionCountByCard,
  mockRepoSearchSessionsByCard,
  mockSnapshotLoadSnapshot,
  mockAssertGameType,
  mockAssertSessionId,
  mockAssertCardName,
  mockAssertPage,
  mockAssertPageSize,
  mockHandleValidationError,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetKysely: vi.fn(),
  mockRepoGetSessionCount: vi.fn(),
  mockRepoGetSessionsPage: vi.fn(),
  mockRepoGetSessionById: vi.fn(),
  mockRepoGetSessionCards: vi.fn(),
  mockRepoGetSessionCountByCard: vi.fn(),
  mockRepoSearchSessionsByCard: vi.fn(),
  mockSnapshotLoadSnapshot: vi.fn(),
  mockAssertGameType: vi.fn(),
  mockAssertSessionId: vi.fn(),
  mockAssertCardName: vi.fn(),
  mockAssertPage: vi.fn(),
  mockAssertPageSize: vi.fn(),
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

// ─── Mock SnapshotService ────────────────────────────────────────────────────
vi.mock("~/main/modules/snapshots", () => ({
  SnapshotService: {
    getInstance: vi.fn(() => ({
      loadSnapshot: mockSnapshotLoadSnapshot,
      getSnapshotForSession: vi.fn(),
      ensureLeague: vi.fn(),
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
      stopAllAutoRefresh: vi.fn(),
    })),
  },
  SnapshotChannel: {
    GetLatestSnapshot: "snapshot:get-latest-snapshot",
    GetSnapshotInfo: "snapshot:get-snapshot-info",
    OnSnapshotCreated: "snapshot:on-snapshot-created",
    OnSnapshotReused: "snapshot:on-snapshot-reused",
    OnAutoRefreshStarted: "snapshot:on-auto-refresh-started",
    OnAutoRefreshStopped: "snapshot:on-auto-refresh-stopped",
  },
}));

// ─── Mock cleanWikiMarkup ────────────────────────────────────────────────────
vi.mock("~/main/utils/cleanWikiMarkup", () => ({
  cleanWikiMarkup: vi.fn((html: string | null | undefined) => html ?? ""),
}));

// ─── Mock SessionsRepository ─────────────────────────────────────────────────
vi.mock("../Sessions.repository", () => ({
  SessionsRepository: class MockSessionsRepository {
    getSessionCount = mockRepoGetSessionCount;
    getSessionsPage = mockRepoGetSessionsPage;
    getSessionById = mockRepoGetSessionById;
    getSessionCards = mockRepoGetSessionCards;
    getSessionCountByCard = mockRepoGetSessionCountByCard;
    searchSessionsByCard = mockRepoSearchSessionsByCard;
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertGameType: mockAssertGameType,
  assertSessionId: mockAssertSessionId,
  assertCardName: mockAssertCardName,
  assertPage: mockAssertPage,
  assertPageSize: mockAssertPageSize,
  handleValidationError: mockHandleValidationError,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { SessionsChannel } from "../Sessions.channels";
import { SessionsService } from "../Sessions.service";

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

const SAMPLE_SESSION_SUMMARIES = [
  {
    sessionId: "session-1",
    game: "poe1",
    league: "Settlers",
    startedAt: "2025-01-15T10:00:00Z",
    endedAt: "2025-01-15T12:00:00Z",
    durationMinutes: 120,
    totalDecksOpened: 50,
    totalExchangeValue: 1500,
    totalStashValue: 1400,
    totalExchangeNetProfit: 1000,
    totalStashNetProfit: 900,
    exchangeChaosToDivine: 200,
    stashChaosToDivine: 195,
    stackedDeckChaosCost: 10,
    isActive: false,
  },
];

const SAMPLE_SESSION_DETAILS = {
  id: "session-1",
  game: "poe1",
  leagueId: "league-1",
  league: "Settlers",
  snapshotId: null,
  startedAt: "2025-01-15T10:00:00Z",
  endedAt: "2025-01-15T12:00:00Z",
  totalCount: 50,
  isActive: false,
};

const SAMPLE_SESSION_CARDS = [
  {
    cardName: "The Doctor",
    count: 2,
    hidePriceExchange: false,
    hidePriceStash: false,
    divinationCard: undefined,
  },
  {
    cardName: "Rain of Chaos",
    count: 15,
    hidePriceExchange: false,
    hidePriceStash: false,
    divinationCard: undefined,
  },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SessionsService — IPC handlers", () => {
  let _service: SessionsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    SessionsService._instance = undefined;

    // Reset validation mocks to no-op / pass-through implementations
    mockAssertGameType.mockImplementation(() => {});
    mockAssertSessionId.mockImplementation(() => {});
    mockAssertCardName.mockImplementation(() => {});
    mockAssertPage.mockImplementation((val: unknown) =>
      val === undefined || val === null ? 1 : val,
    );
    mockAssertPageSize.mockImplementation((val: unknown) =>
      val === undefined || val === null ? 20 : val,
    );
    mockHandleValidationError.mockImplementation(() => ({
      success: false,
      error: "Validation error",
    }));

    // Default mock return values
    mockRepoGetSessionCount.mockResolvedValue(1);
    mockRepoGetSessionsPage.mockResolvedValue(SAMPLE_SESSION_SUMMARIES);
    mockRepoGetSessionById.mockResolvedValue(SAMPLE_SESSION_DETAILS);
    mockRepoGetSessionCards.mockResolvedValue(SAMPLE_SESSION_CARDS);
    mockRepoGetSessionCountByCard.mockResolvedValue(1);
    mockRepoSearchSessionsByCard.mockResolvedValue(SAMPLE_SESSION_SUMMARIES);
    mockSnapshotLoadSnapshot.mockResolvedValue(null);

    _service = SessionsService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    SessionsService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Handler registration ────────────────────────────────────────────────

  describe("handler registration", () => {
    it("should register handlers for all expected IPC channels", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(SessionsChannel.GetAll);
      expect(registeredChannels).toContain(SessionsChannel.GetById);
      expect(registeredChannels).toContain(SessionsChannel.SearchByCard);
    });

    it("should register exactly 3 IPC handlers", () => {
      expect(mockIpcHandle).toHaveBeenCalledTimes(3);
    });
  });

  // ─── GetAll handler ──────────────────────────────────────────────────────

  describe("GetAll handler", () => {
    it("should validate game type and return paginated sessions on success", async () => {
      const handler = getIpcHandler(SessionsChannel.GetAll);
      const result = await handler({}, "poe1", 1, 20);

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        SessionsChannel.GetAll,
      );
      expect(mockAssertPage).toHaveBeenCalledWith(1, SessionsChannel.GetAll);
      expect(mockAssertPageSize).toHaveBeenCalledWith(
        20,
        SessionsChannel.GetAll,
      );
      expect(mockRepoGetSessionCount).toHaveBeenCalledWith("poe1");
      expect(mockRepoGetSessionsPage).toHaveBeenCalledWith("poe1", 20, 0);
      expect(result).toEqual({
        sessions: SAMPLE_SESSION_SUMMARIES,
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it("should calculate correct offset for page 2", async () => {
      mockRepoGetSessionCount.mockResolvedValue(50);
      const handler = getIpcHandler(SessionsChannel.GetAll);
      await handler({}, "poe1", 2, 10);

      expect(mockRepoGetSessionsPage).toHaveBeenCalledWith("poe1", 10, 10);
    });

    it("should calculate correct totalPages", async () => {
      mockRepoGetSessionCount.mockResolvedValue(45);
      const handler = getIpcHandler(SessionsChannel.GetAll);
      const result = await handler({}, "poe1", 1, 20);

      expect(result.totalPages).toBe(3);
      expect(result.total).toBe(45);
    });

    it("should use default page and pageSize from assertPage/assertPageSize when values are undefined", async () => {
      const handler = getIpcHandler(SessionsChannel.GetAll);
      const _result = await handler({}, "poe1", undefined, undefined);

      // The handler signature has defaults (page = 1, pageSize = 20),
      // so undefined is replaced before the validators see it
      expect(mockAssertPage).toHaveBeenCalledWith(1, SessionsChannel.GetAll);
      expect(mockAssertPageSize).toHaveBeenCalledWith(
        20,
        SessionsChannel.GetAll,
      );
      expect(mockRepoGetSessionsPage).toHaveBeenCalledWith("poe1", 20, 0);
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game type");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(SessionsChannel.GetAll);
      await handler({}, "invalid-game", 1, 20);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SessionsChannel.GetAll,
      );
    });

    it("should not call repository when game type validation fails", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("Invalid game type");
      });

      const handler = getIpcHandler(SessionsChannel.GetAll);
      await handler({}, "bad", 1, 20);

      expect(mockRepoGetSessionCount).not.toHaveBeenCalled();
      expect(mockRepoGetSessionsPage).not.toHaveBeenCalled();
    });

    it("should not call repository when page validation fails", async () => {
      mockAssertPage.mockImplementation(() => {
        throw new Error("Invalid page");
      });

      const handler = getIpcHandler(SessionsChannel.GetAll);
      await handler({}, "poe1", -1, 20);

      expect(mockRepoGetSessionCount).not.toHaveBeenCalled();
      expect(mockRepoGetSessionsPage).not.toHaveBeenCalled();
    });

    it("should not call repository when pageSize validation fails", async () => {
      mockAssertPageSize.mockImplementation(() => {
        throw new Error("Invalid pageSize");
      });

      const handler = getIpcHandler(SessionsChannel.GetAll);
      await handler({}, "poe1", 1, 999);

      expect(mockRepoGetSessionCount).not.toHaveBeenCalled();
      expect(mockRepoGetSessionsPage).not.toHaveBeenCalled();
    });

    it("should return validation error result when validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "game must be poe1 or poe2",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.GetAll);
      const result = await handler({}, 123, 1, 20);

      expect(result).toEqual(errorPayload);
    });

    it("should return empty sessions page when no sessions exist", async () => {
      mockRepoGetSessionCount.mockResolvedValue(0);
      mockRepoGetSessionsPage.mockResolvedValue([]);

      const handler = getIpcHandler(SessionsChannel.GetAll);
      const result = await handler({}, "poe1", 1, 20);

      expect(result).toEqual({
        sessions: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });

    it("should work with poe2 game type", async () => {
      const handler = getIpcHandler(SessionsChannel.GetAll);
      await handler({}, "poe2", 1, 10);

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        SessionsChannel.GetAll,
      );
      expect(mockRepoGetSessionCount).toHaveBeenCalledWith("poe2");
      expect(mockRepoGetSessionsPage).toHaveBeenCalledWith("poe2", 10, 0);
    });
  });

  // ─── GetById handler ─────────────────────────────────────────────────────

  describe("GetById handler", () => {
    it("should validate sessionId and return session details on success", async () => {
      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      expect(mockAssertSessionId).toHaveBeenCalledWith(
        "session-1",
        SessionsChannel.GetById,
      );
      expect(mockRepoGetSessionById).toHaveBeenCalledWith("session-1");
      expect(mockRepoGetSessionCards).toHaveBeenCalledWith("session-1");
      expect(result).not.toBeNull();
      expect(result.totalCount).toBe(50);
    });

    it("should return null for non-existent session", async () => {
      mockRepoGetSessionById.mockResolvedValue(null);

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "nonexistent-id");

      expect(result).toBeNull();
    });

    it("should not fetch cards when session does not exist", async () => {
      mockRepoGetSessionById.mockResolvedValue(null);

      const handler = getIpcHandler(SessionsChannel.GetById);
      await handler({}, "nonexistent-id");

      expect(mockRepoGetSessionCards).not.toHaveBeenCalled();
    });

    it("should handle validation errors for invalid sessionId", async () => {
      const validationError = new Error("Invalid sessionId");
      mockAssertSessionId.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      await handler({}, 12345);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SessionsChannel.GetById,
      );
    });

    it("should not call repository when sessionId validation fails", async () => {
      mockAssertSessionId.mockImplementation(() => {
        throw new Error("Invalid sessionId");
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      await handler({}, null);

      expect(mockRepoGetSessionById).not.toHaveBeenCalled();
      expect(mockRepoGetSessionCards).not.toHaveBeenCalled();
    });

    it("should return validation error result for non-string sessionId", async () => {
      const errorPayload = {
        success: false as const,
        error: "sessionId must be a string",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertSessionId.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, undefined);

      expect(result).toEqual(errorPayload);
    });

    it("should call loadSnapshot when session has a snapshotId", async () => {
      mockRepoGetSessionById.mockResolvedValue({
        ...SAMPLE_SESSION_DETAILS,
        snapshotId: "snap-1",
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      await handler({}, "session-1");

      expect(mockSnapshotLoadSnapshot).toHaveBeenCalledWith("snap-1");
    });

    it("should not call loadSnapshot when session has no snapshotId", async () => {
      mockRepoGetSessionById.mockResolvedValue({
        ...SAMPLE_SESSION_DETAILS,
        snapshotId: null,
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      await handler({}, "session-1");

      expect(mockSnapshotLoadSnapshot).not.toHaveBeenCalled();
    });

    it("should return cards array with correct card names", async () => {
      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      expect(result).not.toBeNull();
      expect(result.cards).toBeInstanceOf(Array);
      expect(result.cards.length).toBe(2);

      const cardNames = result.cards.map((c: any) => c.name);
      expect(cardNames).toContain("The Doctor");
      expect(cardNames).toContain("Rain of Chaos");
    });

    it("should include card counts in the result", async () => {
      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      const doctor = result.cards.find((c: any) => c.name === "The Doctor");
      expect(doctor.count).toBe(2);

      const rain = result.cards.find((c: any) => c.name === "Rain of Chaos");
      expect(rain.count).toBe(15);
    });

    it("should include startedAt and endedAt from the session", async () => {
      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      expect(result.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(result.endedAt).toBe("2025-01-15T12:00:00Z");
    });

    it("should include league from the session", async () => {
      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      expect(result.league).toBe("Settlers");
    });

    it("should not include totals when no snapshot is available", async () => {
      mockRepoGetSessionById.mockResolvedValue({
        ...SAMPLE_SESSION_DETAILS,
        snapshotId: null,
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      expect(result.totals).toBeUndefined();
      expect(result.priceSnapshot).toBeUndefined();
    });

    it("should include price data when snapshot is available", async () => {
      mockRepoGetSessionById.mockResolvedValue({
        ...SAMPLE_SESSION_DETAILS,
        snapshotId: "snap-1",
      });
      mockSnapshotLoadSnapshot.mockResolvedValue({
        timestamp: "2025-01-15T09:00:00Z",
        stackedDeckChaosCost: 10,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {
            "The Doctor": { chaosValue: 5000, divineValue: 25 },
          },
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {
            "The Doctor": { chaosValue: 4800, divineValue: 24 },
          },
        },
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      expect(result.totals).toBeDefined();
      expect(result.priceSnapshot).toBeDefined();

      const doctor = result.cards.find((c: any) => c.name === "The Doctor");
      expect(doctor.exchangePrice).toBeDefined();
      expect(doctor.exchangePrice.chaosValue).toBe(5000);
      expect(doctor.stashPrice).toBeDefined();
      expect(doctor.stashPrice.chaosValue).toBe(4800);
    });

    it("should handle loadSnapshot returning null gracefully", async () => {
      mockRepoGetSessionById.mockResolvedValue({
        ...SAMPLE_SESSION_DETAILS,
        snapshotId: "snap-1",
      });
      mockSnapshotLoadSnapshot.mockResolvedValue(null);

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      expect(result).not.toBeNull();
      expect(result.totals).toBeUndefined();
      expect(result.priceSnapshot).toBeUndefined();
    });

    it("should include divination card metadata when available", async () => {
      mockRepoGetSessionCards.mockResolvedValue([
        {
          cardName: "The Doctor",
          count: 2,
          hidePriceExchange: false,
          hidePriceStash: false,
          divinationCard: {
            id: "dc-1",
            stackSize: 8,
            description: "A test card",
            rewardHtml: "[[Headhunter|Headhunter]]",
            artSrc: "https://example.com/art.png",
            flavourHtml: "Some [[flavour]]",
            rarity: 1,
          },
        },
      ]);

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      const doctor = result.cards.find((c: any) => c.name === "The Doctor");
      expect(doctor.divinationCard).toBeDefined();
      expect(doctor.divinationCard.id).toBe("dc-1");
      expect(doctor.divinationCard.stackSize).toBe(8);
    });

    it("should respect hidePrice flags on session cards", async () => {
      mockRepoGetSessionById.mockResolvedValue({
        ...SAMPLE_SESSION_DETAILS,
        snapshotId: "snap-1",
      });
      mockRepoGetSessionCards.mockResolvedValue([
        {
          cardName: "Hidden Card",
          count: 5,
          hidePriceExchange: true,
          hidePriceStash: false,
          divinationCard: undefined,
        },
      ]);
      mockSnapshotLoadSnapshot.mockResolvedValue({
        timestamp: "2025-01-15T09:00:00Z",
        stackedDeckChaosCost: 10,
        exchange: {
          chaosToDivineRatio: 200,
          cardPrices: {
            "Hidden Card": { chaosValue: 100, divineValue: 0.5 },
          },
        },
        stash: {
          chaosToDivineRatio: 195,
          cardPrices: {
            "Hidden Card": { chaosValue: 90, divineValue: 0.45 },
          },
        },
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, "session-1");

      const card = result.cards.find((c: any) => c.name === "Hidden Card");
      expect(card.exchangePrice.hidePrice).toBe(true);
      expect(card.stashPrice.hidePrice).toBe(false);

      // Exchange total should be 0 because the card is hidden from exchange
      expect(result.totals.exchange.totalValue).toBe(0);
      // Stash total should include the card value (90 * 5 = 450)
      expect(result.totals.stash.totalValue).toBe(450);
    });
  });

  // ─── SearchByCard handler ────────────────────────────────────────────────

  describe("SearchByCard handler", () => {
    it("should validate game, cardName, page, pageSize and return results", async () => {
      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      const result = await handler({}, "poe1", "Doctor", 1, 20);

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        SessionsChannel.SearchByCard,
      );
      expect(mockAssertCardName).toHaveBeenCalledWith(
        "Doctor",
        SessionsChannel.SearchByCard,
      );
      expect(mockAssertPage).toHaveBeenCalledWith(
        1,
        SessionsChannel.SearchByCard,
      );
      expect(mockAssertPageSize).toHaveBeenCalledWith(
        20,
        SessionsChannel.SearchByCard,
      );
      expect(mockRepoGetSessionCountByCard).toHaveBeenCalledWith(
        "poe1",
        "Doctor",
      );
      expect(mockRepoSearchSessionsByCard).toHaveBeenCalledWith(
        "poe1",
        "Doctor",
        20,
        0,
      );
      expect(result).toEqual({
        sessions: SAMPLE_SESSION_SUMMARIES,
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it("should calculate correct offset for page 3", async () => {
      mockRepoGetSessionCountByCard.mockResolvedValue(100);
      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "poe1", "Chaos", 3, 15);

      expect(mockRepoSearchSessionsByCard).toHaveBeenCalledWith(
        "poe1",
        "Chaos",
        15,
        30,
      );
    });

    it("should calculate correct totalPages for search results", async () => {
      mockRepoGetSessionCountByCard.mockResolvedValue(37);
      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      const result = await handler({}, "poe1", "Rain", 1, 10);

      expect(result.totalPages).toBe(4);
      expect(result.total).toBe(37);
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game type");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "bad-game", "Doctor", 1, 20);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SessionsChannel.SearchByCard,
      );
    });

    it("should handle validation errors for invalid cardName", async () => {
      const validationError = new Error("Invalid cardName");
      mockAssertCardName.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "poe1", 12345, 1, 20);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        SessionsChannel.SearchByCard,
      );
    });

    it("should not call repository when game validation fails", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "bad", "Doctor", 1, 20);

      expect(mockRepoGetSessionCountByCard).not.toHaveBeenCalled();
      expect(mockRepoSearchSessionsByCard).not.toHaveBeenCalled();
    });

    it("should not call repository when cardName validation fails", async () => {
      mockAssertCardName.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "poe1", null, 1, 20);

      expect(mockRepoGetSessionCountByCard).not.toHaveBeenCalled();
      expect(mockRepoSearchSessionsByCard).not.toHaveBeenCalled();
    });

    it("should not call repository when page validation fails", async () => {
      mockAssertPage.mockImplementation(() => {
        throw new Error("bad page");
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "poe1", "Doctor", -5, 20);

      expect(mockRepoGetSessionCountByCard).not.toHaveBeenCalled();
      expect(mockRepoSearchSessionsByCard).not.toHaveBeenCalled();
    });

    it("should not call repository when pageSize validation fails", async () => {
      mockAssertPageSize.mockImplementation(() => {
        throw new Error("bad pageSize");
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "poe1", "Doctor", 1, 500);

      expect(mockRepoGetSessionCountByCard).not.toHaveBeenCalled();
      expect(mockRepoSearchSessionsByCard).not.toHaveBeenCalled();
    });

    it("should return validation error result when validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "cardName must be a string",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertCardName.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      const result = await handler({}, "poe1", undefined, 1, 20);

      expect(result).toEqual(errorPayload);
    });

    it("should return empty results when no sessions match", async () => {
      mockRepoGetSessionCountByCard.mockResolvedValue(0);
      mockRepoSearchSessionsByCard.mockResolvedValue([]);

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      const result = await handler({}, "poe1", "NonExistentCard", 1, 20);

      expect(result).toEqual({
        sessions: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });

    it("should work with poe2 game type", async () => {
      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "poe2", "Some Card", 1, 10);

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        SessionsChannel.SearchByCard,
      );
      expect(mockRepoGetSessionCountByCard).toHaveBeenCalledWith(
        "poe2",
        "Some Card",
      );
      expect(mockRepoSearchSessionsByCard).toHaveBeenCalledWith(
        "poe2",
        "Some Card",
        10,
        0,
      );
    });

    it("should use default page and pageSize when values are undefined", async () => {
      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, "poe1", "Doctor", undefined, undefined);

      // The handler signature has defaults (page = 1, pageSize = 20),
      // so undefined is replaced before the validators see it
      expect(mockAssertPage).toHaveBeenCalledWith(
        1,
        SessionsChannel.SearchByCard,
      );
      expect(mockAssertPageSize).toHaveBeenCalledWith(
        20,
        SessionsChannel.SearchByCard,
      );
      expect(mockRepoSearchSessionsByCard).toHaveBeenCalledWith(
        "poe1",
        "Doctor",
        20,
        0,
      );
    });
  });

  // ─── Cross-cutting concerns ──────────────────────────────────────────────

  describe("cross-cutting concerns", () => {
    it("should return handleValidationError result when GetAll validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "Mocked validation error",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.GetAll);
      const result = await handler({}, null, 1, 20);

      expect(result).toEqual(errorPayload);
    });

    it("should return handleValidationError result when GetById validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "Mocked validation error",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertSessionId.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      const result = await handler({}, null);

      expect(result).toEqual(errorPayload);
    });

    it("should return handleValidationError result when SearchByCard validation fails", async () => {
      const errorPayload = {
        success: false as const,
        error: "Mocked validation error",
      };
      mockHandleValidationError.mockReturnValue(errorPayload);
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      const result = await handler({}, null, "Doctor", 1, 20);

      expect(result).toEqual(errorPayload);
    });

    it("should not call any repository methods when GetAll validation fails", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.GetAll);
      await handler({}, "bad");

      expect(mockRepoGetSessionCount).not.toHaveBeenCalled();
      expect(mockRepoGetSessionsPage).not.toHaveBeenCalled();
    });

    it("should not call any repository methods when GetById validation fails", async () => {
      mockAssertSessionId.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.GetById);
      await handler({}, null);

      expect(mockRepoGetSessionById).not.toHaveBeenCalled();
      expect(mockRepoGetSessionCards).not.toHaveBeenCalled();
      expect(mockSnapshotLoadSnapshot).not.toHaveBeenCalled();
    });

    it("should not call any repository methods when SearchByCard validation fails", async () => {
      mockAssertGameType.mockImplementation(() => {
        throw new Error("bad");
      });

      const handler = getIpcHandler(SessionsChannel.SearchByCard);
      await handler({}, null, "Doctor", 1, 20);

      expect(mockRepoGetSessionCountByCard).not.toHaveBeenCalled();
      expect(mockRepoSearchSessionsByCard).not.toHaveBeenCalled();
    });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = SessionsService.getInstance();
      const instance2 = SessionsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
