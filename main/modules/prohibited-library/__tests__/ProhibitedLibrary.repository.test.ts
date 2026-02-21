import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedDivinationCard,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import type { UpsertCardWeightRow } from "../ProhibitedLibrary.repository";
import { ProhibitedLibraryRepository } from "../ProhibitedLibrary.repository";

describe("ProhibitedLibraryRepository", () => {
  let testDb: TestDatabase;
  let repository: ProhibitedLibraryRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new ProhibitedLibraryRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function makeRow(
    overrides: Partial<UpsertCardWeightRow> = {},
  ): UpsertCardWeightRow {
    return {
      cardName: overrides.cardName ?? "The Doctor",
      game: overrides.game ?? "poe1",
      league: overrides.league ?? "Keepers",
      weight: overrides.weight ?? 100,
      rarity: overrides.rarity ?? 1,
      fromBoss: overrides.fromBoss ?? false,
      loadedAt: overrides.loadedAt ?? "2025-06-01T00:00:00.000Z",
    };
  }

  // ─── upsertCardWeights ───────────────────────────────────────────────────

  describe("upsertCardWeights", () => {
    it("should insert a single card weight", async () => {
      const row = makeRow();
      await repository.upsertCardWeights([row]);

      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(1);
      expect(weights[0].cardName).toBe("The Doctor");
      expect(weights[0].game).toBe("poe1");
      expect(weights[0].league).toBe("Keepers");
      expect(weights[0].weight).toBe(100);
      expect(weights[0].rarity).toBe(1);
      expect(weights[0].fromBoss).toBe(false);
      expect(weights[0].loadedAt).toBe("2025-06-01T00:00:00.000Z");
    });

    it("should insert multiple card weights", async () => {
      const rows = [
        makeRow({ cardName: "The Doctor", weight: 10, rarity: 1 }),
        makeRow({ cardName: "Rain of Chaos", weight: 5000, rarity: 4 }),
        makeRow({ cardName: "The Nurse", weight: 50, rarity: 2 }),
      ];
      await repository.upsertCardWeights(rows);

      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(3);
      // Results are ordered by card_name ASC
      expect(weights[0].cardName).toBe("Rain of Chaos");
      expect(weights[1].cardName).toBe("The Doctor");
      expect(weights[2].cardName).toBe("The Nurse");
    });

    it("should handle empty array without error", async () => {
      await expect(repository.upsertCardWeights([])).resolves.not.toThrow();
      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(0);
    });

    it("should update existing card weight on conflict (same card_name, game, league)", async () => {
      await repository.upsertCardWeights([
        makeRow({ weight: 100, rarity: 1, fromBoss: false }),
      ]);

      // Upsert the same card with different values
      await repository.upsertCardWeights([
        makeRow({
          weight: 500,
          rarity: 3,
          fromBoss: true,
          loadedAt: "2025-07-01T00:00:00.000Z",
        }),
      ]);

      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(1);
      expect(weights[0].weight).toBe(500);
      expect(weights[0].rarity).toBe(3);
      expect(weights[0].fromBoss).toBe(true);
      expect(weights[0].loadedAt).toBe("2025-07-01T00:00:00.000Z");
    });

    it("should store fromBoss as SQLite boolean correctly", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Boss Card", fromBoss: true }),
        makeRow({ cardName: "Regular Card", fromBoss: false }),
      ]);

      const weights = await repository.getCardWeights("poe1", "Keepers");
      const bossCard = weights.find((w) => w.cardName === "Boss Card");
      const regularCard = weights.find((w) => w.cardName === "Regular Card");
      expect(bossCard!.fromBoss).toBe(true);
      expect(regularCard!.fromBoss).toBe(false);
    });

    it("should keep separate entries for different leagues", async () => {
      await repository.upsertCardWeights([
        makeRow({ league: "Keepers", weight: 100 }),
        makeRow({ league: "Settlers", weight: 200 }),
      ]);

      const keepers = await repository.getCardWeights("poe1", "Keepers");
      const settlers = await repository.getCardWeights("poe1", "Settlers");
      expect(keepers).toHaveLength(1);
      expect(keepers[0].weight).toBe(100);
      expect(settlers).toHaveLength(1);
      expect(settlers[0].weight).toBe(200);
    });

    it("should keep separate entries for different games", async () => {
      await repository.upsertCardWeights([
        makeRow({ game: "poe1", weight: 100 }),
        makeRow({ game: "poe2", weight: 200 }),
      ]);

      const poe1 = await repository.getCardWeights("poe1", "Keepers");
      const poe2 = await repository.getCardWeights("poe2", "Keepers");
      expect(poe1).toHaveLength(1);
      expect(poe1[0].weight).toBe(100);
      expect(poe2).toHaveLength(1);
      expect(poe2[0].weight).toBe(200);
    });
  });

  // ─── getCardWeights ──────────────────────────────────────────────────────

  describe("getCardWeights", () => {
    it("should return empty array when no data exists", async () => {
      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toEqual([]);
    });

    it("should return only cards for the specified game and league", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Card A", game: "poe1", league: "Keepers" }),
        makeRow({ cardName: "Card B", game: "poe1", league: "Settlers" }),
        makeRow({ cardName: "Card C", game: "poe2", league: "Keepers" }),
      ]);

      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(1);
      expect(weights[0].cardName).toBe("Card A");
    });

    it("should return results sorted by card_name ascending", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Zebra Card" }),
        makeRow({ cardName: "Alpha Card" }),
        makeRow({ cardName: "Middle Card" }),
      ]);

      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(3);
      expect(weights[0].cardName).toBe("Alpha Card");
      expect(weights[1].cardName).toBe("Middle Card");
      expect(weights[2].cardName).toBe("Zebra Card");
    });

    it("should correctly map all DTO fields", async () => {
      await repository.upsertCardWeights([
        makeRow({
          cardName: "Test Card",
          game: "poe1",
          league: "Keepers",
          weight: 42,
          rarity: 3,
          fromBoss: true,
          loadedAt: "2025-06-15T12:30:00.000Z",
        }),
      ]);

      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(1);
      const dto = weights[0];
      expect(dto.cardName).toBe("Test Card");
      expect(dto.game).toBe("poe1");
      expect(dto.league).toBe("Keepers");
      expect(dto.weight).toBe(42);
      expect(dto.rarity).toBe(3);
      expect(dto.fromBoss).toBe(true);
      expect(dto.loadedAt).toBe("2025-06-15T12:30:00.000Z");
    });
  });

  // ─── getFromBossCards ────────────────────────────────────────────────────

  describe("getFromBossCards", () => {
    it("should return empty array when no data exists", async () => {
      const cards = await repository.getFromBossCards("poe1", "Keepers");
      expect(cards).toEqual([]);
    });

    it("should return only boss-exclusive cards", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Boss Card 1", fromBoss: true }),
        makeRow({ cardName: "Regular Card", fromBoss: false }),
        makeRow({ cardName: "Boss Card 2", fromBoss: true }),
      ]);

      const cards = await repository.getFromBossCards("poe1", "Keepers");
      expect(cards).toHaveLength(2);
      expect(cards.every((c) => c.fromBoss === true)).toBe(true);
      expect(cards[0].cardName).toBe("Boss Card 1");
      expect(cards[1].cardName).toBe("Boss Card 2");
    });

    it("should return empty array when no boss cards exist", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Regular 1", fromBoss: false }),
        makeRow({ cardName: "Regular 2", fromBoss: false }),
      ]);

      const cards = await repository.getFromBossCards("poe1", "Keepers");
      expect(cards).toHaveLength(0);
    });

    it("should filter by game and league", async () => {
      await repository.upsertCardWeights([
        makeRow({
          cardName: "Boss A",
          game: "poe1",
          league: "Keepers",
          fromBoss: true,
        }),
        makeRow({
          cardName: "Boss B",
          game: "poe1",
          league: "Settlers",
          fromBoss: true,
        }),
        makeRow({
          cardName: "Boss C",
          game: "poe2",
          league: "Keepers",
          fromBoss: true,
        }),
      ]);

      const cards = await repository.getFromBossCards("poe1", "Keepers");
      expect(cards).toHaveLength(1);
      expect(cards[0].cardName).toBe("Boss A");
    });

    it("should return results sorted by card_name ascending", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Zulu Boss", fromBoss: true }),
        makeRow({ cardName: "Alpha Boss", fromBoss: true }),
      ]);

      const cards = await repository.getFromBossCards("poe1", "Keepers");
      expect(cards).toHaveLength(2);
      expect(cards[0].cardName).toBe("Alpha Boss");
      expect(cards[1].cardName).toBe("Zulu Boss");
    });
  });

  // ─── upsertMetadata ─────────────────────────────────────────────────────

  describe("upsertMetadata", () => {
    it("should insert metadata for a new game", async () => {
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        42,
      );

      const metadata = await repository.getMetadata("poe1");
      expect(metadata).toBeDefined();
      expect(metadata!.game).toBe("poe1");
      expect(metadata!.league).toBe("Keepers");
      expect(metadata!.loaded_at).toBe("2025-06-01T00:00:00.000Z");
      expect(metadata!.app_version).toBe("1.0.0");
      expect(metadata!.card_count).toBe(42);
    });

    it("should update metadata on conflict (same game PK)", async () => {
      await repository.upsertMetadata(
        "poe1",
        "Settlers",
        "2025-01-01T00:00:00.000Z",
        "0.9.0",
        30,
      );
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        42,
      );

      const metadata = await repository.getMetadata("poe1");
      expect(metadata).toBeDefined();
      expect(metadata!.league).toBe("Keepers");
      expect(metadata!.loaded_at).toBe("2025-06-01T00:00:00.000Z");
      expect(metadata!.app_version).toBe("1.0.0");
      expect(metadata!.card_count).toBe(42);
    });

    it("should maintain separate metadata per game", async () => {
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        42,
      );
      await repository.upsertMetadata(
        "poe2",
        "Dawn",
        "2025-06-02T00:00:00.000Z",
        "1.0.0",
        10,
      );

      const poe1 = await repository.getMetadata("poe1");
      const poe2 = await repository.getMetadata("poe2");
      expect(poe1!.league).toBe("Keepers");
      expect(poe1!.card_count).toBe(42);
      expect(poe2!.league).toBe("Dawn");
      expect(poe2!.card_count).toBe(10);
    });

    it("should update one game metadata without affecting the other", async () => {
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        42,
      );
      await repository.upsertMetadata(
        "poe2",
        "Dawn",
        "2025-06-02T00:00:00.000Z",
        "1.0.0",
        10,
      );

      // Update poe1 only
      await repository.upsertMetadata(
        "poe1",
        "Settlers",
        "2025-07-01T00:00:00.000Z",
        "1.1.0",
        50,
      );

      const poe1 = await repository.getMetadata("poe1");
      const poe2 = await repository.getMetadata("poe2");
      expect(poe1!.league).toBe("Settlers");
      expect(poe1!.card_count).toBe(50);
      // poe2 should be unchanged
      expect(poe2!.league).toBe("Dawn");
      expect(poe2!.card_count).toBe(10);
    });
  });

  // ─── getMetadata ────────────────────────────────────────────────────────

  describe("getMetadata", () => {
    it("should return undefined when no metadata exists", async () => {
      const metadata = await repository.getMetadata("poe1");
      expect(metadata).toBeUndefined();
    });

    it("should return metadata after upsert", async () => {
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        42,
      );

      const metadata = await repository.getMetadata("poe1");
      expect(metadata).toBeDefined();
      expect(metadata!.game).toBe("poe1");
      expect(metadata!.league).toBe("Keepers");
    });

    it("should not return metadata for a different game", async () => {
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        42,
      );

      const metadata = await repository.getMetadata("poe2");
      expect(metadata).toBeUndefined();
    });

    it("should return all fields correctly", async () => {
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T12:00:00.000Z",
        "2.5.3",
        123,
      );

      const metadata = await repository.getMetadata("poe1");
      expect(metadata).toBeDefined();
      expect(metadata!.game).toBe("poe1");
      expect(metadata!.league).toBe("Keepers");
      expect(metadata!.loaded_at).toBe("2025-06-01T12:00:00.000Z");
      expect(metadata!.app_version).toBe("2.5.3");
      expect(metadata!.card_count).toBe(123);
      expect(metadata!.created_at).toBeDefined();
    });
  });

  // ─── syncFromBossFlags ──────────────────────────────────────────────────

  describe("syncFromBossFlags", () => {
    it("should set from_boss = 1 on divination_cards that are boss-exclusive in PL data", async () => {
      // Seed divination cards
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Boss Card",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Regular Card",
      });

      // Seed PL weights with Boss Card as boss-exclusive
      await repository.upsertCardWeights([
        makeRow({ cardName: "Boss Card", fromBoss: true }),
        makeRow({ cardName: "Regular Card", fromBoss: false }),
      ]);

      await repository.syncFromBossFlags("poe1", "Keepers");

      // Verify divination_cards.from_boss was updated
      const allCards = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss"])
        .where("game", "=", "poe1")
        .orderBy("name", "asc")
        .execute();

      const bossCard = allCards.find((c) => c.name === "Boss Card");
      const regularCard = allCards.find((c) => c.name === "Regular Card");
      expect(bossCard!.from_boss).toBe(1);
      expect(regularCard!.from_boss).toBe(0);
    });

    it("should clear from_boss for cards no longer marked as boss-exclusive", async () => {
      // Seed a card that was previously marked as boss-exclusive
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Was Boss Card",
      });

      // First, manually set from_boss = 1
      await testDb.kysely
        .updateTable("divination_cards")
        .set({ from_boss: 1 })
        .where("name", "=", "Was Boss Card")
        .execute();

      // Now insert PL data where this card is NOT boss-exclusive
      await repository.upsertCardWeights([
        makeRow({ cardName: "Was Boss Card", fromBoss: false }),
      ]);

      await repository.syncFromBossFlags("poe1", "Keepers");

      const card = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss"])
        .where("name", "=", "Was Boss Card")
        .executeTakeFirst();

      expect(card!.from_boss).toBe(0);
    });

    it("should not affect divination_cards from a different game", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Shared Card",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe2",
        name: "Shared Card",
      });

      // Mark as boss-exclusive only for poe1
      await repository.upsertCardWeights([
        makeRow({ cardName: "Shared Card", game: "poe1", fromBoss: true }),
      ]);

      await repository.syncFromBossFlags("poe1", "Keepers");

      const poe1Card = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss", "game"])
        .where("game", "=", "poe1")
        .where("name", "=", "Shared Card")
        .executeTakeFirst();

      const poe2Card = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss", "game"])
        .where("game", "=", "poe2")
        .where("name", "=", "Shared Card")
        .executeTakeFirst();

      expect(poe1Card!.from_boss).toBe(1);
      expect(poe2Card!.from_boss).toBe(0);
    });

    it("should handle multiple boss cards correctly", async () => {
      await seedDivinationCard(testDb.kysely, { game: "poe1", name: "Boss A" });
      await seedDivinationCard(testDb.kysely, { game: "poe1", name: "Boss B" });
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Regular A",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Regular B",
      });

      await repository.upsertCardWeights([
        makeRow({ cardName: "Boss A", fromBoss: true }),
        makeRow({ cardName: "Boss B", fromBoss: true }),
        makeRow({ cardName: "Regular A", fromBoss: false }),
        makeRow({ cardName: "Regular B", fromBoss: false }),
      ]);

      await repository.syncFromBossFlags("poe1", "Keepers");

      const cards = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss"])
        .where("game", "=", "poe1")
        .orderBy("name", "asc")
        .execute();

      expect(cards).toHaveLength(4);
      expect(cards.find((c) => c.name === "Boss A")!.from_boss).toBe(1);
      expect(cards.find((c) => c.name === "Boss B")!.from_boss).toBe(1);
      expect(cards.find((c) => c.name === "Regular A")!.from_boss).toBe(0);
      expect(cards.find((c) => c.name === "Regular B")!.from_boss).toBe(0);
    });

    it("should handle divination_cards not present in PL data (set from_boss to 0)", async () => {
      // Card exists in divination_cards but not in PL data
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Unknown Card",
      });

      // No PL data at all — empty
      await repository.syncFromBossFlags("poe1", "Keepers");

      const card = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss"])
        .where("name", "=", "Unknown Card")
        .executeTakeFirst();

      expect(card!.from_boss).toBe(0);
    });

    it("should be idempotent — running twice yields the same result", async () => {
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Boss Card",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Regular Card",
      });

      await repository.upsertCardWeights([
        makeRow({ cardName: "Boss Card", fromBoss: true }),
        makeRow({ cardName: "Regular Card", fromBoss: false }),
      ]);

      await repository.syncFromBossFlags("poe1", "Keepers");
      await repository.syncFromBossFlags("poe1", "Keepers");

      const cards = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss"])
        .where("game", "=", "poe1")
        .orderBy("name", "asc")
        .execute();

      expect(cards.find((c) => c.name === "Boss Card")!.from_boss).toBe(1);
      expect(cards.find((c) => c.name === "Regular Card")!.from_boss).toBe(0);
    });
  });

  // ─── deleteCardWeights ──────────────────────────────────────────────────

  describe("deleteCardWeights", () => {
    it("should delete all card weights for a specific game and league", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Card A", game: "poe1", league: "Keepers" }),
        makeRow({ cardName: "Card B", game: "poe1", league: "Keepers" }),
      ]);

      await repository.deleteCardWeights("poe1", "Keepers");

      const weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(0);
    });

    it("should not delete card weights for a different league", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Card A", league: "Keepers" }),
        makeRow({ cardName: "Card B", league: "Settlers" }),
      ]);

      await repository.deleteCardWeights("poe1", "Keepers");

      const keepers = await repository.getCardWeights("poe1", "Keepers");
      const settlers = await repository.getCardWeights("poe1", "Settlers");
      expect(keepers).toHaveLength(0);
      expect(settlers).toHaveLength(1);
    });

    it("should not delete card weights for a different game", async () => {
      await repository.upsertCardWeights([
        makeRow({ cardName: "Card A", game: "poe1", league: "Keepers" }),
        makeRow({ cardName: "Card B", game: "poe2", league: "Keepers" }),
      ]);

      await repository.deleteCardWeights("poe1", "Keepers");

      const poe1 = await repository.getCardWeights("poe1", "Keepers");
      const poe2 = await repository.getCardWeights("poe2", "Keepers");
      expect(poe1).toHaveLength(0);
      expect(poe2).toHaveLength(1);
    });

    it("should not throw when no data exists to delete", async () => {
      await expect(
        repository.deleteCardWeights("poe1", "Keepers"),
      ).resolves.not.toThrow();
    });
  });

  // ─── Full Lifecycle ─────────────────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should support: insert weights → store metadata → query → update → re-query", async () => {
      // 1. Insert initial batch
      const initialRows = [
        makeRow({
          cardName: "Card A",
          weight: 100,
          rarity: 4,
          fromBoss: false,
        }),
        makeRow({ cardName: "Card B", weight: 10, rarity: 1, fromBoss: true }),
      ];
      await repository.upsertCardWeights(initialRows);
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        2,
      );

      // 2. Verify initial state
      let weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(2);

      let metadata = await repository.getMetadata("poe1");
      expect(metadata!.card_count).toBe(2);
      expect(metadata!.app_version).toBe("1.0.0");

      // 3. Update with new data (simulate re-parse after app update)
      const updatedRows = [
        makeRow({
          cardName: "Card A",
          weight: 200,
          rarity: 4,
          fromBoss: false,
        }),
        makeRow({ cardName: "Card B", weight: 20, rarity: 2, fromBoss: true }),
        makeRow({ cardName: "Card C", weight: 5, rarity: 1, fromBoss: false }),
      ];
      await repository.upsertCardWeights(updatedRows);
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-07-01T00:00:00.000Z",
        "1.1.0",
        3,
      );

      // 4. Verify updated state
      weights = await repository.getCardWeights("poe1", "Keepers");
      expect(weights).toHaveLength(3);
      expect(weights.find((w) => w.cardName === "Card A")!.weight).toBe(200);
      expect(weights.find((w) => w.cardName === "Card B")!.rarity).toBe(2);
      expect(weights.find((w) => w.cardName === "Card C")).toBeDefined();

      metadata = await repository.getMetadata("poe1");
      expect(metadata!.card_count).toBe(3);
      expect(metadata!.app_version).toBe("1.1.0");
    });

    it("should support multi-game data independently", async () => {
      // Insert data for both games
      await repository.upsertCardWeights([
        makeRow({ cardName: "PoE1 Card", game: "poe1", league: "Keepers" }),
      ]);
      await repository.upsertMetadata(
        "poe1",
        "Keepers",
        "2025-06-01T00:00:00.000Z",
        "1.0.0",
        1,
      );

      await repository.upsertCardWeights([
        makeRow({ cardName: "PoE2 Card", game: "poe2", league: "Dawn" }),
      ]);
      await repository.upsertMetadata(
        "poe2",
        "Dawn",
        "2025-06-02T00:00:00.000Z",
        "1.0.0",
        1,
      );

      // Verify independence
      const poe1Weights = await repository.getCardWeights("poe1", "Keepers");
      const poe2Weights = await repository.getCardWeights("poe2", "Dawn");
      expect(poe1Weights).toHaveLength(1);
      expect(poe1Weights[0].cardName).toBe("PoE1 Card");
      expect(poe2Weights).toHaveLength(1);
      expect(poe2Weights[0].cardName).toBe("PoE2 Card");

      const poe1Meta = await repository.getMetadata("poe1");
      const poe2Meta = await repository.getMetadata("poe2");
      expect(poe1Meta!.league).toBe("Keepers");
      expect(poe2Meta!.league).toBe("Dawn");
    });

    it("should support: insert weights → sync from_boss → verify divination_cards", async () => {
      // Seed divination cards
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Doctor",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "Rain of Chaos",
      });
      await seedDivinationCard(testDb.kysely, {
        game: "poe1",
        name: "The Nurse",
      });

      // Insert PL data
      await repository.upsertCardWeights([
        makeRow({ cardName: "The Doctor", fromBoss: false }),
        makeRow({ cardName: "Rain of Chaos", fromBoss: false }),
        makeRow({ cardName: "The Nurse", fromBoss: true }),
      ]);

      // Sync
      await repository.syncFromBossFlags("poe1", "Keepers");

      // Verify
      const cards = await testDb.kysely
        .selectFrom("divination_cards")
        .select(["name", "from_boss"])
        .where("game", "=", "poe1")
        .orderBy("name", "asc")
        .execute();

      expect(cards).toHaveLength(3);
      expect(cards.find((c) => c.name === "Rain of Chaos")!.from_boss).toBe(0);
      expect(cards.find((c) => c.name === "The Doctor")!.from_boss).toBe(0);
      expect(cards.find((c) => c.name === "The Nurse")!.from_boss).toBe(1);
    });
  });
});
