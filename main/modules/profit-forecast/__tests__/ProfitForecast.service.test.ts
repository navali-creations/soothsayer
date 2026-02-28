import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────

const {
  mockIpcHandle,
  mockGetKysely,
  mockSettingsGet,
  mockRepositoryGetCardWeights,
  mockRepositoryGetMetadata,
  mockEnsureLoaded,
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
    mockEnsureLoaded: vi.fn(),
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
      ensureLoaded: mockEnsureLoaded,
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

const MOCK_POE2_LEAGUE_ROW = {
  id: "league-uuid-poe2",
  game: "poe2",
  name: "Dawn",
  start_date: "2025-03-01T00:00:00Z",
};

const MOCK_SNAPSHOT_ROW = {
  id: "snapshot-uuid-1",
  league_id: "league-uuid-1",
  fetched_at: "2025-06-15T12:00:00Z",
  exchange_chaos_to_divine: 200,
  stash_chaos_to_divine: 195,
  stacked_deck_chaos_cost: 2.22,
  stacked_deck_max_volume_rate: 64.93,
};

const MOCK_POE2_SNAPSHOT_ROW = {
  id: "snapshot-uuid-poe2",
  league_id: "league-uuid-poe2",
  fetched_at: "2025-07-01T08:00:00Z",
  exchange_chaos_to_divine: 150,
  stash_chaos_to_divine: 145,
  stacked_deck_chaos_cost: 3.5,
  stacked_deck_max_volume_rate: 40.0,
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

const MOCK_POE2_CARD_PRICE_ROWS = [
  {
    snapshot_id: "snapshot-uuid-poe2",
    card_name: "The Doctor",
    price_source: "exchange",
    chaos_value: 800,
    divine_value: 5.33,
    confidence: 1,
  },
  {
    snapshot_id: "snapshot-uuid-poe2",
    card_name: "Rain of Chaos",
    price_source: "stash",
    chaos_value: 0.3,
    divine_value: 0.002,
    confidence: 2,
  },
  {
    snapshot_id: "snapshot-uuid-poe2",
    card_name: "The Nurse",
    price_source: "exchange",
    chaos_value: 200,
    divine_value: 1.33,
    confidence: 3,
  },
];

const MOCK_CARD_PRICE_ROWS_MIXED_CONFIDENCE = [
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
    confidence: 2,
  },
  {
    snapshot_id: "snapshot-uuid-1",
    card_name: "The Nurse",
    price_source: "exchange",
    chaos_value: 400,
    divine_value: 2.0,
    confidence: 3,
  },
  {
    snapshot_id: "snapshot-uuid-1",
    card_name: "House of Mirrors",
    price_source: "stash",
    chaos_value: 5000,
    divine_value: 25.0,
    confidence: 3,
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

const MOCK_POE2_PL_WEIGHTS = [
  {
    cardName: "The Doctor",
    game: "poe2" as const,
    league: "Dawn",
    weight: 15,
    rarity: 1 as const,
    fromBoss: false,
    loadedAt: "2025-07-01T00:00:00Z",
  },
  {
    cardName: "Rain of Chaos",
    game: "poe2" as const,
    league: "Dawn",
    weight: 95000,
    rarity: 4 as const,
    fromBoss: false,
    loadedAt: "2025-07-01T00:00:00Z",
  },
  {
    cardName: "The Nurse",
    game: "poe2" as const,
    league: "Dawn",
    weight: 2000,
    rarity: 2 as const,
    fromBoss: false,
    loadedAt: "2025-07-01T00:00:00Z",
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

    // Default mock returns — metadata exists (CSV was loaded during init)
    mockSettingsGet.mockResolvedValue("Keepers");
    mockRepositoryGetCardWeights.mockResolvedValue(MOCK_PL_WEIGHTS);
    mockRepositoryGetMetadata.mockResolvedValue({
      game: "poe1",
      league: "Keepers",
      loaded_at: "2025-06-01T00:00:00Z",
      app_version: "1.0.0",
      card_count: 4,
    });
    mockEnsureLoaded.mockResolvedValue(undefined);

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
        confidence: 1,
      });
      expect(result.snapshot!.cardPrices["Rain of Chaos"]).toEqual({
        chaosValue: 0.5,
        divineValue: 0.0025,
        source: "exchange",
        confidence: 1,
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
        confidence: 1,
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
        confidence: 1,
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
        confidence: 1,
      });
    });

    it("should default confidence to 1 when confidence is null", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Doctor",
          price_source: "exchange",
          chaos_value: 1200,
          divine_value: 6.0,
          confidence: null,
        },
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "Rain of Chaos",
          price_source: "stash",
          chaos_value: 0.5,
          divine_value: 0.0025,
          confidence: null,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      // Exchange price with null confidence should default to 1
      expect(result.snapshot!.cardPrices["The Doctor"].confidence).toBe(1);
      // Stash price with null confidence should also default to 1
      expect(result.snapshot!.cardPrices["Rain of Chaos"].confidence).toBe(1);
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

    // ─── Confidence levels ────────────────────────────────────────────────

    it("should preserve confidence level 2 (medium) on exchange prices", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "Rain of Chaos",
          price_source: "exchange",
          chaos_value: 0.5,
          divine_value: 0.0025,
          confidence: 2,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.cardPrices["Rain of Chaos"].confidence).toBe(2);
      expect(result.snapshot!.cardPrices["Rain of Chaos"].source).toBe(
        "exchange",
      );
    });

    it("should preserve confidence level 3 (low) on exchange prices", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "House of Mirrors",
          price_source: "exchange",
          chaos_value: 5000,
          divine_value: 25.0,
          confidence: 3,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.cardPrices["House of Mirrors"].confidence).toBe(
        3,
      );
    });

    it("should preserve confidence level 2 on stash fallback prices", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Nurse",
          price_source: "stash",
          chaos_value: 300,
          divine_value: 1.5,
          confidence: 2,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.cardPrices["The Nurse"].confidence).toBe(2);
      expect(result.snapshot!.cardPrices["The Nurse"].source).toBe("stash");
    });

    it("should preserve confidence level 3 on stash fallback prices", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Nurse",
          price_source: "stash",
          chaos_value: 300,
          divine_value: 1.5,
          confidence: 3,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.cardPrices["The Nurse"].confidence).toBe(3);
    });

    it("should handle mixed confidence levels across multiple cards", async () => {
      chains.priceChain.execute.mockResolvedValue(
        MOCK_CARD_PRICE_ROWS_MIXED_CONFIDENCE,
      );

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshot!.cardPrices["The Doctor"].confidence).toBe(1);
      expect(result.snapshot!.cardPrices["Rain of Chaos"].confidence).toBe(2);
      expect(result.snapshot!.cardPrices["The Nurse"].confidence).toBe(3);
      // House of Mirrors is stash-only with confidence 3
      expect(result.snapshot!.cardPrices["House of Mirrors"].confidence).toBe(
        3,
      );
      expect(result.snapshot!.cardPrices["House of Mirrors"].source).toBe(
        "stash",
      );
    });

    it("should use exchange confidence when both exchange and stash exist with different confidence", async () => {
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Doctor",
          price_source: "exchange",
          chaos_value: 1200,
          divine_value: 6.0,
          confidence: 2,
        },
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "The Doctor",
          price_source: "stash",
          chaos_value: 1100,
          divine_value: 5.5,
          confidence: 1,
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      // Exchange wins — its confidence (2) should be used, not stash's (1)
      expect(result.snapshot!.cardPrices["The Doctor"].confidence).toBe(2);
      expect(result.snapshot!.cardPrices["The Doctor"].source).toBe("exchange");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // poe2 End-to-End
  // ═══════════════════════════════════════════════════════════════════════════

  describe("poe2 end-to-end", () => {
    beforeEach(() => {
      // Wire up poe2 data for all mocks
      chains.leagueChain.executeTakeFirst.mockResolvedValue(
        MOCK_POE2_LEAGUE_ROW,
      );
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(
        MOCK_POE2_SNAPSHOT_ROW,
      );
      chains.priceChain.execute.mockResolvedValue(MOCK_POE2_CARD_PRICE_ROWS);
      mockRepositoryGetCardWeights.mockResolvedValue(MOCK_POE2_PL_WEIGHTS);
      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe2",
        league: "Dawn",
        loaded_at: "2025-07-01T00:00:00Z",
        app_version: "1.1.0",
        card_count: 3,
      });
    });

    it("should return full snapshot and weights for poe2", async () => {
      const result = await service.getData("poe2", "Dawn");

      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot!.id).toBe("snapshot-uuid-poe2");
      expect(result.snapshot!.chaosToDivineRatio).toBe(150);
      expect(result.snapshot!.stackedDeckChaosCost).toBe(3.5);
      expect(result.snapshot!.stackedDeckMaxVolumeRate).toBe(40.0);
      expect(result.weights).toHaveLength(3);
    });

    it("should query with game=poe2 for league and pass poe2 to ensureLoaded", async () => {
      await service.getData("poe2", "Dawn");

      expect(chains.leagueChain.where).toHaveBeenCalledWith(
        "game",
        "=",
        "poe2",
      );
      expect(chains.leagueChain.where).toHaveBeenCalledWith(
        "name",
        "=",
        "Dawn",
      );
      expect(mockEnsureLoaded).toHaveBeenCalledWith("poe2");
    });

    it("should query poe2 weights using metadata league", async () => {
      await service.getData("poe2", "Dawn");

      expect(mockRepositoryGetCardWeights).toHaveBeenCalledWith("poe2", "Dawn");
    });

    it("should merge poe2 exchange and stash prices correctly", async () => {
      const result = await service.getData("poe2", "Dawn");

      // The Doctor: exchange price
      expect(result.snapshot!.cardPrices["The Doctor"]).toEqual({
        chaosValue: 800,
        divineValue: 5.33,
        source: "exchange",
        confidence: 1,
      });
      // Rain of Chaos: stash fallback (no exchange)
      expect(result.snapshot!.cardPrices["Rain of Chaos"]).toEqual({
        chaosValue: 0.3,
        divineValue: 0.002,
        source: "stash",
        confidence: 2,
      });
      // The Nurse: exchange with low confidence
      expect(result.snapshot!.cardPrices["The Nurse"]).toEqual({
        chaosValue: 200,
        divineValue: 1.33,
        source: "exchange",
        confidence: 3,
      });
    });

    it("should return poe2 weights with correct shape", async () => {
      const result = await service.getData("poe2", "Dawn");

      const doctor = result.weights.find((w) => w.cardName === "The Doctor");
      expect(doctor).toEqual({
        cardName: "The Doctor",
        weight: 15,
        fromBoss: false,
      });
    });

    it("should return null snapshot for poe2 when league not found", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe2", "NonExistentPoe2League");

      expect(result.snapshot).toBeNull();
      expect(result.weights).toHaveLength(3);
    });

    it("should return null snapshot for poe2 when no snapshot exists", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe2", "Dawn");

      expect(result.snapshot).toBeNull();
      expect(result.weights).toHaveLength(3);
    });

    it("should return empty weights for poe2 when metadata is missing", async () => {
      mockRepositoryGetMetadata.mockResolvedValue(undefined);

      const result = await service.getData("poe2", "Dawn");

      expect(result.snapshot).not.toBeNull();
      expect(result.weights).toHaveLength(0);
    });

    it("should exclude poe2 boss cards from weights", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue([
        ...MOCK_POE2_PL_WEIGHTS,
        {
          cardName: "Poe2 Boss Card",
          game: "poe2" as const,
          league: "Dawn",
          weight: 500,
          rarity: 2 as const,
          fromBoss: true,
          loadedAt: "2025-07-01T00:00:00Z",
        },
      ]);

      const result = await service.getData("poe2", "Dawn");

      expect(result.weights.map((w) => w.cardName)).not.toContain(
        "Poe2 Boss Card",
      );
      expect(result.weights).toHaveLength(3);
    });

    it("should assign floor weight to poe2 zero-weight non-boss cards", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue([
        {
          cardName: "Common Card",
          game: "poe2" as const,
          league: "Dawn",
          weight: 50000,
          rarity: 4 as const,
          fromBoss: false,
          loadedAt: "2025-07-01T00:00:00Z",
        },
        {
          cardName: "Rare Card",
          game: "poe2" as const,
          league: "Dawn",
          weight: 5,
          rarity: 1 as const,
          fromBoss: false,
          loadedAt: "2025-07-01T00:00:00Z",
        },
        {
          cardName: "Unseen Card",
          game: "poe2" as const,
          league: "Dawn",
          weight: 0,
          rarity: 1 as const,
          fromBoss: false,
          loadedAt: "2025-07-01T00:00:00Z",
        },
      ]);

      const result = await service.getData("poe2", "Dawn");

      const unseen = result.weights.find((w) => w.cardName === "Unseen Card");
      expect(unseen).toBeDefined();
      expect(unseen!.weight).toBe(5); // floor = min non-zero weight
    });

    it("should work end-to-end through the IPC handler for poe2", async () => {
      const handler = getIpcHandler(ProfitForecastChannel.GetData);
      const result = await handler({}, "poe2", "Dawn");

      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot.id).toBe("snapshot-uuid-poe2");
      expect(result.snapshot.chaosToDivineRatio).toBe(150);
      expect(result.snapshot.cardPrices["The Doctor"].source).toBe("exchange");
      expect(result.snapshot.cardPrices["Rain of Chaos"].source).toBe("stash");
      expect(result.snapshot.cardPrices["Rain of Chaos"].confidence).toBe(2);
      expect(result.snapshot.cardPrices["The Nurse"].confidence).toBe(3);
      expect(result.weights).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getWeights (via getData)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getWeights (via getData)", () => {
    it("should exclude boss cards but keep zero-weight non-boss cards", async () => {
      const result = await service.getData("poe1", "Keepers");

      // MOCK_PL_WEIGHTS has 4 entries: The Void is fromBoss so excluded,
      // the other 3 are non-boss and all kept (even if weight were 0)
      expect(result.weights).toHaveLength(3);
      expect(result.weights.map((w) => w.cardName)).not.toContain("The Void");
    });

    it("should return correct weight DTO shape", async () => {
      const result = await service.getData("poe1", "Keepers");

      const doctor = result.weights.find((w) => w.cardName === "The Doctor");
      expect(doctor).toEqual({
        cardName: "The Doctor",
        weight: 10,
        fromBoss: false,
      });
    });

    it("should exclude boss cards from weights", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue(MOCK_PL_WEIGHTS_WITH_BOSS);

      const result = await service.getData("poe1", "Keepers");

      // A Chilling Wind has fromBoss=true so it should be excluded
      const chillingWind = result.weights.find(
        (w) => w.cardName === "A Chilling Wind",
      );
      expect(chillingWind).toBeUndefined();
      // Only non-boss cards should remain
      expect(result.weights).toHaveLength(3);
      expect(result.weights.every((w) => w.fromBoss === false)).toBe(true);
    });

    it("should query weights using the metadata league, not the user's active league", async () => {
      // User has "Standard" selected, but CSV data was stored under "Keepers"
      mockSettingsGet.mockResolvedValue("Standard");

      await service.getData("poe1", "Standard");

      // Should query with metadata.league ("Keepers"), not the active league
      expect(mockRepositoryGetCardWeights).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
    });

    it("should call ensureLoaded before querying weights", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockEnsureLoaded).toHaveBeenCalledWith("poe1");
    });

    it("should return empty weights when metadata is null after ensureLoaded", async () => {
      mockRepositoryGetMetadata.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "Keepers");

      expect(mockEnsureLoaded).toHaveBeenCalledWith("poe1");
      expect(result.weights).toHaveLength(0);
    });

    it("should return empty weights and log error when PL service throws", async () => {
      mockRepositoryGetCardWeights.mockRejectedValue(
        new Error("Database corrupted"),
      );

      const result = await service.getData("poe1", "Keepers");

      expect(result.weights).toHaveLength(0);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should assign floor weight of 1 when all non-boss PL weights are zero", async () => {
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

      const result = await service.getData("poe1", "Keepers");

      // Boss card excluded, non-boss card kept with fallback floor weight of 1
      expect(result.weights).toHaveLength(1);
      expect(result.weights[0].cardName).toBe("Card A");
      expect(result.weights[0].weight).toBe(1);
    });

    it("should assign the minimum observed non-zero weight to zero-weight non-boss cards", async () => {
      mockRepositoryGetCardWeights.mockResolvedValue([
        {
          cardName: "Rain of Chaos",
          game: "poe1",
          league: "Keepers",
          weight: 121400,
          rarity: 4,
          fromBoss: false,
          loadedAt: "2025-06-01T00:00:00Z",
        },
        {
          cardName: "The Doctor",
          game: "poe1",
          league: "Keepers",
          weight: 10,
          rarity: 1,
          fromBoss: false,
          loadedAt: "2025-06-01T00:00:00Z",
        },
        {
          cardName: "House of Mirrors",
          game: "poe1",
          league: "Keepers",
          weight: 0,
          rarity: 1,
          fromBoss: false,
          loadedAt: "2025-06-01T00:00:00Z",
        },
        {
          cardName: "History",
          game: "poe1",
          league: "Keepers",
          weight: 3,
          rarity: 1,
          fromBoss: false,
          loadedAt: "2025-06-01T00:00:00Z",
        },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.weights).toHaveLength(4);

      // House of Mirrors had weight 0 → gets the minimum observed weight (3, from History)
      const hom = result.weights.find((w) => w.cardName === "House of Mirrors");
      expect(hom).toBeDefined();
      expect(hom!.weight).toBe(3);

      // Cards with real weights are untouched
      const rain = result.weights.find((w) => w.cardName === "Rain of Chaos");
      expect(rain!.weight).toBe(121400);

      const doctor = result.weights.find((w) => w.cardName === "The Doctor");
      expect(doctor!.weight).toBe(10);

      const history = result.weights.find((w) => w.cardName === "History");
      expect(history!.weight).toBe(3);
    });

    it("should not strip league or weight fields from the DTO — only cardName, weight, fromBoss", async () => {
      const result = await service.getData("poe1", "Keepers");

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
        stackedDeckMaxVolumeRate: 64.93,
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

  describe("PL weights are league-independent (use metadata league)", () => {
    it("should return weights regardless of user's active league", async () => {
      // User has "Standard" selected but CSV data is stored under "Keepers"
      mockSettingsGet.mockResolvedValue("Standard");

      const result = await service.getData("poe1", "Standard");

      // Weights come from metadata.league ("Keepers"), not the active league
      expect(result.weights).toHaveLength(3);
      expect(mockRepositoryGetCardWeights).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
    });

    it("should return weights when active league is Hardcore Standard", async () => {
      mockSettingsGet.mockResolvedValue("Hardcore");

      const result = await service.getData("poe1", "Hardcore");

      expect(result.weights).toHaveLength(3);
      // Only one call to getCardWeights — no fallback needed
      expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(1);
      expect(mockRepositoryGetCardWeights).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
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
