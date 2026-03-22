/**
 * Rarity Insights Fixture Data for E2E Tests
 *
 * Provides deterministic seed data for the Rarity Insights page tests.
 * This includes:
 *
 * - Divination card records (with `from_boss` flags)
 * - poe.ninja-derived rarities (`divination_card_rarities`)
 * - Prohibited Library card weights (`prohibited_library_card_weights`)
 * - Filter metadata + filter card rarities for up to 2 mock filters
 *
 * The fixture is designed so that:
 * - Some cards have differing rarities between poe.ninja and filters
 *   (enabling "Show differences only" testing)
 * - Some cards are boss-exclusive (enabling "Include boss cards" testing)
 * - Prohibited Library data is present for most cards but absent for one
 *   (enabling the "—" / null state in the PL column)
 * - Filter 1 and Filter 2 have slightly different rarity assignments
 *   (enabling comparison across filters)
 *
 * @module e2e/fixtures/rarity-insights-fixture
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const FIXTURE_GAME = "poe1" as const;
export const FIXTURE_LEAGUE = "Standard" as const;
export const FIXTURE_LEAGUE_ID = "poe1_standard" as const;

// ─── Filter identifiers ──────────────────────────────────────────────────────

export const FILTER_1_ID = "e2e-filter-001";
export const FILTER_1_NAME = "NeverSink's Semi-Strict";
export const FILTER_1_PATH =
  "C:\\Users\\e2e\\Documents\\My Games\\Path of Exile\\NeverSink-SemiStrict.filter";

export const FILTER_2_ID = "e2e-filter-002";
export const FILTER_2_NAME = "FilterBlade Uber-Strict";
export const FILTER_2_PATH =
  "C:\\Users\\e2e\\Documents\\My Games\\Path of Exile\\FilterBlade-UberStrict.filter";

// ─── Card data ────────────────────────────────────────────────────────────────

/**
 * Each fixture card entry carries all the data needed across tables:
 * - `divination_cards` table fields
 * - `divination_card_rarities` rarity (poe.ninja derived)
 * - `prohibited_library_card_weights` weight + rarity + fromBoss
 * - `filter_card_rarities` for filter 1 and filter 2
 *
 * A `null` value in `plWeight` / `plRarity` means the card is absent from PL.
 * A `null` value in `filter1Rarity` / `filter2Rarity` means the card is not
 * present in that filter (won't be inserted into `filter_card_rarities`).
 */
export interface RarityInsightsCardFixture {
  // divination_cards fields
  id: string;
  name: string;
  stackSize: number;
  description: string;
  rewardHtml: string;
  artSrc: string;
  flavourHtml: string;
  game: "poe1" | "poe2";
  dataHash: string;
  fromBoss: boolean;

  // divination_card_rarities (poe.ninja)
  poeNinjaRarity: 0 | 1 | 2 | 3 | 4;

  // prohibited_library_card_weights
  plWeight: number | null;
  plRarity: 0 | 1 | 2 | 3 | 4 | null;
  plFromBoss: boolean;

  // filter_card_rarities
  filter1Rarity: 1 | 2 | 3 | 4 | null;
  filter2Rarity: 1 | 2 | 3 | 4 | null;
}

/**
 * The complete set of fixture cards.
 *
 * Rarity mapping:
 *   1 = Extremely Rare
 *   2 = Rare
 *   3 = Less Common
 *   4 = Common
 *   0 = Unknown (poe.ninja only)
 *
 * Design decisions:
 * - "The Doctor" and "House of Mirrors" are extremely rare across all sources
 * - "The Nurse" is rare in poe.ninja but less common in filter 1 → a diff
 * - "Humility" is common everywhere → no diff
 * - "Rain of Chaos" is common in poe.ninja but less common in filter 2 → a diff
 * - "Sambodhi's Wisdom" has poe.ninja rarity 0 (unknown) → low confidence
 * - "The Immortal" is boss-exclusive (fromBoss = true)
 * - "The Price of Devotion" is boss-exclusive and absent from PL
 * - "Carrion Crow" is common everywhere → no diff
 * - "The Enlightened" is rare in poe.ninja, rare in filter 1, less common in filter 2 → diff in f2
 * - "The Wretched" is less common in poe.ninja, common in filter 1 → a diff
 */
