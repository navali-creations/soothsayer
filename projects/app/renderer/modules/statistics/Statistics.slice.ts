import type { StateCreator } from "zustand";

export type StatScope = "all-time" | "league";

export interface StatisticsSlice {
  statistics: {
    statScope: StatScope;
    selectedLeague: string;
    setStatScope: (scope: StatScope) => void;
    setSelectedLeague: (league: string) => void;
  };
}

export const createStatisticsSlice: StateCreator<
  StatisticsSlice,
  [],
  [],
  StatisticsSlice
> = (set) => ({
  statistics: {
    priceSource: "exchange",
    statScope: "all-time",
    selectedLeague: "Keepers",
    setStatScope: (scope) =>
      set((state) => ({
        statistics: { ...state.statistics, statScope: scope },
      })),
    setSelectedLeague: (league) =>
      set((state) => ({
        statistics: { ...state.statistics, selectedLeague: league },
      })),
  },
});
