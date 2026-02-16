import type { StateCreator } from "zustand";

import type {
  DiscoveredRarityModelDTO,
  RarityModelScanResultDTO,
} from "~/main/modules/rarity-model/RarityModel.dto";

export interface RarityModelSlice {
  rarityModel: {
    // State
    availableFilters: DiscoveredRarityModelDTO[];
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
    setAvailableFilters: (filters: DiscoveredRarityModelDTO[]) => void;
    setSelectedFilterId: (filterId: string | null) => void;
    setScanError: (error: string | null) => void;
    setParseError: (error: string | null) => void;

    // Getters
    getSelectedFilter: () => DiscoveredRarityModelDTO | null;
    getLocalFilters: () => DiscoveredRarityModelDTO[];
    getOnlineFilters: () => DiscoveredRarityModelDTO[];
  };
}

export const createRarityModelSlice: StateCreator<
  RarityModelSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  RarityModelSlice
> = (set, get) => ({
  rarityModel: {
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
        ({ rarityModel }) => {
          rarityModel.isScanning = true;
          rarityModel.scanError = null;
        },
        false,
        "rarityModelSlice/scanFilters/start",
      );

      try {
        const result: RarityModelScanResultDTO =
          await window.electron.rarityModel.scan();
        set(
          ({ rarityModel }) => {
            rarityModel.availableFilters = result.filters;
            rarityModel.isScanning = false;
            rarityModel.lastScannedAt = new Date().toISOString();
          },
          false,
          "rarityModelSlice/scanFilters/success",
        );
      } catch (error) {
        console.error("Failed to scan filters:", error);
        set(
          ({ rarityModel }) => {
            rarityModel.isScanning = false;
            rarityModel.scanError =
              error instanceof Error ? error.message : "Failed to scan filters";
          },
          false,
          "rarityModelSlice/scanFilters/error",
        );
      }
    },

    // Select a filter and trigger full parse if needed
    selectFilter: async (filterId: string) => {
      set(
        ({ rarityModel }) => {
          rarityModel.selectedFilterId = filterId;
          rarityModel.parseError = null;
        },
        false,
        "rarityModelSlice/selectFilter",
      );

      try {
        await window.electron.rarityModel.select(filterId);
      } catch (error) {
        console.error("Failed to select filter:", error);
        set(
          ({ rarityModel }) => {
            rarityModel.parseError =
              error instanceof Error
                ? error.message
                : "Failed to select filter";
          },
          false,
          "rarityModelSlice/selectFilter/error",
        );
      }
    },

    // Clear the selected filter
    clearSelectedFilter: async () => {
      set(
        ({ rarityModel }) => {
          rarityModel.selectedFilterId = null;
        },
        false,
        "rarityModelSlice/clearSelectedFilter",
      );

      try {
        await window.electron.rarityModel.select(null);
      } catch (error) {
        console.error("Failed to clear selected filter:", error);
      }
    },

    // Trigger a full parse of a specific filter
    parseFilter: async (filterId: string) => {
      set(
        ({ rarityModel }) => {
          rarityModel.isParsing = true;
          rarityModel.parseError = null;
        },
        false,
        "rarityModelSlice/parseFilter/start",
      );

      try {
        await window.electron.rarityModel.parse(filterId);

        // Update the filter in the list to mark as fully parsed
        set(
          ({ rarityModel }) => {
            const filter = rarityModel.availableFilters.find(
              (f) => f.id === filterId,
            );
            if (filter) {
              filter.isFullyParsed = true;
            }
            rarityModel.isParsing = false;
          },
          false,
          "rarityModelSlice/parseFilter/success",
        );
      } catch (error) {
        console.error("Failed to parse filter:", error);
        set(
          ({ rarityModel }) => {
            rarityModel.isParsing = false;
            rarityModel.parseError =
              error instanceof Error ? error.message : "Failed to parse filter";
          },
          false,
          "rarityModelSlice/parseFilter/error",
        );
      }
    },

    // Direct setters (for IPC listeners or external updates)
    setAvailableFilters: (newFilters: DiscoveredRarityModelDTO[]) => {
      set(
        ({ rarityModel }) => {
          rarityModel.availableFilters = newFilters;
        },
        false,
        "rarityModelSlice/setAvailableFilters",
      );
    },

    setSelectedFilterId: (filterId: string | null) => {
      set(
        ({ rarityModel }) => {
          rarityModel.selectedFilterId = filterId;
        },
        false,
        "rarityModelSlice/setSelectedFilterId",
      );
    },

    setScanError: (error: string | null) => {
      set(
        ({ rarityModel }) => {
          rarityModel.scanError = error;
        },
        false,
        "rarityModelSlice/setScanError",
      );
    },

    setParseError: (error: string | null) => {
      set(
        ({ rarityModel }) => {
          rarityModel.parseError = error;
        },
        false,
        "rarityModelSlice/setParseError",
      );
    },

    // Getters
    getSelectedFilter: () => {
      const { rarityModel } = get();
      if (!rarityModel.selectedFilterId) return null;
      return (
        rarityModel.availableFilters.find(
          (f) => f.id === rarityModel.selectedFilterId,
        ) ?? null
      );
    },

    getLocalFilters: () => {
      const { rarityModel } = get();
      return rarityModel.availableFilters.filter((f) => f.type === "local");
    },

    getOnlineFilters: () => {
      const { rarityModel } = get();
      return rarityModel.availableFilters.filter((f) => f.type === "online");
    },
  },
});
