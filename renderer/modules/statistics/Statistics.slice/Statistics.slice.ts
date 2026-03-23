import type { StateCreator } from "zustand";

import type { SnapshotMetaResult } from "~/main/modules/csv/Csv.api";

export type StatScope = "all-time" | "league";

export interface StatisticsSlice {
  statistics: {
    statScope: StatScope;
    selectedLeague: string;
    searchQuery: string;
    snapshotMeta: SnapshotMetaResult | null;
    isExporting: boolean;
    setStatScope: (scope: StatScope) => void;
    setSelectedLeague: (league: string) => void;
    setSearchQuery: (query: string) => void;
    fetchSnapshotMeta: (scope: string) => Promise<void>;
    exportAll: (
      scope: string,
    ) => Promise<import("~/main/modules/csv/Csv.api").CsvExportResult>;
    exportIncremental: (
      scope: string,
    ) => Promise<import("~/main/modules/csv/Csv.api").CsvExportResult>;
  };
}

export const createStatisticsSlice: StateCreator<
  StatisticsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  StatisticsSlice
> = (set, get) => ({
  statistics: {
    priceSource: "exchange",
    statScope: "all-time",
    selectedLeague: "Keepers",
    searchQuery: "",
    snapshotMeta: null,
    isExporting: false,
    setStatScope: (scope) =>
      set(({ statistics }) => {
        statistics.statScope = scope;
      }),
    setSelectedLeague: (league) =>
      set(({ statistics }) => {
        statistics.selectedLeague = league;
      }),
    setSearchQuery: (query) =>
      set(({ statistics }) => {
        statistics.searchQuery = query;
      }),
    fetchSnapshotMeta: async (scope) => {
      try {
        const meta = await window.electron.csv.getSnapshotMeta(scope);
        set(({ statistics }) => {
          statistics.snapshotMeta = meta;
        });
      } catch (error) {
        console.error("Failed to fetch snapshot meta:", error);
        set(({ statistics }) => {
          statistics.snapshotMeta = null;
        });
      }
    },
    exportAll: async (scope) => {
      set(({ statistics }) => {
        statistics.isExporting = true;
      });
      try {
        const result = await window.electron.csv.exportAll(scope);
        if (result.success) {
          await get().statistics.fetchSnapshotMeta(scope);
        }
        return result;
      } finally {
        set(({ statistics }) => {
          statistics.isExporting = false;
        });
      }
    },
    exportIncremental: async (scope) => {
      set(({ statistics }) => {
        statistics.isExporting = true;
      });
      try {
        const result = await window.electron.csv.exportIncremental(scope);
        if (result.success) {
          await get().statistics.fetchSnapshotMeta(scope);
        }
        return result;
      } finally {
        set(({ statistics }) => {
          statistics.isExporting = false;
        });
      }
    },
  },
});
