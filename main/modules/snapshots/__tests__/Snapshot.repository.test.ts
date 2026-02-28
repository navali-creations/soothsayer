import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedLeague,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { SnapshotRepository } from "../Snapshot.repository";

describe("SnapshotRepository", () => {
  let testDb: TestDatabase;
  let repository: SnapshotRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new SnapshotRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── League Operations ───────────────────────────────────────────────────

  describe("getLeagueByName", () => {
    it("should return null when no league exists", async () => {
      const league = await repository.getLeagueByName("poe1", "Settlers");
      expect(league).toBeNull();
    });

    it("should return a league by game and name", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const league = await repository.getLeagueByName("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(league!.id).toBe("league-001");
      expect(league!.game).toBe("poe1");
      expect(league!.name).toBe("Settlers");
    });

    it("should not return a league for a different game", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const league = await repository.getLeagueByName("poe2", "Settlers");
      expect(league).toBeNull();
    });

    it("should not return a league for a different name", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
      });

      const league = await repository.getLeagueByName("poe1", "Standard");
      expect(league).toBeNull();
    });

    it("should return the correct league when multiple exist", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-settlers",
        game: "poe1",
        name: "Settlers",
      });
      await seedLeague(testDb.kysely, {
        id: "league-standard",
        game: "poe1",
        name: "Standard",
      });
      await seedLeague(testDb.kysely, {
        id: "league-dawn",
        game: "poe2",
        name: "Dawn",
      });

      const settlers = await repository.getLeagueByName("poe1", "Settlers");
      const standard = await repository.getLeagueByName("poe1", "Standard");
      const dawn = await repository.getLeagueByName("poe2", "Dawn");

      expect(settlers!.id).toBe("league-settlers");
      expect(standard!.id).toBe("league-standard");
      expect(dawn!.id).toBe("league-dawn");
    });

    it("should return mapped DTO with camelCase fields", async () => {
      await seedLeague(testDb.kysely, {
        id: "league-001",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      const league = await repository.getLeagueByName("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(league!.startDate).toBe("2025-01-01T00:00:00Z");
      expect(Object.keys(league!).sort()).toEqual([
        "game",
        "id",
        "name",
        "startDate",
      ]);
    });
  });

  describe("createLeague", () => {
    it("should create a new league", async () => {
      await repository.createLeague({
        id: "league-new",
        game: "poe1",
        name: "Settlers",
      });

      const league = await repository.getLeagueByName("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(league!.id).toBe("league-new");
      expect(league!.game).toBe("poe1");
      expect(league!.name).toBe("Settlers");
    });

    it("should create a league with a start date", async () => {
      await repository.createLeague({
        id: "league-dated",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-15T00:00:00Z",
      });

      const league = await repository.getLeagueByName("poe1", "Settlers");
      expect(league!.startDate).toBe("2025-01-15T00:00:00Z");
    });

    it("should create a league with null start date when not provided", async () => {
      await repository.createLeague({
        id: "league-no-date",
        game: "poe1",
        name: "Standard",
      });

      const league = await repository.getLeagueByName("poe1", "Standard");
      expect(league!.startDate).toBeNull();
    });

    it("should create leagues for different games", async () => {
      await repository.createLeague({
        id: "league-poe1",
        game: "poe1",
        name: "Settlers",
      });
      await repository.createLeague({
        id: "league-poe2",
        game: "poe2",
        name: "Dawn",
      });

      const poe1 = await repository.getLeagueByName("poe1", "Settlers");
      const poe2 = await repository.getLeagueByName("poe2", "Dawn");

      expect(poe1).not.toBeNull();
      expect(poe2).not.toBeNull();
      expect(poe1!.game).toBe("poe1");
      expect(poe2!.game).toBe("poe2");
    });

    it("should throw on duplicate game+name combination", async () => {
      await repository.createLeague({
        id: "league-1",
        game: "poe1",
        name: "Settlers",
      });

      await expect(
        repository.createLeague({
          id: "league-2",
          game: "poe1",
          name: "Settlers",
        }),
      ).rejects.toThrow();
    });
  });

  // ─── Snapshot Operations ─────────────────────────────────────────────────

  describe("getSnapshotById", () => {
    it("should return null for non-existent snapshot", async () => {
      const snapshot = await repository.getSnapshotById("nonexistent");
      expect(snapshot).toBeNull();
    });

    it("should return a snapshot by ID", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await testDb.kysely
        .insertInto("snapshots")
        .values({
          id: "snap-001",
          league_id: leagueId,
          fetched_at: "2025-01-15T10:00:00Z",
          exchange_chaos_to_divine: 200,
          stash_chaos_to_divine: 195,
          stacked_deck_chaos_cost: 3.5,
        })
        .execute();

      const snapshot = await repository.getSnapshotById("snap-001");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.id).toBe("snap-001");
      expect(snapshot!.leagueId).toBe(leagueId);
      expect(snapshot!.fetchedAt).toBe("2025-01-15T10:00:00Z");
      expect(snapshot!.exchangeChaosToDivine).toBe(200);
      expect(snapshot!.stashChaosToDivine).toBe(195);
      expect(snapshot!.stackedDeckChaosCost).toBe(3.5);
    });

    it("should return mapped DTO with camelCase fields", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await testDb.kysely
        .insertInto("snapshots")
        .values({
          id: "snap-check",
          league_id: leagueId,
          fetched_at: "2025-01-15T10:00:00Z",
          exchange_chaos_to_divine: 200,
          stash_chaos_to_divine: 195,
          stacked_deck_chaos_cost: 3,
        })
        .execute();

      const snapshot = await repository.getSnapshotById("snap-check");
      expect(snapshot).not.toBeNull();
      expect(Object.keys(snapshot!).sort()).toEqual([
        "exchangeChaosToDivine",
        "fetchedAt",
        "id",
        "leagueId",
        "stackedDeckChaosCost",
        "stackedDeckMaxVolumeRate",
        "stashChaosToDivine",
      ]);
    });
  });

  describe("createSnapshot", () => {
    it("should create a snapshot with card prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-create",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3.5,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1200,
                divineValue: 6.0,
              },
              "Rain of Chaos": {
                chaosValue: 0.5,
                divineValue: 0.0025,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1100,
                divineValue: 5.64,
              },
            },
          },
        },
      });

      const snapshot = await repository.getSnapshotById("snap-create");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.id).toBe("snap-create");
      expect(snapshot!.leagueId).toBe(leagueId);
      expect(snapshot!.fetchedAt).toBe("2025-01-15T10:00:00Z");
      expect(snapshot!.exchangeChaosToDivine).toBe(200);
      expect(snapshot!.stashChaosToDivine).toBe(195);
      expect(snapshot!.stackedDeckChaosCost).toBe(3.5);
    });

    it("should store exchange card prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-exchange",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1200,
                divineValue: 6.0,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {},
          },
        },
      });

      const cardPrices =
        await repository.getSnapshotCardPrices("snap-exchange");
      expect(cardPrices).toHaveLength(1);
      expect(cardPrices[0].cardName).toBe("The Doctor");
      expect(cardPrices[0].priceSource).toBe("exchange");
      expect(cardPrices[0].chaosValue).toBe(1200);
      expect(cardPrices[0].divineValue).toBe(6.0);
    });

    it("should store stash card prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-stash",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {},
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {
              "Rain of Chaos": {
                chaosValue: 0.5,
                divineValue: 0.0025,
              },
            },
          },
        },
      });

      const cardPrices = await repository.getSnapshotCardPrices("snap-stash");
      expect(cardPrices).toHaveLength(1);
      expect(cardPrices[0].cardName).toBe("Rain of Chaos");
      expect(cardPrices[0].priceSource).toBe("stash");
      expect(cardPrices[0].chaosValue).toBe(0.5);
      expect(cardPrices[0].divineValue).toBe(0.0025);
    });

    it("should store both exchange and stash prices in one snapshot", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-both",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1200,
                divineValue: 6.0,
              },
              "Rain of Chaos": {
                chaosValue: 0.5,
                divineValue: 0.0025,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1100,
                divineValue: 5.64,
              },
              "The Fiend": {
                chaosValue: 5000,
                divineValue: 25.0,
              },
            },
          },
        },
      });

      const cardPrices = await repository.getSnapshotCardPrices("snap-both");
      expect(cardPrices).toHaveLength(4);

      const exchangePrices = cardPrices.filter(
        (p) => p.priceSource === "exchange",
      );
      const stashPrices = cardPrices.filter((p) => p.priceSource === "stash");

      expect(exchangePrices).toHaveLength(2);
      expect(stashPrices).toHaveLength(2);
    });

    it("should create a snapshot with no card prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-empty",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {},
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {},
          },
        },
      });

      const snapshot = await repository.getSnapshotById("snap-empty");
      expect(snapshot).not.toBeNull();

      const cardPrices = await repository.getSnapshotCardPrices("snap-empty");
      expect(cardPrices).toEqual([]);
    });

    it("should handle card prices without optional fields", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-null-stack",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "Unknown Card": {
                chaosValue: 10,
                divineValue: 0.05,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {},
          },
        },
      });

      const cardPrices =
        await repository.getSnapshotCardPrices("snap-null-stack");
      expect(cardPrices).toHaveLength(1);
      expect(cardPrices[0].cardName).toBe("Unknown Card");
    });

    it("should handle zero stacked deck cost", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-zero-cost",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 0,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {},
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {},
          },
        },
      });

      const snapshot = await repository.getSnapshotById("snap-zero-cost");
      expect(snapshot).not.toBeNull();
      expect(snapshot!.stackedDeckChaosCost).toBe(0);
    });
  });

  // ─── getSnapshotCardPrices ───────────────────────────────────────────────

  describe("getSnapshotCardPrices", () => {
    it("should return empty array for non-existent snapshot", async () => {
      const prices = await repository.getSnapshotCardPrices("nonexistent");
      expect(prices).toEqual([]);
    });

    it("should return empty array for snapshot with no prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await testDb.kysely
        .insertInto("snapshots")
        .values({
          id: "snap-no-prices",
          league_id: leagueId,
          fetched_at: "2025-01-15T10:00:00Z",
          exchange_chaos_to_divine: 200,
          stash_chaos_to_divine: 195,
          stacked_deck_chaos_cost: 3,
        })
        .execute();

      const prices = await repository.getSnapshotCardPrices("snap-no-prices");
      expect(prices).toEqual([]);
    });

    it("should return correctly mapped card price DTOs", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await testDb.kysely
        .insertInto("snapshots")
        .values({
          id: "snap-prices",
          league_id: leagueId,
          fetched_at: "2025-01-15T10:00:00Z",
          exchange_chaos_to_divine: 200,
          stash_chaos_to_divine: 195,
          stacked_deck_chaos_cost: 3,
        })
        .execute();

      await testDb.kysely
        .insertInto("snapshot_card_prices")
        .values([
          {
            snapshot_id: "snap-prices",
            card_name: "The Doctor",
            price_source: "exchange",
            chaos_value: 1200,
            divine_value: 6.0,
          },
          {
            snapshot_id: "snap-prices",
            card_name: "Rain of Chaos",
            price_source: "stash",
            chaos_value: 0.5,
            divine_value: 0.0025,
          },
        ])
        .execute();

      const prices = await repository.getSnapshotCardPrices("snap-prices");
      expect(prices).toHaveLength(2);

      const doctor = prices.find((p) => p.cardName === "The Doctor");
      const rain = prices.find((p) => p.cardName === "Rain of Chaos");

      expect(doctor).toBeDefined();
      expect(doctor!.priceSource).toBe("exchange");
      expect(doctor!.chaosValue).toBe(1200);
      expect(doctor!.divineValue).toBe(6.0);

      expect(rain).toBeDefined();
      expect(rain!.priceSource).toBe("stash");
      expect(rain!.chaosValue).toBe(0.5);
      expect(rain!.divineValue).toBe(0.0025);
    });

    it("should not return prices from other snapshots", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await testDb.kysely
        .insertInto("snapshots")
        .values([
          {
            id: "snap-a",
            league_id: leagueId,
            fetched_at: "2025-01-15T10:00:00Z",
            exchange_chaos_to_divine: 200,
            stash_chaos_to_divine: 195,
            stacked_deck_chaos_cost: 3,
          },
          {
            id: "snap-b",
            league_id: leagueId,
            fetched_at: "2025-01-15T11:00:00Z",
            exchange_chaos_to_divine: 201,
            stash_chaos_to_divine: 196,
            stacked_deck_chaos_cost: 3,
          },
        ])
        .execute();

      await testDb.kysely
        .insertInto("snapshot_card_prices")
        .values([
          {
            snapshot_id: "snap-a",
            card_name: "The Doctor",
            price_source: "exchange",
            chaos_value: 1200,
            divine_value: 6.0,
          },
          {
            snapshot_id: "snap-b",
            card_name: "Rain of Chaos",
            price_source: "exchange",
            chaos_value: 0.5,
            divine_value: 0.0025,
          },
        ])
        .execute();

      const pricesA = await repository.getSnapshotCardPrices("snap-a");
      const pricesB = await repository.getSnapshotCardPrices("snap-b");

      expect(pricesA).toHaveLength(1);
      expect(pricesA[0].cardName).toBe("The Doctor");

      expect(pricesB).toHaveLength(1);
      expect(pricesB[0].cardName).toBe("Rain of Chaos");
    });
  });

  // ─── getRecentSnapshot ───────────────────────────────────────────────────

  describe("getRecentSnapshot", () => {
    it("should return null when no snapshots exist", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const snapshot = await repository.getRecentSnapshot(leagueId, 1);
      expect(snapshot).toBeNull();
    });

    it("should return null when no snapshots are within the time window", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      // Insert a snapshot from far in the past
      await testDb.kysely
        .insertInto("snapshots")
        .values({
          id: "snap-old",
          league_id: leagueId,
          fetched_at: "2020-01-01T00:00:00Z",
          exchange_chaos_to_divine: 200,
          stash_chaos_to_divine: 195,
          stacked_deck_chaos_cost: 3,
        })
        .execute();

      const snapshot = await repository.getRecentSnapshot(leagueId, 1);
      expect(snapshot).toBeNull();
    });

    it("should return a snapshot fetched within the time window", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      // Insert a snapshot with current timestamp
      const now = new Date().toISOString();
      await testDb.kysely
        .insertInto("snapshots")
        .values({
          id: "snap-recent",
          league_id: leagueId,
          fetched_at: now,
          exchange_chaos_to_divine: 200,
          stash_chaos_to_divine: 195,
          stacked_deck_chaos_cost: 3,
        })
        .execute();

      const snapshot = await repository.getRecentSnapshot(leagueId, 1);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.id).toBe("snap-recent");
    });

    it("should return the most recent snapshot when multiple exist", async () => {
      const leagueId = await seedLeague(testDb.kysely);
      const now = new Date();

      // Insert two recent snapshots
      const tenMinutesAgo = new Date(
        now.getTime() - 10 * 60 * 1000,
      ).toISOString();
      const fiveMinutesAgo = new Date(
        now.getTime() - 5 * 60 * 1000,
      ).toISOString();

      await testDb.kysely
        .insertInto("snapshots")
        .values([
          {
            id: "snap-older",
            league_id: leagueId,
            fetched_at: tenMinutesAgo,
            exchange_chaos_to_divine: 200,
            stash_chaos_to_divine: 195,
            stacked_deck_chaos_cost: 3,
          },
          {
            id: "snap-newer",
            league_id: leagueId,
            fetched_at: fiveMinutesAgo,
            exchange_chaos_to_divine: 201,
            stash_chaos_to_divine: 196,
            stacked_deck_chaos_cost: 3.5,
          },
        ])
        .execute();

      const snapshot = await repository.getRecentSnapshot(leagueId, 1);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.id).toBe("snap-newer");
    });

    it("should not return snapshots from a different league", async () => {
      const leagueA = await seedLeague(testDb.kysely, {
        id: "league-a",
        name: "Settlers",
      });
      const leagueB = await seedLeague(testDb.kysely, {
        id: "league-b",
        name: "Standard",
      });

      const now = new Date().toISOString();
      await testDb.kysely
        .insertInto("snapshots")
        .values({
          id: "snap-league-a",
          league_id: leagueA,
          fetched_at: now,
          exchange_chaos_to_divine: 200,
          stash_chaos_to_divine: 195,
          stacked_deck_chaos_cost: 3,
        })
        .execute();

      const snapshot = await repository.getRecentSnapshot(leagueB, 1);
      expect(snapshot).toBeNull();
    });
  });

  // ─── loadSnapshot ────────────────────────────────────────────────────────

  describe("loadSnapshot", () => {
    it("should return null for non-existent snapshot", async () => {
      const result = await repository.loadSnapshot("nonexistent");
      expect(result).toBeNull();
    });

    it("should return snapshot and card prices together", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-load",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1200,
                divineValue: 6.0,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {
              "Rain of Chaos": {
                chaosValue: 0.5,
                divineValue: 0.0025,
              },
            },
          },
        },
      });

      const result = await repository.loadSnapshot("snap-load");
      expect(result).not.toBeNull();
      expect(result!.snapshot.id).toBe("snap-load");
      expect(result!.snapshot.leagueId).toBe(leagueId);
      expect(result!.snapshot.exchangeChaosToDivine).toBe(200);
      expect(result!.snapshot.stashChaosToDivine).toBe(195);
      expect(result!.snapshot.stackedDeckChaosCost).toBe(3);

      expect(result!.cardPrices).toHaveLength(2);

      const doctorPrice = result!.cardPrices.find(
        (p) => p.cardName === "The Doctor",
      );
      const rainPrice = result!.cardPrices.find(
        (p) => p.cardName === "Rain of Chaos",
      );

      expect(doctorPrice).toBeDefined();
      expect(doctorPrice!.priceSource).toBe("exchange");
      expect(doctorPrice!.chaosValue).toBe(1200);

      expect(rainPrice).toBeDefined();
      expect(rainPrice!.priceSource).toBe("stash");
      expect(rainPrice!.chaosValue).toBe(0.5);
    });

    it("should return snapshot with empty card prices array when no prices exist", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-no-prices",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {},
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {},
          },
        },
      });

      const result = await repository.loadSnapshot("snap-no-prices");
      expect(result).not.toBeNull();
      expect(result!.snapshot.id).toBe("snap-no-prices");
      expect(result!.cardPrices).toEqual([]);
    });

    it("should load a snapshot with many card prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      const exchangePrices: Record<
        string,
        { chaosValue: number; divineValue: number }
      > = {};
      for (let i = 0; i < 50; i++) {
        exchangePrices[`Card ${i}`] = {
          chaosValue: i * 10,
          divineValue: i * 0.05,
        };
      }

      await repository.createSnapshot({
        id: "snap-many",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: exchangePrices,
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: exchangePrices,
          },
        },
      });

      const result = await repository.loadSnapshot("snap-many");
      expect(result).not.toBeNull();
      // 50 exchange + 50 stash = 100
      expect(result!.cardPrices).toHaveLength(100);
    });
  });

  // ─── Cross-feature Integration ───────────────────────────────────────────

  describe("cross-feature integration", () => {
    it("should support the full flow: create league → create snapshot → load", async () => {
      // 1. Create a league
      await repository.createLeague({
        id: "league-full",
        game: "poe1",
        name: "Settlers",
        startDate: "2025-01-01T00:00:00Z",
      });

      // 2. Verify league exists
      const league = await repository.getLeagueByName("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(league!.id).toBe("league-full");

      // 3. Create a snapshot for the league
      await repository.createSnapshot({
        id: "snap-full",
        leagueId: "league-full",
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3.5,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1200,
                divineValue: 6.0,
              },
              "Rain of Chaos": {
                chaosValue: 0.5,
                divineValue: 0.0025,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1100,
                divineValue: 5.64,
              },
            },
          },
        },
      });

      // 4. Load the full snapshot
      const result = await repository.loadSnapshot("snap-full");
      expect(result).not.toBeNull();
      expect(result!.snapshot.leagueId).toBe("league-full");
      expect(result!.snapshot.stackedDeckChaosCost).toBe(3.5);
      expect(result!.cardPrices).toHaveLength(3);

      // 5. Verify the snapshot is also findable by ID
      const byId = await repository.getSnapshotById("snap-full");
      expect(byId).not.toBeNull();
      expect(byId!.leagueId).toBe("league-full");
    });

    it("should support multiple snapshots for the same league", async () => {
      const leagueId = await seedLeague(testDb.kysely, {
        id: "league-multi-snap",
      });

      for (let i = 0; i < 3; i++) {
        await repository.createSnapshot({
          id: `snap-${i}`,
          leagueId,
          snapshotData: {
            timestamp: `2025-01-1${5 + i}T10:00:00Z`,
            stackedDeckChaosCost: 3 + i * 0.5,
            exchange: {
              chaosToDivineRatio: 200 + i,
              cardPrices: {
                "The Doctor": {
                  chaosValue: 1200 + i * 10,
                  divineValue: 6.0 + i * 0.05,
                },
              },
            },
            stash: {
              chaosToDivineRatio: 195 + i,
              cardPrices: {},
            },
          },
        });
      }

      // Verify each snapshot is independent
      for (let i = 0; i < 3; i++) {
        const result = await repository.loadSnapshot(`snap-${i}`);
        expect(result).not.toBeNull();
        expect(result!.snapshot.exchangeChaosToDivine).toBe(200 + i);
        expect(result!.cardPrices).toHaveLength(1);
        expect(result!.cardPrices[0].chaosValue).toBe(1200 + i * 10);
      }
    });

    it("should cascade delete snapshot card prices when snapshot is deleted", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-cascade",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "The Doctor": {
                chaosValue: 1200,
                divineValue: 6.0,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {},
          },
        },
      });

      // Verify prices exist
      let prices = await repository.getSnapshotCardPrices("snap-cascade");
      expect(prices).toHaveLength(1);

      // Delete the snapshot
      await testDb.kysely
        .deleteFrom("snapshots")
        .where("id", "=", "snap-cascade")
        .execute();

      // Prices should be cascade-deleted
      prices = await repository.getSnapshotCardPrices("snap-cascade");
      expect(prices).toEqual([]);
    });

    it("should handle card names with special characters in prices", async () => {
      const leagueId = await seedLeague(testDb.kysely);

      await repository.createSnapshot({
        id: "snap-special",
        leagueId,
        snapshotData: {
          timestamp: "2025-01-15T10:00:00Z",
          stackedDeckChaosCost: 3,
          exchange: {
            chaosToDivineRatio: 200,
            cardPrices: {
              "The King's Heart": {
                chaosValue: 500,
                divineValue: 2.5,
              },
              "Brother's Stash": {
                chaosValue: 2000,
                divineValue: 10.0,
              },
            },
          },
          stash: {
            chaosToDivineRatio: 195,
            cardPrices: {},
          },
        },
      });

      const prices = await repository.getSnapshotCardPrices("snap-special");
      expect(prices).toHaveLength(2);

      const kingsHeart = prices.find((p) => p.cardName === "The King's Heart");
      const brothersStash = prices.find(
        (p) => p.cardName === "Brother's Stash",
      );

      expect(kingsHeart).toBeDefined();
      expect(kingsHeart!.chaosValue).toBe(500);
      expect(kingsHeart!.divineValue).toBe(2.5);

      expect(brothersStash).toBeDefined();
      expect(brothersStash!.chaosValue).toBe(2000);
      expect(brothersStash!.divineValue).toBe(10.0);
    });
  });
});
