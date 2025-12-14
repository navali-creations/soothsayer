import type { StateCreator } from "zustand";
import type { GameVersion } from "../../../electron/modules/settings-store/SettingsStore.schemas";
import type { PoeLeague } from "../../../types/poe-league";
import type { SettingsSlice } from "../settings/Settings.slice";

interface GameProcessState {
  isRunning: boolean;
  processName: string;
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

    // Actions - Leagues
    hydrate: () => Promise<void>;
    fetchLeagues: (
      game: Extract<GameVersion, "poe1" | "poe2">,
    ) => Promise<void>;
    refreshLeagues: () => Promise<void>;

    // Actions - Process updates (called by IPC listeners)
    setPoe1ProcessState: (state: GameProcessState) => void;
    setPoe2ProcessState: (state: GameProcessState) => void;

    // Getters
    getLeaguesForGame: (
      game: Extract<GameVersion, "poe1" | "poe2">,
    ) => PoeLeague[];
    isGameOnline: (game: Extract<GameVersion, "poe1" | "poe2">) => boolean;
    getActiveGameStatus: () => {
      game: Extract<GameVersion, "poe1" | "poe2"> | undefined;
      isOnline: boolean;
      leagues: PoeLeague[];
    };
    startListening: () => () => void;
  };
}

export const createGameInfoSlice: StateCreator<
  GameInfoSlice & SettingsSlice,
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
      processName: "",
    },
    poe2Process: {
      isRunning: false,
      processName: "",
    },

    // Hydrate - fetch leagues on app start
    hydrate: async () => {
      const { gameInfo } = get();

      // Fetch initial process state
      try {
        const processState = await window.electron.poeProcess.getState();

        // Set initial state if a process is running
        if (processState?.isRunning && processState?.processName) {
          if (processState.processName.includes("PathOfExile2")) {
            gameInfo.setPoe2ProcessState(processState);
          } else {
            gameInfo.setPoe1ProcessState(processState);
          }
        }
      } catch (error) {
        console.error("[GameInfo] Failed to get initial process state:", error);
      }

      // Fetch leagues
      await Promise.all([
        gameInfo.fetchLeagues("poe1"),
        gameInfo.fetchLeagues("poe2"),
      ]);
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

    // Update PoE 1 process state (called by IPC listener)
    setPoe1ProcessState: (state) => {
      set(
        ({ gameInfo }) => {
          gameInfo.poe1Process = state;
        },
        false,
        "gameInfoSlice/setPoe1ProcessState",
      );
    },

    // Update PoE 2 process state (called by IPC listener)
    setPoe2ProcessState: (state) => {
      set(
        ({ gameInfo }) => {
          gameInfo.poe2Process = state;
        },
        false,
        "gameInfoSlice/setPoe2ProcessState",
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

    // Get active game status (combines settings + game info)
    getActiveGameStatus: () => {
      const state = get();
      const activeGame = state.settings?.data?.["active-game"];

      if (!activeGame) {
        return { game: undefined, isOnline: false, leagues: [] };
      }

      const { gameInfo } = state;
      const isOnline = gameInfo.isGameOnline(activeGame);
      const leagues = gameInfo.getLeaguesForGame(activeGame);

      return { game: activeGame, isOnline, leagues };
    },

    // Start listening to process events
    startListening: () => {
      const unsubscribePoeStart = window.electron?.poeProcess?.onStart?.(
        (state) => {
          const { gameInfo } = get();

          // Determine which game (you might need better logic here)
          if (state.processName.includes("PathOfExile2")) {
            gameInfo.setPoe2ProcessState(state);
          } else {
            gameInfo.setPoe1ProcessState(state);
          }
        },
      );

      const unsubscribePoeStop = window.electron?.poeProcess?.onStop?.(
        (state) => {
          const { gameInfo } = get();

          if (state.processName.includes("PathOfExile2")) {
            gameInfo.setPoe2ProcessState({ isRunning: false, processName: "" });
          } else {
            gameInfo.setPoe1ProcessState({ isRunning: false, processName: "" });
          }
        },
      );

      // Return cleanup function
      return () => {
        unsubscribePoeStart?.();
        unsubscribePoeStop?.();
      };
    },
  },
});
