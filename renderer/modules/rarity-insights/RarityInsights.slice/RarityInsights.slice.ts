import type { StateCreator } from "zustand";

import type {
  DiscoveredRarityInsightsDTO,
  FilterThemeDTO,
  RarityInsightsMetadataDTO,
  RarityInsightsScanResultDTO,
} from "~/main/modules/rarity-insights/RarityInsights.dto";
import type { BoundStore } from "~/renderer/store/store.types";
import type { FilterTheme } from "~/renderer/utils";

import { toFilterTheme } from "../RarityInsights.utils/RarityInsights.utils";

let filterThemeRequestSequence = 0;

export interface RarityInsightsSlice {
  rarityInsights: {
    // State
    availableFilters: DiscoveredRarityInsightsDTO[];
    selectedFilterId: string | null;
    isScanning: boolean;
    isParsing: boolean;
    activeFilterTheme: FilterTheme | null;
    isThemeLoading: boolean;
    scanError: string | null;
    parseError: string | null;
    themeError: string | null;
    lastScannedAt: string | null;

    // Actions
    loadStoredFilters: () => Promise<void>;
    scanFilters: () => Promise<void>;
    selectFilter: (filterId: string) => Promise<void>;
    clearSelectedFilter: () => Promise<void>;
    parseFilter: (filterId: string) => Promise<void>;
    loadFilterTheme: (filterId: string | null) => Promise<void>;
    clearFilterTheme: () => void;
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
    activeFilterTheme: null,
    isThemeLoading: false,
    scanError: null,
    parseError: null,
    themeError: null,
    lastScannedAt: null,

    loadStoredFilters: async () => {
      try {
        const filters = await window.electron.rarityInsights.getAll();
        set(
          ({ rarityInsights }) => {
            rarityInsights.availableFilters = filters.map(toDiscoveredFilter);
          },
          false,
          "rarityInsightsSlice/loadStoredFilters/success",
        );
      } catch (error) {
        console.error("Failed to load stored filters:", error);
        set(
          ({ rarityInsights }) => {
            rarityInsights.scanError =
              error instanceof Error
                ? error.message
                : "Failed to load stored filters";
          },
          false,
          "rarityInsightsSlice/loadStoredFilters/error",
        );
      }
    },

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
        const selectedFilterId =
          get().rarityInsights.selectedFilterId ??
          get().settings.selectedFilterId;
        set(
          ({ rarityInsights }) => {
            rarityInsights.availableFilters = mergeWithCachedSelectedFilter(
              result.filters,
              rarityInsights.availableFilters,
              selectedFilterId,
            );
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
        await get().rarityInsights.loadFilterTheme(filterId);
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
          rarityInsights.activeFilterTheme = null;
          rarityInsights.themeError = null;
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
        await get().rarityInsights.loadFilterTheme(filterId);

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

    loadFilterTheme: async (filterId: string | null) => {
      if (!filterId) {
        get().rarityInsights.clearFilterTheme();
        return;
      }

      if (!isCurrentFilterThemeRequest(get(), filterId)) {
        return;
      }

      const requestId = ++filterThemeRequestSequence;

      set(
        ({ rarityInsights }) => {
          rarityInsights.isThemeLoading = true;
          rarityInsights.themeError = null;
        },
        false,
        "rarityInsightsSlice/loadFilterTheme/start",
      );

      try {
        const themeRows: FilterThemeDTO =
          await window.electron.rarityInsights.getFilterTheme(filterId);

        const currentState = get();
        if (
          requestId !== filterThemeRequestSequence ||
          !isCurrentFilterThemeRequest(currentState, filterId)
        ) {
          if (requestId === filterThemeRequestSequence) {
            set(
              ({ rarityInsights }) => {
                rarityInsights.isThemeLoading = false;
              },
              false,
              "rarityInsightsSlice/loadFilterTheme/ignored",
            );
          }
          return;
        }

        set(
          ({ rarityInsights }) => {
            rarityInsights.activeFilterTheme = toFilterTheme(themeRows);
            rarityInsights.isThemeLoading = false;
          },
          false,
          "rarityInsightsSlice/loadFilterTheme/success",
        );
      } catch (error) {
        const currentState = get();
        if (
          requestId !== filterThemeRequestSequence ||
          !isCurrentFilterThemeRequest(currentState, filterId)
        ) {
          if (requestId === filterThemeRequestSequence) {
            set(
              ({ rarityInsights }) => {
                rarityInsights.isThemeLoading = false;
              },
              false,
              "rarityInsightsSlice/loadFilterTheme/ignored-error",
            );
          }
          return;
        }

        console.error("Failed to load filter theme:", error);
        set(
          ({ rarityInsights }) => {
            rarityInsights.activeFilterTheme = null;
            rarityInsights.isThemeLoading = false;
            rarityInsights.themeError =
              error instanceof Error
                ? error.message
                : "Failed to load filter theme";
          },
          false,
          "rarityInsightsSlice/loadFilterTheme/error",
        );
      }
    },

    clearFilterTheme: () => {
      filterThemeRequestSequence += 1;
      set(
        ({ rarityInsights }) => {
          rarityInsights.activeFilterTheme = null;
          rarityInsights.isThemeLoading = false;
          rarityInsights.themeError = null;
        },
        false,
        "rarityInsightsSlice/clearFilterTheme",
      );
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

function isCurrentFilterThemeRequest(
  state: BoundStore,
  filterId: string,
): boolean {
  if (state.settings.raritySource !== "filter") {
    return false;
  }

  return (
    state.settings.selectedFilterId === filterId ||
    state.rarityInsights.selectedFilterId === filterId
  );
}

function mergeWithCachedSelectedFilter(
  scannedFilters: DiscoveredRarityInsightsDTO[],
  cachedFilters: DiscoveredRarityInsightsDTO[],
  selectedFilterId: string | null,
): DiscoveredRarityInsightsDTO[] {
  if (
    !selectedFilterId ||
    scannedFilters.some((filter) => filter.id === selectedFilterId)
  ) {
    return scannedFilters;
  }

  const cachedSelectedFilter = cachedFilters.find(
    (filter) => filter.id === selectedFilterId,
  );

  return cachedSelectedFilter
    ? [...scannedFilters, cachedSelectedFilter]
    : scannedFilters;
}

function toDiscoveredFilter(
  metadata: RarityInsightsMetadataDTO,
): DiscoveredRarityInsightsDTO {
  return {
    id: metadata.id,
    type: metadata.filterType,
    filePath: metadata.filePath,
    fileName: getFileName(metadata.filePath),
    name: metadata.filterName,
    lastUpdate: metadata.lastUpdate,
    isFullyParsed: metadata.isFullyParsed,
    isOutdated: false,
  };
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}
