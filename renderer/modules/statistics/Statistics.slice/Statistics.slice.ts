import type { StateCreator } from "zustand";

import type { SnapshotMetaResult } from "~/main/modules/csv/Csv.api";
import type {
  BrushRange,
  MetricKey,
  RawDataPoint,
} from "~/renderer/components/CombinedChartCanvas/chart-types";
import { METRICS } from "~/renderer/components/CombinedChartCanvas/chart-types";
import type { BoundStore } from "~/renderer/store/store.types";
import type {
  DivinationCardMetadata,
  SimpleDivinationCardStats,
} from "~/types/data-stores";

import type { SessionHighlights } from "../Statistics.types";

export type StatScope = "all-time" | "league";

// ── Fetch-key helpers ────────────────────────────────────────────────────────
// Each data-fetching action builds a short string key from its parameters.
// Before starting an IPC round-trip the action checks whether the key matches
// the last *successful* fetch OR the currently *in-flight* fetch for that data
// domain.  If it does, the action returns immediately – this is what allows
// the route-loader prefetch (on hover) to satisfy the subsequent useEffect
// fetch (on mount) without a redundant round-trip.
//
// The key is cleared when the store is reset (app refresh) so data is always
// re-fetched after a full reload.

function highlightsKey(game: string, league?: string): string {
  return `highlights:${game}:${league ?? ""}`;
}

function chartKey(game: string, league?: string): string {
  return `chart:${game}:${league ?? ""}`;
}

function cardsKey(game: string, scope: string, league?: string): string {
  return `cards:${game}:${scope}:${league ?? ""}`;
}

