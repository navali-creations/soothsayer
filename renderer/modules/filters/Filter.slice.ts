import type { StateCreator } from "zustand";

import type {
  DiscoveredFilterDTO,
  FilterScanResultDTO,
} from "~/main/modules/filters/Filter.dto";

export interface FilterSlice {
  filters: {
    // State
    availableFilters: DiscoveredFilterDTO[];
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
    setAvailableFilters: (filters: DiscoveredFilterDTO[]) => void;
    setSelectedFilterId: (filterId: string | null) => void;
    setScanError: (error: string | null) => void;
    setParseError: (error: string | null) => void;

    // Getters
    getSelectedFilter: () => DiscoveredFilterDTO | null;
    getLocalFilters: () => DiscoveredFilterDTO[];
    getOnlineFilters: () => DiscoveredFilterDTO[];
  };
}

export const createFilterSlice: StateCreator<
  FilterSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  FilterSlice
> = (set, get) => ({
  filters: {
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
        ({ filters }) => {
          filters.isScanning = true;
          filters.scanError = null;
        },
        false,
        "filterSlice/scanFilters/start",
      );

      try {
        const result: FilterScanResultDTO =
          await window.electron.filters.scan();
        set(
          ({ filters }) => {
            filters.availableFilters = result.filters;
            filters.isScanning = false;
            filters.lastScannedAt = new Date().toISOString();
          },
          false,
          "filterSlice/scanFilters/success",
        );
      } catch (error) {
        console.error("Failed to scan filters:", error);
        set(
          ({ filters }) => {
            filters.isScanning = false;
            filters.scanError =
              error instanceof Error ? error.message : "Failed to scan filters";
          },
          false,
          "filterSlice/scanFilters/error",
        );
      }
    },

    // Select a filter and trigger full parse if needed
    selectFilter: async (filterId: string) => {
      set(
        ({ filters }) => {
          filters.selectedFilterId = filterId;
          filters.parseError = null;
        },
        false,
        "filterSlice/selectFilter",
      );

      try {
        await window.electron.filters.select(filterId);
      } catch (error) {
        console.error("Failed to select filter:", error);
        set(
          ({ filters }) => {
            filters.parseError =
              error instanceof Error
                ? error.message
                : "Failed to select filter";
          },
          false,
          "filterSlice/selectFilter/error",
        );
      }
    },

    // Clear the selected filter
    clearSelectedFilter: async () => {
      set(
        ({ filters }) => {
          filters.selectedFilterId = null;
        },
        false,
        "filterSlice/clearSelectedFilter",
      );

      try {
        await window.electron.filters.select(null);
      } catch (error) {
        console.error("Failed to clear selected filter:", error);
      }
    },

    // Trigger a full parse of a specific filter
    parseFilter: async (filterId: string) => {
      set(
        ({ filters }) => {
          filters.isParsing = true;
          filters.parseError = null;
        },
        false,
        "filterSlice/parseFilter/start",
      );

      try {
        await window.electron.filters.parse(filterId);

        // Update the filter in the list to mark as fully parsed
        set(
          ({ filters }) => {
            const filter = filters.availableFilters.find(
              (f) => f.id === filterId,
            );
            if (filter) {
              filter.isFullyParsed = true;
            }
            filters.isParsing = false;
          },
          false,
          "filterSlice/parseFilter/success",
        );
      } catch (error) {
        console.error("Failed to parse filter:", error);
        set(
          ({ filters }) => {
            filters.isParsing = false;
            filters.parseError =
              error instanceof Error ? error.message : "Failed to parse filter";
          },
          false,
          "filterSlice/parseFilter/error",
        );
      }
    },

    // Direct setters (for IPC listeners or external updates)
    setAvailableFilters: (newFilters: DiscoveredFilterDTO[]) => {
      set(
        ({ filters }) => {
          filters.availableFilters = newFilters;
        },
        false,
        "filterSlice/setAvailableFilters",
      );
    },

    setSelectedFilterId: (filterId: string | null) => {
      set(
        ({ filters }) => {
          filters.selectedFilterId = filterId;
        },
        false,
        "filterSlice/setSelectedFilterId",
      );
    },

    setScanError: (error: string | null) => {
      set(
        ({ filters }) => {
          filters.scanError = error;
        },
        false,
        "filterSlice/setScanError",
      );
    },

    setParseError: (error: string | null) => {
      set(
        ({ filters }) => {
          filters.parseError = error;
        },
        false,
        "filterSlice/setParseError",
      );
    },

    // Getters
    getSelectedFilter: () => {
      const { filters } = get();
      if (!filters.selectedFilterId) return null;
      return (
        filters.availableFilters.find(
          (f) => f.id === filters.selectedFilterId,
        ) ?? null
      );
    },

    getLocalFilters: () => {
      const { filters } = get();
      return filters.availableFilters.filter((f) => f.type === "local");
    },

    getOnlineFilters: () => {
      const { filters } = get();
      return filters.availableFilters.filter((f) => f.type === "online");
    },
  },
});
