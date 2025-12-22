import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  createCardsSlice,
  type CardsSlice,
} from "../modules/cards/Cards.slice";
import {
  type AppMenuSlice,
  createAppMenuSlice,
} from "../modules/app-menu/AppMenu.slice";
import {
  createGameInfoSlice,
  type GameInfoSlice,
} from "../modules/game-info/GameInfo.slice";
import {
  createOverlaySlice,
  type OverlaySlice,
} from "../modules/overlay/Overlay.slice";
import {
  createSettingsSlice,
  type SettingsSlice,
} from "../modules/settings/Settings.slice";
import {
  createSessionsSlice,
  type SessionsSlice,
} from "../modules/sessions/Sessions.slice";
import {
  createSessionDetailsSlice,
  type SessionDetailsSlice,
} from "../modules/session-details";
import {
  createSessionSlice,
  type SessionSlice,
} from "../modules/current-session/CurrentSession.slice";
import { createSetupSlice, type SetupSlice } from "./setupSlice";
import {
  createPoeNinjaSlice,
  type PoeNinjaSlice,
} from "../modules/poe-ninja/PoeNinja.slice";
import {
  createStatisticsSlice,
  type StatisticsSlice,
} from "../modules/statistics/Statistics.slice";

interface RootActions {
  hydrate: () => Promise<void>;
  startListeners: () => () => void;
  reset: () => void;
}

type BoundStore = GameInfoSlice &
  SettingsSlice &
  SetupSlice &
  SessionSlice &
  SessionsSlice &
  SessionDetailsSlice &
  CardsSlice &
  AppMenuSlice &
  OverlaySlice &
  PoeNinjaSlice &
  StatisticsSlice &
  RootActions;

export const useBoundStore = create<BoundStore>()(
  devtools(
    immer((...a) => {
      const settingsSlice = createSettingsSlice(...a);
      const setupSlice = createSetupSlice(...a);
      const sessionSlice = createSessionSlice(...a);
      const sessionsSlice = createSessionsSlice(...a);
      const sessionDetailsSlice = createSessionDetailsSlice(...a);
      const appMenuSlice = createAppMenuSlice(...a);
      const gameInfoSlice = createGameInfoSlice(...a);
      const overlaySlice = createOverlaySlice(...a);
      const cardsSlice = createCardsSlice(...a);
      const poeNinjaSlice = createPoeNinjaSlice(...a);
      const statisticsSlice = createStatisticsSlice(...a);

      return {
        ...settingsSlice,
        ...setupSlice,
        ...sessionSlice,
        ...sessionsSlice,
        ...sessionDetailsSlice,
        ...appMenuSlice,
        ...gameInfoSlice,
        ...overlaySlice,
        ...cardsSlice,
        ...poeNinjaSlice,
        ...statisticsSlice,

        hydrate: async () => {
          await Promise.all([
            settingsSlice.settings.hydrate(),
            setupSlice.hydrate(),
            sessionSlice.currentSession.hydrate(),
            appMenuSlice.appMenu.hydrate(),
            gameInfoSlice.gameInfo.hydrate(),
            overlaySlice.overlay.hydrate(),
          ]);
        },

        // Start all listeners
        startListeners: () => {
          const unsubscribeSession =
            sessionSlice.currentSession.startListening();
          const unsubscribeGameInfo = gameInfoSlice.gameInfo.startListening();
          const unsubscribePoeNinja = poeNinjaSlice.poeNinja.startListening();

          return () => {
            unsubscribeSession();
            unsubscribeGameInfo();
            unsubscribePoeNinja();
          };
        },

        reset: () => {
          a[0](
            ({
              appMenu,
              settings,
              gameInfo,
              sessions,
              sessionDetails,
              overlay,
              cards,
              poeNinja,
              statistics,
              ...state
            }) => {
              // Reset settings
              settings.data = null;
              settings.isLoading = false;
              settings.error = null;

              // Reset setup
              state.setupState = null;

              // Reset session
              state.currentSession.poe1Session = null;
              state.currentSession.poe2Session = null;
              state.isLoading = false;
              state.error = null;

              // Reset sessions history
              sessions.allSessions = [];
              sessions.currentSessionDetail = null;
              sessions.searchQuery = "";
              sessions.isLoading = false;
              sessions.error = null;

              // Reset session detail
              sessionDetails.session = null;
              sessionDetails.isLoading = false;
              sessionDetails.error = null;
              sessionDetails.priceSource = "exchange";

              // Reset app menu
              appMenu.isMaximized = false;

              // Reset game info
              gameInfo.poe1Leagues = [];
              gameInfo.poe2Leagues = [];
              gameInfo.isLoadingLeagues = false;
              gameInfo.leaguesError = null;
              gameInfo.poe1Process = { isRunning: false, processName: "" };
              gameInfo.poe2Process = { isRunning: false, processName: "" };

              // Reset overlay
              overlay.isVisible = false;
              overlay.isLoading = false;
              overlay.error = null;

              // Reset cards
              cards.allCards = [];
              cards.isLoading = false;
              cards.error = null;

              // Reset poeNinja
              poeNinja.currentSnapshot = null;
              poeNinja.autoRefreshes = new Map();
              poeNinja.exchangeCacheStatus = {
                isCached: false,
                lastFetchTime: null,
              };
              poeNinja.stashCacheStatus = {
                isCached: false,
                lastFetchTime: null,
              };
              poeNinja.isLoading = false;
              poeNinja.error = null;

              // Reset statistics
              statistics.statScope = "all-time";
              statistics.selectedLeague = "Keepers";
            },
          );
        },
      };
    }),
  ),
);