function leaguesKey(game: string): string {
  return `leagues:${game}`;
}

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
    uncollectedCardMetadata: Record<string, DivinationCardMetadata>;
    isLoadingHighlights: boolean;

    divinationCardStats: SimpleDivinationCardStats | null;
    isDivinationCardsLoading: boolean;
    availableLeagues: string[];

    chartRawData: RawDataPoint[];
    isChartLoading: boolean;
    hiddenMetrics: Set<MetricKey>;
    brushRange: BrushRange;

    // Internal dedup keys – not part of the public API surface but exposed on
    // the slice so tests can assert against them when needed.
    // "last" = last *completed* fetch key; "pending" = currently in-flight key.
    _lastHighlightsKey: string;
    _lastChartKey: string;
    _lastCardsKey: string;
    _lastLeaguesKey: string;
    _pendingHighlightsKey: string;
    _pendingChartKey: string;
    _pendingCardsKey: string;
    _pendingLeaguesKey: string;

    fetchDivinationCards: (
      game: "poe1" | "poe2",
      scope: StatScope,
      league?: string,
    ) => Promise<void>;
    fetchAvailableLeagues: (game: "poe1" | "poe2") => Promise<void>;
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
    uncollectedCardMetadata: {},
    isLoadingHighlights: false,

    divinationCardStats: null,
    isDivinationCardsLoading: true,
    availableLeagues: [],

    chartRawData: [],
    isChartLoading: true,
    hiddenMetrics: new Set<MetricKey>(),
    brushRange: { startIndex: 0, endIndex: 0 },

    _lastHighlightsKey: "",
    _lastChartKey: "",
    _lastCardsKey: "",
    _lastLeaguesKey: "",
    _pendingHighlightsKey: "",
    _pendingChartKey: "",
    _pendingCardsKey: "",
    _pendingLeaguesKey: "",

    fetchDivinationCards: async (game, scope, league) => {
      const key = cardsKey(game, scope, league);
      const { _lastCardsKey, _pendingCardsKey, divinationCardStats } =
        get().statistics;

      // Skip if this exact fetch already completed with data present,
      // or if the same fetch is already in-flight.
      if (
        (key === _lastCardsKey && divinationCardStats) ||
        key === _pendingCardsKey
      ) {
        return;
      }

      set(({ statistics }) => {
        statistics.isDivinationCardsLoading = true;
        statistics._pendingCardsKey = key;
      });
      try {
        let data: SimpleDivinationCardStats | null = null;
        if (scope === "all-time") {
          data = await window.electron.dataStore.getAllTime(game);
        } else if (scope === "league" && league) {
          data = await window.electron.dataStore.getLeague(game, league);
        }
        set(({ statistics }) => {
          statistics.divinationCardStats = data;
          statistics.isDivinationCardsLoading = false;
          statistics._lastCardsKey = key;
          statistics._pendingCardsKey = "";
        });
      } catch (error) {
        console.error("Failed to fetch divination cards:", error);
        set(({ statistics }) => {
          statistics.divinationCardStats = null;
          statistics.isDivinationCardsLoading = false;
          statistics._lastCardsKey = "";
          statistics._pendingCardsKey = "";
        });
      }
    },
    fetchAvailableLeagues: async (game) => {
      const key = leaguesKey(game);
      const { _lastLeaguesKey, _pendingLeaguesKey, availableLeagues } =
        get().statistics;

      if (
        (key === _lastLeaguesKey && availableLeagues.length > 0) ||
        key === _pendingLeaguesKey
      ) {
        return;
      }

      set(({ statistics }) => {
        statistics._pendingLeaguesKey = key;
      });
      try {
        const leagues = await window.electron.dataStore.getLeagues(game);
        set(({ statistics }) => {
          statistics.availableLeagues = leagues || [];
          statistics._lastLeaguesKey = key;
          statistics._pendingLeaguesKey = "";
        });
      } catch (error) {
        console.error("Failed to fetch available leagues:", error);
        set(({ statistics }) => {
          statistics.availableLeagues = [];
          statistics._lastLeaguesKey = "";
          statistics._pendingLeaguesKey = "";
        });
      }
    },
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
        const [names, allCards] = await Promise.all([
          window.electron.sessions.getUncollectedCardNames(game, league),
          window.electron.divinationCards.getAll(game),
        ]);

        const metadataMap: Record<string, DivinationCardMetadata> = {};
        if (Array.isArray(allCards)) {
          const uncollectedSet = new Set(names);
          for (const card of allCards) {
            if (uncollectedSet.has(card.name)) {
              metadataMap[card.name] = {
                id: card.id,
                stackSize: card.stackSize,
                description: card.description,
                rewardHtml: card.rewardHtml,
                artSrc: card.artSrc,
                flavourHtml: card.flavourHtml,
                rarity: card.rarity,
                fromBoss: card.fromBoss,
              };
            }
          }
        }

        set(({ statistics }) => {
          statistics.uncollectedCardNames = names;
          statistics.uncollectedCardMetadata = metadataMap;
        });
      } catch (error) {
        console.error("Failed to fetch uncollected card names:", error);
      }
    },
    fetchSessionHighlights: async (game, league) => {
      const key = highlightsKey(game, league);
      const { _lastHighlightsKey, _pendingHighlightsKey, sessionHighlights } =
        get().statistics;

      if (
        (key === _lastHighlightsKey && sessionHighlights) ||
        key === _pendingHighlightsKey
      ) {
        return;
      }

      set(({ statistics }) => {
        statistics.isLoadingHighlights = true;
        statistics._pendingHighlightsKey = key;
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
          totalNetProfit,
          totalTimeSpent,
          winRate,
        ] = await Promise.all([
          window.electron.sessions.getMostProfitable(game, league),
          window.electron.sessions.getLongestSession(game, league),
          window.electron.sessions.getMostDecksOpened(game, league),
          window.electron.sessions.getTotalDecksOpened(game, league),
          window.electron.sessions.getStackedDeckCardCount(game),
          window.electron.sessions.getSessionAverages(game, league),
          window.electron.sessions.getBiggestLetdown(game, league),
          window.electron.sessions.getLuckyBreak(game, league),
          window.electron.sessions.getTotalNetProfit(game, league),
          window.electron.sessions.getTotalTimeSpent(game, league),
          window.electron.sessions.getWinRate(game, league),
        ]);

        // Derive avg profit per deck from total profit and total decks
        const avgProfitPerDeck =
          totalNetProfit && totalDecksOpened > 0
            ? {
                avgProfitPerDeck: totalNetProfit.totalProfit / totalDecksOpened,
                avgChaosPerDivine: totalNetProfit.avgChaosPerDivine,
                avgDeckCost: totalNetProfit.avgDeckCost,
              }
            : null;

        // Derive profit per hour from total profit and total time
        const profitPerHour =
          totalNetProfit && totalTimeSpent && totalTimeSpent.totalMinutes > 0
            ? {
                profitPerHour:
                  totalNetProfit.totalProfit /
                  (totalTimeSpent.totalMinutes / 60),
                avgChaosPerDivine: totalNetProfit.avgChaosPerDivine,
              }
            : null;

        set(({ statistics }) => {
          statistics.sessionHighlights = {
            mostProfitable,
            longestSession,
            mostDecksOpened,
            biggestLetdown,
            luckyBreak,
            totalDecksOpened,
            averages,
            totalNetProfit,
            totalTimeSpent,
            winRate,
            avgProfitPerDeck,
            profitPerHour,
          };
          statistics.stackedDeckCardCount =
            stackedDeckCardCount > 0 ? stackedDeckCardCount : null;
          statistics.isLoadingHighlights = false;
          statistics._lastHighlightsKey = key;
          statistics._pendingHighlightsKey = "";
        });
      } catch (error) {
        console.error("Failed to fetch session highlights:", error);
        set(({ statistics }) => {
          statistics.sessionHighlights = null;
          statistics.stackedDeckCardCount = null;
          statistics.isLoadingHighlights = false;
          statistics._lastHighlightsKey = "";
          statistics._pendingHighlightsKey = "";
        });
      }
    },

    fetchChartData: async (game, league) => {
      const key = chartKey(game, league);
      const { _lastChartKey, _pendingChartKey, chartRawData } =
        get().statistics;

      if (
        (key === _lastChartKey && chartRawData.length > 0) ||
        key === _pendingChartKey
      ) {
        return;
      }

      set(({ statistics }) => {
        statistics.isChartLoading = true;
        statistics._pendingChartKey = key;
      });
      try {
        const data = await window.electron.sessions.getChartData(game, league);
        set(({ statistics }) => {
          statistics.chartRawData = data;
          statistics.isChartLoading = false;
          statistics._lastChartKey = key;
          statistics._pendingChartKey = "";
        });
      } catch (error) {
        console.error("Failed to load chart data:", error);
        set(({ statistics }) => {
          statistics.chartRawData = [];
          statistics.isChartLoading = false;
          statistics._lastChartKey = "";
          statistics._pendingChartKey = "";
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
