/**
 * Shared test fixture factories for renderer tests.
 *
 * These replace the duplicated `makeCard()`, `makeSession()`, etc. helpers
 * that were copy-pasted across 20+ test files. Import from here instead of
 * re-declaring locally.
 *
 * Each factory returns a valid default object and accepts a `Partial<T>`
 * overrides bag so tests only specify the fields they care about.
 */

import type {
  CardEntry,
  DetailedDivinationCardStats,
} from "../../types/data-stores";
import type { DivinationCardRow } from "../modules/cards/Cards.types";
import type { SessionsSummary } from "../modules/sessions/Sessions.types";

// ─── DivinationCardRow (used by Cards grid / page / slice tests) ───────────

/**
 * Creates a `DivinationCardRow` with sensible defaults.
 *
 * Duplicated as `makeCard()` in:
 *  - CardGridItem.test.tsx
 *  - CardsGrid.test.tsx
 *  - Cards.page.test.tsx
 *  - Cards.slice.test.ts
 *  - ComparisonTable.test.tsx
 *  - RarityInsightsComparison.slice.test.ts
 */
export function makeDivinationCardRow(
  overrides: Partial<DivinationCardRow> = {},
): DivinationCardRow {
  return {
    id: "card-1",
    name: "The Doctor",
    stackSize: 8,
    description: "A test card",
    rewardHtml: "<span>Reward</span>",
    artSrc: "https://example.com/art.png",
    flavourHtml: "<em>Flavour</em>",
    rarity: 1,
    filterRarity: null,
    prohibitedLibraryRarity: null,
    fromBoss: false,
    isDisabled: false,
    inPool: true,
    ...overrides,
  };
}

// ─── DivinationCardRow + DTO fields (used by slice tests that need game/timestamps)

/**
 * Extended card shape that includes the DTO-only fields (`game`, `createdAt`,
 * `updatedAt`). Useful for slice-level tests (Cards.slice, CardDetails.slice,
 * RarityInsightsComparison.slice).
 */
export function makeDivinationCardDTO(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    name: "The Doctor",
    stackSize: 8,
    description: "",
    rewardHtml: "",
    artSrc: "",
    flavourHtml: "",
    rarity: 1 as const,
    filterRarity: null,
    prohibitedLibraryRarity: null,
    fromBoss: false,
    isDisabled: false,
    inPool: true,
    game: "poe1" as const,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

// ─── SessionsSummary (used by SessionsCard / SessionsGrid / SessionsPagination)

/**
 * Creates a `SessionsSummary` with sensible defaults.
 *
 * Duplicated as `makeSession()` in:
 *  - SessionsCard.test.tsx
 *  - SessionsGrid.test.tsx
 *  - SessionsPagination.test.tsx
 *  - CardDetailsSessionListSubComponents.test.tsx
 */
export function makeSessionsSummary(
  overrides: Partial<SessionsSummary> = {},
): SessionsSummary {
  return {
    sessionId: "sess-1",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:00:00Z",
    league: "Settlers",
    isActive: false,
    durationMinutes: 60,
    totalDecksOpened: 100,
    totalValue: 500,
    netProfit: 200,
    chaosToDivineRatio: 150,
    stackedDeckChaosCost: 3,
    ...overrides,
  };
}

// ─── CardEntry (used by DivinationCard / SessionDetailsTable / columns tests)

/**
 * Creates a `CardEntry` (from `~/types/data-stores`) with sensible defaults.
 *
 * Duplicated as `makeCard()` / `makeCardEntry()` in:
 *  - DivinationCard.test.tsx
 *  - SessionDetailsTable.test.tsx
 *  - columns.test.tsx
 *  - TimelineTooltip.test.tsx
 */
export function makeCardEntry(overrides: Partial<CardEntry> = {}): CardEntry {
  return {
    name: "The Doctor",
    count: 5,
    price: {
      chaosValue: 950,
      divineValue: 4.75,
      totalValue: 4750,
      hidePrice: false,
    },
    ...overrides,
  };
}

// ─── DetailedDivinationCardStats (session detail / slice tests) ────────────

/**
 * Creates a `DetailedDivinationCardStats` with sensible defaults.
 *
 * Duplicated as `makeSession()` / `makeSessionDetail()` in:
 *  - CurrentSession.slice.test.ts
 *  - SessionDetails.slice.test.ts
 *  - Sessions.slice.test.ts
 *  - SessionDetailsPage.test.tsx
 */
export function makeDetailedSession(
  overrides: Partial<DetailedDivinationCardStats> = {},
): DetailedDivinationCardStats {
  return {
    totalCount: 50,
    cards: [
      {
        name: "The Doctor",
        count: 2,
        price: {
          chaosValue: 1200,
          divineValue: 8,
          totalValue: 2400,
        },
      },
      {
        name: "Rain of Chaos",
        count: 30,
        price: {
          chaosValue: 1,
          divineValue: 0.007,
          totalValue: 30,
        },
      },
    ],
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: "2024-01-01T01:00:00Z",
    league: "Settlers",
    ...overrides,
  };
}