export const RARITY_INSIGHTS_CARDS: RarityInsightsCardFixture[] = [
  {
    id: "poe1_the-doctor",
    name: "The Doctor",
    stackSize: 8,
    description: "A card that grants Headhunter.",
    rewardHtml: "<span class='currency'>Headhunter</span>",
    artSrc: "TheDoctor.webp",
    flavourHtml: "<em>Every doctor has a cure.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-doctor",
    fromBoss: false,
    poeNinjaRarity: 1,
    plWeight: 5,
    plRarity: 1,
    plFromBoss: false,
    filter1Rarity: 1,
    filter2Rarity: 1,
  },
  {
    id: "poe1_house-of-mirrors",
    name: "House of Mirrors",
    stackSize: 1,
    description: "A card that grants Mirror of Kalandra.",
    rewardHtml: "<span class='currency'>Mirror of Kalandra</span>",
    artSrc: "HouseOfMirrors.webp",
    flavourHtml: "<em>In the mirror, all is possible.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-hom",
    fromBoss: false,
    poeNinjaRarity: 1,
    plWeight: 2,
    plRarity: 1,
    plFromBoss: false,
    filter1Rarity: 1,
    filter2Rarity: 1,
  },
  {
    id: "poe1_the-nurse",
    name: "The Nurse",
    stackSize: 8,
    description: "A card that grants The Doctor.",
    rewardHtml: "<span class='currency'>The Doctor</span>",
    artSrc: "TheNurse.webp",
    flavourHtml: "<em>The nurse cares for the sick.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-nurse",
    fromBoss: false,
    poeNinjaRarity: 2,
    plWeight: 80,
    plRarity: 2,
    plFromBoss: false,
    filter1Rarity: 3, // ← differs from poe.ninja (2 vs 3)
    filter2Rarity: 2,
  },
  {
    id: "poe1_humility",
    name: "Humility",
    stackSize: 9,
    description: "A card that grants Tabula Rasa.",
    rewardHtml: "<span class='currency'>Tabula Rasa</span>",
    artSrc: "Humility.webp",
    flavourHtml: "<em>The greatest warriors are born with nothing.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-humility",
    fromBoss: false,
    poeNinjaRarity: 4,
    plWeight: 9000,
    plRarity: 4,
    plFromBoss: false,
    filter1Rarity: 4,
    filter2Rarity: 4,
  },
  {
    id: "poe1_rain-of-chaos",
    name: "Rain of Chaos",
    stackSize: 8,
    description: "A card that grants Chaos Orb.",
    rewardHtml: "<span class='currency'>Chaos Orb</span>",
    artSrc: "RainOfChaos.webp",
    flavourHtml: "<em>What the gods give, they take away.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-rain",
    fromBoss: false,
    poeNinjaRarity: 4,
    plWeight: 12000,
    plRarity: 4,
    plFromBoss: false,
    filter1Rarity: 4,
    filter2Rarity: 3, // ← differs from poe.ninja (4 vs 3)
  },
  {
    id: "poe1_sambodhis-wisdom",
    name: "Sambodhi's Wisdom",
    stackSize: 7,
    description: "A card with low confidence pricing.",
    rewardHtml: "<span class='currency'>The Enlightenment</span>",
    artSrc: "SambodhisWisdom.webp",
    flavourHtml: "<em>Beyond the veil lies clarity.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-sambodhi",
    fromBoss: false,
    poeNinjaRarity: 0, // Unknown / low confidence
    plWeight: 300,
    plRarity: 2,
    plFromBoss: false,
    filter1Rarity: 2,
    filter2Rarity: 2,
  },
  {
    id: "poe1_carrion-crow",
    name: "Carrion Crow",
    stackSize: 4,
    description: "A card that grants life armour.",
    rewardHtml: "<span class='armour'>Life Armour</span>",
    artSrc: "CarrionCrow.webp",
    flavourHtml: "<em>The crow picks clean the bones.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-carrion",
    fromBoss: false,
    poeNinjaRarity: 4,
    plWeight: 15000,
    plRarity: 4,
    plFromBoss: false,
    filter1Rarity: 4,
    filter2Rarity: 4,
  },
  {
    id: "poe1_the-enlightened",
    name: "The Enlightened",
    stackSize: 6,
    description: "A card that grants Enlighten Support.",
    rewardHtml: "<span class='gem'>Enlighten Support</span>",
    artSrc: "TheEnlightened.webp",
    flavourHtml: "<em>Knowledge is power incarnate.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-enlightened",
    fromBoss: false,
    poeNinjaRarity: 2,
    plWeight: 100,
    plRarity: 2,
    plFromBoss: false,
    filter1Rarity: 2,
    filter2Rarity: 3, // ← differs from poe.ninja (2 vs 3)
  },
  {
    id: "poe1_the-wretched",
    name: "The Wretched",
    stackSize: 6,
    description: "A card that grants a random belt.",
    rewardHtml: "<span class='item'>Random Belt</span>",
    artSrc: "TheWretched.webp",
    flavourHtml: "<em>In desperation, we find strength.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-wretched",
    fromBoss: false,
    poeNinjaRarity: 3,
    plWeight: 3000,
    plRarity: 3,
    plFromBoss: false,
    filter1Rarity: 4, // ← differs from poe.ninja (3 vs 4)
    filter2Rarity: 3,
  },
  {
    id: "poe1_the-immortal",
    name: "The Immortal",
    stackSize: 10,
    description: "A boss-exclusive card.",
    rewardHtml: "<span class='unique'>Immortal Resolve</span>",
    artSrc: "TheImmortal.webp",
    flavourHtml: "<em>Only the worthy may claim this prize.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-immortal",
    fromBoss: true, // ← Boss card
    poeNinjaRarity: 2,
    plWeight: 0,
    plRarity: 0,
    plFromBoss: true,
    filter1Rarity: 2,
    filter2Rarity: 2,
  },
  {
    id: "poe1_the-price-of-devotion",
    name: "The Price of Devotion",
    stackSize: 5,
    description: "A boss-exclusive card absent from PL.",
    rewardHtml: "<span class='unique'>Devotion's Price</span>",
    artSrc: "ThePriceOfDevotion.webp",
    flavourHtml: "<em>Devotion is never free.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-devotion",
    fromBoss: true, // ← Boss card
    poeNinjaRarity: 1,
    plWeight: null, // ← Absent from Prohibited Library
    plRarity: null,
    plFromBoss: true,
    filter1Rarity: 1,
    filter2Rarity: 1,
  },
  {
    id: "poe1_heterochromia",
    name: "Heterochromia",
    stackSize: 1,
    description: "A card that grants a Two-Stone Ring.",
    rewardHtml: "<span class='item'>Two-Stone Ring</span>",
    artSrc: "Heterochromia.webp",
    flavourHtml: "<em>Two colours, one vision.</em>",
    game: FIXTURE_GAME,
    dataHash: "e2e-hash-heterochromia",
    fromBoss: false,
    poeNinjaRarity: 3,
    plWeight: 2500,
    plRarity: 3,
    plFromBoss: false,
    filter1Rarity: 3,
    filter2Rarity: 3,
  },
];

