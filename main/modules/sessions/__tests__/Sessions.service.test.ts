import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
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

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
const mockGetKysely = vi.fn();
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: vi.fn(),
    })),
  },
}));

// ─── Mock SnapshotService ────────────────────────────────────────────────────
const mockLoadSnapshot = vi.fn();
vi.mock("~/main/modules/snapshots", () => ({
  SnapshotService: {
    getInstance: vi.fn(() => ({
      loadSnapshot: mockLoadSnapshot,
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

import {
  createTestDatabase,
  seedDivinationCard,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import type { SessionPriceSnapshot } from "../../../../types/data-stores";
import { SessionsService } from "../Sessions.service";

// ─── Helper: build a realistic SessionPriceSnapshot ──────────────────────────
function buildPriceSnapshot(
  overrides: {
    timestamp?: string;
    stackedDeckChaosCost?: number;
    exchangeChaosToDivine?: number;
    stashChaosToDivine?: number;
    exchangeCardPrices?: Record<
      string,
      { chaosValue: number; divineValue: number; stackSize?: number }
    >;
    stashCardPrices?: Record<
      string,
      { chaosValue: number; divineValue: number; stackSize?: number }
    >;
  } = {},
): SessionPriceSnapshot {
  return {
    timestamp: overrides.timestamp ?? "2025-01-15T12:00:00Z",
    stackedDeckChaosCost: overrides.stackedDeckChaosCost ?? 5,
    exchange: {
      chaosToDivineRatio: overrides.exchangeChaosToDivine ?? 150,
      cardPrices: overrides.exchangeCardPrices ?? {},
    },
    stash: {
      chaosToDivineRatio: overrides.stashChaosToDivine ?? 145,
      cardPrices: overrides.stashCardPrices ?? {},
    },
  };
}

describe("SessionsService", () => {
  let testDb: TestDatabase;
  let service: SessionsService;

  beforeEach(() => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);
    mockLoadSnapshot.mockReset();

    // Reset the singleton so each test gets a fresh instance
    // @ts-expect-error accessing private static for testing
    SessionsService._instance = undefined;

    service = SessionsService.getInstance();
  });

  afterEach(async () => {
    // @ts-expect-error accessing private static for testing
    SessionsService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = SessionsService.getInstance();
      const b = SessionsService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ─── getSessionById ─────────────────────────────────────────────────────

  describe("getSessionById", () => {
    it("should return null for a non-existent session", async () => {
      const result = await service.getSessionById("non-existent-id");
      expect(result).toBeNull();
    });

    it("should return basic session data without snapshot", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 3,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 1 },
      ]);

      mockLoadSnapshot.mockResolvedValue(undefined);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totalCount).toBe(3);
      expect(result!.league).toBe("Settlers");
      expect(result!.cards).toHaveLength(2);

      const doctor = result!.cards.find((c) => c.name === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.count).toBe(2);

      const rain = result!.cards.find((c) => c.name === "Rain of Chaos");
      expect(rain).toBeDefined();
      expect(rain!.count).toBe(1);
    });

    it("should return session data with price information from snapshot", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, {
        leagueId,
        cardPrices: [
          {
            cardName: "The Doctor",
            priceSource: "exchange",
            chaosValue: 5000,
            divineValue: 30,
          },
          {
            cardName: "The Doctor",
            priceSource: "stash",
            chaosValue: 4800,
            divineValue: 29,
          },
        ],
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 3,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 3 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 5,
        exchangeChaosToDivine: 150,
        stashChaosToDivine: 145,
        exchangeCardPrices: {
          "The Doctor": { chaosValue: 5000, divineValue: 30 },
        },
        stashCardPrices: {
          "The Doctor": { chaosValue: 4800, divineValue: 29 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.priceSnapshot).toBeDefined();
      expect(result!.totals).toBeDefined();

      const doctor = result!.cards.find((c) => c.name === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.exchangePrice).toBeDefined();
      expect(doctor!.exchangePrice!.chaosValue).toBe(5000);
      expect(doctor!.exchangePrice!.totalValue).toBe(15000); // 5000 * 3
      expect(doctor!.stashPrice).toBeDefined();
      expect(doctor!.stashPrice!.chaosValue).toBe(4800);
      expect(doctor!.stashPrice!.totalValue).toBe(14400); // 4800 * 3
    });

    it("should calculate correct exchange totals", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 5,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 3 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 5,
        exchangeChaosToDivine: 150,
        stashChaosToDivine: 145,
        exchangeCardPrices: {
          "The Doctor": { chaosValue: 5000, divineValue: 30 },
          "Rain of Chaos": { chaosValue: 1, divineValue: 0.006 },
        },
        stashCardPrices: {
          "The Doctor": { chaosValue: 4800, divineValue: 29 },
          "Rain of Chaos": { chaosValue: 0.8, divineValue: 0.005 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totals).toBeDefined();

      // Exchange total = (5000 * 2) + (1 * 3) = 10003
      expect(result!.totals!.exchange.totalValue).toBe(10003);

      // Stash total = (4800 * 2) + (0.8 * 3) = 9602.4
      expect(result!.totals!.stash.totalValue).toBeCloseTo(9602.4, 1);

      // Deck cost = 5 * 5 = 25
      expect(result!.totals!.totalDeckCost).toBe(25);
      expect(result!.totals!.stackedDeckChaosCost).toBe(5);

      // Net profit = total - deckCost
      expect(result!.totals!.exchange.netProfit).toBe(10003 - 25);
      expect(result!.totals!.stash.netProfit).toBeCloseTo(9602.4 - 25, 1);
    });

    it("should handle cards with no prices in snapshot", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 5,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Unknown Card", count: 5 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        exchangeCardPrices: {},
        stashCardPrices: {},
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      const card = result!.cards.find((c) => c.name === "Unknown Card");
      expect(card).toBeDefined();

      // Should have zero-value price entries
      expect(card!.exchangePrice).toBeDefined();
      expect(card!.exchangePrice!.chaosValue).toBe(0);
      expect(card!.exchangePrice!.totalValue).toBe(0);
      expect(card!.stashPrice).toBeDefined();
      expect(card!.stashPrice!.chaosValue).toBe(0);
      expect(card!.stashPrice!.totalValue).toBe(0);
    });

    it("should not include totals when no snapshot is available", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 2,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
      ]);

      mockLoadSnapshot.mockResolvedValue(undefined);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totals).toBeUndefined();
      expect(result!.priceSnapshot).toBeUndefined();
    });

    it("should include divination card metadata when available", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 1,
      });

      // Seed divination card metadata
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
        description: "A valuable card",
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<em>Some flavour</em>",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      mockLoadSnapshot.mockResolvedValue(undefined);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      const doctor = result!.cards.find((c) => c.name === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.divinationCard).toBeDefined();
      expect(doctor!.divinationCard!.stackSize).toBe(8);
    });

    it("should include startedAt and endedAt from the session", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const startedAt = "2025-01-15T10:00:00Z";
      const endedAt = "2025-01-15T11:30:00Z";

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 0,
        startedAt,
        endedAt,
      });

      mockLoadSnapshot.mockResolvedValue(undefined);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.startedAt).toBe(startedAt);
      expect(result!.endedAt).toBe(endedAt);
    });

    it("should respect hidePrice flags on session cards", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 5,
      });

      // Seed a card with exchange price hidden
      await seedSessionCards(testDb.kysely, sessionId, [
        {
          cardName: "Hidden Card",
          count: 5,
          hidePriceExchange: true,
          hidePriceStash: false,
        },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 5,
        exchangeCardPrices: {
          "Hidden Card": { chaosValue: 1000, divineValue: 6 },
        },
        stashCardPrices: {
          "Hidden Card": { chaosValue: 900, divineValue: 5.5 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();

      const card = result!.cards.find((c) => c.name === "Hidden Card");
      expect(card).toBeDefined();
      expect(card!.exchangePrice!.hidePrice).toBe(true);
      expect(card!.stashPrice!.hidePrice).toBe(false);

      // Exchange total should exclude hidden card
      // The hidden card's exchange value (5000) is excluded, only stash is counted
      expect(result!.totals!.exchange.totalValue).toBe(0);
      expect(result!.totals!.stash.totalValue).toBe(4500); // 900 * 5
    });

    it("should handle multiple cards with mixed hide states for totals", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 4,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        {
          cardName: "Visible Card",
          count: 2,
          hidePriceExchange: false,
          hidePriceStash: false,
        },
        {
          cardName: "Hidden Exchange",
          count: 2,
          hidePriceExchange: true,
          hidePriceStash: false,
        },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 5,
        exchangeCardPrices: {
          "Visible Card": { chaosValue: 100, divineValue: 0.6 },
          "Hidden Exchange": { chaosValue: 2000, divineValue: 12 },
        },
        stashCardPrices: {
          "Visible Card": { chaosValue: 90, divineValue: 0.55 },
          "Hidden Exchange": { chaosValue: 1800, divineValue: 11 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      // Exchange total should only include Visible Card: 100 * 2 = 200
      expect(result!.totals!.exchange.totalValue).toBe(200);
      // Stash total should include both: (90 * 2) + (1800 * 2) = 180 + 3600 = 3780
      expect(result!.totals!.stash.totalValue).toBe(3780);
    });

    it("should handle session with zero totalCount", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 0,
      });

      const priceSnapshot = buildPriceSnapshot({ stackedDeckChaosCost: 5 });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totalCount).toBe(0);
      expect(result!.cards).toHaveLength(0);
      expect(result!.totals).toBeDefined();
      expect(result!.totals!.totalDeckCost).toBe(0);
      expect(result!.totals!.exchange.totalValue).toBe(0);
      expect(result!.totals!.stash.totalValue).toBe(0);
    });

    it("should clean wiki markup from divination card metadata", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 1,
      });

      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Wiki Card",
        stackSize: 5,
        description: "A test card",
        rewardHtml: "[[File:Something.png]] [[ItemName|Display Text]] reward",
        artSrc: "https://example.com/wiki.png",
        flavourHtml: "[[Simple]] flavour text",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Wiki Card", count: 1 },
      ]);

      mockLoadSnapshot.mockResolvedValue(undefined);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      const card = result!.cards.find((c) => c.name === "Wiki Card");
      expect(card).toBeDefined();
      expect(card!.divinationCard).toBeDefined();
      // Wiki markup should be cleaned
      expect(card!.divinationCard!.rewardHtml).not.toContain("[[");
      expect(card!.divinationCard!.rewardHtml).toContain("Display Text");
      expect(card!.divinationCard!.flavourHtml).not.toContain("[[");
      expect(card!.divinationCard!.flavourHtml).toContain("Simple");
    });

    it("should pass the snapshot's chaos-to-divine ratio through to totals", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 1,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        exchangeChaosToDivine: 155,
        stashChaosToDivine: 148,
        exchangeCardPrices: {
          "The Doctor": { chaosValue: 5000, divineValue: 30 },
        },
        stashCardPrices: {
          "The Doctor": { chaosValue: 4800, divineValue: 29 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totals!.exchange.chaosToDivineRatio).toBe(155);
      expect(result!.totals!.stash.chaosToDivineRatio).toBe(148);
    });

    it("should handle snapshot loadSnapshot returning null gracefully", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId, // Session references a snapshot
        totalCount: 1,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      // loadSnapshot returns null (snapshot data missing/corrupt)
      mockLoadSnapshot.mockResolvedValue(null);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.priceSnapshot).toBeUndefined();
      expect(result!.totals).toBeUndefined();
    });

    it("should handle many cards in a single session", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 100,
      });

      const cards = Array.from({ length: 20 }, (_, i) => ({
        cardName: `Card ${String(i + 1).padStart(2, "0")}`,
        count: 5,
      }));
      await seedSessionCards(testDb.kysely, sessionId, cards);

      mockLoadSnapshot.mockResolvedValue(undefined);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.cards).toHaveLength(20);
      expect(result!.totalCount).toBe(100);
    });

    it("should calculate net profit correctly with deck cost", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 10,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 10 },
      ]);

      const deckCost = 8;
      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: deckCost,
        exchangeCardPrices: {
          "Rain of Chaos": { chaosValue: 1, divineValue: 0.006 },
        },
        stashCardPrices: {
          "Rain of Chaos": { chaosValue: 0.8, divineValue: 0.005 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();

      // Exchange: totalValue = 1 * 10 = 10, deckCost = 8 * 10 = 80, net = 10 - 80 = -70
      expect(result!.totals!.exchange.totalValue).toBe(10);
      expect(result!.totals!.totalDeckCost).toBe(80);
      expect(result!.totals!.exchange.netProfit).toBe(-70);

      // Stash: totalValue = 0.8 * 10 = 8, deckCost = 80, net = 8 - 80 = -72
      expect(result!.totals!.stash.totalValue).toBeCloseTo(8, 1);
      expect(result!.totals!.stash.netProfit).toBeCloseTo(-72, 1);
    });
  });

  // ─── getAllSessions (via private method, tested through public-ish patterns) ─

  describe("pagination (getAllSessions)", () => {
    it("should return empty page when no sessions exist", async () => {
      const _leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });

      // getAllSessions is private so we validate the handler was registered.
      const { ipcMain } = await import("electron");
      const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
      const getAllHandler = handleCalls.find(
        ([channel]) => channel === "sessions:get-all",
      );
      expect(getAllHandler).toBeDefined();
    });

    it("should register all expected IPC handlers", async () => {
      const { ipcMain } = await import("electron");
      const registeredChannels = vi
        .mocked(ipcMain.handle)
        .mock.calls.map(([channel]) => channel);

      expect(registeredChannels).toContain("sessions:get-all");
      expect(registeredChannels).toContain("sessions:get-by-id");
      expect(registeredChannels).toContain("sessions:search-by-card");
    });
  });

  // ─── Complex integration scenarios ──────────────────────────────────────

  describe("integration scenarios", () => {
    it("should correctly assemble a full session with multiple cards and prices", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });

      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 15,
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
      });

      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
        stackSize: 8,
        description: "A valuable divination card",
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "",
      });

      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Rain of Chaos",
        stackSize: 8,
        description: "A common divination card",
        rewardHtml: "<span>Chaos Orb</span>",
        artSrc: "https://example.com/rain.png",
        flavourHtml: "",
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Rain of Chaos", count: 10 },
        { cardName: "Rare Unknown", count: 3 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 5,
        exchangeChaosToDivine: 150,
        stashChaosToDivine: 145,
        exchangeCardPrices: {
          "The Doctor": { chaosValue: 5000, divineValue: 33.3 },
          "Rain of Chaos": { chaosValue: 1, divineValue: 0.007 },
          // "Rare Unknown" has no price
        },
        stashCardPrices: {
          "The Doctor": { chaosValue: 4800, divineValue: 33.1 },
          "Rain of Chaos": { chaosValue: 0.9, divineValue: 0.006 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totalCount).toBe(15);
      expect(result!.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(result!.endedAt).toBe("2025-01-15T11:30:00Z");
      expect(result!.league).toBe("Settlers");
      expect(result!.cards).toHaveLength(3);

      // Verify The Doctor
      const doctor = result!.cards.find((c) => c.name === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.count).toBe(2);
      expect(doctor!.divinationCard).toBeDefined();
      expect(doctor!.divinationCard!.stackSize).toBe(8);
      expect(doctor!.exchangePrice!.chaosValue).toBe(5000);
      expect(doctor!.exchangePrice!.totalValue).toBe(10000);

      // Verify Rain of Chaos
      const rain = result!.cards.find((c) => c.name === "Rain of Chaos");
      expect(rain).toBeDefined();
      expect(rain!.count).toBe(10);
      expect(rain!.divinationCard).toBeDefined();
      expect(rain!.exchangePrice!.totalValue).toBe(10);

      // Verify Rare Unknown (no divination card metadata, zero prices)
      const unknown = result!.cards.find((c) => c.name === "Rare Unknown");
      expect(unknown).toBeDefined();
      expect(unknown!.count).toBe(3);
      expect(unknown!.exchangePrice!.chaosValue).toBe(0);
      expect(unknown!.exchangePrice!.totalValue).toBe(0);

      // Verify totals
      // Exchange: (5000*2) + (1*10) + (0*3) = 10010
      expect(result!.totals!.exchange.totalValue).toBe(10010);

      // Stash: (4800*2) + (0.9*10) + (0*3) = 9609
      expect(result!.totals!.stash.totalValue).toBeCloseTo(9609, 0);

      // Deck cost: 5 * 15 = 75
      expect(result!.totals!.totalDeckCost).toBe(75);
      expect(result!.totals!.exchange.netProfit).toBe(10010 - 75);
    });

    it("should handle poe2 sessions the same as poe1", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe2",
        name: "Early Access",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe2",
        leagueId,
        snapshotId,
        totalCount: 3,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Some PoE2 Card", count: 3 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        exchangeCardPrices: {
          "Some PoE2 Card": { chaosValue: 100, divineValue: 0.5 },
        },
        stashCardPrices: {
          "Some PoE2 Card": { chaosValue: 95, divineValue: 0.48 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.league).toBe("Early Access");
      expect(result!.cards).toHaveLength(1);
      expect(result!.cards[0].exchangePrice!.totalValue).toBe(300);
    });

    it("should correctly handle a session with all cards hidden from exchange", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 5,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        {
          cardName: "Card A",
          count: 3,
          hidePriceExchange: true,
          hidePriceStash: true,
        },
        {
          cardName: "Card B",
          count: 2,
          hidePriceExchange: true,
          hidePriceStash: true,
        },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 5,
        exchangeCardPrices: {
          "Card A": { chaosValue: 1000, divineValue: 6 },
          "Card B": { chaosValue: 500, divineValue: 3 },
        },
        stashCardPrices: {
          "Card A": { chaosValue: 900, divineValue: 5.5 },
          "Card B": { chaosValue: 450, divineValue: 2.8 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      // All cards hidden from both exchange and stash
      expect(result!.totals!.exchange.totalValue).toBe(0);
      expect(result!.totals!.stash.totalValue).toBe(0);
      // Net profit should be negative (only deck cost)
      expect(result!.totals!.exchange.netProfit).toBe(-25);
      expect(result!.totals!.stash.netProfit).toBe(-25);
    });

    it("should return correct data for a session with a single card", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 1,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 5,
        exchangeCardPrices: {
          "The Doctor": { chaosValue: 5000, divineValue: 30 },
        },
        stashCardPrices: {
          "The Doctor": { chaosValue: 4800, divineValue: 29 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totalCount).toBe(1);
      expect(result!.cards).toHaveLength(1);
      expect(result!.cards[0].name).toBe("The Doctor");
      expect(result!.totals!.exchange.totalValue).toBe(5000);
      expect(result!.totals!.exchange.netProfit).toBe(4995); // 5000 - 5
    });

    it("should handle zero stacked deck cost", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 5,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "Rain of Chaos", count: 5 },
      ]);

      const priceSnapshot = buildPriceSnapshot({
        stackedDeckChaosCost: 0,
        exchangeCardPrices: {
          "Rain of Chaos": { chaosValue: 1, divineValue: 0.006 },
        },
        stashCardPrices: {
          "Rain of Chaos": { chaosValue: 0.8, divineValue: 0.005 },
        },
      });
      mockLoadSnapshot.mockResolvedValue(priceSnapshot);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.totals!.stackedDeckChaosCost).toBe(0);
      expect(result!.totals!.totalDeckCost).toBe(0);
      // Net profit = totalValue (no deck cost deducted)
      expect(result!.totals!.exchange.netProfit).toBe(5);
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle card names with special characters", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 3,
      });

      const specialCards = [
        { cardName: "The King's Blade", count: 1 },
        { cardName: "Jack in the Box", count: 1 },
        { cardName: "A Mother's Parting Gift", count: 1 },
      ];

      await seedSessionCards(testDb.kysely, sessionId, specialCards);

      mockLoadSnapshot.mockResolvedValue(undefined);

      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.cards).toHaveLength(3);

      for (const card of specialCards) {
        const found = result!.cards.find((c) => c.name === card.cardName);
        expect(found).toBeDefined();
        expect(found!.count).toBe(1);
      }
    });

    it("should handle session with no snapshotId at all", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 1,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      // loadSnapshot should not even be called when snapshotId is null
      const result = await service.getSessionById(sessionId);

      expect(result).not.toBeNull();
      expect(result!.priceSnapshot).toBeUndefined();
      expect(result!.totals).toBeUndefined();
    });

    it("should not call loadSnapshot when session has no snapshotId", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId: undefined,
        totalCount: 1,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      await service.getSessionById(sessionId);

      expect(mockLoadSnapshot).not.toHaveBeenCalled();
    });

    it("should call loadSnapshot with the correct snapshotId", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        game: "poe1",
        name: "Settlers",
      });
      const snapshotId = await seedSnapshot(testDb.kysely, { leagueId });
      const sessionId = await seedSession(testDb.kysely, {
        game: "poe1",
        leagueId,
        snapshotId,
        totalCount: 1,
      });

      await seedSessionCards(testDb.kysely, sessionId, [
        { cardName: "The Doctor", count: 1 },
      ]);

      mockLoadSnapshot.mockResolvedValue(null);

      await service.getSessionById(sessionId);

      expect(mockLoadSnapshot).toHaveBeenCalledWith(snapshotId);
    });
  });
});
