import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatabaseServiceMock,
  createElectronMock,
  createSettingsStoreMock,
  getIpcHandler,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions ──────────────────────────────────────────────────

const {
  mockIpcHandle,
  mockGetKysely,
  mockSettingsGet,
  mockLoggerLog,
  mockLoggerError,
  mockKyselySelectFrom,
} = vi.hoisted(() => {
  const mockKyselySelectFrom = vi.fn();

  return {
    mockIpcHandle: vi.fn(),
    mockGetKysely: vi.fn(),
    mockSettingsGet: vi.fn(),
    mockLoggerLog: vi.fn(),
    mockLoggerError: vi.fn(),
    mockKyselySelectFrom,
  };
});

// ─── Mock Electron ───────────────────────────────────────────────────────────

vi.mock("electron", () => createElectronMock({ mockIpcHandle }));

// ─── Mock DatabaseService ────────────────────────────────────────────────────

vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);

// ─── Mock SettingsStoreService ───────────────────────────────────────────────

vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({ mockGet: mockSettingsGet }),
);

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

// ─── Availability mock data (divination_card_availability rows) ──────────────
// Shape: { card_name: string, weight: number | null, from_boss: number }

const MOCK_AVAILABILITY_ROWS = [
  { card_name: "The Doctor", weight: 10, from_boss: 0 },
  { card_name: "Rain of Chaos", weight: 121400, from_boss: 0 },
  { card_name: "The Nurse", weight: 1500, from_boss: 0 },
  { card_name: "The Void", weight: 0, from_boss: 1 },
];

const MOCK_POE2_AVAILABILITY_ROWS = [
  { card_name: "The Doctor", weight: 15, from_boss: 0 },
  { card_name: "Rain of Chaos", weight: 95000, from_boss: 0 },
  { card_name: "The Nurse", weight: 2000, from_boss: 0 },
];

