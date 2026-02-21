import type { SortingState } from "@tanstack/react-table";
import type { StateCreator } from "zustand";

import type { DiscoveredRarityModelDTO } from "~/main/modules/rarity-model/RarityModel.dto";
import { trackEvent } from "~/renderer/modules/umami";
import type { KnownRarity, Rarity } from "~/types/data-stores";

import type { CardsSlice } from "../cards/Cards.slice";
import type { SettingsSlice } from "../settings/Settings.slice";
import type { RarityModelSlice } from "./RarityModel.slice";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedRarityModelRarities {
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
  /** Prohibited Library derived rarity (1–4), or null if card absent from PL dataset */
  prohibitedLibraryRarity: KnownRarity | null;
  /** Whether the card is boss-exclusive in the stacked-deck context (from PL data) */
  fromBoss: boolean;
}

// ─── Slice ───────────────────────────────────────────────────────────────────

export interface RarityModelComparisonSlice {
  rarityModelComparison: {
    // State
    selectedFilters: string[];
    parsedResults: Map<string, ParsedRarityModelRarities>;
    parsingFilterId: string | null;
    parseErrors: Map<string, string>;
    showDiffsOnly: boolean;

    // Priority rarity filters (drive the custom sort functions)
    priorityPoeNinjaRarity: Rarity | null;
    priorityPlRarity: KnownRarity | null;
    // Table sort state (owned here so sort is preserved across re-renders / devtools)
    tableSorting: SortingState;

    // Actions
    toggleFilter: (filterId: string) => void;
    parseFilter: (filterId: string) => Promise<void>;
    parseNextUnparsedFilter: () => Promise<void>;
    rescan: () => Promise<void>;
    setShowDiffsOnly: (show: boolean) => void;
    // Priority rarity actions — toggle on click, clear when switching sort column
    handlePoeNinjaRarityClick: (rarity: Rarity) => void;
    handlePlRarityClick: (rarity: KnownRarity) => void;
    handleTableSortingChange: (sorting: SortingState) => void;
    updateFilterCardRarity: (
      filterId: string,
      cardName: string,
      newRarity: KnownRarity,
    ) => Promise<void>;
    reset: () => void;

    // Getters
    getSelectedFilterDetails: () => DiscoveredRarityModelDTO[];
    getAllSelectedParsed: () => boolean;
    getDifferences: () => Set<string>;
    getDisplayRows: () => ComparisonRow[];
    getDisplayRowCount: () => number;
    getCanShowDiffs: () => boolean;
  };
}

export const createRarityModelComparisonSlice: StateCreator<
  RarityModelComparisonSlice & RarityModelSlice & CardsSlice & SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  RarityModelComparisonSlice
