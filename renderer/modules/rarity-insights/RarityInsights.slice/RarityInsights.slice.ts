import type { StateCreator } from "zustand";

import type {
  DiscoveredRarityInsightsDTO,
  RarityInsightsScanResultDTO,
} from "~/main/modules/rarity-insights/RarityInsights.dto";
import type { BoundStore } from "~/renderer/store/store.types";

export interface RarityInsightsSlice {
  rarityInsights: {
    // State
    availableFilters: DiscoveredRarityInsightsDTO[];
    selectedFilterId: string | null;
    isScanning: boolean;
    isParsing: boolean;
    scanError: string | null;
    parseError: string | null;
    lastScannedAt: string | null;

    // Actions
    scanFilters: () => Promise<void>;
    selectFilter: (filterId: string) => Promise<void>;
    clearSelectedFilter: () => Promise<void>;
    parseFilter: (filterId: string) => Promise<void>;
    setAvailableFilters: (filters: DiscoveredRarityInsightsDTO[]) => void;
    setSelectedFilterId: (filterId: string | null) => void;
    setScanError: (error: string | null) => void;
    setParseError: (error: string | null) => void;

    // Getters
    getSelectedFilter: () => DiscoveredRarityInsightsDTO | null;
    getLocalFilters: () => DiscoveredRarityInsightsDTO[];
    getOnlineFilters: () => DiscoveredRarityInsightsDTO[];
  };
}

export const createRarityInsightsSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  RarityInsightsSlice
> = (set, get) => ({
  rarityInsights: {
    // Initial state
    availableFilters: [],
    selectedFilterId: null,
    isScanning: false,
    isParsing: false,
    scanError: null,
    parseError: null,
    lastScannedAt: null,

    // Scan filter directories for available filters (metadata only)
    scanFilters: async () => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.isScanning = true;
          rarityInsights.scanError = null;
        },
        false,
        "rarityInsightsSlice/scanFilters/start",
      );

      try {
        const result: RarityInsightsScanResultDTO =
          await window.electron.rarityInsights.scan();
        set(
          ({ rarityInsights }) => {
            rarityInsights.availableFilters = result.filters;
            rarityInsights.isScanning = false;
            rarityInsights.lastScannedAt = new Date().toISOString();
          },
          false,
          "rarityInsightsSlice/scanFilters/success",
        );
      } catch (error) {
        console.error("Failed to scan filters:", error);
        set(
          ({ rarityInsights }) => {
            rarityInsights.isScanning = false;
            rarityInsights.scanError =
              error instanceof Error ? error.message : "Failed to scan filters";
          },
          false,
          "rarityInsightsSlice/scanFilters/error",
        );
      }
    },

    // Select a filter and trigger full parse if needed
    selectFilter: async (filterId: string) => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.selectedFilterId = filterId;
          rarityInsights.parseError = null;
        },
        false,
        "rarityInsightsSlice/selectFilter",
      );

      try {
        await window.electron.rarityInsights.select(filterId);
      } catch (error) {
        console.error("Failed to select filter:", error);
        set(
          ({ rarityInsights }) => {
            rarityInsights.parseError =
              error instanceof Error
                ? error.message
                : "Failed to select filter";
          },
          false,
          "rarityInsightsSlice/selectFilter/error",
        );
      }
    },

    // Clear the selected filter
    clearSelectedFilter: async () => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.selectedFilterId = null;
        },
        false,
        "rarityInsightsSlice/clearSelectedFilter",
      );

      try {
        await window.electron.rarityInsights.select(null);
      } catch (error) {
        console.error("Failed to clear selected filter:", error);
      }
    },

    // Trigger a full parse of a specific filter
    parseFilter: async (filterId: string) => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.isParsing = true;
          rarityInsights.parseError = null;
        },
        false,
        "rarityInsightsSlice/parseFilter/start",
      );

      try {
        await window.electron.rarityInsights.parse(filterId);

        // Update the filter in the list to mark as fully parsed
        set(
          ({ rarityInsights }) => {
            const filter = rarityInsights.availableFilters.find(
              (f) => f.id === filterId,
            );
            if (filter) {
              filter.isFullyParsed = true;
            }
            rarityInsights.isParsing = false;
          },
          false,
          "rarityInsightsSlice/parseFilter/success",
        );
      } catch (error) {
        console.error("Failed to parse filter:", error);
        set(
          ({ rarityInsights }) => {
            rarityInsights.isParsing = false;
            rarityInsights.parseError =
              error instanceof Error ? error.message : "Failed to parse filter";
          },
          false,
          "rarityInsightsSlice/parseFilter/error",
        );
      }
    },

    // Direct setters (for IPC listeners or external updates)
    setAvailableFilters: (newFilters: DiscoveredRarityInsightsDTO[]) => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.availableFilters = newFilters;
        },
        false,
        "rarityInsightsSlice/setAvailableFilters",
      );
    },

    setSelectedFilterId: (filterId: string | null) => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.selectedFilterId = filterId;
        },
        false,
        "rarityInsightsSlice/setSelectedFilterId",
      );
    },

    setScanError: (error: string | null) => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.scanError = error;
        },
        false,
        "rarityInsightsSlice/setScanError",
      );
    },

    setParseError: (error: string | null) => {
      set(
        ({ rarityInsights }) => {
          rarityInsights.parseError = error;
        },
        false,
        "rarityInsightsSlice/setParseError",
      );
    },

    // Getters
    getSelectedFilter: () => {
      const { rarityInsights } = get();
      if (!rarityInsights.selectedFilterId) return null;
      return (
        rarityInsights.availableFilters.find(
          (f) => f.id === rarityInsights.selectedFilterId,
        ) ?? null
      );
    },

    getLocalFilters: () => {
      const { rarityInsights } = get();
      return rarityInsights.availableFilters.filter((f) => f.type === "local");
    },

    getOnlineFilters: () => {
      const { rarityInsights } = get();
      return rarityInsights.availableFilters.filter((f) => f.type === "online");
    },
  },
});
