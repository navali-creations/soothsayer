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
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  StatisticsSlice
> = (set) => ({
  statistics: {
    priceSource: "exchange",
    statScope: "all-time",
    selectedLeague: "Keepers",
    setStatScope: (scope) =>
      set(({ statistics }) => {
        statistics.statScope = scope;
      }),
    setSelectedLeague: (league) =>
      set(({ statistics }) => {
        statistics.selectedLeague = league;
      }),
  },
});
