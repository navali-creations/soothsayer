import type { SortingState } from "@tanstack/react-table";
import type { StateCreator } from "zustand";

import type { DiscoveredRarityInsightsDTO } from "~/main/modules/rarity-insights/RarityInsights.dto";
import { trackEvent } from "~/renderer/modules/umami";
import type { KnownRarity, Rarity } from "~/types/data-stores";

import type { CardsSlice } from "../../cards/Cards.slice/Cards.slice";
import type { SettingsSlice } from "../../settings/Settings.slice/Settings.slice";
import type { RarityInsightsSlice } from "../RarityInsights.slice/RarityInsights.slice";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedRarityInsightsRarities {
  filterId: string;
  filterName: string;
  rarities: Map<string, KnownRarity>;
  totalCards: number;
}

export const MAX_SELECTED_FILTERS = 3;

/**
 * A flat row for the TanStack comparison table.
 */
export interface ComparisonRow {
  id: string;
  name: string;
  stackSize: number;
  description: string;
  rewardHtml: string;
  artSrc: string;
  flavourHtml: string;
  /** poe.ninja-derived rarity (0-4) — 0 = Unknown (no data / low confidence) */
  rarity: Rarity;
  /** Whether any filter rarity differs from poe.ninja */
  isDifferent: boolean;
  /** filterId → rarity (null = still loading) */
  filterRarities: Record<string, KnownRarity | null>;
  /** Prohibited Library derived rarity (0–4), or null if card absent from PL dataset */
  prohibitedLibraryRarity: Rarity | null;
  /** Whether the card is boss-exclusive in the stacked-deck context (from PL data) */
  fromBoss: boolean;
}

// ─── Slice ───────────────────────────────────────────────────────────────────

export interface RarityInsightsComparisonSlice {
  rarityInsightsComparison: {
    // State
    selectedFilters: string[];
    parsedResults: Map<string, ParsedRarityInsightsRarities>;
    parsingFilterId: string | null;
    parseErrors: Map<string, string>;
    showDiffsOnly: boolean;
    /** When false (default), cards with fromBoss === true are hidden from the table */
    includeBossCards: boolean;

    // Priority rarity filters (drive the custom sort functions)
    priorityPoeNinjaRarity: Rarity | null;
    priorityPlRarity: KnownRarity | null;
    /** Per-filter priority rarity — keyed by filterId */
    priorityFilterRarities: Record<string, KnownRarity | null>;
    // Table sort state (owned here so sort is preserved across re-renders / devtools)
    tableSorting: SortingState;

    // Actions
    toggleFilter: (filterId: string) => void;
    parseFilter: (filterId: string) => Promise<void>;
    parseNextUnparsedFilter: () => Promise<void>;
    rescan: () => Promise<void>;
    setShowDiffsOnly: (show: boolean) => void;
    setIncludeBossCards: (include: boolean) => void;
    // Priority rarity actions — toggle on click, clear when switching sort column
    handlePoeNinjaRarityClick: (rarity: Rarity) => void;
    handlePlRarityClick: (rarity: KnownRarity) => void;
    handleFilterRarityClick: (filterId: string, rarity: KnownRarity) => void;
    handleTableSortingChange: (sorting: SortingState) => void;
    updateFilterCardRarity: (
      filterId: string,
      cardName: string,
      newRarity: KnownRarity,
    ) => Promise<void>;
    reset: () => void;

    // Getters
    getSelectedFilterDetails: () => DiscoveredRarityInsightsDTO[];
    getAllSelectedParsed: () => boolean;
    getDifferences: () => Set<string>;
    getDisplayRows: () => ComparisonRow[];
    getDisplayRowCount: () => number;
    getCanShowDiffs: () => boolean;
  };
}

export const createRarityInsightsComparisonSlice: StateCreator<
  RarityInsightsComparisonSlice &
    RarityInsightsSlice &
    CardsSlice &
    SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  RarityInsightsComparisonSlice
