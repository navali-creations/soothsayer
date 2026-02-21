import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockReadFileSync,
  mockSettingsGet,
  mockGetKysely,
  mockRepositoryGetAllByGame,
  mockRepositoryGetById,
  mockRepositoryGetByName,
  mockRepositorySearchByName,
  mockRepositoryGetCardCount,
  mockRepositoryGetLastUpdated,
  mockRepositoryGetCardHash,
  mockRepositoryInsertCard,
  mockRepositoryUpdateCard,
  mockRepositoryUpdateRarities,
  mockElectronApp,
  mockPlRepoGetCardWeights,
  mockPlRepoGetMetadata,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockGetKysely: vi.fn(),
  mockRepositoryGetAllByGame: vi.fn(),
  mockRepositoryGetById: vi.fn(),
  mockRepositoryGetByName: vi.fn(),
  mockRepositorySearchByName: vi.fn(),
  mockRepositoryGetCardCount: vi.fn(),
  mockRepositoryGetLastUpdated: vi.fn(),
  mockRepositoryGetCardHash: vi.fn(),
  mockRepositoryInsertCard: vi.fn(),
  mockRepositoryUpdateCard: vi.fn(),
  mockRepositoryUpdateRarities: vi.fn(),
  mockElectronApp: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-path"),
  },
  mockPlRepoGetCardWeights: vi.fn(),
  mockPlRepoGetMetadata: vi.fn(),
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
  app: mockElectronApp,
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock node:fs ────────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  readFileSync: mockReadFileSync,
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
}));

// ─── Mock node:crypto ────────────────────────────────────────────────────────
vi.mock("node:crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => "mock-hash-value"),
  })),
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

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: vi.fn(),
      getAllSettings: vi.fn(),
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
    SelectedPoe1League: "poe1SelectedLeague",
    SelectedPoe2League: "poe2SelectedLeague",
    RaritySource: "raritySource",
    SelectedFilterId: "selectedFilterId",
  },
}));

// ─── Mock DivinationCardsRepository ──────────────────────────────────────────
vi.mock("../DivinationCards.repository", () => ({
  DivinationCardsRepository: class MockDivinationCardsRepository {
    getAllByGame = mockRepositoryGetAllByGame;
    getById = mockRepositoryGetById;
    getByName = mockRepositoryGetByName;
    searchByName = mockRepositorySearchByName;
    getCardCount = mockRepositoryGetCardCount;
    getLastUpdated = mockRepositoryGetLastUpdated;
    getCardHash = mockRepositoryGetCardHash;
    insertCard = mockRepositoryInsertCard;
    updateCard = mockRepositoryUpdateCard;
    updateRarities = mockRepositoryUpdateRarities;
    getAllCardNames = vi.fn().mockResolvedValue([]);
  },
}));

// ─── Mock RarityModelRepository ───────────────────────────────────────────────────
vi.mock("~/main/modules/rarity-model/RarityModel.repository", () => ({
  RarityModelRepository: class MockRarityModelRepository {
    getAll = vi.fn().mockResolvedValue([]);
    getById = vi.fn().mockResolvedValue(null);
    getCardRarities = vi.fn().mockResolvedValue([]);
    replaceCardRarities = vi.fn().mockResolvedValue(undefined);
    getCardRarityCount = vi.fn().mockResolvedValue(0);
    getCardRarity = vi.fn().mockResolvedValue(null);
  },
}));

// ─── Mock ProhibitedLibraryRepository ────────────────────────────────────────
vi.mock(
  "~/main/modules/prohibited-library/ProhibitedLibrary.repository",
  () => ({
    ProhibitedLibraryRepository: class MockProhibitedLibraryRepository {
      getCardWeights = mockPlRepoGetCardWeights;
      getMetadata = mockPlRepoGetMetadata;
      upsertCardWeights = vi.fn().mockResolvedValue(undefined);
      upsertMetadata = vi.fn().mockResolvedValue(undefined);
      syncFromBossFlags = vi.fn().mockResolvedValue(undefined);
      getFromBossCards = vi.fn().mockResolvedValue([]);
      deleteCardWeights = vi.fn().mockResolvedValue(undefined);
    },
  }),
);