// ─── Derived collections ──────────────────────────────────────────────────────

/** Cards that are NOT boss-exclusive (default view when "Include boss cards" is off). */
export const NON_BOSS_CARDS = RARITY_INSIGHTS_CARDS.filter((c) => !c.fromBoss);

/** Cards that ARE boss-exclusive. */
export const BOSS_CARDS = RARITY_INSIGHTS_CARDS.filter((c) => c.fromBoss);

/** Card names expected in the default (non-boss) view. */
export const NON_BOSS_CARD_NAMES = NON_BOSS_CARDS.map((c) => c.name).sort();

/** Card names expected when "Include boss cards" is toggled on. */
export const ALL_CARD_NAMES = RARITY_INSIGHTS_CARDS.map((c) => c.name).sort();

/**
 * Cards where filter 1's rarity differs from poe.ninja's rarity.
 * Used to verify "Show differences only" with filter 1 selected.
 *
 * Default rarity for a card not in a filter is 4 (common).
 * poe.ninja rarity 0 (unknown) can also cause diffs if filter rarity ≠ 0,
 * but since filter rarities are 1-4 and 0 ≠ any 1-4, those always diff.
 */
export const FILTER_1_DIFF_CARDS = RARITY_INSIGHTS_CARDS.filter((c) => {
  const filterRarity = c.filter1Rarity ?? 4;
  return filterRarity !== c.poeNinjaRarity && !c.fromBoss;
});