> = (set, get) => ({
  rarityModelComparison: {
    // Initial state
    selectedFilters: [],
    parsedResults: new Map(),
    parsingFilterId: null,
    parseErrors: new Map(),
    showDiffsOnly: false,
    priorityPoeNinjaRarity: null,
    priorityPlRarity: null,
    tableSorting: [{ id: "name", desc: false }],

    // ─── Actions ───────────────────────────────────────────────────────

    toggleFilter: (filterId: string) => {
      let shouldParse = false;

      set(
        ({ rarityModelComparison }) => {
          const idx = rarityModelComparison.selectedFilters.indexOf(filterId);
          if (idx >= 0) {
            rarityModelComparison.selectedFilters.splice(idx, 1);
          } else if (
            rarityModelComparison.selectedFilters.length < MAX_SELECTED_FILTERS
          ) {
            rarityModelComparison.selectedFilters.push(filterId);

            // Eagerly set parsingFilterId in the same state update so the UI
            // shows the "Parsing…" state on the very first render after the
            // click, avoiding the multi-render-cycle delay caused by the
            // useEffect → parseNextUnparsedFilter chain.
            if (
              !rarityModelComparison.parsingFilterId &&
              !rarityModelComparison.parsedResults.has(filterId) &&
              !rarityModelComparison.parseErrors.has(filterId)
            ) {
              rarityModelComparison.parsingFilterId = filterId;
              shouldParse = true;
            }
          }
        },
        false,
        "rarityModelComparison/toggleFilter",
      );

      if (shouldParse) {
        // Fire-and-forget: parseFilter will handle its own state transitions.
        get().rarityModelComparison.parseFilter(filterId);
      }

      trackEvent("filter-comparison-toggle", { filterId });
    },

    parseFilter: async (filterId: string) => {
      const { rarityModelComparison } = get();
      if (rarityModelComparison.parsedResults.has(filterId)) return;
      // Allow the call if parsingFilterId was eagerly set to this filter
      // by toggleFilter; block only if a *different* filter is parsing.
      if (
        rarityModelComparison.parsingFilterId &&
        rarityModelComparison.parsingFilterId !== filterId
      )
        return;

      // Only update state if not already eagerly set by toggleFilter
      if (rarityModelComparison.parsingFilterId !== filterId) {
        set(
          ({ rarityModelComparison }) => {
            rarityModelComparison.parsingFilterId = filterId;
            rarityModelComparison.parseErrors.delete(filterId);
          },
          false,
          "rarityModelComparison/parseFilter/start",
        );
      }

      try {
        const result = await window.electron.rarityModel.parse(filterId);
        const rarityMap = new Map<string, KnownRarity>();
        for (const r of result.rarities) {
          rarityMap.set(r.cardName, r.rarity);
        }

        set(
          ({ rarityModelComparison }) => {
            rarityModelComparison.parsedResults.set(filterId, {
              filterId,
              filterName: result.filterName,
              rarities: rarityMap,
              totalCards: result.totalCards,
            });
            rarityModelComparison.parsingFilterId = null;
          },
          false,
          "rarityModelComparison/parseFilter/success",
        );

        trackEvent("filter-comparison-parse", {
          filterId,
          totalCards: result.totalCards,
        });
      } catch (error) {
        console.error("Failed to parse filter:", error);
        set(
          ({ rarityModelComparison }) => {
            rarityModelComparison.parseErrors.set(
              filterId,
              error instanceof Error ? error.message : "Failed to parse filter",
            );
            rarityModelComparison.parsingFilterId = null;
          },
          false,
          "rarityModelComparison/parseFilter/error",
        );
      }
    },

    parseNextUnparsedFilter: async () => {
      const { rarityModelComparison } = get();
      for (const filterId of rarityModelComparison.selectedFilters) {
        if (
          !rarityModelComparison.parsedResults.has(filterId) &&
          !rarityModelComparison.parsingFilterId &&
          !rarityModelComparison.parseErrors.has(filterId)
        ) {
          await get().rarityModelComparison.parseFilter(filterId);
          return;
        }
      }
    },

    rescan: async () => {
      set(
        ({ rarityModelComparison }) => {
          rarityModelComparison.parseErrors = new Map();
          rarityModelComparison.selectedFilters = [];
          rarityModelComparison.parsedResults = new Map();
          rarityModelComparison.parsingFilterId = null;
          rarityModelComparison.parseErrors = new Map();
          rarityModelComparison.showDiffsOnly = false;
        },
        false,
        "rarityModelComparison/rescan/clear",
      );
      await get().rarityModel.scanFilters();
    },

    setShowDiffsOnly: (show: boolean) => {
      set(
        ({ rarityModelComparison }) => {
          rarityModelComparison.showDiffsOnly = show;
        },
        false,
        "rarityModelComparison/setShowDiffsOnly",
      );
    },

    handlePoeNinjaRarityClick: (rarity: Rarity) => {
      set(
        ({ rarityModelComparison: s }) => {
          const next = s.priorityPoeNinjaRarity === rarity ? null : rarity;
          s.priorityPoeNinjaRarity = next;
          s.priorityPlRarity = null;
          s.tableSorting =
            next != null
              ? [{ id: "poeNinjaRarity", desc: false }]
              : [{ id: "name", desc: false }];
        },
        false,
        "rarityModelComparison/handlePoeNinjaRarityClick",
      );
    },

    handlePlRarityClick: (rarity: KnownRarity) => {
      set(
        ({ rarityModelComparison: s }) => {
          const next = s.priorityPlRarity === rarity ? null : rarity;
          s.priorityPlRarity = next;
          s.priorityPoeNinjaRarity = null;
          s.tableSorting =
            next != null
              ? [{ id: "prohibitedLibraryRarity", desc: false }]
              : [{ id: "name", desc: false }];
        },
        false,
        "rarityModelComparison/handlePlRarityClick",
      );
    },

    handleTableSortingChange: (sorting: SortingState) => {
      set(
        ({ rarityModelComparison: s }) => {
          s.tableSorting = sorting;
          // Clear the priority rarity for any column no longer being sorted by
          if (!sorting.some((col) => col.id === "poeNinjaRarity")) {
            s.priorityPoeNinjaRarity = null;
          }
          if (!sorting.some((col) => col.id === "prohibitedLibraryRarity")) {
            s.priorityPlRarity = null;
          }
        },
        false,
        "rarityModelComparison/handleTableSortingChange",
      );
    },

    updateFilterCardRarity: async (
      filterId: string,
      cardName: string,
      newRarity: KnownRarity,
    ) => {
      try {
        const result = await window.electron.rarityModel.updateCardRarity(
          filterId,
          cardName,
          newRarity,
        );

        if (result.success) {
          // Optimistically update the local parsed results
          set(
            ({ rarityModelComparison }) => {
              const parsed = rarityModelComparison.parsedResults.get(filterId);
              if (parsed) {
                parsed.rarities.set(cardName, newRarity);
              }
            },
            false,
            "rarityModelComparison/updateFilterCardRarity/success",
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
        ({ rarityModelComparison }) => {
          rarityModelComparison.selectedFilters = [];
          rarityModelComparison.parsedResults = new Map();
          rarityModelComparison.parsingFilterId = null;
          rarityModelComparison.parseErrors = new Map();
          rarityModelComparison.showDiffsOnly = false;
          rarityModelComparison.priorityPoeNinjaRarity = null;
          rarityModelComparison.priorityPlRarity = null;
          rarityModelComparison.tableSorting = [{ id: "name", desc: false }];
        },
        false,
        "rarityModelComparison/reset",
      );
    },

    // ─── Getters ───────────────────────────────────────────────────────

    getSelectedFilterDetails: () => {
      const { rarityModelComparison, rarityModel } = get();
      return rarityModelComparison.selectedFilters
        .map((id) => rarityModel.availableFilters.find((f) => f.id === id))
        .filter(Boolean) as DiscoveredRarityModelDTO[];
    },

    getAllSelectedParsed: () => {
      const { rarityModelComparison } = get();
      return rarityModelComparison.selectedFilters.every((id) =>
        rarityModelComparison.parsedResults.has(id),
      );
    },

    getDifferences: () => {
      const { rarityModelComparison, cards } = get();
      const parsed = rarityModelComparison.selectedFilters
        .map((id) => rarityModelComparison.parsedResults.get(id))
        .filter(Boolean) as ParsedRarityModelRarities[];

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
      const { rarityModelComparison } = get();
      return rarityModelComparison.selectedFilters.length >= 1;
    },

    getDisplayRowCount: () => {
      const { rarityModelComparison, cards } = get();
      const { showDiffsOnly } = rarityModelComparison;
      const { allCards } = cards;

      if (!showDiffsOnly) return allCards.length;

      const differences = get().rarityModelComparison.getDifferences();
      if (differences.size === 0) return allCards.length;

      return allCards.filter((c) => differences.has(c.name)).length;
    },

    getDisplayRows: () => {
      const { rarityModelComparison, cards } = get();
      const { showDiffsOnly, selectedFilters, parsedResults } =
        rarityModelComparison;
      const { allCards } = cards;

      const differences = get().rarityModelComparison.getDifferences();

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
          prohibitedLibraryRarity: card.prohibitedLibraryRarity ?? null,
          fromBoss: card.fromBoss ?? false,
        };
      });
    },
  },
});
