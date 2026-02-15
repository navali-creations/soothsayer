import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import type { Rarity } from "~/types/data-stores";

import { DivinationCardsRepository } from "../DivinationCards.repository";

describe("DivinationCardsRepository", () => {
  let testDb: TestDatabase;
  let repository: DivinationCardsRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new DivinationCardsRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── Helper ──────────────────────────────────────────────────────────────

  async function insertCard(
    game: "poe1" | "poe2" = "poe1",
    name = "The Doctor",
    opts: {
      stackSize?: number;
      description?: string;
      rewardHtml?: string;
      artSrc?: string;
      flavourHtml?: string;
      dataHash?: string;
    } = {},
  ) {
    await repository.insertCard(
      game,
      name,
      opts.stackSize ?? 8,
      opts.description ?? "A powerful card",
      opts.rewardHtml ?? "Headhunter",
      opts.artSrc ?? "https://example.com/doctor.png",
      opts.flavourHtml ?? "A taste of power",
      opts.dataHash ?? "hash-abc123",
    );
  }

  // ─── insertCard ──────────────────────────────────────────────────────────

  describe("insertCard", () => {
    it("should insert a card and retrieve it by ID", async () => {
      await insertCard("poe1", "The Doctor");

      const card = await repository.getById("poe1_the-doctor");
      expect(card).not.toBeNull();
      expect(card!.name).toBe("The Doctor");
      expect(card!.stackSize).toBe(8);
      expect(card!.game).toBe("poe1");
    });

    it("should insert a card for poe2", async () => {
      await insertCard("poe2", "The Scout");

      const card = await repository.getById("poe2_the-scout");
      expect(card).not.toBeNull();
      expect(card!.name).toBe("The Scout");
      expect(card!.game).toBe("poe2");
    });

    it("should store all provided fields", async () => {
      await insertCard("poe1", "Rain of Chaos", {
        stackSize: 8,
        description: "Drops in any area",
        rewardHtml: "Chaos Orb",
        artSrc: "https://example.com/rain.png",
        flavourHtml: "Chaos reigns",
        dataHash: "rain-hash-001",
      });

      const card = await repository.getByName("poe1", "Rain of Chaos");
      expect(card).not.toBeNull();
      expect(card!.stackSize).toBe(8);
      expect(card!.description).toBe("Drops in any area");
      expect(card!.artSrc).toBe("https://example.com/rain.png");
    });

    it("should handle cards with special characters in the name", async () => {
      await insertCard("poe1", "The King's Heart");

      const card = await repository.getByName("poe1", "The King's Heart");
      expect(card).not.toBeNull();
      expect(card!.name).toBe("The King's Heart");
    });

    it("should handle cards with multiple special characters", async () => {
      await insertCard("poe1", "Brother's Stash");

      const card = await repository.getByName("poe1", "Brother's Stash");
      expect(card).not.toBeNull();
      expect(card!.id).toBe("poe1_brother-s-stash");
    });
  });

  // ─── ID Generation (slug logic) ──────────────────────────────────────────

  describe("generateId slug logic", () => {
    it("should generate lowercase slug-based ID from card name", async () => {
      await insertCard("poe1", "The Doctor");
      const card = await repository.getById("poe1_the-doctor");
      expect(card).not.toBeNull();
    });

    it("should replace spaces with hyphens in ID", async () => {
      await insertCard("poe1", "Rain of Chaos");
      const card = await repository.getById("poe1_rain-of-chaos");
      expect(card).not.toBeNull();
    });

    it("should replace non-alphanumeric chars with hyphens", async () => {
      await insertCard("poe1", "The King's Heart");
      const card = await repository.getById("poe1_the-king-s-heart");
      expect(card).not.toBeNull();
    });

    it("should remove leading/trailing hyphens from the slug", async () => {
      await insertCard("poe1", "...Dots Card...");
      const card = await repository.getById("poe1_dots-card");
      expect(card).not.toBeNull();
    });

    it("should prefix with game type", async () => {
      await insertCard("poe1", "The Fiend");
      await insertCard("poe2", "The Fiend");

      const poe1Card = await repository.getById("poe1_the-fiend");
      const poe2Card = await repository.getById("poe2_the-fiend");

      expect(poe1Card).not.toBeNull();
      expect(poe2Card).not.toBeNull();
      expect(poe1Card!.game).toBe("poe1");
      expect(poe2Card!.game).toBe("poe2");
    });

    it("should handle single-word card names", async () => {
      await insertCard("poe1", "Hubris");
      const card = await repository.getById("poe1_hubris");
      expect(card).not.toBeNull();
    });

    it("should handle numeric characters in card names", async () => {
      await insertCard("poe1", "The 7 Years Bad Luck");
      const card = await repository.getById("poe1_the-7-years-bad-luck");
      expect(card).not.toBeNull();
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("should return null for non-existent ID", async () => {
      const card = await repository.getById("poe1_nonexistent");
      expect(card).toBeNull();
    });

    it("should return the card with correctly mapped DTO fields", async () => {
      await insertCard("poe1", "The Doctor", {
        stackSize: 8,
        description: "A powerful card",
        rewardHtml: "Headhunter",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "A taste of power",
      });

      const card = await repository.getById("poe1_the-doctor");
      expect(card).not.toBeNull();
      expect(card!.id).toBe("poe1_the-doctor");
      expect(card!.name).toBe("The Doctor");
      expect(card!.stackSize).toBe(8);
      expect(card!.description).toBe("A powerful card");
      expect(card!.artSrc).toBe("https://example.com/doctor.png");
      expect(card!.game).toBe("poe1");
      expect(card!.createdAt).toBeDefined();
      expect(card!.updatedAt).toBeDefined();
    });

    it("should default rarity to 0 (Unknown) when no rarity data exists", async () => {
      await insertCard("poe1", "The Doctor");
      const card = await repository.getById("poe1_the-doctor");

      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(0);
    });

    it("should include rarity when league is provided and rarity exists", async () => {
      await insertCard("poe1", "The Doctor");
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);

      const card = await repository.getById("poe1_the-doctor", "Settlers");
      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(1);
    });

    it("should default rarity to 0 (Unknown) when league is provided but no rarity for that league", async () => {
      await insertCard("poe1", "The Doctor");
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);

      const card = await repository.getById("poe1_the-doctor", "OtherLeague");
      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(0);
    });
  });

  // ─── getByName ───────────────────────────────────────────────────────────

  describe("getByName", () => {
    it("should return a card by game and name", async () => {
      await insertCard("poe1", "The Doctor");
      const card = await repository.getByName("poe1", "The Doctor");

      expect(card).not.toBeNull();
      expect(card!.name).toBe("The Doctor");
      expect(card!.game).toBe("poe1");
    });

    it("should return null when card does not exist", async () => {
      const card = await repository.getByName("poe1", "Nonexistent Card");
      expect(card).toBeNull();
    });

    it("should return null when game does not match", async () => {
      await insertCard("poe1", "The Doctor");
      const card = await repository.getByName("poe2", "The Doctor");
      expect(card).toBeNull();
    });

    it("should include rarity when league is provided", async () => {
      await insertCard("poe1", "Rain of Chaos");
      await repository.updateRarity("poe1", "Settlers", "Rain of Chaos", 4);

      const card = await repository.getByName(
        "poe1",
        "Rain of Chaos",
        "Settlers",
      );
      expect(card).not.toBeNull();
      expect(card!.rarity).toBe(4);
    });

    it("should match name exactly (case-sensitive)", async () => {
      await insertCard("poe1", "The Doctor");
      const card = await repository.getByName("poe1", "the doctor");
      // SQLite LIKE is case-insensitive by default, but = is case-sensitive
      // The repository uses = for getByName
      expect(card).toBeNull();
    });
  });

  // ─── getAllByGame ─────────────────────────────────────────────────────────

  describe("getAllByGame", () => {
    it("should return empty array when no cards exist", async () => {
      const cards = await repository.getAllByGame("poe1");
      expect(cards).toEqual([]);
    });

    it("should return all cards for a specific game", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");
      await insertCard("poe1", "The Fiend");

      const cards = await repository.getAllByGame("poe1");
      expect(cards).toHaveLength(3);
    });

    it("should not return cards from a different game", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe2", "The Scout");

      const poe1Cards = await repository.getAllByGame("poe1");
      const poe2Cards = await repository.getAllByGame("poe2");

      expect(poe1Cards).toHaveLength(1);
      expect(poe1Cards[0].name).toBe("The Doctor");

      expect(poe2Cards).toHaveLength(1);
      expect(poe2Cards[0].name).toBe("The Scout");
    });

    it("should return cards sorted by name ascending", async () => {
      await insertCard("poe1", "The Fiend");
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");

      const cards = await repository.getAllByGame("poe1");
      expect(cards[0].name).toBe("Rain of Chaos");
      expect(cards[1].name).toBe("The Doctor");
      expect(cards[2].name).toBe("The Fiend");
    });

    it("should default rarity to 0 (Unknown) without league parameter", async () => {
      await insertCard("poe1", "The Doctor");
      const cards = await repository.getAllByGame("poe1");

      expect(cards[0].rarity).toBe(0);
    });

    it("should include rarity data when league parameter is provided", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);
      await repository.updateRarity("poe1", "Settlers", "Rain of Chaos", 4);

      const cards = await repository.getAllByGame("poe1", "Settlers");
      const doctor = cards.find((c) => c.name === "The Doctor");
      const rain = cards.find((c) => c.name === "Rain of Chaos");

      expect(doctor!.rarity).toBe(1);
      expect(rain!.rarity).toBe(4);
    });

    it("should default rarity to 0 (Unknown) for cards without rarity in specified league", async () => {
      await insertCard("poe1", "The Doctor");
      // No rarity set for "OtherLeague"
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);

      const cards = await repository.getAllByGame("poe1", "OtherLeague");
      expect(cards[0].rarity).toBe(0);
    });
  });

  // ─── searchByName ────────────────────────────────────────────────────────

  describe("searchByName", () => {
    beforeEach(async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "The Fiend");
      await insertCard("poe1", "Rain of Chaos");
      await insertCard("poe1", "The Apothecary");
    });

    it("should find cards matching a partial name", async () => {
      const cards = await repository.searchByName("poe1", "The");
      expect(cards).toHaveLength(3); // The Doctor, The Fiend, The Apothecary
    });

    it("should find cards matching an exact name", async () => {
      const cards = await repository.searchByName("poe1", "Rain of Chaos");
      expect(cards).toHaveLength(1);
      expect(cards[0].name).toBe("Rain of Chaos");
    });

    it("should return empty array when no cards match", async () => {
      const cards = await repository.searchByName("poe1", "Nonexistent");
      expect(cards).toEqual([]);
    });

    it("should not return cards from a different game", async () => {
      await insertCard("poe2", "The Scout");

      const cards = await repository.searchByName("poe2", "Doctor");
      expect(cards).toEqual([]);
    });

    it("should return results sorted by name ascending", async () => {
      const cards = await repository.searchByName("poe1", "The");
      expect(cards[0].name).toBe("The Apothecary");
      expect(cards[1].name).toBe("The Doctor");
      expect(cards[2].name).toBe("The Fiend");
    });

    it("should include rarity when league is provided", async () => {
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);
      await repository.updateRarity("poe1", "Settlers", "The Fiend", 2);

      const cards = await repository.searchByName("poe1", "The", "Settlers");
      const doctor = cards.find((c) => c.name === "The Doctor");
      const fiend = cards.find((c) => c.name === "The Fiend");

      expect(doctor!.rarity).toBe(1);
      expect(fiend!.rarity).toBe(2);
    });

    it("should be case-insensitive for the search query", async () => {
      const cards = await repository.searchByName("poe1", "doctor");
      expect(cards).toHaveLength(1);
      expect(cards[0].name).toBe("The Doctor");
    });

    it("should find cards matching middle of the name", async () => {
      const cards = await repository.searchByName("poe1", "of");
      expect(cards).toHaveLength(1);
      expect(cards[0].name).toBe("Rain of Chaos");
    });
  });

  // ─── getCardCount ────────────────────────────────────────────────────────

  describe("getCardCount", () => {
    it("should return 0 when no cards exist", async () => {
      const count = await repository.getCardCount("poe1");
      expect(count).toBe(0);
    });

    it("should return the correct count for a game", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");
      await insertCard("poe1", "The Fiend");

      const count = await repository.getCardCount("poe1");
      expect(count).toBe(3);
    });

    it("should not count cards from a different game", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe2", "The Scout");

      const poe1Count = await repository.getCardCount("poe1");
      const poe2Count = await repository.getCardCount("poe2");

      expect(poe1Count).toBe(1);
      expect(poe2Count).toBe(1);
    });
  });

  // ─── cardExists ──────────────────────────────────────────────────────────

  describe("cardExists", () => {
    it("should return true when card exists", async () => {
      await insertCard("poe1", "The Doctor");
      const exists = await repository.cardExists("poe1", "The Doctor");
      expect(exists).toBe(true);
    });

    it("should return false when card does not exist", async () => {
      const exists = await repository.cardExists("poe1", "Nonexistent");
      expect(exists).toBe(false);
    });

    it("should return false for wrong game", async () => {
      await insertCard("poe1", "The Doctor");
      const exists = await repository.cardExists("poe2", "The Doctor");
      expect(exists).toBe(false);
    });

    it("should handle cards with special characters", async () => {
      await insertCard("poe1", "The King's Heart");
      const exists = await repository.cardExists("poe1", "The King's Heart");
      expect(exists).toBe(true);
    });
  });

  // ─── getCardHash ─────────────────────────────────────────────────────────

  describe("getCardHash", () => {
    it("should return the hash for an existing card", async () => {
      await insertCard("poe1", "The Doctor", { dataHash: "my-hash-value" });
      const hash = await repository.getCardHash("poe1", "The Doctor");
      expect(hash).toBe("my-hash-value");
    });

    it("should return null for a non-existent card", async () => {
      const hash = await repository.getCardHash("poe1", "Nonexistent");
      expect(hash).toBeNull();
    });

    it("should return null for wrong game", async () => {
      await insertCard("poe1", "The Doctor", { dataHash: "poe1-hash" });
      const hash = await repository.getCardHash("poe2", "The Doctor");
      expect(hash).toBeNull();
    });

    it("should return different hashes for different cards", async () => {
      await insertCard("poe1", "The Doctor", { dataHash: "hash-doctor" });
      await insertCard("poe1", "Rain of Chaos", { dataHash: "hash-rain" });

      const doctorHash = await repository.getCardHash("poe1", "The Doctor");
      const rainHash = await repository.getCardHash("poe1", "Rain of Chaos");

      expect(doctorHash).toBe("hash-doctor");
      expect(rainHash).toBe("hash-rain");
      expect(doctorHash).not.toBe(rainHash);
    });
  });

  // ─── updateCard ──────────────────────────────────────────────────────────

  describe("updateCard", () => {
    it("should update an existing card's fields", async () => {
      await insertCard("poe1", "The Doctor", {
        stackSize: 8,
        description: "Old description",
        rewardHtml: "Old reward",
        artSrc: "old.png",
        flavourHtml: "Old flavour",
        dataHash: "old-hash",
      });

      await repository.updateCard(
        "poe1",
        "The Doctor",
        8,
        "New description",
        "New reward",
        "new.png",
        "New flavour",
        "new-hash",
      );

      const card = await repository.getByName("poe1", "The Doctor");
      expect(card).not.toBeNull();
      expect(card!.description).toBe("New description");
      expect(card!.artSrc).toBe("new.png");
    });

    it("should update the data hash", async () => {
      await insertCard("poe1", "The Doctor", { dataHash: "original-hash" });

      await repository.updateCard(
        "poe1",
        "The Doctor",
        8,
        "A powerful card",
        "Headhunter",
        "doctor.png",
        "A taste of power",
        "updated-hash",
      );

      const hash = await repository.getCardHash("poe1", "The Doctor");
      expect(hash).toBe("updated-hash");
    });

    it("should update the stack size", async () => {
      await insertCard("poe1", "The Doctor", { stackSize: 8 });

      await repository.updateCard(
        "poe1",
        "The Doctor",
        10,
        "A powerful card",
        "Headhunter",
        "doctor.png",
        "A taste of power",
        "hash",
      );

      const card = await repository.getByName("poe1", "The Doctor");
      expect(card!.stackSize).toBe(10);
    });

    it("should not affect other cards", async () => {
      await insertCard("poe1", "The Doctor", { description: "Doctor desc" });
      await insertCard("poe1", "Rain of Chaos", {
        description: "Rain desc",
        dataHash: "rain-hash",
      });

      await repository.updateCard(
        "poe1",
        "The Doctor",
        8,
        "Updated Doctor desc",
        "Headhunter",
        "doctor.png",
        "flavour",
        "new-hash",
      );

      const rain = await repository.getByName("poe1", "Rain of Chaos");
      expect(rain!.description).toBe("Rain desc");
    });
  });

  // ─── getLastUpdated ──────────────────────────────────────────────────────

  describe("getLastUpdated", () => {
    it("should return null when no cards exist", async () => {
      const lastUpdated = await repository.getLastUpdated("poe1");
      expect(lastUpdated).toBeNull();
    });

    it("should return a timestamp when cards exist", async () => {
      await insertCard("poe1", "The Doctor");
      const lastUpdated = await repository.getLastUpdated("poe1");
      expect(lastUpdated).not.toBeNull();
      expect(typeof lastUpdated).toBe("string");
    });

    it("should not include timestamps from other games", async () => {
      await insertCard("poe2", "The Scout");
      const lastUpdated = await repository.getLastUpdated("poe1");
      expect(lastUpdated).toBeNull();
    });

    it("should return the most recent updated_at timestamp", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");

      // Update one card to get a newer timestamp
      await repository.updateCard(
        "poe1",
        "Rain of Chaos",
        8,
        "Updated",
        "Chaos Orb",
        "rain.png",
        "flavour",
        "new-hash",
      );

      const lastUpdated = await repository.getLastUpdated("poe1");
      expect(lastUpdated).not.toBeNull();
    });
  });

  // ─── Rarity Management ───────────────────────────────────────────────────

  describe("updateRarity", () => {
    beforeEach(async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");
    });

    it("should insert a rarity for a card in a league", async () => {
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);

      const card = await repository.getByName("poe1", "The Doctor", "Settlers");
      expect(card!.rarity).toBe(1);
    });

    it("should upsert rarity on conflict (update existing)", async () => {
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 3);

      const card = await repository.getByName("poe1", "The Doctor", "Settlers");
      expect(card!.rarity).toBe(3);
    });

    it("should handle different rarities for different leagues", async () => {
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);
      await repository.updateRarity("poe1", "Standard", "The Doctor", 3);

      const settlerCard = await repository.getByName(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      const standardCard = await repository.getByName(
        "poe1",
        "The Doctor",
        "Standard",
      );

      expect(settlerCard!.rarity).toBe(1);
      expect(standardCard!.rarity).toBe(3);
    });

    it("should handle different rarities for different cards", async () => {
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);
      await repository.updateRarity("poe1", "Settlers", "Rain of Chaos", 4);

      const doctor = await repository.getByName(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      const rain = await repository.getByName(
        "poe1",
        "Rain of Chaos",
        "Settlers",
      );

      expect(doctor!.rarity).toBe(1);
      expect(rain!.rarity).toBe(4);
    });

    it("should accept all valid rarity values (1-4)", async () => {
      for (const rarity of [1, 2, 3, 4] as Rarity[]) {
        await repository.updateRarity("poe1", "Settlers", "The Doctor", rarity);
        const card = await repository.getByName(
          "poe1",
          "The Doctor",
          "Settlers",
        );
        expect(card!.rarity).toBe(rarity);
      }
    });
  });

  // ─── updateRarities (bulk) ───────────────────────────────────────────────

  describe("updateRarities", () => {
    beforeEach(async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");
      await insertCard("poe1", "The Fiend");
    });

    it("should bulk update rarities for multiple cards", async () => {
      await repository.updateRarities("poe1", "Settlers", [
        { name: "The Doctor", rarity: 1 as Rarity },
        { name: "Rain of Chaos", rarity: 4 as Rarity },
        { name: "The Fiend", rarity: 2 },
      ]);

      const cards = await repository.getAllByGame("poe1", "Settlers");
      const doctor = cards.find((c) => c.name === "The Doctor");
      const rain = cards.find((c) => c.name === "Rain of Chaos");
      const fiend = cards.find((c) => c.name === "The Fiend");

      expect(doctor!.rarity).toBe(1);
      expect(rain!.rarity).toBe(4);
      expect(fiend!.rarity).toBe(2);
    });

    it("should handle empty updates array", async () => {
      await repository.updateRarities("poe1", "Settlers", []);

      const cards = await repository.getAllByGame("poe1", "Settlers");
      // All should have default rarity 0 (Unknown) since no rarity data exists
      for (const card of cards) {
        expect(card.rarity).toBe(0);
      }
    });

    it("should handle single card in updates array", async () => {
      await repository.updateRarities("poe1", "Settlers", [
        { name: "The Doctor", rarity: 1 },
      ]);

      const doctor = await repository.getByName(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      const rain = await repository.getByName(
        "poe1",
        "Rain of Chaos",
        "Settlers",
      );

      expect(doctor!.rarity).toBe(1);
      expect(rain!.rarity).toBe(0); // default (Unknown)
    });

    it("should overwrite previously set rarities", async () => {
      await repository.updateRarities("poe1", "Settlers", [
        { name: "The Doctor", rarity: 1 },
      ]);
      await repository.updateRarities("poe1", "Settlers", [
        { name: "The Doctor", rarity: 3 },
      ]);

      const doctor = await repository.getByName(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      expect(doctor!.rarity).toBe(3);
    });
  });

  // ─── Cross-game isolation ────────────────────────────────────────────────

  describe("cross-game isolation", () => {
    it("should keep cards separate across games", async () => {
      await insertCard("poe1", "The Doctor", { description: "PoE1 Doctor" });
      await insertCard("poe2", "The Doctor", { description: "PoE2 Doctor" });

      const poe1Card = await repository.getByName("poe1", "The Doctor");
      const poe2Card = await repository.getByName("poe2", "The Doctor");

      expect(poe1Card!.description).toBe("PoE1 Doctor");
      expect(poe2Card!.description).toBe("PoE2 Doctor");
    });

    it("should return separate counts per game", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe1", "Rain of Chaos");
      await insertCard("poe2", "The Scout");

      expect(await repository.getCardCount("poe1")).toBe(2);
      expect(await repository.getCardCount("poe2")).toBe(1);
    });

    it("should keep rarity data separate per game", async () => {
      await insertCard("poe1", "The Doctor");
      await insertCard("poe2", "The Doctor");

      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);
      await repository.updateRarity("poe2", "Dawn", "The Doctor", 3);

      const poe1Card = await repository.getByName(
        "poe1",
        "The Doctor",
        "Settlers",
      );
      const poe2Card = await repository.getByName("poe2", "The Doctor", "Dawn");

      expect(poe1Card!.rarity).toBe(1);
      expect(poe2Card!.rarity).toBe(3);
    });

    it("should keep hashes separate per game", async () => {
      await insertCard("poe1", "The Doctor", { dataHash: "poe1-hash" });
      await insertCard("poe2", "The Doctor", { dataHash: "poe2-hash" });

      expect(await repository.getCardHash("poe1", "The Doctor")).toBe(
        "poe1-hash",
      );
      expect(await repository.getCardHash("poe2", "The Doctor")).toBe(
        "poe2-hash",
      );
    });
  });

  // ─── Full Lifecycle ──────────────────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should support insert → query → update → verify flow", async () => {
      // 1. Insert a card
      await repository.insertCard(
        "poe1",
        "The Doctor",
        8,
        "Original description",
        "Headhunter",
        "original.png",
        "Original flavour",
        "hash-v1",
      );

      // 2. Verify it exists
      expect(await repository.cardExists("poe1", "The Doctor")).toBe(true);
      expect(await repository.getCardCount("poe1")).toBe(1);
      expect(await repository.getCardHash("poe1", "The Doctor")).toBe(
        "hash-v1",
      );

      // 3. Get by name
      let card = await repository.getByName("poe1", "The Doctor");
      expect(card!.description).toBe("Original description");
      expect(card!.rarity).toBe(0); // default (Unknown)

      // 4. Update rarity
      await repository.updateRarity("poe1", "Settlers", "The Doctor", 1);
      card = await repository.getByName("poe1", "The Doctor", "Settlers");
      expect(card!.rarity).toBe(1);

      // 5. Update card data
      await repository.updateCard(
        "poe1",
        "The Doctor",
        8,
        "Updated description",
        "Headhunter Leather Belt",
        "updated.png",
        "Updated flavour",
        "hash-v2",
      );

      // 6. Verify updates
      card = await repository.getByName("poe1", "The Doctor", "Settlers");
      expect(card!.description).toBe("Updated description");
      expect(card!.artSrc).toBe("updated.png");
      expect(card!.rarity).toBe(1); // rarity persists

      // 7. Verify hash updated
      expect(await repository.getCardHash("poe1", "The Doctor")).toBe(
        "hash-v2",
      );

      // 8. Search should still find it
      const searchResults = await repository.searchByName("poe1", "Doctor");
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe("The Doctor");
    });

    it("should support a multi-card, multi-game dataset", async () => {
      // Seed a realistic dataset
      const poe1Cards: Array<{
        name: string;
        stackSize: number;
        rarity: Rarity;
      }> = [
        { name: "The Doctor", stackSize: 8, rarity: 1 },
        { name: "Rain of Chaos", stackSize: 8, rarity: 4 },
        { name: "The Fiend", stackSize: 11, rarity: 1 },
        { name: "The Nurse", stackSize: 8, rarity: 2 },
        { name: "Abandoned Wealth", stackSize: 5, rarity: 3 },
      ];

      for (const c of poe1Cards) {
        await repository.insertCard(
          "poe1",
          c.name,
          c.stackSize,
          `${c.name} description`,
          `${c.name} reward`,
          `${c.name.toLowerCase().replace(/ /g, "-")}.png`,
          `${c.name} flavour`,
          `hash-${c.name.toLowerCase().replace(/ /g, "-")}`,
        );
      }

      await insertCard("poe2", "The Scout", { stackSize: 5 });
      await insertCard("poe2", "Etched in Blood", { stackSize: 3 });

      // Set rarities
      await repository.updateRarities(
        "poe1",
        "Settlers",
        poe1Cards.map((c) => ({ name: c.name, rarity: c.rarity })),
      );

      // Verify counts
      expect(await repository.getCardCount("poe1")).toBe(5);
      expect(await repository.getCardCount("poe2")).toBe(2);

      // Verify search
      const theCards = await repository.searchByName("poe1", "The");
      expect(theCards).toHaveLength(3); // Doctor, Fiend, Nurse

      // Verify rarities
      const allPoe1 = await repository.getAllByGame("poe1", "Settlers");
      const doctor = allPoe1.find((c) => c.name === "The Doctor");
      const rain = allPoe1.find((c) => c.name === "Rain of Chaos");
      expect(doctor!.rarity).toBe(1);
      expect(rain!.rarity).toBe(4);

      // Verify game isolation
      const poe2Cards = await repository.getAllByGame("poe2");
      expect(poe2Cards).toHaveLength(2);
      expect(poe2Cards.every((c) => c.game === "poe2")).toBe(true);
    });
  });
});
