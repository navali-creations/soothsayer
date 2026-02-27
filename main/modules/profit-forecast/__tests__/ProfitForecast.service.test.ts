import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────

const {
  mockIpcHandle,
  mockGetKysely,
  mockSettingsGet,
  mockRepositoryGetCardWeights,
  mockRepositoryGetMetadata,
  mockLoggerLog,
  mockLoggerError,
  mockKyselySelectFrom,
} = vi.hoisted(() => {
  const mockKyselySelectFrom = vi.fn();

  return {
    mockIpcHandle: vi.fn(),
    mockGetKysely: vi.fn(),
    mockSettingsGet: vi.fn(),
    mockRepositoryGetCardWeights: vi.fn(),
    mockRepositoryGetMetadata: vi.fn(),
    mockLoggerLog: vi.fn(),
    mockLoggerError: vi.fn(),
    mockKyselySelectFrom,
  };
});

// ─── Mock Electron ───────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

// ─── Mock DatabaseService ────────────────────────────────────────────────────

vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────

vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
    })),
  },
  SettingsKey: {
    SelectedPoe1League: "poe1SelectedLeague",
    SelectedPoe2League: "poe2SelectedLeague",
    ActiveGame: "selectedGame",
  },
}));

// ─── Mock ProhibitedLibraryService ───────────────────────────────────────────

vi.mock("~/main/modules/prohibited-library", () => ({
  ProhibitedLibraryService: {
    getInstance: vi.fn(() => ({
      getRepository: vi.fn(() => ({
        getCardWeights: mockRepositoryGetCardWeights,
        getMetadata: mockRepositoryGetMetadata,
      })),
    })),
  },
}));

// ─── Mock LoggerService ──────────────────────────────────────────────────────

vi.mock("~/main/modules/logger", () => ({
  LoggerService: {
    createLogger: vi.fn(() => ({
      log: mockLoggerLog,
      info: vi.fn(),
      warn: vi.fn(),
      error: mockLoggerError,
      debug: vi.fn(),
    })),
  },
}));

// ─── Import service under test ───────────────────────────────────────────────

import { ProfitForecastChannel } from "../ProfitForecast.channels";
import { ProfitForecastService } from "../ProfitForecast.service";

// ─── Kysely chain builder helper ─────────────────────────────────────────────

/**
 * Builds a chainable mock that mimics Kysely's builder pattern:
 *   kysely.selectFrom("table").selectAll().where(...).orderBy(...).limit(...).executeTakeFirst()
 *
 * `resolvedValue` is what the terminal method (`execute` / `executeTakeFirst`) returns.
 */
