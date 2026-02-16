import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedDivinationCard,
  seedDivinationCardRarity,
  seedFilterCardRarities,
  seedFilterCardRarity,
  seedFilterMetadata,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import { CurrentSessionRepository } from "~/main/modules/current-session/CurrentSession.repository";
import type { Database } from "~/main/modules/database";
import { DivinationCardsRepository } from "~/main/modules/divination-cards/DivinationCards.repository";
import type { KnownRarity } from "~/types/data-stores";

import { RarityModelRepository } from "../RarityModel.repository";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const TEST_FILTER_ID = "filter_test0001";
const TEST_FILTER_PATH =
  "C:\\Users\\Test\\Documents\\My Games\\Path of Exile\\NeverSink.filter";
const TEST_FILTER_NAME = "NeverSink";
const TEST_GAME: "poe1" | "poe2" = "poe1";
const TEST_LEAGUE = "Settlers";

/**
 * Seed a realistic set of divination cards for testing.
 * Returns the card names that were seeded.
 */
async function seedTestCards(kysely: Kysely<Database>): Promise<string[]> {
  const cards = [
    { name: "The Doctor", stackSize: 8 },
    { name: "The Apothecary", stackSize: 5 },
    { name: "Rain of Chaos", stackSize: 8 },
    { name: "The Lover", stackSize: 2 },
    { name: "Emperor of Purity", stackSize: 7 },
    { name: "The Nurse", stackSize: 8 },
    { name: "The Wretched", stackSize: 5 },
    { name: "Abandoned Wealth", stackSize: 5 },
    { name: "Heterochromia", stackSize: 1 },
    { name: "The Demoness", stackSize: 5 },
  ];

  for (const card of cards) {
    await seedDivinationCard(kysely, {
      game: TEST_GAME,
      name: card.name,
      stackSize: card.stackSize,
    });
  }

  return cards.map((c) => c.name);
}

/**
 * Seed poe.ninja price-based rarities for all test cards.
 */
async function seedPriceRarities(
  kysely: Kysely<Database>,
  league: string,
): Promise<void> {
  // High-value cards = rarity 1
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "The Doctor",
    rarity: 1,
  });
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "The Apothecary",
    rarity: 1,
  });

  // Mid-value cards = rarity 2
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "The Nurse",
    rarity: 2,
  });
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "Abandoned Wealth",
    rarity: 2,
  });

  // Low-value cards = rarity 3
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "The Lover",
    rarity: 3,
  });

  // Common cards = rarity 4
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "Rain of Chaos",
    rarity: 4,
  });
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "Emperor of Purity",
    rarity: 4,
  });
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "The Wretched",
    rarity: 4,
  });
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "Heterochromia",
    rarity: 4,
  });
  await seedDivinationCardRarity(kysely, {
    game: TEST_GAME,
    league,
    cardName: "The Demoness",
    rarity: 4,
  });
}

/**
 * Seed a fully-parsed filter with card rarities that DIFFER from poe.ninja.
 * This simulates a NeverSink-style filter where tier assignments
 * may not match market prices perfectly.
 */
async function seedTestFilter(kysely: Kysely<Database>): Promise<string> {
  const filterId = await seedFilterMetadata(kysely, {
    id: TEST_FILTER_ID,
    filterType: "local",
    filePath: TEST_FILTER_PATH,
    filterName: TEST_FILTER_NAME,
    isFullyParsed: true,
    parsedAt: new Date().toISOString(),
  });

  // Filter tier assignments (intentionally different from poe.ninja prices):
  // The Doctor → t1 (rarity 1) — matches poe.ninja
  // The Apothecary → excustomstack (rarity 1) — matches poe.ninja
  // The Nurse → t2 (rarity 2) — matches poe.ninja
  // Rain of Chaos → t4c (rarity 3) — DIFFERS from poe.ninja (was 4)
  // The Lover → t3 (rarity 3) — matches poe.ninja
  // Emperor of Purity → t5 (rarity 4) — matches poe.ninja
  // The Wretched → t4 (rarity 4) — matches poe.ninja
  // Note: Abandoned Wealth, Heterochromia, The Demoness are NOT in the filter
  // → they should default to rarity 4
  await seedFilterCardRarities(kysely, filterId, [
    { cardName: "The Doctor", rarity: 1 },
    { cardName: "The Apothecary", rarity: 1 },
    { cardName: "The Nurse", rarity: 2 },
    { cardName: "Rain of Chaos", rarity: 3 }, // Differs from poe.ninja (4)
    { cardName: "The Lover", rarity: 3 },
    { cardName: "Emperor of Purity", rarity: 4 },
    { cardName: "The Wretched", rarity: 4 },
  ]);

  return filterId;
}

