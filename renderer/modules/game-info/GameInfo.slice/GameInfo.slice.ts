import type { StateCreator } from "zustand";

import type {
  PoeProcessSnapshot,
  PoeProcessWatcherStatus,
} from "~/main/modules/poe-process";
import type { BoundStore } from "~/renderer/store/store.types";

import type { PoeLeague } from "../../../../types/poe-league";

interface GameProcessState {
  isRunning: boolean;
}

export interface GameInfoSlice {
  gameInfo: {
    // State - Leagues
    poe1Leagues: PoeLeague[];
    poe2Leagues: PoeLeague[];
    isLoadingLeagues: boolean;
    leaguesError: string | null;

    // State - Process status
    poe1Process: GameProcessState;
    poe2Process: GameProcessState;
    processWatcherStatus: PoeProcessWatcherStatus;

    // Actions - Leagues
    hydrate: () => Promise<void>;
    fetchLeagues: (game: "poe1" | "poe2") => Promise<void>;
    refreshLeagues: () => Promise<void>;

    setProcessSnapshot: (snapshot: PoeProcessSnapshot) => void;

    // Getters
    getLeaguesForGame: (game: "poe1" | "poe2") => PoeLeague[];
    isGameOnline: (game: "poe1" | "poe2") => boolean;
    isProcessWatcherAvailable: () => boolean;
    getActiveGameStatus: () => {
      game: "poe1" | "poe2";
      isOnline: boolean;
      leagues: PoeLeague[];
    };
    startListening: () => () => void;
  };
}

export const createGameInfoSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  GameInfoSlice
> = (set, get) => ({
  gameInfo: {
    // Initial state - Leagues
    poe1Leagues: [],
    poe2Leagues: [],
    isLoadingLeagues: false,
    leaguesError: null,

    // Initial state - Process
    poe1Process: {
      isRunning: false,
    },
    poe2Process: {
      isRunning: false,
    },
    processWatcherStatus: "stopped",

    // Hydrate - fetch leagues on app start
    hydrate: async () => {
      const { gameInfo } = get();

      // Fetch initial process state
      try {
        const processSnapshot = await window.electron.poeProcess.getSnapshot();
        if (processSnapshot) {
          gameInfo.setProcessSnapshot(processSnapshot);
        }
      } catch (_error) {
        // Silently handle - IPC handlers may not be ready during initial load
      }

      // Only fetch leagues when setup is complete — during first-run setup
      // the user hasn't selected a game yet, and Supabase auth may not be
      // ready. The SetupLeagueStep component fetches leagues itself once
      // the user reaches that step.
      const setupComplete = get().setup.isSetupComplete();
      if (setupComplete) {
        const installedGames = get().settings.installedGames;
        const fetches = installedGames.map((g: "poe1" | "poe2") =>
          gameInfo.fetchLeagues(g),
        );
        Promise.all(fetches).catch((error) => {
          console.error("[GameInfo] Background league fetch failed:", error);
        });
      }
    },

    // Fetch leagues for a specific game
    fetchLeagues: async (game) => {
      set(
        ({ gameInfo }) => {
          gameInfo.isLoadingLeagues = true;
          gameInfo.leaguesError = null;
        },
        false,
        `gameInfoSlice/fetchLeagues/${game}/start`,
      );

      try {
        const leagues = await window.electron.poeLeagues.fetchLeagues(game);

        set(
          ({ gameInfo }) => {
            if (game === "poe1") {
              gameInfo.poe1Leagues = leagues;
            } else {
              gameInfo.poe2Leagues = leagues;
            }
            gameInfo.isLoadingLeagues = false;
          },
          false,
          `gameInfoSlice/fetchLeagues/${game}/success`,
        );
      } catch (error) {
        console.error(`Failed to fetch leagues for ${game}:`, error);
        set(
          ({ gameInfo }) => {
            gameInfo.leaguesError =
              error instanceof Error
                ? error.message
                : "Failed to fetch leagues";
            gameInfo.isLoadingLeagues = false;
          },
          false,
          `gameInfoSlice/fetchLeagues/${game}/error`,
        );
      }
    },

    // Refresh leagues for both games
    refreshLeagues: async () => {
      const { gameInfo } = get();
      await Promise.all([
        gameInfo.fetchLeagues("poe1"),
        gameInfo.fetchLeagues("poe2"),
      ]);
    },

    setProcessSnapshot: (snapshot) => {
      set(
        ({ gameInfo }) => {
          gameInfo.poe1Process = {
            isRunning: snapshot.states.poe1.isRunning,
          };
          gameInfo.poe2Process = {
            isRunning: snapshot.states.poe2.isRunning,
          };
          gameInfo.processWatcherStatus = snapshot.status;
        },
        false,
        "gameInfoSlice/setProcessSnapshot",
      );
    },

    // Get leagues for a specific game
    getLeaguesForGame: (game) => {
      const { gameInfo } = get();
      return game === "poe1" ? gameInfo.poe1Leagues : gameInfo.poe2Leagues;
    },

    // Check if game is online
    isGameOnline: (game) => {
      const { gameInfo } = get();
      return game === "poe1"
        ? gameInfo.poe1Process.isRunning
        : gameInfo.poe2Process.isRunning;
    },

    isProcessWatcherAvailable: () => {
      return get().gameInfo.processWatcherStatus !== "unavailable";
    },

    // Get active game status (combines settings + game info)
    getActiveGameStatus: () => {
      const state = get();
      const activeGame = state.settings.getSelectedGame();

      const { gameInfo } = state;
      const isOnline = gameInfo.isGameOnline(activeGame);
      const leagues = gameInfo.getLeaguesForGame(activeGame);

      return { game: activeGame, isOnline, leagues };
    },

    // Start listening to process events
    startListening: () => {
      const unsubscribePoeSnapshot = window.electron?.poeProcess?.onSnapshot?.(
        (snapshot) => {
          get().gameInfo.setProcessSnapshot(snapshot);
        },
      );

      return () => {
        unsubscribePoeSnapshot?.();
      };
    },
  },
});
