import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedDivinationCard,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import type { Rarity } from "~/types/data-stores";

import type { ProhibitedLibraryCardWeightDTO } from "../ProhibitedLibrary.dto";
import {
  parseProhibitedLibraryCsv,
  weightToDropRarity,
} from "../ProhibitedLibrary.parser";
import {
  ProhibitedLibraryRepository,
  type UpsertCardWeightRow,
} from "../ProhibitedLibrary.repository";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the path to the real bundled CSV asset.
 * In the test (dev) environment this is under `renderer/assets/poe1/`.
 */
function getRealCsvPath(): string {
  // vitest runs from the project root, so this relative resolution works
  return join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "renderer",
    "assets",
    "poe1",
    "prohibited-library-weights.csv",
  );
}

/**
 * Convert parsed rows into `UpsertCardWeightRow[]` — mirrors
 * `ProhibitedLibraryService.convertWeights()` logic.
 */
function convertRows(
  rows: ReturnType<typeof parseProhibitedLibraryCsv>["rows"],
  league: string,
  game: "poe1" | "poe2" = "poe1",
  loadedAt: string = new Date().toISOString(),
): UpsertCardWeightRow[] {
  return rows.map((row) => {
    let rarity: Rarity;

    if (row.weight > 0) {
      rarity = weightToDropRarity(row.weight);
    } else {
      // Weight 0 means no stacked deck drop data — unknown regardless of
      // boss status (the weight is about stacked decks, not actual rarity)
      rarity = 0;
    }

    return {
      cardName: row.cardName,
      game,
      league,
      weight: row.weight,
      rarity,
      fromBoss: row.fromBoss,
      loadedAt,
    };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// End-to-end: real bundled CSV → parse → store → query
// ═════════════════════════════════════════════════════════════════════════════

describe("Prohibited Library — end-to-end integration (real CSV)", () => {
  let testDb: TestDatabase;
  let repository: ProhibitedLibraryRepository;
  let csvContent: string;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new ProhibitedLibraryRepository(testDb.kysely);
    csvContent = readFileSync(getRealCsvPath(), "utf-8");
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ── Phase 1: Parse the real CSV ──────────────────────────────────────────

  it("should parse the real bundled CSV without throwing", () => {
    expect(() => parseProhibitedLibraryCsv(csvContent)).not.toThrow();
  });

  it("should extract a non-empty league label from the header", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    expect(result.rawLeagueLabel).toBeTruthy();
    expect(typeof result.rawLeagueLabel).toBe("string");
    // Must be a league name, not a patch version
    expect(result.rawLeagueLabel).not.toMatch(/^\d+\.\d+$/);
  });

  it("should parse a substantial number of card rows", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    // The real CSV has hundreds of cards — at a minimum we expect 100+
    expect(result.rows.length).toBeGreaterThanOrEqual(100);
  });

  it("should have valid field values for every parsed row", () => {
    const result = parseProhibitedLibraryCsv(csvContent);

    for (const row of result.rows) {
      // Card name must be non-empty
      expect(row.cardName.length).toBeGreaterThan(0);
      // Bucket must be a number
      expect(typeof row.bucket).toBe("number");
      // Weight must be a finite non-negative integer
      expect(Number.isFinite(row.weight)).toBe(true);
      expect(row.weight).toBeGreaterThanOrEqual(0);
      // fromBoss must be a boolean
      expect(typeof row.fromBoss).toBe("boolean");
      // rawLeagueLabel should match header
      expect(row.rawLeagueLabel).toBe(result.rawLeagueLabel);
    }
  });

  it("should contain boss-exclusive cards (including 'Boss' text in Ritual column)", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const bossCards = result.rows.filter((r) => r.fromBoss);
    // The real CSV has many boss cards via both numeric 4 and "Boss" text
    expect(bossCards.length).toBeGreaterThanOrEqual(50);
  });

  it("should contain well-known cards", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const cardNames = result.rows.map((r) => r.cardName);

    // These are staple divination cards that should always be in the dataset
    expect(cardNames).toContain("Rain of Chaos");
    expect(cardNames).toContain("The Doctor");
    expect(cardNames).toContain("Emperor's Luck");
  });

  // ── Phase 2: Convert weights → rarities ──────────────────────────────────

  it("should convert all parsed rows to valid 0–4 rarities via absolute weight thresholds", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const mapped = convertRows(result.rows, result.rawLeagueLabel);

    for (const row of mapped) {
      expect(row.rarity).toBeGreaterThanOrEqual(0);
      expect(row.rarity).toBeLessThanOrEqual(4);
    }
  });

  it("should assign Rain of Chaos the highest rarity (4, common) — weight > 5000", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const mapped = convertRows(result.rows, result.rawLeagueLabel);

    const rainOfChaos = mapped.find((r) => r.cardName === "Rain of Chaos");
    expect(rainOfChaos).toBeDefined();
    expect(rainOfChaos!.rarity).toBe(4);
  });

  it("should assign The Doctor rarity 1 (extremely rare) — weight ≤ 30", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const mapped = convertRows(result.rows, result.rawLeagueLabel);

    const theDoctor = mapped.find((r) => r.cardName === "The Doctor");
    expect(theDoctor).toBeDefined();
    // The Doctor has weight ≤ 30 in Keepers → rarity 1 (extremely rare)
    expect(theDoctor!.rarity).toBe(1);
  });

  it("should produce all five rarity tiers with absolute weight thresholds", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const mapped = convertRows(result.rows, result.rawLeagueLabel);
    const uniqueRarities = new Set(mapped.map((r) => r.rarity));

    // Should produce all 5 tiers: 0 (unknown), 1-4 (extremely rare to common)
    expect(uniqueRarities.size).toBe(5);
    expect(uniqueRarities).toContain(0);
    expect(uniqueRarities).toContain(1);
    expect(uniqueRarities).toContain(2);
    expect(uniqueRarities).toContain(3);
    expect(uniqueRarities).toContain(4);
  });

  it("should have at most ~50 non-boss extremely rare cards from weight data", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const mapped = convertRows(result.rows, result.rawLeagueLabel);

    // Non-boss cards that got rarity 1 from actual weight data (weight > 0 and ≤ 30)
    const nonBossWeightRarity1 = mapped.filter(
      (r) => r.rarity === 1 && !r.fromBoss && r.weight > 0,
    ).length;
    // All weight=0 cards get rarity 0 (unknown) — no stacked deck data
    const zeroWeightRarity0 = mapped.filter(
      (r) => r.rarity === 0 && r.weight === 0,
    ).length;
    const rarity4Count = mapped.filter((r) => r.rarity === 4).length;

    // With absolute weight thresholds (≤30 = extremely rare), only ~43 non-boss
    // cards should be extremely rare from drop data — not the 200+ from old approaches
    expect(nonBossWeightRarity1).toBeLessThanOrEqual(50); // at most ~50
    expect(nonBossWeightRarity1).toBeGreaterThan(0); // some should exist
    // All weight=0 cards get rarity 0 (unknown — no stacked deck data)
    expect(zeroWeightRarity0).toBeGreaterThan(0);
    // And rarity 4 (common, weight > 5000) should have a meaningful share of cards
    expect(rarity4Count).toBeGreaterThan(20);
  });

  // ── Phase 3: Store in database ───────────────────────────────────────────

  it("should persist all converted rows to the database without errors", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const mapped = convertRows(result.rows, result.rawLeagueLabel);

    await expect(repository.upsertCardWeights(mapped)).resolves.not.toThrow();
  });

  it("should store metadata after persisting card weights", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const loadedAt = new Date().toISOString();
    const mapped = convertRows(result.rows, league, "poe1", loadedAt);

    await repository.upsertCardWeights(mapped);
    await repository.upsertMetadata(
      "poe1",
      league,
      loadedAt,
      "1.0.0-test",
      mapped.length,
    );

    const metadata = await repository.getMetadata("poe1");
    expect(metadata).toBeDefined();
    expect(metadata!.league).toBe(league);
    expect(metadata!.card_count).toBe(mapped.length);
    expect(metadata!.app_version).toBe("1.0.0-test");
    expect(metadata!.loaded_at).toBe(loadedAt);
  });

  // ── Phase 4: Query back from database ────────────────────────────────────

  it("should query back the same number of cards that were inserted", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    await repository.upsertCardWeights(mapped);

    const queried = await repository.getCardWeights("poe1", league);
    expect(queried).toHaveLength(mapped.length);
  });

  it("should return correct DTO fields for queried cards", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const loadedAt = "2025-07-01T00:00:00.000Z";
    const mapped = convertRows(result.rows, league, "poe1", loadedAt);

    await repository.upsertCardWeights(mapped);

    const queried = await repository.getCardWeights("poe1", league);

    // Verify a well-known card
    const rainOfChaos = queried.find(
      (c: ProhibitedLibraryCardWeightDTO) => c.cardName === "Rain of Chaos",
    );
    expect(rainOfChaos).toBeDefined();
    expect(rainOfChaos!.game).toBe("poe1");
    expect(rainOfChaos!.league).toBe(league);
    expect(rainOfChaos!.rarity).toBe(4);
    expect(rainOfChaos!.fromBoss).toBe(false);
    expect(rainOfChaos!.loadedAt).toBe(loadedAt);
    expect(rainOfChaos!.weight).toBeGreaterThan(0);
  });

  it("should return cards sorted by card_name ascending", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    await repository.upsertCardWeights(mapped);

    const queried = await repository.getCardWeights("poe1", league);
    const names = queried.map(
      (c: ProhibitedLibraryCardWeightDTO) => c.cardName,
    );

    // SQLite uses binary (byte-by-byte) collation for ORDER BY, which differs
    // from JS's locale-aware `localeCompare`. Compare using the same binary
    // sort that SQLite applies (i.e. codepoint ordering).
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("should return empty array when querying a different league", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    await repository.upsertCardWeights(mapped);

    const queried = await repository.getCardWeights(
      "poe1",
      "NonExistentLeague",
    );
    expect(queried).toHaveLength(0);
  });

  it("should return empty array when querying a different game", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    await repository.upsertCardWeights(mapped);

    const queried = await repository.getCardWeights("poe2", league);
    expect(queried).toHaveLength(0);
  });

  // ── Phase 5: Boss-exclusive card queries ─────────────────────────────────

  it("should return only boss-exclusive cards via getFromBossCards", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    await repository.upsertCardWeights(mapped);

    const bossCards = await repository.getFromBossCards("poe1", league);

    // Every returned card should be boss-exclusive
    for (const card of bossCards) {
      expect(card.fromBoss).toBe(true);
    }

    // Count should match the number of boss cards in the parsed data
    const expectedBossCount = mapped.filter((r) => r.fromBoss).length;
    expect(bossCards).toHaveLength(expectedBossCount);
  });

  // ── Phase 6: from_boss sync to divination_cards ──────────────────────────

  it("should sync from_boss flags to divination_cards table", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    // Find a boss card and a regular card from the parsed data
    const bossRow = mapped.find((r) => r.fromBoss);
    const regularRow = mapped.find((r) => !r.fromBoss);
    expect(bossRow).toBeDefined();
    expect(regularRow).toBeDefined();

    // Seed divination_cards entries for these two cards
    await seedDivinationCard(testDb.kysely, { name: bossRow!.cardName });
    await seedDivinationCard(testDb.kysely, { name: regularRow!.cardName });

    // Persist PL weights and sync
    await repository.upsertCardWeights(mapped);
    await repository.syncFromBossFlags("poe1", league);

    // Query divination_cards directly to verify from_boss flags
    const allCards = await testDb.kysely
      .selectFrom("divination_cards")
      .select(["name", "from_boss"])
      .where("game", "=", "poe1")
      .where("name", "in", [bossRow!.cardName, regularRow!.cardName])
      .execute();

    const bossCard = allCards.find((c) => c.name === bossRow!.cardName);
    const regularCard = allCards.find((c) => c.name === regularRow!.cardName);

    expect(bossCard).toBeDefined();
    expect(bossCard!.from_boss).toBe(1);

    expect(regularCard).toBeDefined();
    expect(regularCard!.from_boss).toBe(0);
  });

  // ── Phase 7: Upsert idempotency ─────────────────────────────────────────

  it("should be idempotent — upserting the same data twice yields the same results", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const loadedAt = "2025-07-01T00:00:00.000Z";
    const mapped = convertRows(result.rows, league, "poe1", loadedAt);

    // First insert
    await repository.upsertCardWeights(mapped);
    const first = await repository.getCardWeights("poe1", league);

    // Second insert (same data)
    await repository.upsertCardWeights(mapped);
    const second = await repository.getCardWeights("poe1", league);

    expect(second).toHaveLength(first.length);

    // Compare each card — same card_name, weight, rarity, fromBoss
    for (let i = 0; i < first.length; i++) {
      expect(second[i].cardName).toBe(first[i].cardName);
      expect(second[i].weight).toBe(first[i].weight);
      expect(second[i].rarity).toBe(first[i].rarity);
      expect(second[i].fromBoss).toBe(first[i].fromBoss);
    }
  });

  // ── Phase 8: Full lifecycle (parse → store → metadata → query → update) ─

  it("should support the full lifecycle: parse → store → metadata → re-query", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const loadedAt = new Date().toISOString();
    const mapped = convertRows(result.rows, league, "poe1", loadedAt);

    // 1. Persist
    await repository.upsertCardWeights(mapped);
    await repository.upsertMetadata(
      "poe1",
      league,
      loadedAt,
      "2.0.0",
      mapped.length,
    );

    // 2. Verify metadata
    const metadata = await repository.getMetadata("poe1");
    expect(metadata).toBeDefined();
    expect(metadata!.league).toBe(league);
    expect(metadata!.card_count).toBe(mapped.length);

    // 3. Query weights
    const weights = await repository.getCardWeights("poe1", league);
    expect(weights).toHaveLength(mapped.length);

    // 4. Query boss cards
    const bossCards = await repository.getFromBossCards("poe1", league);
    const expectedBossCount = mapped.filter((r) => r.fromBoss).length;
    expect(bossCards).toHaveLength(expectedBossCount);

    // 5. Verify rarity distribution is reasonable
    const rarityCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const w of weights) {
      rarityCounts[w.rarity as 0 | 1 | 2 | 3 | 4]++;
    }

    // All five tiers should have cards
    expect(rarityCounts[4]).toBeGreaterThan(0); // common cards exist
    expect(rarityCounts[3]).toBeGreaterThan(0); // less common cards exist
    expect(rarityCounts[2]).toBeGreaterThan(0); // rare cards exist
    expect(rarityCounts[1]).toBeGreaterThan(0); // extremely rare cards exist
    expect(rarityCounts[0]).toBeGreaterThan(0); // unknown (zero-weight non-boss) cards exist
    // Total should match
    expect(
      rarityCounts[0] +
        rarityCounts[1] +
        rarityCounts[2] +
        rarityCounts[3] +
        rarityCounts[4],
    ).toBe(weights.length);
  });

  // ── Phase 9: Rarity boundary validation with real data ───────────────────

  it("should have the highest-weight card (Rain of Chaos) at rarity 4 and lowest positive-weight at a lower tier", async () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    await repository.upsertCardWeights(mapped);
    const weights = await repository.getCardWeights("poe1", league);

    // Rain of Chaos should be the most common
    const rainOfChaos = weights.find(
      (w: ProhibitedLibraryCardWeightDTO) => w.cardName === "Rain of Chaos",
    );
    expect(rainOfChaos).toBeDefined();
    expect(rainOfChaos!.rarity).toBe(4);
    expect(rainOfChaos!.weight).toBeGreaterThan(0);

    // Find the card with the lowest non-zero weight
    const nonZeroWeights = weights.filter(
      (w: ProhibitedLibraryCardWeightDTO) => w.weight > 0,
    );
    const lowestWeightCard = nonZeroWeights.reduce(
      (
        min: ProhibitedLibraryCardWeightDTO,
        w: ProhibitedLibraryCardWeightDTO,
      ) => (w.weight < min.weight ? w : min),
    );

    // It should have a lower rarity than Rain of Chaos
    expect(lowestWeightCard.rarity).toBeLessThan(rainOfChaos!.rarity);
  });

  it("should assign rarity based on fromBoss for zero-weight cards", () => {
    const result = parseProhibitedLibraryCsv(csvContent);
    const league = result.rawLeagueLabel;
    const mapped = convertRows(result.rows, league);

    const zeroWeightCards = result.rows.filter((r) => r.weight === 0);
    expect(zeroWeightCards.length).toBeGreaterThan(0); // sanity check

    // All zero-weight cards get rarity 0 (unknown) — no stacked deck data,
    // regardless of boss status
    for (const zeroCard of zeroWeightCards) {
      const mappedCard = mapped.find((m) => m.cardName === zeroCard.cardName);
      expect(mappedCard).toBeDefined();
      expect(mappedCard!.weight).toBe(0);
      expect(mappedCard!.rarity).toBe(0);
    }
  });
});