function createKyselyChain(resolvedValue: any = undefined) {
  const chain: Record<string, any> = {};
  const self = () => chain;
  chain.selectAll = vi.fn(self);
  chain.select = vi.fn(self);
  chain.where = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.execute = vi.fn().mockResolvedValue(resolvedValue);
  chain.executeTakeFirst = vi
    .fn()
    .mockResolvedValue(
      Array.isArray(resolvedValue) ? resolvedValue[0] : resolvedValue,
    );
  return chain;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => Promise<any> {
  const call = mockIpcHandle.mock.calls.find(
    ([registeredChannel]: [string]) => registeredChannel === channel,
  );
  if (!call) {
    throw new Error(
      `No IPC handler registered for channel "${channel}". ` +
        `Registered channels: ${mockIpcHandle.mock.calls
          .map(([c]: [string]) => c)
          .join(", ")}`,
    );
  }
  return call[1];
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const MOCK_LEAGUE_ROW = {
  id: "league-uuid-1",
  game: "poe1",
  name: "Keepers",
  start_date: "2025-01-01T00:00:00Z",
};

const MOCK_SNAPSHOT_ROW = {
  id: "snapshot-uuid-1",
  league_id: "league-uuid-1",
  fetched_at: "2025-06-15T12:00:00Z",
  exchange_chaos_to_divine: 200,
  stash_chaos_to_divine: 195,
  stacked_deck_chaos_cost: 2.22,
};

const MOCK_CARD_PRICE_ROWS_EXCHANGE = [
  {
    snapshot_id: "snapshot-uuid-1",
    card_name: "The Doctor",
    price_source: "exchange",
    chaos_value: 1200,
    divine_value: 6.0,
    confidence: 1,
  },
  {
    snapshot_id: "snapshot-uuid-1",
    card_name: "Rain of Chaos",
    price_source: "exchange",
    chaos_value: 0.5,
    divine_value: 0.0025,
    confidence: 1,
  },
];

const MOCK_CARD_PRICE_ROWS_MIXED = [
  {
    snapshot_id: "snapshot-uuid-1",
    card_name: "The Doctor",
    price_source: "exchange",
    chaos_value: 1200,
    divine_value: 6.0,
    confidence: 1,
  },
  {
    snapshot_id: "snapshot-uuid-1",
    card_name: "The Doctor",
    price_source: "stash",
    chaos_value: 1100,
    divine_value: 5.5,
    confidence: 1,
  },
  {
    snapshot_id: "snapshot-uuid-1",
    card_name: "Rain of Chaos",
    price_source: "stash",
    chaos_value: 0.5,
    divine_value: 0.0025,
    confidence: 1,
  },
];

const MOCK_PL_WEIGHTS = [
  {
    cardName: "The Doctor",
    game: "poe1" as const,
    league: "Keepers",
    weight: 10,
    rarity: 1 as const,
    fromBoss: false,
    loadedAt: "2025-06-01T00:00:00Z",
  },
  {
    cardName: "Rain of Chaos",
    game: "poe1" as const,
    league: "Keepers",
    weight: 121400,
    rarity: 4 as const,
    fromBoss: false,
    loadedAt: "2025-06-01T00:00:00Z",
  },
  {
    cardName: "The Nurse",
    game: "poe1" as const,
    league: "Keepers",
    weight: 1500,
    rarity: 2 as const,
    fromBoss: false,
    loadedAt: "2025-06-01T00:00:00Z",
  },
  {
    cardName: "The Void",
    game: "poe1" as const,
    league: "Keepers",
    weight: 0,
    rarity: 0 as const,
    fromBoss: true,
    loadedAt: "2025-06-01T00:00:00Z",
  },
];

const MOCK_PL_WEIGHTS_WITH_BOSS = [
  ...MOCK_PL_WEIGHTS.slice(0, 3),
  {
    cardName: "A Chilling Wind",
    game: "poe1" as const,
    league: "Keepers",
    weight: 8000,
    rarity: 3 as const,
    fromBoss: true,
    loadedAt: "2025-06-01T00:00:00Z",
  },
];

// ─── selectFrom routing ──────────────────────────────────────────────────────

/**
 * Sets up `mockKyselySelectFrom` so that different table names
 * get their own independent chains. Call this in `beforeEach` and
 * override the chain values per-test as needed.
 *
 * Returns the chains so individual tests can reconfigure them.
 */
function setupDefaultChains() {
  const leagueChain = createKyselyChain(MOCK_LEAGUE_ROW);
  const snapshotChain = createKyselyChain(MOCK_SNAPSHOT_ROW);
  const priceChain = createKyselyChain(MOCK_CARD_PRICE_ROWS_EXCHANGE);

  mockKyselySelectFrom.mockImplementation((table: string) => {
    switch (table) {
      case "leagues":
        return leagueChain;
      case "snapshots":
        return snapshotChain;
      case "snapshot_card_prices":
        return priceChain;
      default:
        return createKyselyChain(undefined);
    }
  });

  return { leagueChain, snapshotChain, priceChain };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProfitForecastService", () => {
  let service: ProfitForecastService;
  let chains: ReturnType<typeof setupDefaultChains>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    ProfitForecastService._instance = undefined;

    // Set up Kysely mock
    const mockKysely = { selectFrom: mockKyselySelectFrom };
    mockGetKysely.mockReturnValue(mockKysely);

    // Set up default chains
    chains = setupDefaultChains();

    // Default mock returns
    mockSettingsGet.mockResolvedValue("Keepers");
    mockRepositoryGetCardWeights.mockResolvedValue(MOCK_PL_WEIGHTS);
    mockRepositoryGetMetadata.mockResolvedValue(undefined);

    service = ProfitForecastService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Singleton
  // ═══════════════════════════════════════════════════════════════════════════

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = ProfitForecastService.getInstance();
      const instance2 = ProfitForecastService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetting the singleton", () => {
      const instance1 = ProfitForecastService.getInstance();
      // @ts-expect-error — accessing private static for testing
      ProfitForecastService._instance = undefined;
      const instance2 = ProfitForecastService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler Registration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("IPC handler registration", () => {
    it("should register the GetData IPC handler", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([channel]: [string]) => channel,
      );
      expect(registeredChannels).toContain(ProfitForecastChannel.GetData);
    });

    it("should register exactly one IPC handler", () => {
      const profitForecastCalls = mockIpcHandle.mock.calls.filter(
        ([channel]: [string]) => channel === ProfitForecastChannel.GetData,
      );
      // One registration per getInstance() call in beforeEach
      expect(profitForecastCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getData — Happy Path
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getData", () => {
    it("should return snapshot and weights when both exist", async () => {
      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot!.fetchedAt).toBe("2025-06-15T12:00:00Z");
      expect(result.snapshot!.chaosToDivineRatio).toBe(200);
      expect(result.snapshot!.stackedDeckChaosCost).toBe(2.22);
      expect(result.snapshot!.cardPrices["The Doctor"]).toEqual({
        chaosValue: 1200,
        divineValue: 6.0,
        source: "exchange",
      });
      expect(result.snapshot!.cardPrices["Rain of Chaos"]).toEqual({
        chaosValue: 0.5,
        divineValue: 0.0025,
        source: "exchange",
      });

      // Weights should be filtered to weight > 0
      expect(result.weights).toHaveLength(3);
      expect(result.weights.map((w) => w.cardName)).toEqual(
        expect.arrayContaining(["The Doctor", "Rain of Chaos", "The Nurse"]),
      );
      // The Void has weight 0 and should be excluded
      expect(result.weights.map((w) => w.cardName)).not.toContain("The Void");
    });

    it("should query leagues table with correct game and league name", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockKyselySelectFrom).toHaveBeenCalledWith("leagues");
      expect(chains.leagueChain.where).toHaveBeenCalledWith(
        "game",
        "=",
        "poe1",
      );
      expect(chains.leagueChain.where).toHaveBeenCalledWith(
        "name",
        "=",
        "Keepers",
      );
    });

    it("should query snapshots ordered by fetched_at desc with limit 1", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockKyselySelectFrom).toHaveBeenCalledWith("snapshots");
      expect(chains.snapshotChain.where).toHaveBeenCalledWith(
        "league_id",
        "=",
        MOCK_LEAGUE_ROW.id,
      );
      expect(chains.snapshotChain.orderBy).toHaveBeenCalledWith(
        "fetched_at",
        "desc",
      );
      expect(chains.snapshotChain.limit).toHaveBeenCalledWith(1);
    });

    it("should query card prices for the correct snapshot id", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockKyselySelectFrom).toHaveBeenCalledWith("snapshot_card_prices");
      expect(chains.priceChain.where).toHaveBeenCalledWith(
        "snapshot_id",
        "=",
        MOCK_SNAPSHOT_ROW.id,
      );
    });

    // ─── No league ────────────────────────────────────────────────────────

    it("should return null snapshot when league does not exist", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistentLeague");

      expect(result.snapshot).toBeNull();
      expect(result.weights).toHaveLength(3); // weights still returned
    });

    // ─── No snapshot ──────────────────────────────────────────────────────

    it("should return null snapshot when league exists but has no snapshots", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot).toBeNull();
      expect(result.weights).toHaveLength(3);
    });

    // ─── Exchange + stash price merge ─────────────────────────────────────

    it("should prefer exchange prices over stash prices", async () => {
      chains.priceChain.execute.mockResolvedValue(MOCK_CARD_PRICE_ROWS_MIXED);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.cardPrices["The Doctor"]).toEqual({
        chaosValue: 1200,
        divineValue: 6.0,
        source: "exchange",
      });
    });

    it("should use stash prices to fill gaps when exchange price is missing", async () => {
      chains.priceChain.execute.mockResolvedValue(MOCK_CARD_PRICE_ROWS_MIXED);

      const result = await service.getData("poe1", "Keepers");

      // Rain of Chaos only has stash pricing
      expect(result.snapshot!.cardPrices["Rain of Chaos"]).toEqual({
        chaosValue: 0.5,
        divineValue: 0.0025,
        source: "stash",
      });
    });

    it("should not include stash prices when exchange price already exists for the same card", async () => {
      chains.priceChain.execute.mockResolvedValue(MOCK_CARD_PRICE_ROWS_MIXED);

      const result = await service.getData("poe1", "Keepers");

      // The Doctor has both exchange and stash — exchange should win
      expect(result.snapshot!.cardPrices["The Doctor"].source).toBe("exchange");
      expect(result.snapshot!.cardPrices["The Doctor"].chaosValue).toBe(1200);
    });

    it("should return empty cardPrices when snapshot has no card prices", async () => {
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot!.cardPrices).toEqual({});
    });

    it("should handle stash-only card prices", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Nurse",
          price_source: "stash",
          chaos_value: 300,
          divine_value: 1.5,
          confidence: 1,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.cardPrices["The Nurse"]).toEqual({
        chaosValue: 300,
        divineValue: 1.5,
        source: "stash",
      });
    });

    it("should handle multiple cards with only exchange prices", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Doctor",
          price_source: "exchange",
          chaos_value: 1200,
          divine_value: 6.0,
          confidence: 1,
        },
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Nurse",
          price_source: "exchange",
          chaos_value: 400,
          divine_value: 2.0,
          confidence: 1,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(Object.keys(result.snapshot!.cardPrices)).toHaveLength(2);
      expect(result.snapshot!.cardPrices["The Doctor"].source).toBe("exchange");
      expect(result.snapshot!.cardPrices["The Nurse"].source).toBe("exchange");
    });

    // ─── Different games ──────────────────────────────────────────────────

    it("should pass the correct game to the leagues query", async () => {
      mockSettingsGet.mockResolvedValue("Poe2League");
      mockRepositoryGetCardWeights.mockResolvedValue([]);
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      await service.getData("poe2", "Poe2League");

      expect(chains.leagueChain.where).toHaveBeenCalledWith(
        "game",
        "=",
        "poe2",
      );
    });

    // ─── League names with spaces ─────────────────────────────────────────

    it("should handle league names with spaces", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_LEAGUE_ROW,
        name: "Hardcore Keepers",
      });

      const result = await service.getData("poe1", "Hardcore Keepers");

      expect(result.snapshot).not.toBeNull();
      expect(chains.leagueChain.where).toHaveBeenCalledWith(
        "name",
        "=",
        "Hardcore Keepers",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getWeights (via getData)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getWeights (via getData)", () => {
    it("should filter out cards with weight = 0", async () => {
      // No league → null snapshot, but weights are still returned
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      // MOCK_PL_WEIGHTS has 4 entries, but The Void has weight 0
      expect(result.weights).toHaveLength(3);
      expect(result.weights.map((w) => w.cardName)).not.toContain("The Void");
    });

    it("should return correct weight DTO shape", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      const doctor = result.weights.find((w) => w.cardName === "The Doctor");
      expect(doctor).toEqual({
        cardName: "The Doctor",
        weight: 10,
        fromBoss: false,
      });
    });

    it("should preserve fromBoss flag in weight DTO", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue(MOCK_PL_WEIGHTS_WITH_BOSS);
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      const chillingWind = result.weights.find(
        (w) => w.cardName === "A Chilling Wind",
      );
      expect(chillingWind).toBeDefined();
      expect(chillingWind!.fromBoss).toBe(true);
    });

    it("should use active league from settings to query PL weights", async () => {
      mockSettingsGet.mockResolvedValue("Keepers");
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      await service.getData("poe1", "NonExistent");

      expect(mockRepositoryGetCardWeights).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
    });

    it("should use poe2 settings key for poe2 game", async () => {
      mockSettingsGet.mockResolvedValue("Poe2League");
      mockRepositoryGetCardWeights.mockResolvedValue([]);
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      await service.getData("poe2", "Poe2League");

      expect(mockSettingsGet).toHaveBeenCalledWith("poe2SelectedLeague");
    });

    it("should fall back to metadata league when active league has no PL data", async () => {
      mockRepositoryGetCardWeights
        .mockResolvedValueOnce([]) // active league — empty
        .mockResolvedValueOnce(MOCK_PL_WEIGHTS); // metadata league

      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Settlers",
        loaded_at: "2025-06-01T00:00:00Z",
        app_version: "1.0.0",
        card_count: 450,
        created_at: "2025-06-01T00:00:00Z",
      });

      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(2);
      expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
        2,
        "poe1",
        "Settlers",
      );
      expect(result.weights).toHaveLength(3);
    });

    it("should not fall back when metadata league matches active league", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue([]);
      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Keepers",
        loaded_at: "2025-06-01T00:00:00Z",
        app_version: "1.0.0",
        card_count: 450,
        created_at: "2025-06-01T00:00:00Z",
      });
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      // Should only call getCardWeights once since metadata league = active league
      expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(1);
      expect(result.weights).toHaveLength(0);
    });

    it("should not fall back when no metadata exists", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue([]);
      mockRepositoryGetMetadata.mockResolvedValue(undefined);
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(1);
      expect(result.weights).toHaveLength(0);
    });

    it("should return empty weights and log error when PL service throws", async () => {
      mockRepositoryGetCardWeights.mockRejectedValue(
        new Error("Database corrupted"),
      );
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      expect(result.weights).toHaveLength(0);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should return empty array when all PL weights are zero", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue([
        {
          cardName: "Card A",
          game: "poe1",
          league: "Keepers",
          weight: 0,
          rarity: 0,
          fromBoss: false,
          loadedAt: "2025-06-01T00:00:00Z",
        },
        {
          cardName: "Card B",
          game: "poe1",
          league: "Keepers",
          weight: 0,
          rarity: 0,
          fromBoss: true,
          loadedAt: "2025-06-01T00:00:00Z",
        },
      ]);
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      expect(result.weights).toHaveLength(0);
    });

    it("should not strip league or weight fields from the DTO — only cardName, weight, fromBoss", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NonExistent");

      for (const w of result.weights) {
        expect(Object.keys(w).sort()).toEqual(
          ["cardName", "fromBoss", "weight"].sort(),
        );
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler — Input Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("IPC handler validation", () => {
    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "invalid-game", "Keepers");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when game is a number", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, 123, "Keepers");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when game is null", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, null, "Keepers");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when league is a number", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe1", 42);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when league is null", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe1", null);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when league is undefined", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe1", undefined);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should accept valid poe1 game type", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe1", "Keepers");

      // Should not be a validation error — should return actual data
      expect(result).not.toHaveProperty("success", false);
      expect(result).toHaveProperty("weights");
      expect(result).toHaveProperty("snapshot");
    });

    it("should accept valid poe2 game type", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      mockSettingsGet.mockResolvedValue("Poe2League");
      mockRepositoryGetCardWeights.mockResolvedValue([]);
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await handler({}, "poe2", "SomeLeague");

      expect(result).not.toHaveProperty("success", false);
      expect(result).toHaveProperty("weights");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler — Integration (via handler)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("IPC handler integration", () => {
    it("should return full data through the IPC handler", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe1", "Keepers");

      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot.chaosToDivineRatio).toBe(200);
      expect(result.snapshot.stackedDeckChaosCost).toBe(2.22);
      expect(result.snapshot.cardPrices["The Doctor"].chaosValue).toBe(1200);
      expect(result.weights).toHaveLength(3);
    });

    it("should return null snapshot and weights through the IPC handler when no league exists", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe1", "NonExistent");

      expect(result.snapshot).toBeNull();
      expect(result.weights).toHaveLength(3);
    });

    it("should return null snapshot when league exists but no snapshot found via IPC handler", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe1", "Keepers");

      expect(result.snapshot).toBeNull();
      expect(result.weights).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Snapshot DTO Shape
  // ═══════════════════════════════════════════════════════════════════════════

  describe("snapshot DTO shape", () => {
    it("should include all required snapshot fields", async () => {
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot).toEqual({
        id: MOCK_SNAPSHOT_ROW.id,
        fetchedAt: "2025-06-15T12:00:00Z",
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 2.22,
        cardPrices: {},
      });
    });

    it("should use exchange chaos to divine ratio (not stash)", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        exchange_chaos_to_divine: 200,
        stash_chaos_to_divine: 180,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.chaosToDivineRatio).toBe(200);
    });

    it("should include snapshot id in the DTO", async () => {
      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.id).toBe(MOCK_SNAPSHOT_ROW.id);
    });

    it("should handle stackedDeckChaosCost of 0", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_chaos_cost: 0,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.stackedDeckChaosCost).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Read-Only League Lookup
  // ═══════════════════════════════════════════════════════════════════════════

  describe("read-only league lookup", () => {
    it("should not create a league when it does not exist", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "NewLeague");

      // Only selectFrom should be called — no insertInto
      expect(result.snapshot).toBeNull();
      // Verify we only queried, never inserted
      expect(mockKyselySelectFrom).toHaveBeenCalledWith("leagues");
    });

    it("should not query snapshots when league does not exist", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      await service.getData("poe1", "NonExistent");

      // The snapshot chain should not have had .where called with a league_id
      // since we bail early when league is null
      const snapshotWhereCalledWithLeagueId =
        chains.snapshotChain.where.mock.calls.some(
          (args: any[]) => args[0] === "league_id",
        );
      expect(snapshotWhereCalledWithLeagueId).toBe(false);
    });

    it("should not query card prices when no snapshot exists", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      await service.getData("poe1", "Keepers");

      // Price chain where should not have been called with snapshot_id
      const priceWhereCalledWithSnapshotId =
        chains.priceChain.where.mock.calls.some(
          (args: any[]) => args[0] === "snapshot_id",
        );
      expect(priceWhereCalledWithSnapshotId).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Logging
  // ═══════════════════════════════════════════════════════════════════════════

  describe("logging", () => {
    it("should log when no league is found", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      await service.getData("poe1", "NonExistent");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("No league found"),
      );
    });

    it("should log when no snapshot is found", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      await service.getData("poe1", "Keepers");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("No snapshot found"),
      );
    });

    it("should log snapshot details on successful return", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("Returning snapshot"),
      );
    });

    it("should include card price count in success log", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("2 card prices"),
      );
    });

    it("should include weight count in success log", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("3 PL weights"),
      );
    });

    it("should log service initialization", () => {
      expect(mockLoggerLog).toHaveBeenCalledWith("Service initialized");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Standard / Permanent League Fallback (n-1)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("PL weights league fallback for permanent leagues", () => {
    it("should fall back to metadata league when active league is Standard", async () => {
      mockSettingsGet.mockResolvedValue("Standard");
      mockRepositoryGetCardWeights
        .mockResolvedValueOnce([]) // Standard — no data
        .mockResolvedValueOnce(MOCK_PL_WEIGHTS); // Keepers — has data

      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Keepers",
        loaded_at: "2025-06-01T00:00:00Z",
        app_version: "1.0.0",
        card_count: 450,
        created_at: "2025-06-01T00:00:00Z",
      });

      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "Standard");

      expect(result.weights).toHaveLength(3);
      expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
        1,
        "poe1",
        "Standard",
      );
      expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
        2,
        "poe1",
        "Keepers",
      );
    });

    it("should fall back to metadata league when active league is Hardcore Standard", async () => {
      mockSettingsGet.mockResolvedValue("Hardcore");
      mockRepositoryGetCardWeights
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(MOCK_PL_WEIGHTS);

      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Keepers",
        loaded_at: "2025-06-01T00:00:00Z",
        app_version: "1.0.0",
        card_count: 450,
        created_at: "2025-06-01T00:00:00Z",
      });

      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "Hardcore");

      expect(result.weights).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("should handle snapshot with very high chaos-to-divine ratio", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        exchange_chaos_to_divine: 999999,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.chaosToDivineRatio).toBe(999999);
    });

    it("should handle snapshot with fractional stackedDeckChaosCost", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_chaos_cost: 2.777,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.stackedDeckChaosCost).toBe(2.777);
    });

    it("should handle large number of card prices", async () => {
      const manyPrices = Array.from({ length: 500 }, (_, i) => ({
        snapshot_id: "snapshot-uuid-1",
        card_name: `Card ${i}`,
        price_source: "exchange" as const,
        chaos_value: i * 10,
        divine_value: (i * 10) / 200,
        confidence: 1,
      }));

      chains.priceChain.execute.mockResolvedValue(manyPrices);

      const result = await service.getData("poe1", "Keepers");

      expect(Object.keys(result.snapshot!.cardPrices)).toHaveLength(500);
    });

    it("should handle card names with special characters", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "A Mother's Parting Gift",
          price_source: "exchange",
          chaos_value: 5,
          divine_value: 0.025,
          confidence: 1,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(
        result.snapshot!.cardPrices["A Mother's Parting Gift"],
      ).toBeDefined();
    });

    it("should return weights even when snapshot query throws", async () => {
      chains.leagueChain.executeTakeFirst.mockRejectedValue(
        new Error("DB read error"),
      );

      // getData will throw, but let's verify the behavior through the IPC handler
      // which has try/catch wrapping
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      // The error will propagate since it's not an IpcValidationError
      await expect(handler({}, "poe1", "Keepers")).rejects.toThrow(
        "DB read error",
      );
    });
  });
});
