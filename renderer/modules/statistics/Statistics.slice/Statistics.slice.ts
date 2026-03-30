import type { StateCreator } from "zustand";

import type { SnapshotMetaResult } from "~/main/modules/csv/Csv.api";
import type {
  BrushRange,
  MetricKey,
  RawDataPoint,
} from "~/renderer/components/CombinedChartCanvas/chart-types";
import { METRICS } from "~/renderer/components/CombinedChartCanvas/chart-types";
import type { BoundStore } from "~/renderer/store/store.types";

import type { SessionHighlights } from "../Statistics.types";

export type StatScope = "all-time" | "league";

export interface StatisticsSlice {
  statistics: {
    statScope: StatScope;
    selectedLeague: string;
    searchQuery: string;
    snapshotMeta: SnapshotMetaResult | null;
    isExporting: boolean;
    showUncollectedCards: boolean;
    sessionHighlights: SessionHighlights | null;
    stackedDeckCardCount: number | null;
    uncollectedCardNames: string[];
    isLoadingHighlights: boolean;

    chartRawData: RawDataPoint[];
    isChartLoading: boolean;
    hiddenMetrics: Set<MetricKey>;
    brushRange: BrushRange;

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
    toggleShowUncollectedCards: () => void;
    fetchSessionHighlights: (
      game: "poe1" | "poe2",
      league?: string,
    ) => Promise<void>;
    fetchUncollectedCardNames: (
      game: "poe1" | "poe2",
      league?: string,
    ) => Promise<void>;

    fetchChartData: (game: "poe1" | "poe2", league?: string) => Promise<void>;
    toggleChartMetric: (key: MetricKey) => void;
    setBrushRange: (range: BrushRange) => void;
  };
}

export const createStatisticsSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  StatisticsSlice
> = (set, get) => ({
  statistics: {
    statScope: "all-time",
    selectedLeague: "",
    searchQuery: "",
    snapshotMeta: null,
    isExporting: false,
    showUncollectedCards: false,
    sessionHighlights: null,
    stackedDeckCardCount: null,
    uncollectedCardNames: [],
    isLoadingHighlights: false,

    chartRawData: [],
    isChartLoading: true,
    hiddenMetrics: new Set<MetricKey>(),
    brushRange: { startIndex: 0, endIndex: 0 },

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
    toggleShowUncollectedCards: () => {
      const willBeEnabled = !get().statistics.showUncollectedCards;
      set(({ statistics }) => {
        statistics.showUncollectedCards = willBeEnabled;
      });
      if (willBeEnabled) {
        const { statScope, selectedLeague } = get().statistics;
        const league =
          statScope === "league" && selectedLeague ? selectedLeague : undefined;
        get().statistics.fetchUncollectedCardNames("poe1", league);
      }
    },
    fetchUncollectedCardNames: async (game, league) => {
      try {
        const names = await window.electron.sessions.getUncollectedCardNames(
          game,
          league,
        );
        set(({ statistics }) => {
          statistics.uncollectedCardNames = names;
        });
      } catch (error) {
        console.error("Failed to fetch uncollected card names:", error);
      }
    },
    fetchSessionHighlights: async (game, league) => {
      set(({ statistics }) => {
        statistics.isLoadingHighlights = true;
      });
      try {
        const [
          mostProfitable,
          longestSession,
          mostDecksOpened,
          totalDecksOpened,
          stackedDeckCardCount,
          averages,
          biggestLetdown,
          luckyBreak,
        ] = await Promise.all([
          window.electron.sessions.getMostProfitable(game, league),
          window.electron.sessions.getLongestSession(game, league),
          window.electron.sessions.getMostDecksOpened(game, league),
          window.electron.sessions.getTotalDecksOpened(game, league),
          window.electron.sessions.getStackedDeckCardCount(game),
          window.electron.sessions.getSessionAverages(game, league),
          window.electron.sessions.getBiggestLetdown(game, league),
          window.electron.sessions.getLuckyBreak(game, league),
        ]);
        set(({ statistics }) => {
          statistics.sessionHighlights = {
            mostProfitable,
            longestSession,
            mostDecksOpened,
            biggestLetdown,
            luckyBreak,
            totalDecksOpened,
            averages,
          };
          statistics.stackedDeckCardCount =
            stackedDeckCardCount > 0 ? stackedDeckCardCount : null;
          statistics.isLoadingHighlights = false;
        });
      } catch (error) {
        console.error("Failed to fetch session highlights:", error);
        set(({ statistics }) => {
          statistics.sessionHighlights = null;
          statistics.stackedDeckCardCount = null;
          statistics.isLoadingHighlights = false;
        });
      }
    },

    fetchChartData: async (game, league) => {
      set(({ statistics }) => {
        statistics.isChartLoading = true;
      });
      try {
        const data = await window.electron.sessions.getChartData(game, league);
        set(({ statistics }) => {
          statistics.chartRawData = data;
          statistics.isChartLoading = false;
        });
      } catch (error) {
        console.error("Failed to load chart data:", error);
        set(({ statistics }) => {
          statistics.chartRawData = [];
          statistics.isChartLoading = false;
        });
      }
    },

    toggleChartMetric: (key) => {
      set(({ statistics }) => {
        const next = new Set(statistics.hiddenMetrics);
        if (next.has(key)) {
          next.delete(key);
        } else if (next.size < METRICS.length - 1) {
          next.add(key);
        }
        statistics.hiddenMetrics = next;
      });
    },

    setBrushRange: (range) =>
      set(({ statistics }) => {
        statistics.brushRange = range;
      }),
  },
});