// ─── Test Suite: DivinationCardsRepository with filter rarity joins ──────────

describe("DivinationCardsRepository — filter rarity joins", () => {
  let testDb: TestDatabase;
  let repository: DivinationCardsRepository;

  beforeEach(async () => {
    testDb = createTestDatabase();
    repository = new DivinationCardsRepository(testDb.kysely);
    await seedTestCards(testDb.kysely);
    await seedPriceRarities(testDb.kysely, TEST_LEAGUE);
    await seedTestFilter(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── getAllByGame ────────────────────────────────────────────────────

  describe("getAllByGame with filterId", () => {
    it("should return both rarity and filterRarity when filterId is provided", async () => {
      const cards = await repository.getAllByGame(
        TEST_GAME,
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      expect(cards.length).toBe(10);

      // Check a card that IS in the filter
      const doctor = cards.find((c) => c.name === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor!.rarity).toBe(1); // From poe.ninja
      expect(doctor!.filterRarity).toBe(1); // From filter

      // Check a card with a DIFFERENT filter rarity
      const rain = cards.find((c) => c.name === "Rain of Chaos");
      expect(rain).toBeDefined();
      expect(rain!.rarity).toBe(4); // From poe.ninja (common)
      expect(rain!.filterRarity).toBe(3); // From filter (less common)

      // Check a card NOT in the filter
      const abandoned = cards.find((c) => c.name === "Abandoned Wealth");
      expect(abandoned).toBeDefined();
      expect(abandoned!.rarity).toBe(2); // From poe.ninja
      expect(abandoned!.filterRarity).toBeNull(); // Not in filter
    });

    it("should return filterRarity as null for all cards when no filterId is provided", async () => {
      const cards = await repository.getAllByGame(TEST_GAME, TEST_LEAGUE);

      expect(cards.length).toBe(10);

      for (const card of cards) {
        expect(card.filterRarity).toBeNull();
      }
    });

    it("should return filterRarity as null when filterId is null", async () => {
      const cards = await repository.getAllByGame(TEST_GAME, TEST_LEAGUE, null);

      for (const card of cards) {
        expect(card.filterRarity).toBeNull();
      }
    });

    it("should return filterRarity as null for non-existent filterId", async () => {
      const cards = await repository.getAllByGame(
        TEST_GAME,
        TEST_LEAGUE,
        "filter_nonexistent",
      );

      for (const card of cards) {
        expect(card.filterRarity).toBeNull();
      }
    });

    it("should return default rarity 4 when no league is provided", async () => {
      const cards = await repository.getAllByGame(
        TEST_GAME,
        undefined,
        TEST_FILTER_ID,
      );

      // All rarity values should be 0 (Unknown) since no league rarity data
      for (const card of cards) {
        expect(card.rarity).toBe(0);
      }

      // But filterRarity should still be populated
      const doctor = cards.find((c) => c.name === "The Doctor");
      expect(doctor!.filterRarity).toBe(1);
    });

    it("should correctly join filter rarities for all tiers", async () => {
      const cards = await repository.getAllByGame(
        TEST_GAME,
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      const cardMap = new Map(cards.map((c) => [c.name, c]));

      // Tier 1 (rarity 1) cards in filter
      expect(cardMap.get("The Doctor")!.filterRarity).toBe(1);
      expect(cardMap.get("The Apothecary")!.filterRarity).toBe(1);

      // Tier 2 (rarity 2) cards in filter
      expect(cardMap.get("The Nurse")!.filterRarity).toBe(2);

      // Tier 3 (rarity 3) cards in filter
      expect(cardMap.get("Rain of Chaos")!.filterRarity).toBe(3);
      expect(cardMap.get("The Lover")!.filterRarity).toBe(3);

      // Tier 4 (rarity 4) cards in filter
      expect(cardMap.get("Emperor of Purity")!.filterRarity).toBe(4);
      expect(cardMap.get("The Wretched")!.filterRarity).toBe(4);

      // Cards NOT in filter
      expect(cardMap.get("Abandoned Wealth")!.filterRarity).toBeNull();
      expect(cardMap.get("Heterochromia")!.filterRarity).toBeNull();
      expect(cardMap.get("The Demoness")!.filterRarity).toBeNull();
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────

  describe("getById with filterId", () => {
    it("should return filterRarity for a card in the filter", async () => {
      const card = await repository.getById(
        "poe1_the-doctor",
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(1);
      expect(card!.filterRarity).toBe(1);
    });

    it("should return null filterRarity for a card NOT in the filter", async () => {
      const card = await repository.getById(
        "poe1_abandoned-wealth",
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(2); // poe.ninja rarity
      expect(card!.filterRarity).toBeNull();
    });

    it("should return null filterRarity when no filterId provided", async () => {
      const card = await repository.getById("poe1_the-doctor", TEST_LEAGUE);

      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(1);
      expect(card!.filterRarity).toBeNull();
    });
  });

  // ─── getByName ───────────────────────────────────────────────────────

  describe("getByName with filterId", () => {
    it("should return filterRarity when card is in filter", async () => {
      const card = await repository.getByName(
        TEST_GAME,
        "Rain of Chaos",
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(4); // poe.ninja: common
      expect(card!.filterRarity).toBe(3); // filter: less common
    });

    it("should return null filterRarity when card is not in filter", async () => {
      const card = await repository.getByName(
        TEST_GAME,
        "Heterochromia",
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      expect(card).not.toBeNull();
      expect(card!.filterRarity).toBeNull();
    });

    it("should return null filterRarity when filterId is null", async () => {
      const card = await repository.getByName(
        TEST_GAME,
        "The Doctor",
        TEST_LEAGUE,
        null,
      );

      expect(card).not.toBeNull();
      expect(card!.filterRarity).toBeNull();
    });
  });

  // ─── searchByName ────────────────────────────────────────────────────

  describe("searchByName with filterId", () => {
    it("should return filterRarity in search results", async () => {
      const results = await repository.searchByName(
        TEST_GAME,
        "Doctor",
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("The Doctor");
      expect(results[0].rarity).toBe(1);
      expect(results[0].filterRarity).toBe(1);
    });

    it("should return null filterRarity in search results when no filterId", async () => {
      const results = await repository.searchByName(
        TEST_GAME,
        "Doctor",
        TEST_LEAGUE,
      );

      expect(results.length).toBe(1);
      expect(results[0].filterRarity).toBeNull();
    });

    it("should handle search returning mix of in-filter and not-in-filter cards", async () => {
      // Search for "The" which matches many cards
      const results = await repository.searchByName(
        TEST_GAME,
        "The",
        TEST_LEAGUE,
        TEST_FILTER_ID,
      );

      expect(results.length).toBeGreaterThan(0);

      const inFilter = results.filter((c) => c.filterRarity !== null);
      const notInFilter = results.filter((c) => c.filterRarity === null);

      // We should have some of each
      expect(inFilter.length).toBeGreaterThan(0);
      expect(notInFilter.length).toBeGreaterThan(0);
    });
  });

  // ─── getAllCardNames ─────────────────────────────────────────────────

  describe("getAllCardNames", () => {
    it("should return all card names for the game", async () => {
      const names = await repository.getAllCardNames(TEST_GAME);

      expect(names.length).toBe(10);
      expect(names).toContain("The Doctor");
      expect(names).toContain("Rain of Chaos");
      expect(names).toContain("Heterochromia");
    });

    it("should return sorted card names", async () => {
      const names = await repository.getAllCardNames(TEST_GAME);

      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it("should return empty array for game with no cards", async () => {
      const names = await repository.getAllCardNames("poe2");
      expect(names).toEqual([]);
    });
  });
});

// ─── Test Suite: updateRaritiesFromFilter (via repository operations) ────────

describe("updateRaritiesFromFilter — repository-level integration", () => {
  let testDb: TestDatabase;
  let divinationCardsRepo: DivinationCardsRepository;
  let filterRepo: RarityModelRepository;

  beforeEach(async () => {
    testDb = createTestDatabase();
    divinationCardsRepo = new DivinationCardsRepository(testDb.kysely);
    filterRepo = new RarityModelRepository(testDb.kysely);
    await seedTestCards(testDb.kysely);
    await seedPriceRarities(testDb.kysely, TEST_LEAGUE);
    await seedTestFilter(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("should read filter rarities and write to divination_card_rarities", async () => {
    // Simulate what updateRaritiesFromFilter does:
    // 1. Read filter rarities
    const filterRarities = await filterRepo.getCardRarities(TEST_FILTER_ID);
    expect(filterRarities.length).toBe(7); // 7 cards in filter

    // 2. Build lookup map
    const filterRarityMap = new Map(
      filterRarities.map((r) => [r.cardName, r.rarity]),
    );

    // 3. Get all card names
    const allCardNames = await divinationCardsRepo.getAllCardNames(TEST_GAME);
    expect(allCardNames.length).toBe(10);

    // 4. Build updates with default rarity 4 for missing cards
    const updates = allCardNames.map((name) => ({
      name,
      rarity: filterRarityMap.get(name) ?? 4,
    }));

    // 5. Write to divination_card_rarities
    await divinationCardsRepo.updateRarities(TEST_GAME, TEST_LEAGUE, updates);

    // 6. Verify: cards IN filter should have filter rarity
    const cards = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
    );
    const cardMap = new Map(cards.map((c) => [c.name, c]));

    // Rain of Chaos: was rarity 4 (poe.ninja), now rarity 3 (from filter)
    expect(cardMap.get("Rain of Chaos")!.rarity).toBe(3);

    // Cards not in filter should be rarity 4
    expect(cardMap.get("Abandoned Wealth")!.rarity).toBe(4);
    expect(cardMap.get("Heterochromia")!.rarity).toBe(4);
    expect(cardMap.get("The Demoness")!.rarity).toBe(4);

    // Cards in filter with rarity 1 should stay at 1
    expect(cardMap.get("The Doctor")!.rarity).toBe(1);
    expect(cardMap.get("The Apothecary")!.rarity).toBe(1);
  });

  it("should handle filter with no matching cards gracefully", async () => {
    // Create a filter with cards that don't exist in the DB
    const emptyFilterId = await seedFilterMetadata(testDb.kysely, {
      id: "filter_empty_001",
      filePath: "C:\\empty.filter",
      filterName: "EmptyFilter",
      isFullyParsed: true,
      parsedAt: new Date().toISOString(),
    });

    await seedFilterCardRarity(testDb.kysely, {
      filterId: emptyFilterId,
      cardName: "Nonexistent Card",
      rarity: 1,
    });

    const filterRarities = await filterRepo.getCardRarities(emptyFilterId);
    const filterRarityMap = new Map(
      filterRarities.map((r) => [r.cardName, r.rarity]),
    );

    const allCardNames = await divinationCardsRepo.getAllCardNames(TEST_GAME);
    const updates = allCardNames.map((name) => ({
      name,
      rarity: filterRarityMap.get(name) ?? 4,
    }));

    await divinationCardsRepo.updateRarities(TEST_GAME, TEST_LEAGUE, updates);

    // All cards should default to rarity 4 since none match
    const cards = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
    );
    for (const card of cards) {
      expect(card.rarity).toBe(4);
    }
  });

  it("should overwrite existing poe.ninja rarities when applying filter rarities", async () => {
    // Verify initial state: The Nurse has poe.ninja rarity 2
    const beforeCards = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
    );
    const nurseBefore = beforeCards.find((c) => c.name === "The Nurse");
    expect(nurseBefore!.rarity).toBe(2);

    // Apply filter rarities (which also sets The Nurse to rarity 2 — same value)
    const filterRarities = await filterRepo.getCardRarities(TEST_FILTER_ID);
    const filterRarityMap = new Map(
      filterRarities.map((r) => [r.cardName, r.rarity]),
    );
    const allCardNames = await divinationCardsRepo.getAllCardNames(TEST_GAME);
    const updates = allCardNames.map((name) => ({
      name,
      rarity: filterRarityMap.get(name) ?? 4,
    }));

    await divinationCardsRepo.updateRarities(TEST_GAME, TEST_LEAGUE, updates);

    // After: Abandoned Wealth was rarity 2 (poe.ninja), now overwritten to 4 (not in filter)
    const afterCards = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
    );
    const abandonedAfter = afterCards.find(
      (c) => c.name === "Abandoned Wealth",
    );
    expect(abandonedAfter!.rarity).toBe(4);
  });
});

// ─── Test Suite: CurrentSessionRepository with filter rarity ─────────────────

describe("CurrentSessionRepository — getSessionCards with filterId", () => {
  let testDb: TestDatabase;
  let sessionRepo: CurrentSessionRepository;
  let leagueId: string;
  let snapshotId: string;
  let sessionId: string;

  beforeEach(async () => {
    testDb = createTestDatabase();
    sessionRepo = new CurrentSessionRepository(testDb.kysely);

    // Seed reference data
    await seedTestCards(testDb.kysely);
    await seedPriceRarities(testDb.kysely, TEST_LEAGUE);
    await seedTestFilter(testDb.kysely);

    // Create a league, snapshot, and session
    leagueId = await seedLeague(testDb.kysely, {
      name: TEST_LEAGUE,
      game: TEST_GAME,
    });

    snapshotId = await seedSnapshot(testDb.kysely, {
      leagueId,
      cardPrices: [
        {
          cardName: "The Doctor",
          chaosValue: 50000,
          divineValue: 250,
          priceSource: "exchange",
        },
        {
          cardName: "Rain of Chaos",
          chaosValue: 1,
          divineValue: 0.005,
          priceSource: "exchange",
        },
      ],
    });

    sessionId = await seedSession(testDb.kysely, {
      game: TEST_GAME,
      leagueId,
      snapshotId,
    });

    // Add some cards to the session
    await seedSessionCards(testDb.kysely, sessionId, [
      { cardName: "The Doctor", count: 1 },
      { cardName: "Rain of Chaos", count: 5 },
      { cardName: "Abandoned Wealth", count: 2 },
    ]);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("should return filterRarity alongside rarity when filterId is provided", async () => {
    const cards = await sessionRepo.getSessionCards(sessionId, TEST_FILTER_ID);

    expect(cards.length).toBe(3);

    const doctorCard = cards.find((c) => c.cardName === "The Doctor");
    expect(doctorCard).toBeDefined();
    expect(doctorCard!.divinationCard?.rarity).toBe(1); // poe.ninja
    expect(doctorCard!.divinationCard?.filterRarity).toBe(1); // filter

    const rainCard = cards.find((c) => c.cardName === "Rain of Chaos");
    expect(rainCard).toBeDefined();
    expect(rainCard!.divinationCard?.rarity).toBe(4); // poe.ninja: common
    expect(rainCard!.divinationCard?.filterRarity).toBe(3); // filter: less common

    const abandonedCard = cards.find((c) => c.cardName === "Abandoned Wealth");
    expect(abandonedCard).toBeDefined();
    expect(abandonedCard!.divinationCard?.rarity).toBe(2); // poe.ninja: rare
    expect(abandonedCard!.divinationCard?.filterRarity).toBeNull(); // not in filter
  });

  it("should return null filterRarity when no filterId is provided", async () => {
    const cards = await sessionRepo.getSessionCards(sessionId);

    expect(cards.length).toBe(3);

    for (const card of cards) {
      expect(card.divinationCard?.filterRarity).toBeNull();
    }
  });

  it("should return null filterRarity when filterId is null", async () => {
    const cards = await sessionRepo.getSessionCards(sessionId, null);

    expect(cards.length).toBe(3);

    for (const card of cards) {
      expect(card.divinationCard?.filterRarity).toBeNull();
    }
  });

  it("should preserve other divination card metadata alongside filterRarity", async () => {
    const cards = await sessionRepo.getSessionCards(sessionId, TEST_FILTER_ID);

    const doctorCard = cards.find((c) => c.cardName === "The Doctor");
    expect(doctorCard).toBeDefined();

    // Verify metadata is still populated
    expect(doctorCard!.divinationCard).toBeDefined();
    expect(doctorCard!.divinationCard!.id).toBe("poe1_the-doctor");
    expect(doctorCard!.divinationCard!.stackSize).toBe(8);
    expect(doctorCard!.divinationCard!.description).toBeDefined();
    expect(doctorCard!.divinationCard!.rewardHtml).toBeDefined();
    expect(doctorCard!.divinationCard!.artSrc).toBeDefined();
  });

  it("should handle session with cards not in divination_cards table", async () => {
    // Add a card that doesn't exist in divination_cards
    await seedSessionCards(testDb.kysely, sessionId, [
      { cardName: "Unknown Card", count: 1 },
    ]);

    const cards = await sessionRepo.getSessionCards(sessionId, TEST_FILTER_ID);

    // Should still work — unknown cards just won't have divination card metadata
    const unknownCard = cards.find((c) => c.cardName === "Unknown Card");
    expect(unknownCard).toBeDefined();
    expect(unknownCard!.count).toBe(1);
    // No divination card join result, so filterRarity comes from SQL NULL
  });
});

// ─── Test Suite: RarityModelRepository card rarities ──────────────────────────────

describe("RarityModelRepository — card rarities for rarity application", () => {
  let testDb: TestDatabase;
  let filterRepo: RarityModelRepository;

  beforeEach(async () => {
    testDb = createTestDatabase();
    filterRepo = new RarityModelRepository(testDb.kysely);
    await seedTestFilter(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("should return all card rarities for a filter", async () => {
    const rarities = await filterRepo.getCardRarities(TEST_FILTER_ID);

    expect(rarities.length).toBe(7);

    const rarityMap = new Map(rarities.map((r) => [r.cardName, r.rarity]));
    expect(rarityMap.get("The Doctor")).toBe(1);
    expect(rarityMap.get("The Apothecary")).toBe(1);
    expect(rarityMap.get("The Nurse")).toBe(2);
    expect(rarityMap.get("Rain of Chaos")).toBe(3);
    expect(rarityMap.get("The Lover")).toBe(3);
    expect(rarityMap.get("Emperor of Purity")).toBe(4);
    expect(rarityMap.get("The Wretched")).toBe(4);
  });

  it("should return empty array for non-existent filter", async () => {
    const rarities = await filterRepo.getCardRarities("filter_nonexistent");
    expect(rarities).toEqual([]);
  });

  it("should return rarities sorted by card name", async () => {
    const rarities = await filterRepo.getCardRarities(TEST_FILTER_ID);
    const names = rarities.map((r) => r.cardName);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("should count card rarities correctly", async () => {
    const count = await filterRepo.getCardRarityCount(TEST_FILTER_ID);
    expect(count).toBe(7);
  });

  it("should get a specific card rarity", async () => {
    const rarity = await filterRepo.getCardRarity(
      TEST_FILTER_ID,
      "Rain of Chaos",
    );
    expect(rarity).not.toBeNull();
    expect(rarity!.rarity).toBe(3);
    expect(rarity!.filterId).toBe(TEST_FILTER_ID);
    expect(rarity!.cardName).toBe("Rain of Chaos");
  });

  it("should return null for a card not in the filter", async () => {
    const rarity = await filterRepo.getCardRarity(
      TEST_FILTER_ID,
      "Abandoned Wealth",
    );
    expect(rarity).toBeNull();
  });

  it("should replace card rarities for a filter", async () => {
    const newRarities: Array<{ cardName: string; rarity: KnownRarity }> = [
      { cardName: "The Doctor", rarity: 2 }, // Changed from 1 to 2
      { cardName: "New Card", rarity: 1 },
    ];

    await filterRepo.replaceCardRarities(TEST_FILTER_ID, newRarities);

    const rarities = await filterRepo.getCardRarities(TEST_FILTER_ID);
    expect(rarities.length).toBe(2);

    const rarityMap = new Map(rarities.map((r) => [r.cardName, r.rarity]));
    expect(rarityMap.get("The Doctor")).toBe(2);
    expect(rarityMap.get("New Card")).toBe(1);

    // Old cards should be gone
    expect(rarityMap.has("The Nurse")).toBe(false);
    expect(rarityMap.has("Rain of Chaos")).toBe(false);
  });
});

// ─── Test Suite: Dual rarity display scenarios ───────────────────────────────

describe("Dual rarity scenarios", () => {
  let testDb: TestDatabase;
  let divinationCardsRepo: DivinationCardsRepository;

  beforeEach(async () => {
    testDb = createTestDatabase();
    divinationCardsRepo = new DivinationCardsRepository(testDb.kysely);
    await seedTestCards(testDb.kysely);
    await seedPriceRarities(testDb.kysely, TEST_LEAGUE);
    await seedTestFilter(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("should allow consumers to pick the appropriate rarity source", async () => {
    const cards = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
      TEST_FILTER_ID,
    );

    // Simulate the consumer choosing rarity based on setting
    const raritySource: "poe.ninja" | "filter" = "filter";

    for (const card of cards) {
      const activeRarity =
        raritySource === "filter" && card.filterRarity != null
          ? card.filterRarity
          : card.rarity;

      // Rain of Chaos: poe.ninja=4, filter=3 → when source is "filter", activeRarity=3
      if (card.name === "Rain of Chaos") {
        expect(activeRarity).toBe(3);
      }

      // Abandoned Wealth: poe.ninja=2, filter=null → fallback to poe.ninja=2
      if (card.name === "Abandoned Wealth") {
        expect(activeRarity).toBe(2);
      }

      // The Doctor: both sources agree → 1
      if (card.name === "The Doctor") {
        expect(activeRarity).toBe(1);
      }
    }
  });

  it("should fall back to poe.ninja rarity when filter source but no filter selected", async () => {
    const cards = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
      null, // No filter selected
    );

    const raritySource: "poe.ninja" | "filter" = "filter";

    for (const card of cards) {
      const activeRarity =
        raritySource === "filter" && card.filterRarity != null
          ? card.filterRarity
          : card.rarity;

      // Should always use poe.ninja rarity as fallback
      expect(activeRarity).toBe(card.rarity);
    }
  });

  it("should fall back to rarity 0 (Unknown) when no league and no filter", async () => {
    const cards = await divinationCardsRepo.getAllByGame(TEST_GAME);

    for (const card of cards) {
      expect(card.rarity).toBe(0); // Default to Unknown when no league
      expect(card.filterRarity).toBeNull(); // No filter provided
    }
  });

  it("should handle multiple filters for the same cards independently", async () => {
    // Create a second filter with different rarities
    const secondFilterId = await seedFilterMetadata(testDb.kysely, {
      id: "filter_test0002",
      filePath: "C:\\path\\FilterBlade.filter",
      filterName: "FilterBlade",
      isFullyParsed: true,
      parsedAt: new Date().toISOString(),
    });

    await seedFilterCardRarities(testDb.kysely, secondFilterId, [
      { cardName: "The Doctor", rarity: 1 },
      { cardName: "Rain of Chaos", rarity: 4 }, // Different from first filter (3)
      { cardName: "Abandoned Wealth", rarity: 2 }, // In this filter but not in first
    ]);

    // Query with first filter
    const cardsFilter1 = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
      TEST_FILTER_ID,
    );
    const rainFilter1 = cardsFilter1.find((c) => c.name === "Rain of Chaos");
    expect(rainFilter1!.filterRarity).toBe(3);

    // Query with second filter
    const cardsFilter2 = await divinationCardsRepo.getAllByGame(
      TEST_GAME,
      TEST_LEAGUE,
      secondFilterId,
    );
    const rainFilter2 = cardsFilter2.find((c) => c.name === "Rain of Chaos");
    expect(rainFilter2!.filterRarity).toBe(4);

    // Abandoned Wealth: null in first filter, 2 in second
    const abandonedFilter1 = cardsFilter1.find(
      (c) => c.name === "Abandoned Wealth",
    );
    expect(abandonedFilter1!.filterRarity).toBeNull();

    const abandonedFilter2 = cardsFilter2.find(
      (c) => c.name === "Abandoned Wealth",
    );
    expect(abandonedFilter2!.filterRarity).toBe(2);
  });
});
