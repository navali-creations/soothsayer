import type { StateCreator } from "zustand";

import type { BoundStore } from "~/renderer/store/store.types";
import type { GameType } from "~/types/data-stores";
import type { PoeLeagueWithStatus } from "~/types/poe-league";

export interface LeaguesSlice {
  leagues: {
    poe1Leagues: PoeLeagueWithStatus[];
    poe2Leagues: PoeLeagueWithStatus[];
    isLoading: boolean;
    error: string | null;
    hydrate: () => Promise<void>;
    fetchLeagues: (game: "poe1" | "poe2") => Promise<void>;
    refreshLeagues: () => Promise<void>;
    getLeaguesForGame: (game: "poe1" | "poe2") => PoeLeagueWithStatus[];
    getActiveLeaguesForGame: (game: "poe1" | "poe2") => PoeLeagueWithStatus[];
  };
}

export const createLeaguesSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  LeaguesSlice
> = (set, get) => ({
  leagues: {
    poe1Leagues: [],
    poe2Leagues: [],
    isLoading: false,
    error: null,

    hydrate: async () => {
      const setupComplete = get().setup.isSetupComplete();
      if (!setupComplete) return;

      const installedGames = get().settings.installedGames;
      const fetches = installedGames.map((game: GameType) =>
        get().leagues.fetchLeagues(game),
      );
      Promise.all(fetches).catch((error) => {
        console.error(
          "[Leagues] Background historical league fetch failed:",
          error,
        );
      });
    },

    fetchLeagues: async (game) => {
      set(
        ({ leagues }) => {
          leagues.isLoading = true;
          leagues.error = null;
        },
        false,
        `leaguesSlice/fetchLeagues/${game}/start`,
      );

      try {
        const allLeagues = await window.electron.poeLeagues.getAllLeagues(game);

        set(
          ({ leagues }) => {
            if (game === "poe1") {
              leagues.poe1Leagues = allLeagues;
            } else {
              leagues.poe2Leagues = allLeagues;
            }
            leagues.isLoading = false;
          },
          false,
          `leaguesSlice/fetchLeagues/${game}/success`,
        );
      } catch (error) {
        console.error(`[Leagues] Failed to fetch leagues for ${game}:`, error);
        set(
          ({ leagues }) => {
            leagues.error =
              error instanceof Error
                ? error.message
                : "Failed to fetch historical leagues";
            leagues.isLoading = false;
          },
          false,
          `leaguesSlice/fetchLeagues/${game}/error`,
        );
      }
    },

    refreshLeagues: async () => {
      const { leagues } = get();
      await Promise.all([
        leagues.fetchLeagues("poe1"),
        leagues.fetchLeagues("poe2"),
      ]);
    },

    getLeaguesForGame: (game) => {
      const { leagues } = get();
      return game === "poe1" ? leagues.poe1Leagues : leagues.poe2Leagues;
    },

    getActiveLeaguesForGame: (game) => {
      return get()
        .leagues.getLeaguesForGame(game)
        .filter((league) => league.isActive);
    },
  },
});