/** Card names with diffs between filter 1 and poe.ninja (non-boss only). */
export const FILTER_1_DIFF_CARD_NAMES = FILTER_1_DIFF_CARDS.map(
  (c) => c.name,
).sort();

/**
 * Cards where filter 2's rarity differs from poe.ninja's rarity (non-boss).
 */
export const FILTER_2_DIFF_CARDS = RARITY_INSIGHTS_CARDS.filter((c) => {
  const filterRarity = c.filter2Rarity ?? 4;
  return filterRarity !== c.poeNinjaRarity && !c.fromBoss;
});

export const FILTER_2_DIFF_CARD_NAMES = FILTER_2_DIFF_CARDS.map(
  (c) => c.name,
).sort();

/**
 * Cards where ANY filter (1 or 2) differs from poe.ninja (non-boss).
 * This is the union used when both filters are selected and "Show differences only" is on.
 */
export const ANY_FILTER_DIFF_CARDS = RARITY_INSIGHTS_CARDS.filter((c) => {
  if (c.fromBoss) return false;
  const f1 = c.filter1Rarity ?? 4;
  const f2 = c.filter2Rarity ?? 4;
  return f1 !== c.poeNinjaRarity || f2 !== c.poeNinjaRarity;
});

export const ANY_FILTER_DIFF_CARD_NAMES = ANY_FILTER_DIFF_CARDS.map(
  (c) => c.name,
).sort();

// ─── Rarity label helpers ─────────────────────────────────────────────────────

/** Full rarity labels matching the UI badges. */
export const RARITY_LABELS: Record<number, string> = {
  0: "Unknown",
  1: "Extremely Rare",
  2: "Rare",
  3: "Less Common",
  4: "Common",
};

/** Short rarity labels matching the header chip badges. */
export const RARITY_SHORT_LABELS: Record<number, string> = {
  1: "R1",
  2: "R2",
  3: "R3",
  4: "R4",
};

// ─── Specific card lookups ────────────────────────────────────────────────────

/** A card with poe.ninja rarity 0 (unknown / low confidence). */
export const LOW_CONFIDENCE_CARD = RARITY_INSIGHTS_CARDS.find(
  (c) => c.poeNinjaRarity === 0,
)!;

/** A boss-exclusive card. */
export const A_BOSS_CARD = RARITY_INSIGHTS_CARDS.find((c) => c.fromBoss)!;

/** A card absent from Prohibited Library. */
export const PL_ABSENT_CARD = RARITY_INSIGHTS_CARDS.find(
  (c) => c.plRarity === null,
)!;

/** A card where filter1 rarity differs from poe.ninja (non-boss). */
export const A_DIFF_CARD_FILTER_1 = FILTER_1_DIFF_CARDS[0]!;

/** A common card with no differences anywhere. */
export const A_NO_DIFF_CARD = NON_BOSS_CARDS.find(
  (c) =>
    c.poeNinjaRarity !== 0 &&
    c.filter1Rarity === (c.poeNinjaRarity as 1 | 2 | 3 | 4) &&
    c.filter2Rarity === (c.poeNinjaRarity as 1 | 2 | 3 | 4),
)!;

/**
 * A well-known searchable card name used in search tests.
 * "The Doctor" is always present and easy to search for.
 */
export const SEARCHABLE_CARD_NAME = "The Doctor";

/**
 * A search query that should return multiple results.
 * "The" prefix matches The Doctor, The Nurse, The Enlightened, The Wretched,
 * The Immortal, The Price of Devotion.
 */
export const SEARCH_QUERY_MULTIPLE = "The";

/**
 * A search query that should return exactly one result.
 */
export const SEARCH_QUERY_UNIQUE = "Heterochromia";
