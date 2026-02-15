import type { StateCreator } from "zustand";

import type { DiscoveredFilterDTO } from "~/main/modules/filters/Filter.dto";
import { trackEvent } from "~/renderer/modules/umami";
import type { KnownRarity, Rarity } from "~/types/data-stores";

import type { CardsSlice } from "../cards/Cards.slice";
import type { SettingsSlice } from "../settings/Settings.slice";
import type { FilterSlice } from "./Filter.slice";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedFilterRarities {
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
}

// ─── Slice ───────────────────────────────────────────────────────────────────

export interface FilterComparisonSlice {
  filterComparison: {
    // State
    selectedFilters: string[];
    parsedResults: Map<string, ParsedFilterRarities>;
    parsingFilterId: string | null;
    parseErrors: Map<string, string>;
    showDiffsOnly: boolean;

    // Actions
    toggleFilter: (filterId: string) => void;
    parseFilter: (filterId: string) => Promise<void>;
    parseNextUnparsedFilter: () => Promise<void>;
    rescan: () => Promise<void>;
    setShowDiffsOnly: (show: boolean) => void;
    updateFilterCardRarity: (
      filterId: string,
      cardName: string,
      newRarity: KnownRarity,
    ) => Promise<void>;
    reset: () => void;

    // Getters
    getSelectedFilterDetails: () => DiscoveredFilterDTO[];
    getAllSelectedParsed: () => boolean;
    getDifferences: () => Set<string>;
    getDisplayRows: () => ComparisonRow[];
    getCanShowDiffs: () => boolean;
  };
}

export const createFilterComparisonSlice: StateCreator<
  FilterComparisonSlice & FilterSlice & CardsSlice & SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  FilterComparisonSlice
> = (set, get) => ({
  filterComparison: {
    // Initial state
    selectedFilters: [],
    parsedResults: new Map(),
    parsingFilterId: null,
    parseErrors: new Map(),
    showDiffsOnly: false,

    // ─── Actions ───────────────────────────────────────────────────────

    toggleFilter: (filterId: string) => {
      set(
        ({ filterComparison }) => {
          const idx = filterComparison.selectedFilters.indexOf(filterId);
          if (idx >= 0) {
            filterComparison.selectedFilters.splice(idx, 1);
          } else if (
            filterComparison.selectedFilters.length < MAX_SELECTED_FILTERS
          ) {
            filterComparison.selectedFilters.push(filterId);
          }
        },
        false,
        "filterComparison/toggleFilter",
      );
      trackEvent("filter-comparison-toggle", { filterId });
    },

    parseFilter: async (filterId: string) => {
      const { filterComparison } = get();
      if (filterComparison.parsedResults.has(filterId)) return;
      if (filterComparison.parsingFilterId) return;

      set(
        ({ filterComparison }) => {
          filterComparison.parsingFilterId = filterId;
          filterComparison.parseErrors.delete(filterId);
        },
        false,
        "filterComparison/parseFilter/start",
      );

      try {
        const result = await window.electron.filters.parse(filterId);
        const rarityMap = new Map<string, KnownRarity>();
        for (const r of result.rarities) {
          rarityMap.set(r.cardName, r.rarity);
        }

        set(
          ({ filterComparison }) => {
            filterComparison.parsedResults.set(filterId, {
              filterId,
              filterName: result.filterName,
              rarities: rarityMap,
              totalCards: result.totalCards,
            });
            filterComparison.parsingFilterId = null;
          },
          false,
          "filterComparison/parseFilter/success",
        );

        trackEvent("filter-comparison-parse", {
          filterId,
          totalCards: result.totalCards,
        });
      } catch (error) {
        console.error("Failed to parse filter:", error);
        set(
          ({ filterComparison }) => {
            filterComparison.parseErrors.set(
              filterId,
              error instanceof Error ? error.message : "Failed to parse filter",
            );
            filterComparison.parsingFilterId = null;
          },
          false,
          "filterComparison/parseFilter/error",
        );
      }
    },

    parseNextUnparsedFilter: async () => {
      const { filterComparison } = get();
      for (const filterId of filterComparison.selectedFilters) {
        if (
          !filterComparison.parsedResults.has(filterId) &&
          !filterComparison.parsingFilterId &&
          !filterComparison.parseErrors.has(filterId)
        ) {
          await get().filterComparison.parseFilter(filterId);
          return;
        }
      }
    },

    rescan: async () => {
      set(
        ({ filterComparison }) => {
          filterComparison.parseErrors = new Map();
          filterComparison.parsedResults = new Map();
        },
        false,
        "filterComparison/rescan/clear",
      );
      await get().filters.scanFilters();
    },

    setShowDiffsOnly: (show: boolean) => {
      set(
        ({ filterComparison }) => {
          filterComparison.showDiffsOnly = show;
        },
        false,
        "filterComparison/setShowDiffsOnly",
      );
    },

    updateFilterCardRarity: async (
      filterId: string,
      cardName: string,
      newRarity: KnownRarity,
    ) => {
      try {
        const result = await window.electron.filters.updateCardRarity(
          filterId,
          cardName,
          newRarity,
        );

        if (result.success) {
          // Optimistically update the local parsed results
          set(
            ({ filterComparison }) => {
              const parsed = filterComparison.parsedResults.get(filterId);
              if (parsed) {
                parsed.rarities.set(cardName, newRarity);
              }
            },
            false,
            "filterComparison/updateFilterCardRarity/success",
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
        ({ filterComparison }) => {
          filterComparison.selectedFilters = [];
          filterComparison.parsedResults = new Map();
          filterComparison.parsingFilterId = null;
          filterComparison.parseErrors = new Map();
          filterComparison.showDiffsOnly = false;
        },
        false,
        "filterComparison/reset",
      );
    },

    // ─── Getters ───────────────────────────────────────────────────────

    getSelectedFilterDetails: () => {
      const { filterComparison, filters } = get();
      return filterComparison.selectedFilters
        .map((id) => filters.availableFilters.find((f) => f.id === id))
        .filter(Boolean) as DiscoveredFilterDTO[];
    },

    getAllSelectedParsed: () => {
      const { filterComparison } = get();
      return filterComparison.selectedFilters.every((id) =>
        filterComparison.parsedResults.has(id),
      );
    },

    getDifferences: () => {
      const { filterComparison, cards } = get();
      const parsed = filterComparison.selectedFilters
        .map((id) => filterComparison.parsedResults.get(id))
        .filter(Boolean) as ParsedFilterRarities[];

      if (parsed.length < 2) return new Set<string>();

      const diffs = new Set<string>();
      for (const card of cards.allCards) {
        const rarities = parsed.map((p) => p.rarities.get(card.name) ?? 4);
        if (new Set(rarities).size > 1) {
          diffs.add(card.name);
        }
      }
      return diffs;
    },

    getCanShowDiffs: () => {
      const { filterComparison } = get();
      return filterComparison.selectedFilters.length >= 2;
    },

    getDisplayRows: () => {
      const { filterComparison, cards } = get();
      const { showDiffsOnly, selectedFilters, parsedResults } =
        filterComparison;
      const { allCards } = cards;

      const differences = get().filterComparison.getDifferences();

      // Filter by diffs only
      let filtered = allCards;
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
        };
      });
    },
  },
});