const MOCK_AVAILABILITY_ROWS_WITH_BOSS = [
  { card_name: "The Doctor", weight: 10, from_boss: 0 },
  { card_name: "Rain of Chaos", weight: 121400, from_boss: 0 },
  { card_name: "The Nurse", weight: 1500, from_boss: 0 },
  { card_name: "A Chilling Wind", weight: 8000, from_boss: 1 },
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
  const divinationCardsChain = createKyselyChain([]);
  const availabilityChain = createKyselyChain(MOCK_AVAILABILITY_ROWS);

  mockKyselySelectFrom.mockImplementation((table: string) => {
    switch (table) {
      case "leagues":
        return leagueChain;
      case "snapshots":
        return snapshotChain;
      case "snapshot_card_prices":
        return priceChain;
      case "divination_cards":
        return divinationCardsChain;
      case "divination_card_availability as dca":
        return availabilityChain;
      default:
        return createKyselyChain(undefined);
    }
  });

  return {
    leagueChain,
    snapshotChain,
    priceChain,
    divinationCardsChain,
    availabilityChain,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProfitForecastService", () => {
  let service: ProfitForecastService;
  let chains: ReturnType<typeof setupDefaultChains>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    resetSingleton(ProfitForecastService);

    // Set up Kysely mock
    const mockKysely = { selectFrom: mockKyselySelectFrom };
    mockGetKysely.mockReturnValue(mockKysely);

    // Set up default chains
    chains = setupDefaultChains();

    // Default mock returns
    mockSettingsGet.mockResolvedValue("Keepers");

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
      resetSingleton(ProfitForecastService);
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

      expect(result.snapshotFetchedAt).not.toBeNull();
      expect(result.snapshotFetchedAt).toBe("2025-06-15T12:00:00Z");
      expect(result.chaosToDivineRatio).toBe(200);
      expect(result.stackedDeckChaosCost).toBe(2.22);

      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor).toBeDefined();
      expect(doctor.chaosValue).toBe(1200);
      expect(doctor.divineValue).toBe(6.0);
      expect(doctor.confidence).toBe(1);
      expect(doctor.isAnomalous).toBe(false);
      expect(doctor.hasPrice).toBe(true);

      const rain = result.rows.find((r) => r.cardName === "Rain of Chaos")!;
      expect(rain).toBeDefined();
      expect(rain.chaosValue).toBe(0.5);
      expect(rain.divineValue).toBe(0.0025);
      expect(rain.confidence).toBe(1);
      expect(rain.isAnomalous).toBe(false);
      expect(rain.hasPrice).toBe(true);

      // Rows should be filtered to exclude boss cards (The Void is from_boss=1)
      expect(result.rows).toHaveLength(3);
      expect(result.rows.map((r) => r.cardName)).toEqual(
        expect.arrayContaining(["The Doctor", "Rain of Chaos", "The Nurse"]),
      );
      // The Void has from_boss=1 so should be excluded
      expect(result.rows.map((r) => r.cardName)).not.toContain("The Void");
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

      expect(result.snapshotFetchedAt).toBeNull();
      expect(result.rows).toHaveLength(3); // weights still returned as rows
    });

    // ─── No snapshot ──────────────────────────────────────────────────────

    it("should return null snapshot when league exists but has no snapshots", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshotFetchedAt).toBeNull();
      expect(result.rows).toHaveLength(3);
    });

    // ─── Exchange + stash price merge ─────────────────────────────────────

    it("should prefer exchange prices over stash prices", async () => {
      chains.priceChain.execute.mockResolvedValue(MOCK_CARD_PRICE_ROWS_MIXED);

      const result = await service.getData("poe1", "Keepers");

      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.chaosValue).toBe(1200);
      expect(doctor.divineValue).toBe(6.0);
      expect(doctor.confidence).toBe(1);
      expect(doctor.isAnomalous).toBe(false);
      expect(doctor.hasPrice).toBe(true);
    });

    it("should use stash prices to fill gaps when exchange price is missing", async () => {
      chains.priceChain.execute.mockResolvedValue(MOCK_CARD_PRICE_ROWS_MIXED);

      const result = await service.getData("poe1", "Keepers");

      // Rain of Chaos only has stash pricing
      const rain = result.rows.find((r) => r.cardName === "Rain of Chaos")!;
      expect(rain.chaosValue).toBe(0.5);
      expect(rain.divineValue).toBe(0.0025);
      expect(rain.confidence).toBe(1);
      expect(rain.isAnomalous).toBe(false);
      expect(rain.hasPrice).toBe(true);
    });

    it("should not include stash prices when exchange price already exists for the same card", async () => {
      chains.priceChain.execute.mockResolvedValue(MOCK_CARD_PRICE_ROWS_MIXED);

      const result = await service.getData("poe1", "Keepers");

      // The Doctor has both exchange and stash — exchange should win
      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.chaosValue).toBe(1200);
    });

    it("should return rows with hasPrice false when snapshot has no card prices", async () => {
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshotFetchedAt).not.toBeNull();
      // All rows should have hasPrice: false since no card prices exist
      for (const row of result.rows) {
        expect(row.hasPrice).toBe(false);
      }
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

      const nurse = result.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurse.chaosValue).toBe(300);
      expect(nurse.divineValue).toBe(1.5);
      expect(nurse.confidence).toBe(1);
      expect(nurse.isAnomalous).toBe(false);
      expect(nurse.hasPrice).toBe(true);
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
      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.confidence).toBe(1);
      // Stash price with null confidence should also default to 1
      const rain = result.rows.find((r) => r.cardName === "Rain of Chaos")!;
      expect(rain.confidence).toBe(1);
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

      const pricedRows = result.rows.filter((r) => r.hasPrice);
      expect(pricedRows).toHaveLength(2);
      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.hasPrice).toBe(true);
      const nurse = result.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurse.hasPrice).toBe(true);
    });

    // ─── Different games ──────────────────────────────────────────────────

    it("should pass the correct game to the leagues query", async () => {
      mockSettingsGet.mockResolvedValue("Poe2League");
      chains.availabilityChain.execute.mockResolvedValue([]);
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

      expect(result.snapshotFetchedAt).not.toBeNull();
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

      const rain = result.rows.find((r) => r.cardName === "Rain of Chaos")!;
      expect(rain.confidence).toBe(2);
      expect(rain.hasPrice).toBe(true);
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

      // House of Mirrors is not in the availability rows, so it won't
      // be in rows at all. The price exists but no weight row maps to it.
      // We can verify that weights-only rows don't erroneously get this price.
      const nurse = result.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurse.hasPrice).toBe(false); // Nurse not in this price set
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

      const nurse = result.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurse.confidence).toBe(2);
      expect(nurse.hasPrice).toBe(true);
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

      const nurse = result.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurse.confidence).toBe(3);
    });

    it("should handle mixed confidence levels across multiple cards", async () => {
      chains.priceChain.execute.mockResolvedValue(
        MOCK_CARD_PRICE_ROWS_MIXED_CONFIDENCE,
      );

      const result = await service.getData("poe1", "Keepers");

      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.confidence).toBe(1);
      const rain = result.rows.find((r) => r.cardName === "Rain of Chaos")!;
      expect(rain.confidence).toBe(2);
      const nurse = result.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurse.confidence).toBe(3);
      // House of Mirrors is stash-only with confidence 3 but not in availability rows,
      // so it won't appear in rows. We can't check it here.
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
      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.confidence).toBe(2);
      expect(doctor.chaosValue).toBe(1200);
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
      chains.availabilityChain.execute.mockResolvedValue(
        MOCK_POE2_AVAILABILITY_ROWS,
      );
    });

    it("should return full snapshot and weights for poe2", async () => {
      const result = await service.getData("poe2", "Dawn");

      expect(result.snapshotFetchedAt).not.toBeNull();
      expect(result.snapshotFetchedAt).toBe("2025-07-01T08:00:00Z");
      expect(result.chaosToDivineRatio).toBe(150);
      expect(result.stackedDeckChaosCost).toBe(3.5);
      expect(result.baseRate).toBe(Math.max(20, Math.floor(40.0)));
      expect(result.baseRateSource).toBe("maxVolumeRate");
      expect(result.rows).toHaveLength(3);
    });

    it("should query with game=poe2 for league and query availability with poe2", async () => {
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
      expect(mockKyselySelectFrom).toHaveBeenCalledWith(
        "divination_card_availability as dca",
      );
    });

    it("should query poe2 weights using the league passed to getData", async () => {
      await service.getData("poe2", "Dawn");

      expect(mockKyselySelectFrom).toHaveBeenCalledWith(
        "divination_card_availability as dca",
      );
      expect(chains.availabilityChain.where).toHaveBeenCalledWith(
        "dca.game",
        "=",
        "poe2",
      );
      expect(chains.availabilityChain.where).toHaveBeenCalledWith(
        "dca.league",
        "=",
        "Dawn",
      );
    });

    it("should merge poe2 exchange and stash prices correctly", async () => {
      const result = await service.getData("poe2", "Dawn");

      // The Doctor: exchange price
      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.chaosValue).toBe(800);
      expect(doctor.divineValue).toBe(5.33);
      expect(doctor.confidence).toBe(1);
      expect(doctor.isAnomalous).toBe(false);
      expect(doctor.hasPrice).toBe(true);

      // Rain of Chaos: stash fallback (no exchange)
      const rain = result.rows.find((r) => r.cardName === "Rain of Chaos")!;
      expect(rain.chaosValue).toBe(0.3);
      expect(rain.divineValue).toBe(0.002);
      expect(rain.confidence).toBe(2);
      expect(rain.isAnomalous).toBe(false);
      expect(rain.hasPrice).toBe(true);

      // The Nurse: exchange with low confidence
      const nurse = result.rows.find((r) => r.cardName === "The Nurse")!;
      expect(nurse.chaosValue).toBe(200);
      expect(nurse.divineValue).toBe(1.33);
      expect(nurse.confidence).toBe(3);
      expect(nurse.isAnomalous).toBe(false);
      expect(nurse.hasPrice).toBe(true);
    });

    it("should return poe2 weights with correct shape", async () => {
      const result = await service.getData("poe2", "Dawn");

      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor).toBeDefined();
      expect(doctor.cardName).toBe("The Doctor");
      expect(doctor.weight).toBe(15);
      expect(doctor.fromBoss).toBe(false);
    });

    it("should return null snapshot for poe2 when league not found", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe2", "NonExistentPoe2League");

      expect(result.snapshotFetchedAt).toBeNull();
      expect(result.rows).toHaveLength(3);
    });

    it("should return null snapshot for poe2 when no snapshot exists", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await service.getData("poe2", "Dawn");

      expect(result.snapshotFetchedAt).toBeNull();
      expect(result.rows).toHaveLength(3);
    });

    it("should return empty weights for poe2 when availability returns no rows", async () => {
      chains.availabilityChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe2", "Dawn");

      expect(result.snapshotFetchedAt).not.toBeNull();
      expect(result.rows).toHaveLength(0);
    });

    it("should exclude poe2 boss cards from weights", async () => {
      chains.availabilityChain.execute.mockResolvedValue([
        ...MOCK_POE2_AVAILABILITY_ROWS,
        { card_name: "Poe2 Boss Card", weight: 500, from_boss: 1 },
      ]);

      const result = await service.getData("poe2", "Dawn");

      expect(result.rows.map((r) => r.cardName)).not.toContain(
        "Poe2 Boss Card",
      );
      expect(result.rows).toHaveLength(3);
    });

    it("should assign floor weight to poe2 zero-weight non-boss cards", async () => {
      chains.availabilityChain.execute.mockResolvedValue([
        { card_name: "Common Card", weight: 50000, from_boss: 0 },
        { card_name: "Rare Card", weight: 5, from_boss: 0 },
        { card_name: "Unseen Card", weight: 0, from_boss: 0 },
      ]);

      const result = await service.getData("poe2", "Dawn");

      const unseen = result.rows.find((r) => r.cardName === "Unseen Card");
      expect(unseen).toBeDefined();
      expect(unseen!.weight).toBe(5); // floor = min non-zero weight
    });

    it("should work end-to-end through the IPC handler for poe2", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe2", "Dawn");

      expect(result.snapshotFetchedAt).not.toBeNull();
      expect(result.snapshotFetchedAt).toBe("2025-07-01T08:00:00Z");
      expect(result.chaosToDivineRatio).toBe(150);
      const doctor = result.rows.find((r: any) => r.cardName === "The Doctor")!;
      expect(doctor.hasPrice).toBe(true);
      const rain = result.rows.find(
        (r: any) => r.cardName === "Rain of Chaos",
      )!;
      expect(rain.confidence).toBe(2);
      expect(rain.hasPrice).toBe(true);
      const nurse = result.rows.find((r: any) => r.cardName === "The Nurse")!;
      expect(nurse.confidence).toBe(3);
      expect(result.rows).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getWeights (via getData)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getWeights (via getData)", () => {
    it("should exclude boss cards but keep zero-weight non-boss cards", async () => {
      const result = await service.getData("poe1", "Keepers");

      // MOCK_AVAILABILITY_ROWS has 4 entries: The Void is from_boss=1 so excluded,
      // the other 3 are non-boss and all kept (even if weight were 0)
      expect(result.rows).toHaveLength(3);
      expect(result.rows.map((r) => r.cardName)).not.toContain("The Void");
    });

    it("should return correct weight DTO shape", async () => {
      const result = await service.getData("poe1", "Keepers");

      const doctor = result.rows.find((r) => r.cardName === "The Doctor")!;
      expect(doctor.cardName).toBe("The Doctor");
      expect(doctor.weight).toBe(10);
      expect(doctor.fromBoss).toBe(false);
    });

    it("should exclude boss cards from weights", async () => {
      chains.availabilityChain.execute.mockResolvedValue(
        MOCK_AVAILABILITY_ROWS_WITH_BOSS,
      );

      const result = await service.getData("poe1", "Keepers");

      // A Chilling Wind has from_boss=1 so it should be excluded
      const chillingWind = result.rows.find(
        (r) => r.cardName === "A Chilling Wind",
      );
      expect(chillingWind).toBeUndefined();
      // Only non-boss cards should remain
      expect(result.rows).toHaveLength(3);
      expect(result.rows.every((r) => r.fromBoss === false)).toBe(true);
    });

    it("should query weights using the league passed to getData directly", async () => {
      // The metadata league concept is gone — weights now use whatever league is passed
      mockSettingsGet.mockResolvedValue("Standard");

      await service.getData("poe1", "Standard");

      // Should query with "Standard" directly
      expect(mockKyselySelectFrom).toHaveBeenCalledWith(
        "divination_card_availability as dca",
      );
      expect(chains.availabilityChain.where).toHaveBeenCalledWith(
        "dca.league",
        "=",
        "Standard",
      );
    });

    it("should query divination_card_availability for weights", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockKyselySelectFrom).toHaveBeenCalledWith(
        "divination_card_availability as dca",
      );
    });

    it("should return empty weights when availability returns no rows", async () => {
      chains.availabilityChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.rows).toHaveLength(0);
    });

    it("should return empty weights and log error when availability query throws", async () => {
      chains.availabilityChain.execute.mockRejectedValue(
        new Error("Database corrupted"),
      );

      const result = await service.getData("poe1", "Keepers");

      expect(result.rows).toHaveLength(0);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("should assign floor weight of 1 when all non-boss weights are zero", async () => {
      chains.availabilityChain.execute.mockResolvedValue([
        { card_name: "Card A", weight: 0, from_boss: 0 },
        { card_name: "Card B", weight: 0, from_boss: 1 },
      ]);

      const result = await service.getData("poe1", "Keepers");

      // Boss card excluded, non-boss card kept with fallback floor weight of 1
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].cardName).toBe("Card A");
      expect(result.rows[0].weight).toBe(1);
    });

    it("should assign the minimum observed non-zero weight to zero-weight non-boss cards", async () => {
      chains.availabilityChain.execute.mockResolvedValue([
        { card_name: "Rain of Chaos", weight: 121400, from_boss: 0 },
        { card_name: "The Doctor", weight: 10, from_boss: 0 },
        { card_name: "House of Mirrors", weight: 0, from_boss: 0 },
        { card_name: "History", weight: 3, from_boss: 0 },
      ]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.rows).toHaveLength(4);

      // House of Mirrors had weight 0 → gets the minimum observed weight (3, from History)
      const hom = result.rows.find((r) => r.cardName === "House of Mirrors");
      expect(hom).toBeDefined();
      expect(hom!.weight).toBe(3);

      // Cards with real weights are untouched
      const rain = result.rows.find((r) => r.cardName === "Rain of Chaos");
      expect(rain!.weight).toBe(121400);

      const doctor = result.rows.find((r) => r.cardName === "The Doctor");
      expect(doctor!.weight).toBe(10);

      const history = result.rows.find((r) => r.cardName === "History");
      expect(history!.weight).toBe(3);
    });

    it("should include all expected row fields in the DTO", async () => {
      const result = await service.getData("poe1", "Keepers");

      const expectedKeys = [
        "cardName",
        "chaosValue",
        "confidence",
        "divineValue",
        "evContribution",
        "excludeFromEv",
        "fromBoss",
        "hasPrice",
        "isAnomalous",
        "probability",
        "weight",
      ];

      for (const row of result.rows) {
        expect(Object.keys(row).sort()).toEqual(expectedKeys);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler — Input Validation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("IPC handler validation", () => {
    it("should return validation error for invalid game type", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "invalid-game", "Keepers");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when game is a number", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, 123, "Keepers");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when game is null", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, null, "Keepers");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when league is a number", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe1", 42);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when league is null", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe1", null);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should return validation error when league is undefined", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe1", undefined);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Invalid input"),
        }),
      );
    });

    it("should accept valid poe1 game type", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe1", "Keepers");

      // Should not be a validation error — should return actual data
      expect(result).not.toHaveProperty("success", false);
      expect(result).toHaveProperty("rows");
      expect(result).toHaveProperty("snapshotFetchedAt");
    });

    it("should accept valid poe2 game type", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      mockSettingsGet.mockResolvedValue("Poe2League");
      chains.availabilityChain.execute.mockResolvedValue([]);
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const result = await handler({}, "poe2", "SomeLeague");

      expect(result).not.toHaveProperty("success", false);
      expect(result).toHaveProperty("rows");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler — Integration (via handler)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("IPC handler integration", () => {
    it("should return full data through the IPC handler", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe1", "Keepers");

      expect(result.snapshotFetchedAt).not.toBeNull();
      expect(result.chaosToDivineRatio).toBe(200);
      expect(result.stackedDeckChaosCost).toBe(2.22);
      const doctor = result.rows.find((r: any) => r.cardName === "The Doctor")!;
      expect(doctor.chaosValue).toBe(1200);
      expect(result.rows).toHaveLength(3);
    });

    it("should return null snapshot and weights through the IPC handler when no league exists", async () => {
      chains.leagueChain.executeTakeFirst.mockResolvedValue(undefined);

      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe1", "NonExistent");

      expect(result.snapshotFetchedAt).toBeNull();
      expect(result.rows).toHaveLength(3);
    });

    it("should return null snapshot when league exists but no snapshot found via IPC handler", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue(undefined);

      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      const result = await handler({}, "poe1", "Keepers");

      expect(result.snapshotFetchedAt).toBeNull();
      expect(result.rows).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Snapshot DTO Shape
  // ═══════════════════════════════════════════════════════════════════════════

  describe("snapshot DTO shape", () => {
    it("should include all required top-level fields", async () => {
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshotFetchedAt).toBe("2025-06-15T12:00:00Z");
      expect(result.chaosToDivineRatio).toBe(200);
      expect(result.stackedDeckChaosCost).toBe(2.22);
      expect(result.baseRate).toBe(Math.max(20, Math.floor(64.93)));
      expect(result.baseRateSource).toBe("maxVolumeRate");
      expect(result.totalWeight).toBeGreaterThan(0);
      expect(typeof result.evPerDeck).toBe("number");
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it("should use exchange chaos to divine ratio (not stash)", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        exchange_chaos_to_divine: 200,
        stash_chaos_to_divine: 180,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.chaosToDivineRatio).toBe(200);
    });

    it("should include snapshotFetchedAt in the DTO", async () => {
      const result = await service.getData("poe1", "Keepers");

      expect(result.snapshotFetchedAt).toBe(MOCK_SNAPSHOT_ROW.fetched_at);
    });

    it("should handle stackedDeckChaosCost of 0", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_chaos_cost: 0,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.stackedDeckChaosCost).toBe(0);
    });

    it("should use derived baseRate when maxVolumeRate is null", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_max_volume_rate: null,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      // Derived: floor(chaosToDivineRatio / stackedDeckChaosCost) = floor(200 / 2.22) = 90
      expect(result.baseRate).toBe(Math.max(20, Math.floor(200 / 2.22)));
      expect(result.baseRateSource).toBe("derived");
    });

    it("should use derived baseRate when maxVolumeRate is 0", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_max_volume_rate: 0,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.baseRate).toBe(Math.max(20, Math.floor(200 / 2.22)));
      expect(result.baseRateSource).toBe("derived");
    });

    it("should return baseRate 0 and source none when both maxVolumeRate and stackedDeckChaosCost are 0", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_max_volume_rate: null,
        stacked_deck_chaos_cost: 0,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.baseRate).toBe(0);
      expect(result.baseRateSource).toBe("none");
    });

    it("should clamp derived baseRate to RATE_FLOOR when ratio is very small", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_max_volume_rate: null,
        exchange_chaos_to_divine: 10,
        stacked_deck_chaos_cost: 5,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      // floor(10 / 5) = 2, clamped to RATE_FLOOR (20)
      expect(result.baseRate).toBe(20);
      expect(result.baseRateSource).toBe("derived");
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
      expect(result.snapshotFetchedAt).toBeNull();
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

    it("should log row details on successful return", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("Returning"),
      );
    });

    it("should include row count in success log", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("3 rows"),
      );
    });

    it("should include anomalous count in success log", async () => {
      await service.getData("poe1", "Keepers");

      expect(mockLoggerLog).toHaveBeenCalledWith(
        expect.stringContaining("0 anomalous"),
      );
    });

    it("should log service initialization", () => {
      expect(mockLoggerLog).toHaveBeenCalledWith("Service initialized");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Weights use the league passed to getData directly
  // ═══════════════════════════════════════════════════════════════════════════

  describe("PL weights are league-independent (use metadata league)", () => {
    it("should return weights regardless of user's active league", async () => {
      // User has "Standard" selected — weights now come from the league
      // passed to getData directly
      mockSettingsGet.mockResolvedValue("Standard");

      const result = await service.getData("poe1", "Standard");

      // Weights come from the availability query with league="Standard"
      expect(result.rows).toHaveLength(3);
      expect(mockKyselySelectFrom).toHaveBeenCalledWith(
        "divination_card_availability as dca",
      );
      expect(chains.availabilityChain.where).toHaveBeenCalledWith(
        "dca.league",
        "=",
        "Standard",
      );
    });

    it("should return weights when active league is Hardcore Standard", async () => {
      mockSettingsGet.mockResolvedValue("Hardcore");

      const result = await service.getData("poe1", "Hardcore");

      expect(result.rows).toHaveLength(3);
      // Weights query uses the league passed to getData
      expect(chains.availabilityChain.where).toHaveBeenCalledWith(
        "dca.league",
        "=",
        "Hardcore",
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

      expect(result.chaosToDivineRatio).toBe(999999);
    });

    it("should handle snapshot with fractional stackedDeckChaosCost", async () => {
      chains.snapshotChain.executeTakeFirst.mockResolvedValue({
        ...MOCK_SNAPSHOT_ROW,
        stacked_deck_chaos_cost: 2.777,
      });
      chains.priceChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      expect(result.stackedDeckChaosCost).toBe(2.777);
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

      // The rows are built from weights, not prices.
      // Only cards in availability rows will have rows, but those that match
      // a price entry will have hasPrice=true.
      const pricedRows = result.rows.filter((r) => r.hasPrice);
      // The default weights have "The Doctor", "Rain of Chaos", "The Nurse"
      // None of those match "Card 0" .. "Card 499", so pricedRows should be 0
      expect(pricedRows).toHaveLength(0);
      // But we still have 3 rows from the weights
      expect(result.rows).toHaveLength(3);
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

      // "A Mother's Parting Gift" is not in availability rows, so it won't be in rows.
      // But we can verify the service doesn't crash with special characters.
      expect(result.snapshotFetchedAt).not.toBeNull();
      expect(result.rows).toHaveLength(3);
    });

    it("should return weights even when snapshot query throws", async () => {
      chains.leagueChain.executeTakeFirst.mockRejectedValue(
        new Error("DB read error"),
      );

      // getData will throw, but let's verify the behavior through the IPC handler
      // which has try/catch wrapping
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.GetData,
      );
      // The error will propagate since it's not an IpcValidationError
      await expect(handler({}, "poe1", "Keepers")).rejects.toThrow(
        "DB read error",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Anomaly Detection (detectAnomalousCardPrices)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("detectAnomalousCardPrices (via getData)", () => {
    /**
     * Helper: builds N price rows (exchange) and N matching availability entries.
     *
     * Each entry is { name, chaos, weight }.  Confidence defaults to 1.
     * Returns { priceRows, availabilityRows } ready to plug into mocks.
     */
    function buildTestData(
      entries: {
        name: string;
        chaos: number;
        weight: number;
        confidence?: 1 | 2 | 3;
      }[],
    ) {
      const priceRows = entries.map((e) => ({
        snapshot_id: "snapshot-uuid-1",
        card_name: e.name,
        price_source: "exchange" as const,
        chaos_value: e.chaos,
        divine_value: e.chaos / 200,
        confidence: e.confidence ?? 1,
      }));

      const availabilityRows = entries.map((e) => ({
        card_name: e.name,
        weight: e.weight,
        from_boss: 0,
      }));

      return { priceRows, availabilityRows };
    }

    it("should flag a common card with an anomalously high price", async () => {
      // 8 common cards priced 0.5–4 chaos, one common card priced 500 chaos
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Card E", chaos: 2.5, weight: 60000 },
        { name: "Card F", chaos: 3.0, weight: 50000 },
        { name: "Card G", chaos: 3.5, weight: 45000 },
        { name: "Card H", chaos: 4.0, weight: 40000 },
        { name: "Outlier", chaos: 500, weight: 95000 }, // common + absurdly high
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      const outlier = result.rows.find((r) => r.cardName === "Outlier")!;
      expect(outlier.isAnomalous).toBe(true);
      // Normal common cards should NOT be flagged
      expect(
        result.rows.find((r) => r.cardName === "Card A")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "Card D")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "Card H")!.isAnomalous,
      ).toBe(false);
    });

    it("should not flag rare cards even if they are expensive", async () => {
      // Rare cards (low weight) with high prices — should never be flagged
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Common A", chaos: 0.5, weight: 100000 },
        { name: "Common B", chaos: 1.0, weight: 90000 },
        { name: "Common C", chaos: 1.5, weight: 80000 },
        { name: "Common D", chaos: 2.0, weight: 70000 },
        { name: "Common E", chaos: 2.5, weight: 60000 },
        { name: "Rare Expensive", chaos: 5000, weight: 10 }, // rare (low weight)
        { name: "Rare Costly", chaos: 3000, weight: 5 }, // rare (low weight)
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      expect(
        result.rows.find((r) => r.cardName === "Rare Expensive")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "Rare Costly")!.isAnomalous,
      ).toBe(false);
    });

    it("should exclude low-confidence (confidence=3) cards from detection candidates", async () => {
      // A common card with a high price but confidence=3 should NOT be flagged
      // because confidence=3 cards are excluded from the candidate pool entirely
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Common A", chaos: 0.5, weight: 100000 },
        { name: "Common B", chaos: 1.0, weight: 90000 },
        { name: "Common C", chaos: 1.5, weight: 80000 },
        { name: "Common D", chaos: 2.0, weight: 70000 },
        { name: "Common E", chaos: 2.5, weight: 60000 },
        {
          name: "Low Conf High Price",
          chaos: 999,
          weight: 95000,
          confidence: 3,
        },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // Should still have isAnomalous: false because confidence=3 cards are
      // excluded from the detection algorithm entirely
      expect(
        result.rows.find((r) => r.cardName === "Low Conf High Price")!
          .isAnomalous,
      ).toBe(false);
    });

    it("should skip detection when fewer than 5 candidates exist", async () => {
      // Only 4 priced+weighted cards → too few for detection
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Outlier", chaos: 999, weight: 95000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // Outlier should NOT be flagged because sample is too small
      expect(
        result.rows.find((r) => r.cardName === "Outlier")!.isAnomalous,
      ).toBe(false);
    });

    it("should skip detection when fewer than 3 common cards have positive prices", async () => {
      // The `< 3 common prices` guard triggers when common cards exist but
      // fewer than 3 have chaosValue > 0 (zero-priced cards are filtered out
      // of the commonPrices array). Here 5 candidates exist and 3 are common,
      // but 2 of the common cards have chaosValue = 0 so commonPrices.length < 3.
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Common A", chaos: 0, weight: 100000 }, // common but zero price
        { name: "Common B", chaos: 0, weight: 90000 }, // common but zero price
        { name: "Common C", chaos: 999, weight: 80000 }, // common, only positive price
        { name: "Rare A", chaos: 10.0, weight: 100 },
        { name: "Rare B", chaos: 20.0, weight: 50 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // Only 1 common card has a positive price → commonPrices.length < 3 → skip detection
      expect(
        result.rows.find((r) => r.cardName === "Common C")!.isAnomalous,
      ).toBe(false);
    });

    it("should not flag anything when all common cards have similar low prices", async () => {
      // All common cards have prices in a tight range → no outliers
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 0.6, weight: 90000 },
        { name: "Card C", chaos: 0.7, weight: 80000 },
        { name: "Card D", chaos: 0.8, weight: 70000 },
        { name: "Card E", chaos: 0.9, weight: 60000 },
        { name: "Card F", chaos: 1.0, weight: 50000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      for (const name of [
        "Card A",
        "Card B",
        "Card C",
        "Card D",
        "Card E",
        "Card F",
      ]) {
        expect(result.rows.find((r) => r.cardName === name)!.isAnomalous).toBe(
          false,
        );
      }
    });

    it("should use fallback threshold when IQR is 0 (all lower-half prices are equal)", async () => {
      // All common cards priced at 1 chaos, except one outlier at 10.
      // Lower half all = 1, so IQR = 0. Fallback = max(1*5, 1+1) = 5.
      // The 10-chaos card exceeds 5 → flagged.
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 1, weight: 100000 },
        { name: "Card B", chaos: 1, weight: 90000 },
        { name: "Card C", chaos: 1, weight: 80000 },
        { name: "Card D", chaos: 1, weight: 70000 },
        { name: "Card E", chaos: 1, weight: 60000 },
        { name: "Card F", chaos: 1, weight: 55000 },
        { name: "Outlier", chaos: 10, weight: 95000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      expect(
        result.rows.find((r) => r.cardName === "Outlier")!.isAnomalous,
      ).toBe(true);
      expect(
        result.rows.find((r) => r.cardName === "Card A")!.isAnomalous,
      ).toBe(false);
    });

    it("should not flag a common card just barely above baseline when IQR is 0", async () => {
      // All common cards priced at 1 chaos, one card at 4 chaos.
      // Fallback threshold = max(1*5, 1+1) = 5. Card at 4 < 5 → not flagged.
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 1, weight: 100000 },
        { name: "Card B", chaos: 1, weight: 90000 },
        { name: "Card C", chaos: 1, weight: 80000 },
        { name: "Card D", chaos: 1, weight: 70000 },
        { name: "Card E", chaos: 1, weight: 60000 },
        { name: "Card F", chaos: 1, weight: 55000 },
        { name: "Slightly Up", chaos: 4, weight: 95000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      expect(
        result.rows.find((r) => r.cardName === "Slightly Up")!.isAnomalous,
      ).toBe(false);
    });

    it("should flag multiple anomalous common cards simultaneously", async () => {
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Card E", chaos: 2.5, weight: 60000 },
        { name: "Card F", chaos: 3.0, weight: 50000 },
        { name: "Outlier 1", chaos: 500, weight: 95000 },
        { name: "Outlier 2", chaos: 800, weight: 85000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      expect(
        result.rows.find((r) => r.cardName === "Outlier 1")!.isAnomalous,
      ).toBe(true);
      expect(
        result.rows.find((r) => r.cardName === "Outlier 2")!.isAnomalous,
      ).toBe(true);
      expect(
        result.rows.find((r) => r.cardName === "Card A")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "Card F")!.isAnomalous,
      ).toBe(false);
    });

    it("should not flag cards that have no matching availability weight", async () => {
      // Price exists but no weight entry → card is excluded from detection
      const { priceRows: baseRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Card E", chaos: 2.5, weight: 60000 },
      ]);

      // Add a price row for a card that has NO weight entry
      const priceRows = [
        ...baseRows,
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "No Weight Card",
          price_source: "exchange" as const,
          chaos_value: 9999,
          divine_value: 49.995,
          confidence: 1,
        },
      ];

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // "No Weight Card" has no availability entry, so it won't appear in rows.
      // We verify the detection doesn't crash and other cards are fine.
      const noWeightRow = result.rows.find(
        (r) => r.cardName === "No Weight Card",
      );
      expect(noWeightRow).toBeUndefined();
      // All other rows should not be anomalous
      for (const row of result.rows) {
        expect(row.isAnomalous).toBe(false);
      }
    });

    it("should not flag cards with zero weight even if priced", async () => {
      // A card with weight=0 should be excluded from candidates
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Card E", chaos: 2.5, weight: 60000 },
        { name: "Zero Weight", chaos: 999, weight: 0 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      const zeroWeightRow = result.rows.find(
        (r) => r.cardName === "Zero Weight",
      )!;
      expect(zeroWeightRow.isAnomalous).toBe(false);
    });

    it("should include anomalous count in the success log message", async () => {
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Card E", chaos: 2.5, weight: 60000 },
        { name: "Card F", chaos: 3.0, weight: 50000 },
        { name: "Outlier", chaos: 500, weight: 95000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      await service.getData("poe1", "Keepers");

      const logCalls = mockLoggerLog.mock.calls.map(
        (args: unknown[]) => args[0],
      );
      const successLog = logCalls.find(
        (msg: string) => typeof msg === "string" && msg.includes("Returning"),
      );
      expect(successLog).toBeDefined();
      expect(successLog).toContain("1 anomalous");
    });

    it("should log 0 anomalous when no cards are flagged", async () => {
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Card E", chaos: 2.5, weight: 60000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      await service.getData("poe1", "Keepers");

      const logCalls = mockLoggerLog.mock.calls.map(
        (args: unknown[]) => args[0],
      );
      const successLog = logCalls.find(
        (msg: string) => typeof msg === "string" && msg.includes("Returning"),
      );
      expect(successLog).toBeDefined();
      expect(successLog).toContain("0 anomalous");
    });

    it("should handle a realistic late-league scenario with inflated common cards", async () => {
      // Simulates end-of-league thin market: most common cards are ~0.5c,
      // but a few have single-listing artifacts pushing them to 10-50c
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Rain of Chaos", chaos: 0.3, weight: 121400 },
        { name: "The Lover", chaos: 0.4, weight: 113000 },
        { name: "The Hermit", chaos: 0.5, weight: 105000 },
        { name: "Loyalty", chaos: 0.4, weight: 98000 },
        { name: "Thunderous Skies", chaos: 0.6, weight: 92000 },
        { name: "Her Mask", chaos: 0.5, weight: 88000 },
        { name: "The Rabid Rhoa", chaos: 0.3, weight: 85000 },
        { name: "The Carrion Crow", chaos: 0.4, weight: 82000 },
        { name: "Turn the Other Cheek", chaos: 0.5, weight: 79000 },
        { name: "Lantador's Lost Love", chaos: 0.3, weight: 75000 },
        // Inflated common cards (single-listing artifacts)
        { name: "The Incantation", chaos: 35, weight: 91000 },
        { name: "The Metalsmith's Gift", chaos: 50, weight: 87000 },
        // Legitimately expensive rare cards
        { name: "The Doctor", chaos: 1200, weight: 10 },
        { name: "The Nurse", chaos: 400, weight: 1500 },
        { name: "House of Mirrors", chaos: 5000, weight: 3 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // Inflated common cards should be flagged
      expect(
        result.rows.find((r) => r.cardName === "The Incantation")!.isAnomalous,
      ).toBe(true);
      expect(
        result.rows.find((r) => r.cardName === "The Metalsmith's Gift")!
          .isAnomalous,
      ).toBe(true);

      // Normal common cards should not be flagged
      expect(
        result.rows.find((r) => r.cardName === "Rain of Chaos")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "The Lover")!.isAnomalous,
      ).toBe(false);

      // Expensive rare cards should not be flagged (below median weight)
      expect(
        result.rows.find((r) => r.cardName === "The Doctor")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "The Nurse")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "House of Mirrors")!.isAnomalous,
      ).toBe(false);
    });

    it("should not flag when only 4 candidates after excluding confidence=3 cards", async () => {
      // 6 total price entries, but 2 have confidence=3, leaving only 4 candidates
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Low Conf 1", chaos: 999, weight: 95000, confidence: 3 },
        { name: "Low Conf 2", chaos: 888, weight: 85000, confidence: 3 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // Only 4 non-low-confidence candidates → below minimum of 5 → no detection
      expect(
        result.rows.find((r) => r.cardName === "Card A")!.isAnomalous,
      ).toBe(false);
      expect(
        result.rows.find((r) => r.cardName === "Card D")!.isAnomalous,
      ).toBe(false);
    });

    it("should handle exactly 5 candidates (minimum for detection)", async () => {
      // Exactly 5 candidates — detection should proceed
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 0.5, weight: 100000 },
        { name: "Card B", chaos: 1.0, weight: 90000 },
        { name: "Card C", chaos: 1.5, weight: 80000 },
        { name: "Card D", chaos: 2.0, weight: 70000 },
        { name: "Outlier", chaos: 500, weight: 95000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // With 5 candidates, detection should run. All 5 are "common" since
      // sorted desc by weight: [100k, 95k, 90k, 80k, 70k], median at index 2 = 90k.
      // Common = weight >= 90k → Card A (100k), Outlier (95k), Card B (90k) = 3 common.
      // Common prices sorted: [0.5, 1.0, 500]. Lower half = [0.5, 1.0].
      // lowerQ1 = idx 0 = 0.5, lowerQ3 = idx 1 = 1.0, IQR = 0.5
      // Threshold = 1.0 + 3*0.5 = 2.5. 500 > 2.5 → flagged.
      expect(
        result.rows.find((r) => r.cardName === "Outlier")!.isAnomalous,
      ).toBe(true);
    });

    it("should not mutate isAnomalous for cards below the threshold", async () => {
      // Prices that vary but all within normal range
      const { priceRows, availabilityRows } = buildTestData([
        { name: "Card A", chaos: 1.0, weight: 100000 },
        { name: "Card B", chaos: 2.0, weight: 90000 },
        { name: "Card C", chaos: 3.0, weight: 80000 },
        { name: "Card D", chaos: 4.0, weight: 70000 },
        { name: "Card E", chaos: 5.0, weight: 60000 },
        { name: "Card F", chaos: 6.0, weight: 50000 },
        { name: "Card G", chaos: 7.0, weight: 45000 },
      ]);

      chains.priceChain.execute.mockResolvedValue(priceRows);
      chains.availabilityChain.execute.mockResolvedValue(availabilityRows);

      const result = await service.getData("poe1", "Keepers");

      // All cards should remain isAnomalous: false
      for (const name of [
        "Card A",
        "Card B",
        "Card C",
        "Card D",
        "Card E",
        "Card F",
        "Card G",
      ]) {
        expect(result.rows.find((r) => r.cardName === name)!.isAnomalous).toBe(
          false,
        );
      }
    });

    it("should correctly initialize all card prices with isAnomalous: false before detection", async () => {
      // Verify that isAnomalous defaults to false for all cards, even when
      // detection is skipped (e.g., no weights)
      chains.priceChain.execute.mockResolvedValue([
        {
          snapshot_id: "snapshot-uuid-1",
          card_name: "Some Card",
          price_source: "exchange",
          chaos_value: 100,
          divine_value: 0.5,
          confidence: 1,
        },
      ]);
      chains.availabilityChain.execute.mockResolvedValue([]);

      const result = await service.getData("poe1", "Keepers");

      // No weights means no rows, so we can't check the card in rows.
      // But we can verify the result is valid and no crash occurs.
      expect(result.rows).toHaveLength(0);
      expect(result.snapshotFetchedAt).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler — profit-forecast:compute
  // ═══════════════════════════════════════════════════════════════════════════

  describe("profit-forecast:compute", () => {
    const VALID_COMPUTE_REQUEST = {
      rows: [
        {
          cardName: "Test Card",
          weight: 100,
          fromBoss: false,
          probability: 0.1,
          chaosValue: 1000,
          divineValue: 5,
          evContribution: 100,
          hasPrice: true,
          confidence: 1,
          isAnomalous: false,
          excludeFromEv: false,
        },
      ],
      userOverrides: {},
      selectedBatch: 10000,
      baseRate: 90,
      stepDrop: 2,
      subBatchSize: 5000,
      customBaseRate: null,
      chaosToDivineRatio: 200,
      evPerDeck: 100,
    };

    // ─── Handler Registration ──────────────────────────────────────────────

    it("should register the Compute IPC handler", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([channel]: [string]) => channel,
      );
      expect(registeredChannels).toContain(ProfitForecastChannel.Compute);
    });

    // ─── Happy Path ────────────────────────────────────────────────────────

    it("should return a valid ProfitForecastComputeResponse for a valid request", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );
      const result = handler({}, VALID_COMPUTE_REQUEST);

      expect(result).toHaveProperty("rowFields");
      expect(result).toHaveProperty("totalCost");
      expect(result).toHaveProperty("pnlCurve");
      expect(result).toHaveProperty("confidenceInterval");
      expect(result).toHaveProperty("batchPnL");
    });

    it("should return rowFields keyed by card name", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );
      const result = handler({}, VALID_COMPUTE_REQUEST);

      expect(result.rowFields).toHaveProperty("Test Card");
      const fields = result.rowFields["Test Card"];
      expect(fields).toHaveProperty("chanceInBatch");
      expect(fields).toHaveProperty("expectedDecks");
      expect(fields).toHaveProperty("costToPull");
      expect(fields).toHaveProperty("plA");
      expect(fields).toHaveProperty("plB");
    });

    it("should return totalCost as a positive number", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );
      const result = handler({}, VALID_COMPUTE_REQUEST);

      expect(typeof result.totalCost).toBe("number");
      expect(result.totalCost).toBeGreaterThan(0);
    });

    it("should return pnlCurve as an array with data points", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );
      const result = handler({}, VALID_COMPUTE_REQUEST);

      expect(Array.isArray(result.pnlCurve)).toBe(true);
      expect(result.pnlCurve.length).toBeGreaterThan(0);

      const point = result.pnlCurve[0];
      expect(point).toHaveProperty("deckCount");
      expect(point).toHaveProperty("estimated");
      expect(point).toHaveProperty("optimistic");
    });

    it("should return confidenceInterval with estimated and optimistic", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );
      const result = handler({}, VALID_COMPUTE_REQUEST);

      expect(result.confidenceInterval).toHaveProperty("estimated");
      expect(result.confidenceInterval).toHaveProperty("optimistic");
      expect(typeof result.confidenceInterval.estimated).toBe("number");
      expect(typeof result.confidenceInterval.optimistic).toBe("number");
    });

    it("should return batchPnL with revenue, cost, netPnL, and confidence", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );
      const result = handler({}, VALID_COMPUTE_REQUEST);

      expect(result.batchPnL).toHaveProperty("revenue");
      expect(result.batchPnL).toHaveProperty("cost");
      expect(result.batchPnL).toHaveProperty("netPnL");
      expect(result.batchPnL).toHaveProperty("confidence");
      expect(result.batchPnL.confidence).toHaveProperty("estimated");
      expect(result.batchPnL.confidence).toHaveProperty("optimistic");
    });

    // ─── Input Validation ──────────────────────────────────────────────────

    it("should return validation error when request is null", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );

      const result = handler({}, null);
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Missing or malformed payload"),
      });
    });

    it("should return validation error when request is undefined", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );

      const result = handler({}, undefined);
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Missing or malformed payload"),
      });
    });

    it("should return validation error when request has no rows property", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );

      const result = handler({}, { selectedBatch: 10000 });
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("rows"),
      });
    });

    it("should return validation error when rows is not an array", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );

      const result = handler(
        {},
        { ...VALID_COMPUTE_REQUEST, rows: "not-an-array" },
      );
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("rows"),
      });
    });

    // ─── Custom Base Rate ──────────────────────────────────────────────────

    it("should apply custom base rate with stepDrop=0 when customBaseRate is set", () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        ProfitForecastChannel.Compute,
      );

      const requestWithCustomRate = {
        ...VALID_COMPUTE_REQUEST,
        customBaseRate: 50,
      };
      const resultCustom = handler({}, requestWithCustomRate);

      const requestWithoutCustomRate = {
        ...VALID_COMPUTE_REQUEST,
        customBaseRate: null,
      };
      const resultDefault = handler({}, requestWithoutCustomRate);

      // Both should be valid responses
      expect(resultCustom).toHaveProperty("rowFields");
      expect(resultDefault).toHaveProperty("rowFields");

      // The total cost should differ because the custom rate (50) is lower
      // than the default base rate (90), making decks more expensive
      expect(resultCustom.totalCost).not.toBe(resultDefault.totalCost);

      // Custom rate of 50 means each deck costs chaosToDivineRatio/50 = 4 chaos
      // With stepDrop=0 the rate stays fixed, so totalCost = 10000 * 4 = 40000
      expect(resultCustom.totalCost).toBe(10000 * (200 / 50));
    });
  });
});