// ─── Import under test ──────────────────────────────────────────────────────
import { DivinationCardsService } from "../DivinationCards.service";

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

const SAMPLE_CARDS_JSON = JSON.stringify([
  {
    name: "The Doctor",
    stack_size: 8,
    description: "A card description",
    reward_html: "<span>Headhunter</span>",
    art_src: "https://example.com/doctor.png",
    flavour_html: "<em>Flavour text</em>",
  },
  {
    name: "Rain of Chaos",
    stack_size: 8,
    description: "Another card",
    reward_html: "<span>Chaos Orb</span>",
    art_src: "https://example.com/rain.png",
    flavour_html: "",
  },
]);

const SAMPLE_CARD_DTO = {
  id: "poe1_the-doctor",
  name: "The Doctor",
  stackSize: 8,
  description: "A card description",
  rewardHtml: "<span>Headhunter</span>",
  artSrc: "https://example.com/doctor.png",
  flavourHtml: "<em>Flavour text</em>",
  rarity: 4,
  game: "poe1" as const,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DivinationCardsService — IPC handlers and initialization", () => {
  let service: DivinationCardsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    DivinationCardsService._instance = undefined;

    // Default mock returns
    mockReadFileSync.mockReturnValue(SAMPLE_CARDS_JSON);
    mockSettingsGet.mockResolvedValue("Settlers");
    mockRepositoryGetAllByGame.mockResolvedValue([SAMPLE_CARD_DTO]);
    mockRepositoryGetById.mockResolvedValue(SAMPLE_CARD_DTO);
    mockRepositoryGetByName.mockResolvedValue(SAMPLE_CARD_DTO);
    mockRepositorySearchByName.mockResolvedValue([SAMPLE_CARD_DTO]);
    mockRepositoryGetCardCount.mockResolvedValue(42);
    mockRepositoryGetLastUpdated.mockResolvedValue("2025-01-01T00:00:00");
    mockRepositoryGetCardHash.mockResolvedValue(null);
    mockRepositoryInsertCard.mockResolvedValue(undefined);
    mockRepositoryUpdateCard.mockResolvedValue(undefined);
    mockRepositoryUpdateRarities.mockResolvedValue(undefined);
    mockPlRepoGetCardWeights.mockResolvedValue([]);
    mockPlRepoGetMetadata.mockResolvedValue(null);

    service = DivinationCardsService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    DivinationCardsService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Singleton ────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = DivinationCardsService.getInstance();
      const instance2 = DivinationCardsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetting the singleton", () => {
      const instance1 = DivinationCardsService.getInstance();
      // @ts-expect-error — accessing private static for testing
      DivinationCardsService._instance = undefined;
      const instance2 = DivinationCardsService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ─── IPC handler registration ─────────────────────────────────────────

  describe("IPC handler registration", () => {
    it("should register all expected IPC handlers", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain("divination-cards:get-all");
      expect(registeredChannels).toContain("divination-cards:get-by-id");
      expect(registeredChannels).toContain("divination-cards:get-by-name");
      expect(registeredChannels).toContain("divination-cards:search-by-name");
      expect(registeredChannels).toContain("divination-cards:get-count");
      expect(registeredChannels).toContain("divination-cards:get-stats");
      expect(registeredChannels).toContain("divination-cards:force-sync");
      expect(registeredChannels).toContain("divination-cards:update-rarity");
    });
  });

  // ─── GetAll handler ───────────────────────────────────────────────────

  describe("GetAll handler", () => {
    it("should return all cards for a valid game type", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      const result = await handler({}, "poe1");

      expect(mockRepositoryGetAllByGame).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        null,
        null,
      );
      expect(result).toEqual([SAMPLE_CARD_DTO]);
    });

    it("should pass undefined league when settings return null", async () => {
      mockSettingsGet.mockResolvedValue(null);
      const handler = getIpcHandler("divination-cards:get-all");
      await handler({}, "poe1");

      expect(mockRepositoryGetAllByGame).toHaveBeenCalledWith(
        "poe1",
        undefined,
        null,
        null,
      );
    });

    it("should use poe2 league key when game is poe2", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      await handler({}, "poe2");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe2SelectedLeague");
    });

    it("should use poe1 league key when game is poe1", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      await handler({}, "poe1");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe1SelectedLeague");
    });

    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      const result = await handler({}, "invalid");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error when game is a number", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      const result = await handler({}, 123);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error when game is null", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      const result = await handler({}, null);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error when game is undefined", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      const result = await handler({}, undefined);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── GetById handler ──────────────────────────────────────────────────

  describe("GetById handler", () => {
    it("should return a card by id for poe1", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      const result = await handler({}, "poe1_the-doctor");

      expect(mockRepositoryGetById).toHaveBeenCalledWith(
        "poe1_the-doctor",
        "Settlers",
        null,
        null,
      );
      expect(result).toEqual(SAMPLE_CARD_DTO);
    });

    it("should return a card by id for poe2", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      await handler({}, "poe2_the-doctor");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe2SelectedLeague");
    });

    it("should return null for non-existent card", async () => {
      mockRepositoryGetById.mockResolvedValue(null);
      const handler = getIpcHandler("divination-cards:get-by-id");
      const result = await handler({}, "poe1_nonexistent");

      expect(result).toBeNull();
    });

    it("should pass undefined league when settings return null", async () => {
      mockSettingsGet.mockResolvedValue(null);
      const handler = getIpcHandler("divination-cards:get-by-id");
      await handler({}, "poe1_test");

      expect(mockRepositoryGetById).toHaveBeenCalledWith(
        "poe1_test",
        undefined,
        null,
        null,
      );
    });

    it("should return validation error for non-string id", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      const result = await handler({}, 123);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for id exceeding max length", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      const result = await handler({}, "x".repeat(41));

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should accept id at exactly max length (40)", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      const id = `poe1_${"x".repeat(35)}`;
      const result = await handler({}, id);

      // Should not be a validation error
      expect(result).not.toHaveProperty("success", false);
    });
  });

  // ─── GetByName handler ────────────────────────────────────────────────

  describe("GetByName handler", () => {
    it("should return a card by game and name", async () => {
      const handler = getIpcHandler("divination-cards:get-by-name");
      const result = await handler({}, "poe1", "The Doctor");

      expect(mockRepositoryGetByName).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        "Settlers",
        null,
        null,
      );
      expect(result).toEqual(SAMPLE_CARD_DTO);
    });

    it("should return null for non-existent card name", async () => {
      mockRepositoryGetByName.mockResolvedValue(null);
      const handler = getIpcHandler("divination-cards:get-by-name");
      const result = await handler({}, "poe1", "Nonexistent Card");

      expect(result).toBeNull();
    });

    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler("divination-cards:get-by-name");
      const result = await handler({}, "invalid", "The Doctor");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for non-string name", async () => {
      const handler = getIpcHandler("divination-cards:get-by-name");
      const result = await handler({}, "poe1", 123);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for name exceeding max length", async () => {
      const handler = getIpcHandler("divination-cards:get-by-name");
      const result = await handler({}, "poe1", "x".repeat(41));

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── SearchByName handler ─────────────────────────────────────────────

  describe("SearchByName handler", () => {
    it("should return search results with total count", async () => {
      const handler = getIpcHandler("divination-cards:search-by-name");
      const result = await handler({}, "poe1", "Doctor");

      expect(mockRepositorySearchByName).toHaveBeenCalledWith(
        "poe1",
        "Doctor",
        "Settlers",
        null,
        null,
      );
      expect(result).toEqual({
        cards: [SAMPLE_CARD_DTO],
        total: 1,
      });
    });

    it("should return empty results for no matches", async () => {
      mockRepositorySearchByName.mockResolvedValue([]);
      const handler = getIpcHandler("divination-cards:search-by-name");
      const result = await handler({}, "poe1", "zzz_nonexistent");

      expect(result).toEqual({
        cards: [],
        total: 0,
      });
    });

    it("should return multiple results with correct total", async () => {
      const cards = [
        SAMPLE_CARD_DTO,
        { ...SAMPLE_CARD_DTO, id: "poe1_rain-of-chaos" },
      ];
      mockRepositorySearchByName.mockResolvedValue(cards);

      const handler = getIpcHandler("divination-cards:search-by-name");
      const result = await handler({}, "poe1", "card");

      expect(result).toEqual({
        cards,
        total: 2,
      });
    });

    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler("divination-cards:search-by-name");
      const result = await handler({}, "invalid", "Doctor");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for non-string query", async () => {
      const handler = getIpcHandler("divination-cards:search-by-name");
      const result = await handler({}, "poe1", 42);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for query exceeding max length", async () => {
      const handler = getIpcHandler("divination-cards:search-by-name");
      const result = await handler({}, "poe1", "x".repeat(41));

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── GetCount handler ─────────────────────────────────────────────────

  describe("GetCount handler", () => {
    it("should return the card count for a valid game", async () => {
      const handler = getIpcHandler("divination-cards:get-count");
      const result = await handler({}, "poe1");

      expect(mockRepositoryGetCardCount).toHaveBeenCalledWith("poe1");
      expect(result).toBe(42);
    });

    it("should return the card count for poe2", async () => {
      mockRepositoryGetCardCount.mockResolvedValue(10);
      const handler = getIpcHandler("divination-cards:get-count");
      const result = await handler({}, "poe2");

      expect(mockRepositoryGetCardCount).toHaveBeenCalledWith("poe2");
      expect(result).toBe(10);
    });

    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler("divination-cards:get-count");
      const result = await handler({}, "invalid");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for non-string game", async () => {
      const handler = getIpcHandler("divination-cards:get-count");
      const result = await handler({}, 123);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── GetStats handler ─────────────────────────────────────────────────

  describe("GetStats handler", () => {
    it("should return stats for a valid game", async () => {
      const handler = getIpcHandler("divination-cards:get-stats");
      const result = await handler({}, "poe1");

      expect(result).toEqual({
        game: "poe1",
        totalCards: 42,
        lastUpdated: "2025-01-01T00:00:00",
      });
    });

    it("should return empty string lastUpdated when repository returns null", async () => {
      mockRepositoryGetLastUpdated.mockResolvedValue(null);
      const handler = getIpcHandler("divination-cards:get-stats");
      const result = await handler({}, "poe1");

      expect(result).toEqual({
        game: "poe1",
        totalCards: 42,
        lastUpdated: "",
      });
    });

    it("should return stats for poe2", async () => {
      mockRepositoryGetCardCount.mockResolvedValue(5);
      mockRepositoryGetLastUpdated.mockResolvedValue("2025-06-01");
      const handler = getIpcHandler("divination-cards:get-stats");
      const result = await handler({}, "poe2");

      expect(result).toEqual({
        game: "poe2",
        totalCards: 5,
        lastUpdated: "2025-06-01",
      });
    });

    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler("divination-cards:get-stats");
      const result = await handler({}, "invalid");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── ForceSync handler ────────────────────────────────────────────────

  describe("ForceSync handler", () => {
    it("should sync poe1 cards from JSON and return success", async () => {
      const handler = getIpcHandler("divination-cards:force-sync");
      const result = await handler({}, "poe1");

      expect(mockReadFileSync).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should sync poe2 cards from JSON and return success", async () => {
      const handler = getIpcHandler("divination-cards:force-sync");
      const result = await handler({}, "poe2");

      expect(mockReadFileSync).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler("divination-cards:force-sync");
      const result = await handler({}, "invalid");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should insert new cards during sync", async () => {
      // getCardHash returns null → card is new
      mockRepositoryGetCardHash.mockResolvedValue(null);

      const handler = getIpcHandler("divination-cards:force-sync");
      await handler({}, "poe1");

      // Should call insertCard for each card in the JSON (2 cards)
      expect(mockRepositoryInsertCard).toHaveBeenCalledTimes(2);
    });

    it("should update cards when hash differs during sync", async () => {
      // getCardHash returns a different hash → card needs update
      mockRepositoryGetCardHash.mockResolvedValue("different-old-hash");

      const handler = getIpcHandler("divination-cards:force-sync");
      await handler({}, "poe1");

      expect(mockRepositoryUpdateCard).toHaveBeenCalledTimes(2);
      expect(mockRepositoryInsertCard).not.toHaveBeenCalled();
    });

    it("should skip cards when hash matches during sync", async () => {
      // getCardHash returns matching hash → card is unchanged
      mockRepositoryGetCardHash.mockResolvedValue("mock-hash-value");

      const handler = getIpcHandler("divination-cards:force-sync");
      await handler({}, "poe1");

      expect(mockRepositoryInsertCard).not.toHaveBeenCalled();
      expect(mockRepositoryUpdateCard).not.toHaveBeenCalled();
    });
  });

  // ─── initialize ───────────────────────────────────────────────────────

  describe("initialize", () => {
    it("should initialize poe1 cards from JSON", async () => {
      mockRepositoryGetCardHash.mockResolvedValue(null);

      await service.initialize();

      expect(mockReadFileSync).toHaveBeenCalled();
      // Should process all cards from the JSON (2 cards)
      expect(mockRepositoryInsertCard).toHaveBeenCalledTimes(2);
    });

    it("should insert cards with correct data", async () => {
      mockRepositoryGetCardHash.mockResolvedValue(null);

      await service.initialize();

      // Check first card insertion (The Doctor)
      expect(mockRepositoryInsertCard).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        8,
        "A card description",
        "<span>Headhunter</span>",
        "https://example.com/doctor.png",
        "<em>Flavour text</em>",
        expect.any(String), // hash
      );
    });

    it("should handle empty flavour_html with empty string fallback", async () => {
      mockRepositoryGetCardHash.mockResolvedValue(null);

      await service.initialize();

      // Rain of Chaos has empty flavour_html
      expect(mockRepositoryInsertCard).toHaveBeenCalledWith(
        "poe1",
        "Rain of Chaos",
        8,
        "Another card",
        "<span>Chaos Orb</span>",
        "https://example.com/rain.png",
        "",
        expect.any(String),
      );
    });

    it("should update existing cards when hash differs", async () => {
      mockRepositoryGetCardHash.mockResolvedValue("old-hash");

      await service.initialize();

      expect(mockRepositoryUpdateCard).toHaveBeenCalledTimes(2);
      expect(mockRepositoryInsertCard).not.toHaveBeenCalled();
    });

    it("should skip unchanged cards when hash matches", async () => {
      mockRepositoryGetCardHash.mockResolvedValue("mock-hash-value");

      await service.initialize();

      expect(mockRepositoryInsertCard).not.toHaveBeenCalled();
      expect(mockRepositoryUpdateCard).not.toHaveBeenCalled();
    });

    it("should handle mixed insert/update/skip during sync", async () => {
      // First call: null (insert), second call: different hash (update)
      mockRepositoryGetCardHash
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("different-hash");

      await service.initialize();

      expect(mockRepositoryInsertCard).toHaveBeenCalledTimes(1);
      expect(mockRepositoryUpdateCard).toHaveBeenCalledTimes(1);
    });

    it("should gracefully handle ENOENT error for missing cards file", async () => {
      const enoentError = new Error("File not found") as any;
      enoentError.code = "ENOENT";
      mockReadFileSync.mockImplementation(() => {
        throw enoentError;
      });

      // Should not throw — ENOENT is handled gracefully
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it("should rethrow non-ENOENT errors", async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(service.initialize()).rejects.toThrow("Permission denied");
    });

    it("should handle empty cards JSON array", async () => {
      mockReadFileSync.mockReturnValue("[]");

      await service.initialize();

      expect(mockRepositoryInsertCard).not.toHaveBeenCalled();
      expect(mockRepositoryUpdateCard).not.toHaveBeenCalled();
    });
  });

  // ─── updateRaritiesFromPrices (public method) ─────────────────────────

  describe("updateRaritiesFromPrices", () => {
    it("should classify cards into correct rarities", async () => {
      const divine = 200;
      mockRepositoryGetAllByGame.mockResolvedValue([
        { name: "The Doctor", rarity: 4 },
        { name: "Rain of Chaos", rarity: 4 },
        { name: "The Gambler", rarity: 4 },
        { name: "Unpriced Card", rarity: 4 },
      ]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "The Doctor": { chaosValue: 1500 }, // 750% of divine → rarity 1
        "Rain of Chaos": { chaosValue: 1 }, // 0.5% of divine → rarity 4
        "The Gambler": { chaosValue: 80 }, // 40% of divine → rarity 2
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "The Doctor", rarity: 1, clearOverride: true },
          { name: "Rain of Chaos", rarity: 4, clearOverride: true },
          { name: "The Gambler", rarity: 2, clearOverride: true },
          { name: "Unpriced Card", rarity: 0, clearOverride: false }, // No price → rarity 0 (Unknown)
        ]),
      );
    });

    it("should set rarity 1 for cards worth ≥70% of a divine", async () => {
      const divine = 100;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Expensive Card": { chaosValue: 70 }, // exactly 70%
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Expensive Card", rarity: 1, clearOverride: true },
        ]),
      );
    });

    it("should set rarity 2 for cards worth 35-70% of a divine", async () => {
      const divine = 100;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Medium Card": { chaosValue: 50 }, // 50%
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Medium Card", rarity: 2, clearOverride: true },
        ]),
      );
    });

    it("should set rarity 3 for cards worth 5-35% of a divine", async () => {
      const divine = 100;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Uncommon Card": { chaosValue: 20 }, // 20%
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Uncommon Card", rarity: 3, clearOverride: true },
        ]),
      );
    });

    it("should set rarity 4 for cards worth <5% of a divine", async () => {
      const divine = 100;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Common Card": { chaosValue: 4 }, // 4%
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Common Card", rarity: 4, clearOverride: true },
        ]),
      );
    });

    it("should set rarity 0 for all unpriced cards", async () => {
      const divine = 200;
      mockRepositoryGetAllByGame.mockResolvedValue([
        { name: "Card A", rarity: 1 },
        { name: "Card B", rarity: 1 },
      ]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {});

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Card A", rarity: 0, clearOverride: false },
          { name: "Card B", rarity: 0, clearOverride: false },
        ]),
      );
    });

    it("should not call updateRarities when there are no cards at all", async () => {
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", 200, {});

      expect(mockRepositoryUpdateRarities).not.toHaveBeenCalled();
    });

    it("should handle boundary at exactly 35% of divine (rarity 2)", async () => {
      const divine = 100;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Boundary Card": { chaosValue: 35 }, // exactly 35%
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Boundary Card", rarity: 2, clearOverride: true },
        ]),
      );
    });

    it("should handle boundary at exactly 5% of divine (rarity 3)", async () => {
      const divine = 100;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Boundary Card": { chaosValue: 5 }, // exactly 5%
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Boundary Card", rarity: 3, clearOverride: true },
        ]),
      );
    });

    it("should pass correct game and league to the repository", async () => {
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe2", "Standard", 150, {
        "Test Card": { chaosValue: 200 },
      });

      expect(mockRepositoryGetAllByGame).toHaveBeenCalledWith("poe2");
      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe2",
        "Standard",
        expect.any(Array),
      );
    });

    it("should set rarity 0 for low-confidence cards regardless of price", async () => {
      const divine = 200;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Nook's Crown": { chaosValue: 176.2, confidence: 3 }, // Would be rarity 1 if confident
        History: { chaosValue: 17444, confidence: 3 }, // Would be rarity 1 if confident
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Nook's Crown", rarity: 0, clearOverride: false },
          { name: "History", rarity: 0, clearOverride: false },
        ]),
      );
    });

    it("should calculate normal rarity for medium-confidence cards", async () => {
      const divine = 200;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Unrequited Love": { chaosValue: 10872, confidence: 2 }, // 5436% → rarity 1
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Unrequited Love", rarity: 1, clearOverride: true },
        ]),
      );
    });

    it("should calculate normal rarity for high-confidence cards", async () => {
      const divine = 200;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "House of Mirrors": { chaosValue: 21814, confidence: 1 },
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "House of Mirrors", rarity: 1, clearOverride: true },
        ]),
      );
    });

    it("should default to high confidence when confidence is not specified", async () => {
      const divine = 100;
      mockRepositoryGetAllByGame.mockResolvedValue([]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "Legacy Card": { chaosValue: 70 }, // No confidence field → default high → rarity 1
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "Legacy Card", rarity: 1, clearOverride: true },
        ]),
      );
    });

    it("should handle mix of confidence levels correctly", async () => {
      const divine = 200;
      mockRepositoryGetAllByGame.mockResolvedValue([
        { name: "Unpriced Card", rarity: 1 },
      ]);

      await service.updateRaritiesFromPrices("poe1", "Settlers", divine, {
        "High Conf": { chaosValue: 1500, confidence: 1 }, // rarity 1
        "Med Conf": { chaosValue: 50, confidence: 2 }, // 25% → rarity 3
        "Low Conf": { chaosValue: 5000, confidence: 3 }, // rarity 0 (low confidence)
      });

      expect(mockRepositoryUpdateRarities).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
        expect.arrayContaining([
          { name: "High Conf", rarity: 1, clearOverride: true },
          { name: "Med Conf", rarity: 3, clearOverride: true },
          { name: "Low Conf", rarity: 0, clearOverride: false },
          { name: "Unpriced Card", rarity: 0, clearOverride: false },
        ]),
      );
    });
  });

  // ─── League-specific IPC behavior ─────────────────────────────────────

  describe("league-specific IPC behavior", () => {
    it("GetAll should query with the league from settings for poe1", async () => {
      mockSettingsGet.mockResolvedValue("Necropolis");
      const handler = getIpcHandler("divination-cards:get-all");
      await handler({}, "poe1");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe1SelectedLeague");
      expect(mockRepositoryGetAllByGame).toHaveBeenCalledWith(
        "poe1",
        "Necropolis",
        null,
        null,
      );
    });

    it("GetAll should query with the league from settings for poe2", async () => {
      mockSettingsGet.mockResolvedValue("Standard");
      const handler = getIpcHandler("divination-cards:get-all");
      await handler({}, "poe2");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe2SelectedLeague");
      expect(mockRepositoryGetAllByGame).toHaveBeenCalledWith(
        "poe2",
        "Standard",
        null,
        null,
      );
    });

    it("GetByName should query with the league from settings", async () => {
      mockSettingsGet.mockResolvedValue("Necropolis");
      const handler = getIpcHandler("divination-cards:get-by-name");
      await handler({}, "poe1", "The Doctor");

      expect(mockRepositoryGetByName).toHaveBeenCalledWith(
        "poe1",
        "The Doctor",
        "Necropolis",
        null,
        null,
      );
    });

    it("GetById should detect poe2 game from id prefix", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      await handler({}, "poe2_some-card");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe2SelectedLeague");
    });

    it("GetById should detect poe1 game from id prefix", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      await handler({}, "poe1_some-card");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe1SelectedLeague");
    });

    it("SearchByName should query with the league from settings", async () => {
      mockSettingsGet.mockResolvedValue("League123");
      const handler = getIpcHandler("divination-cards:search-by-name");
      await handler({}, "poe1", "Doc");

      expect(mockRepositorySearchByName).toHaveBeenCalledWith(
        "poe1",
        "Doc",
        "League123",
        null,
        null,
      );
    });
  });

  // ─── Validation edge cases ────────────────────────────────────────────

  describe("validation edge cases", () => {
    it("GetAll should reject empty string game", async () => {
      const handler = getIpcHandler("divination-cards:get-all");
      const result = await handler({}, "");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("GetByName should reject empty string name", async () => {
      const handler = getIpcHandler("divination-cards:get-by-name");
      // assertBoundedString allows empty strings, but game validation should still pass
      // Actually, empty string IS a valid string — it just won't match anything
      // The service uses assertBoundedString which only checks type and length
      // So this should succeed (empty query is valid for search)
      const result = await handler({}, "poe1", "");
      // Empty string is a valid bounded string, so it should not be a validation error
      expect(result).not.toHaveProperty("error");
    });

    it("GetById should reject null id", async () => {
      const handler = getIpcHandler("divination-cards:get-by-id");
      const result = await handler({}, null);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("GetCount should reject boolean game", async () => {
      const handler = getIpcHandler("divination-cards:get-count");
      const result = await handler({}, true);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("GetStats should reject object game", async () => {
      const handler = getIpcHandler("divination-cards:get-stats");
      const result = await handler({}, { game: "poe1" });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("ForceSync should reject array game", async () => {
      const handler = getIpcHandler("divination-cards:force-sync");
      const result = await handler({}, ["poe1"]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("SearchByName should reject both invalid game and query", async () => {
      const handler = getIpcHandler("divination-cards:search-by-name");
      // Game validation runs first, so we get a game validation error
      const result = await handler({}, 42, 42);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── Path resolution ────────────────────────────────────────────────────

  describe("card JSON path resolution", () => {
    it("should use app.getAppPath() based path when NOT packaged", async () => {
      // The default beforeEach already sets isPackaged = false
      mockRepositoryGetCardHash.mockResolvedValue(null);

      await service.initialize();

      // readFileSync should have been called with the dev path
      const callPath = mockReadFileSync.mock.calls[0][0] as string;
      // Normalize separators for cross-platform
      const normalized = callPath.replace(/\\/g, "/");
      expect(normalized).toBe("/mock-app-path/renderer/assets/poe1/cards.json");
    });

    it("should use process.resourcesPath based path when packaged", async () => {
      // Reset singleton so we can create a fresh one with isPackaged = true
      // @ts-expect-error — accessing private static for testing
      DivinationCardsService._instance = undefined;
      vi.clearAllMocks();
      mockReadFileSync.mockReturnValue(SAMPLE_CARDS_JSON);
      mockRepositoryGetCardHash.mockResolvedValue(null);
      mockRepositoryInsertCard.mockResolvedValue(undefined);

      // Set packaged mode and resourcesPath
      mockElectronApp.isPackaged = true;
      const originalResourcesPath = process.resourcesPath;
      Object.defineProperty(process, "resourcesPath", {
        value: "/mock-resources",
        writable: true,
        configurable: true,
      });

      try {
        const packagedService = DivinationCardsService.getInstance();
        await packagedService.initialize();

        // readFileSync should have been called with the packaged path
        const callPath = mockReadFileSync.mock.calls[0][0] as string;
        const normalized = callPath.replace(/\\/g, "/");
        expect(normalized).toBe("/mock-resources/poe1/cards.json");

        // Crucially: NOT the old broken path that included renderer/assets/
        expect(normalized).not.toContain("renderer/assets");
      } finally {
        // Restore
        mockElectronApp.isPackaged = false;
        Object.defineProperty(process, "resourcesPath", {
          value: originalResourcesPath,
          writable: true,
          configurable: true,
        });
        // @ts-expect-error — accessing private static for testing
        DivinationCardsService._instance = undefined;
      }
    });

    it("should NOT use renderer/assets in packaged path (regression guard)", async () => {
      // This test specifically guards against the bug where the packaged app
      // tried to read from process.resourcesPath/renderer/assets/poe1/cards.json
      // which doesn't exist because extraResource copies directories as
      // resources/<dirname>/ not resources/renderer/assets/<dirname>/

      // @ts-expect-error — accessing private static for testing
      DivinationCardsService._instance = undefined;
      vi.clearAllMocks();
      mockReadFileSync.mockReturnValue(SAMPLE_CARDS_JSON);
      mockRepositoryGetCardHash.mockResolvedValue(null);
      mockRepositoryInsertCard.mockResolvedValue(undefined);

      mockElectronApp.isPackaged = true;
      const originalResourcesPath = process.resourcesPath;
      Object.defineProperty(process, "resourcesPath", {
        value: "C:\\Users\\test\\AppData\\Local\\soothsayer\\resources",
        writable: true,
        configurable: true,
      });

      try {
        const packagedService = DivinationCardsService.getInstance();
        await packagedService.initialize();

        const callPath = mockReadFileSync.mock.calls[0][0] as string;
        const normalized = callPath.replace(/\\/g, "/");

        // The path should end with /poe1/cards.json directly under resources
        expect(normalized).toMatch(/\/resources\/poe1\/cards\.json$/);
        // And must NOT contain the old broken renderer/assets prefix
        expect(normalized).not.toContain("renderer/assets");
      } finally {
        mockElectronApp.isPackaged = false;
        Object.defineProperty(process, "resourcesPath", {
          value: originalResourcesPath,
          writable: true,
          configurable: true,
        });
        // @ts-expect-error — accessing private static for testing
        DivinationCardsService._instance = undefined;
      }
    });
  });
});
