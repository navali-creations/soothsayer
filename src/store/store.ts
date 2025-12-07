import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  type AppMenuSlice,
  createAppMenuSlice,
} from "../modules/app-menu/AppMenu.slice";
import {
  createGameInfoSlice,
  type GameInfoSlice,
} from "../modules/game-info/GameInfo.slice";
import {
  createSettingsSlice,
  type SettingsSlice,
} from "../modules/settings/Settings.slice";
import { createSessionSlice, type SessionSlice } from "./sessionSlice";
import { createSetupSlice, type SetupSlice } from "./setupSlice";

interface RootActions {
  hydrate: () => Promise<void>;
  startListeners: () => () => void;
  reset: () => void;
}

type BoundStore = GameInfoSlice &
  SettingsSlice &
  SetupSlice &
  SessionSlice &
  AppMenuSlice &
  RootActions;

export const useBoundStore = create<BoundStore>()(
  devtools(
    immer((...a) => {
      const settingsSlice = createSettingsSlice(...a);
      const setupSlice = createSetupSlice(...a);
      const sessionSlice = createSessionSlice(...a);
      const appMenuSlice = createAppMenuSlice(...a);
      const gameInfoSlice = createGameInfoSlice(...a);

      return {
        ...settingsSlice,
        ...setupSlice,
        ...sessionSlice,
        ...appMenuSlice,
        ...gameInfoSlice,

        hydrate: async () => {
          await Promise.all([
            settingsSlice.settings.hydrate(),
            setupSlice.hydrate(),
            sessionSlice.hydrate(),
            appMenuSlice.appMenu.hydrate(),
            gameInfoSlice.gameInfo.hydrate(),
          ]);
        },

        // Start all listeners
        startListeners: () => {
          const unsubscribeSession = sessionSlice.startListening();
          const unsubscribeGameInfo = gameInfoSlice.gameInfo.startListening();

          return () => {
            unsubscribeSession();
            unsubscribeGameInfo();
          };
        },

        reset: () => {
          a[0](({ appMenu, settings, gameInfo, ...state }) => {
            // Reset settings
            settings.data = null;
            settings.isLoading = false;
            settings.error = null;

            // Reset setup
            state.setupState = null;

            // Reset session
            state.poe1Session = null;
            state.poe2Session = null;
            state.isLoading = false;
            state.error = null;

            // Reset app menu
            appMenu.isMaximized = false;

            // Reset game info
            gameInfo.poe1Leagues = [];
            gameInfo.poe2Leagues = [];
            gameInfo.isLoadingLeagues = false;
            gameInfo.leaguesError = null;
            gameInfo.poe1Process = { isRunning: false, processName: "" };
            gameInfo.poe2Process = { isRunning: false, processName: "" };
          });
        },
      };
    }),
  ),
);