> = (set, get) => ({
  rarityInsightsComparison: {
    // Initial state
    selectedFilters: [],
    parsedResults: new Map(),
    parsingFilterId: null,
    parseErrors: new Map(),
    showDiffsOnly: false,
    includeBossCards: false,
    priorityPoeNinjaRarity: null,
    priorityPlRarity: null,
    priorityFilterRarities: {},
    tableSorting: [{ id: "name", desc: false }],

    // ─── Actions ───────────────────────────────────────────────────────

    toggleFilter: (filterId: string) => {
      let shouldParse = false;

      set(
        ({ rarityInsightsComparison }) => {
          const idx =
            rarityInsightsComparison.selectedFilters.indexOf(filterId);
          if (idx >= 0) {
            rarityInsightsComparison.selectedFilters.splice(idx, 1);
          } else if (
            rarityInsightsComparison.selectedFilters.length <
            MAX_SELECTED_FILTERS
          ) {
            rarityInsightsComparison.selectedFilters.push(filterId);

            // Eagerly set parsingFilterId in the same state update so the UI
            // shows the "Parsing…" state on the very first render after the
            // click, avoiding the multi-render-cycle delay caused by the
            // useEffect → parseNextUnparsedFilter chain.
            if (
              !rarityInsightsComparison.parsingFilterId &&
              !rarityInsightsComparison.parsedResults.has(filterId) &&
              !rarityInsightsComparison.parseErrors.has(filterId)
            ) {
              rarityInsightsComparison.parsingFilterId = filterId;
              shouldParse = true;
            }
          }
        },
        false,
        "rarityInsightsComparison/toggleFilter",
      );

      if (shouldParse) {
        // Fire-and-forget: parseFilter will handle its own state transitions.
        get().rarityInsightsComparison.parseFilter(filterId);
      }

      trackEvent("filter-comparison-toggle", { filterId });
    },

    parseFilter: async (filterId: string) => {
      const { rarityInsightsComparison } = get();
      if (rarityInsightsComparison.parsedResults.has(filterId)) return;
      // Allow the call if parsingFilterId was eagerly set to this filter
      // by toggleFilter; block only if a *different* filter is parsing.
      if (
        rarityInsightsComparison.parsingFilterId &&
        rarityInsightsComparison.parsingFilterId !== filterId
      )
        return;

      // Only update state if not already eagerly set by toggleFilter
      if (rarityInsightsComparison.parsingFilterId !== filterId) {
        set(
          ({ rarityInsightsComparison }) => {
            rarityInsightsComparison.parsingFilterId = filterId;
            rarityInsightsComparison.parseErrors.delete(filterId);
          },
          false,
          "rarityInsightsComparison/parseFilter/start",
        );
      }

      try {
        const result = await window.electron.rarityInsights.parse(filterId);
        const rarityMap = new Map<string, KnownRarity>();
        for (const r of result.rarities) {
          rarityMap.set(r.cardName, r.rarity);
        }

        set(
          ({ rarityInsightsComparison }) => {
            rarityInsightsComparison.parsedResults.set(filterId, {
              filterId,
              filterName: result.filterName,
              rarities: rarityMap,
              totalCards: result.totalCards,
            });
            rarityInsightsComparison.parsingFilterId = null;
          },
          false,
          "rarityInsightsComparison/parseFilter/success",
        );

        trackEvent("filter-comparison-parse", {
          filterId,
          totalCards: result.totalCards,
        });
      } catch (error) {
        console.error("Failed to parse filter:", error);
        set(
          ({ rarityInsightsComparison }) => {
            rarityInsightsComparison.parseErrors.set(
              filterId,
              error instanceof Error ? error.message : "Failed to parse filter",
            );
            rarityInsightsComparison.parsingFilterId = null;
          },
          false,
          "rarityInsightsComparison/parseFilter/error",
        );
      }
    },

    parseNextUnparsedFilter: async () => {
      const { rarityInsightsComparison } = get();
      for (const filterId of rarityInsightsComparison.selectedFilters) {
        if (
          !rarityInsightsComparison.parsedResults.has(filterId) &&
          !rarityInsightsComparison.parsingFilterId &&
          !rarityInsightsComparison.parseErrors.has(filterId)
        ) {
          await get().rarityInsightsComparison.parseFilter(filterId);
          return;
        }
      }
    },

    rescan: async () => {
      set(
        ({ rarityInsightsComparison }) => {
          rarityInsightsComparison.parseErrors = new Map();
          rarityInsightsComparison.selectedFilters = [];
          rarityInsightsComparison.parsedResults = new Map();
          rarityInsightsComparison.parsingFilterId = null;
          rarityInsightsComparison.parseErrors = new Map();
          rarityInsightsComparison.showDiffsOnly = false;
        },
        false,
        "rarityInsightsComparison/rescan/clear",
      );
      await get().rarityInsights.scanFilters();
    },

    setShowDiffsOnly: (show: boolean) => {
      set(
        ({ rarityInsightsComparison }) => {
          rarityInsightsComparison.showDiffsOnly = show;
        },
        false,
        "rarityInsightsComparison/setShowDiffsOnly",
      );
    },

    setIncludeBossCards: (include: boolean) => {
      set(
        ({ rarityInsightsComparison }) => {
          rarityInsightsComparison.includeBossCards = include;
        },
        false,
        "rarityInsightsComparison/setIncludeBossCards",
      );
    },

    handlePoeNinjaRarityClick: (rarity: Rarity) => {
      set(
        ({ rarityInsightsComparison: s }) => {
          const next = s.priorityPoeNinjaRarity === rarity ? null : rarity;
          s.priorityPoeNinjaRarity = next;
          s.priorityPlRarity = null;
          s.priorityFilterRarities = {};
          s.tableSorting =
            next != null
              ? [{ id: "poeNinjaRarity", desc: false }]
              : [{ id: "name", desc: false }];
        },
        false,
        "rarityInsightsComparison/handlePoeNinjaRarityClick",
      );
    },

    handlePlRarityClick: (rarity: KnownRarity) => {
      set(
        ({ rarityInsightsComparison: s }) => {
          const next = s.priorityPlRarity === rarity ? null : rarity;
          s.priorityPlRarity = next;
          s.priorityPoeNinjaRarity = null;
          s.priorityFilterRarities = {};
          s.tableSorting =
            next != null
              ? [{ id: "prohibitedLibraryRarity", desc: false }]
              : [{ id: "name", desc: false }];
        },
        false,
        "rarityInsightsComparison/handlePlRarityClick",
      );
    },

    handleFilterRarityClick: (filterId: string, rarity: KnownRarity) => {
      set(
        ({ rarityInsightsComparison: s }) => {
          const current = s.priorityFilterRarities[filterId] ?? null;
          const next = current === rarity ? null : rarity;
          // Clear all other priority sources
          s.priorityPoeNinjaRarity = null;
          s.priorityPlRarity = null;
          // Clear all filter priorities, then set the one we care about
          s.priorityFilterRarities = next != null ? { [filterId]: next } : {};
          s.tableSorting =
            next != null
              ? [{ id: `filter_${filterId}`, desc: false }]
              : [{ id: "name", desc: false }];
        },
        false,
        "rarityInsightsComparison/handleFilterRarityClick",
      );
    },

    handleTableSortingChange: (sorting: SortingState) => {
      set(
        ({ rarityInsightsComparison: s }) => {
          s.tableSorting = sorting;
          // Clear the priority rarity for any column no longer being sorted by
          if (!sorting.some((col) => col.id === "poeNinjaRarity")) {
            s.priorityPoeNinjaRarity = null;
          }
          if (!sorting.some((col) => col.id === "prohibitedLibraryRarity")) {
            s.priorityPlRarity = null;
          }
          // Clear filter priorities for columns no longer being sorted by
          for (const filterId of Object.keys(s.priorityFilterRarities)) {
            if (!sorting.some((col) => col.id === `filter_${filterId}`)) {
              delete s.priorityFilterRarities[filterId];
            }
          }
        },
        false,
        "rarityInsightsComparison/handleTableSortingChange",
      );
    },

    updateFilterCardRarity: async (
      filterId: string,
      cardName: string,
      newRarity: KnownRarity,
    ) => {
      try {
        const result = await window.electron.rarityInsights.updateCardRarity(
          filterId,
          cardName,
          newRarity,
        );

        if (result.success) {
          // Optimistically update the local parsed results
          set(
            ({ rarityInsightsComparison }) => {
              const parsed =
                rarityInsightsComparison.parsedResults.get(filterId);
              if (parsed) {
                parsed.rarities.set(cardName, newRarity);
              }
            },
            false,
            "rarityInsightsComparison/updateFilterCardRarity/success",
          );
          trackEvent("modify-rarity-filter", {
            filterId,
            cardName,
            rarity: newRarity,
          });
        } else {
          console.error("Failed to update filter card rarity:", result);
        }
      } catch (error) {
        console.error("Failed to update filter card rarity:", error);
      }
    },

    reset: () => {
      set(
        ({ rarityInsightsComparison }) => {
          rarityInsightsComparison.selectedFilters = [];
          rarityInsightsComparison.parsedResults = new Map();
          rarityInsightsComparison.parsingFilterId = null;
          rarityInsightsComparison.parseErrors = new Map();
          rarityInsightsComparison.showDiffsOnly = false;
          rarityInsightsComparison.includeBossCards = false;
          rarityInsightsComparison.priorityPoeNinjaRarity = null;
          rarityInsightsComparison.priorityPlRarity = null;
          rarityInsightsComparison.priorityFilterRarities = {};
          rarityInsightsComparison.tableSorting = [{ id: "name", desc: false }];
        },
        false,
        "rarityInsightsComparison/reset",
      );
    },

    // ─── Getters ───────────────────────────────────────────────────────

    getSelectedFilterDetails: () => {
      const { rarityInsightsComparison, rarityInsights } = get();
      return rarityInsightsComparison.selectedFilters
        .map((id) => rarityInsights.availableFilters.find((f) => f.id === id))
        .filter(Boolean) as DiscoveredRarityInsightsDTO[];
    },

    getAllSelectedParsed: () => {
      const { rarityInsightsComparison } = get();
      return rarityInsightsComparison.selectedFilters.every((id) =>
        rarityInsightsComparison.parsedResults.has(id),
      );
    },

    getDifferences: () => {
      const { rarityInsightsComparison, cards } = get();
      const parsed = rarityInsightsComparison.selectedFilters
        .map((id) => rarityInsightsComparison.parsedResults.get(id))
        .filter(Boolean) as ParsedRarityInsightsRarities[];

      if (parsed.length === 0) return new Set<string>();

      const diffs = new Set<string>();
      for (const card of cards.allCards) {
        const ninjaRarity = card.rarity;
        // A card is "different" if ANY selected filter disagrees with poe.ninja
        for (const p of parsed) {
          const filterRarity = p.rarities.get(card.name) ?? 4;
          if (filterRarity !== ninjaRarity) {
            diffs.add(card.name);
            break;
          }
        }
      }
      return diffs;
    },

    getCanShowDiffs: () => {
      const { rarityInsightsComparison } = get();
      return rarityInsightsComparison.selectedFilters.length >= 1;
    },

    getDisplayRowCount: () => {
      const { rarityInsightsComparison, cards } = get();
      const { showDiffsOnly, includeBossCards } = rarityInsightsComparison;
      const { allCards } = cards;

      let filtered = allCards;

      // Filter out boss-exclusive cards unless explicitly included
      if (!includeBossCards) {
        filtered = filtered.filter((c) => !c.fromBoss);
      }

      if (!showDiffsOnly) return filtered.length;

      const differences = get().rarityInsightsComparison.getDifferences();
      if (differences.size === 0) return filtered.length;

      return filtered.filter((c) => differences.has(c.name)).length;
    },

    getDisplayRows: () => {
      const { rarityInsightsComparison, cards } = get();
      const {
        showDiffsOnly,
        includeBossCards,
        selectedFilters,
        parsedResults,
      } = rarityInsightsComparison;
      const { allCards } = cards;

      const differences = get().rarityInsightsComparison.getDifferences();

      // Filter out boss-exclusive cards unless explicitly included
      let filtered = allCards;
      if (!includeBossCards) {
        filtered = filtered.filter((c) => !c.fromBoss);
      }

      // Filter by diffs only
      if (showDiffsOnly && differences.size > 0) {
        filtered = filtered.filter((c) => differences.has(c.name));
      }

      // Map to ComparisonRow
      return filtered.map((card) => {
        const filterRarities: Record<string, KnownRarity | null> = {};
        for (const filterId of selectedFilters) {
          const parsed = parsedResults.get(filterId);
          filterRarities[filterId] = parsed
            ? (parsed.rarities.get(card.name) ?? (4 as KnownRarity))
            : null;
        }

        return {
          id: card.id,
          name: card.name,
          stackSize: card.stackSize,
          description: card.description,
          rewardHtml: card.rewardHtml,
          artSrc: card.artSrc,
          flavourHtml: card.flavourHtml,
          rarity: card.rarity,
          isDifferent: differences.has(card.name),
          filterRarities,
          prohibitedLibraryRarity: card.prohibitedLibraryRarity ?? null,
          fromBoss: card.fromBoss ?? false,
        };
      });
    },
  },
});
