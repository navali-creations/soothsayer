import { enableMapSet } from "immer";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  type AppMenuSlice,
  createAppMenuSlice,
} from "../modules/app-menu/AppMenu.slice";
import {
  type CardsSlice,
  createCardsSlice,
} from "../modules/cards/Cards.slice";
import {
  type ChangelogSlice,
  createChangelogSlice,
} from "../modules/changelog/Changelog.slice";
import {
  createSessionSlice,
  type SessionSlice,
} from "../modules/current-session/CurrentSession.slice";
import {
  createGameInfoSlice,
  type GameInfoSlice,
} from "../modules/game-info/GameInfo.slice";
import {
  createOnboardingSlice,
  type OnboardingSlice,
} from "../modules/onboarding/Onboarding.slice";
import {
  createOverlaySlice,
  type OverlaySlice,
} from "../modules/overlay/Overlay.slice";
import {
  createPoeNinjaSlice,
  type PoeNinjaSlice,
} from "../modules/poe-ninja/PoeNinja.slice";
import {
  createProhibitedLibrarySlice,
  type ProhibitedLibrarySlice,
} from "../modules/prohibited-library/ProhibitedLibrary.slice";
import {
  createRarityModelSlice,
  type RarityModelSlice,
} from "../modules/rarity-model/RarityModel.slice";
import {
  createRarityModelComparisonSlice,
  type RarityModelComparisonSlice,
} from "../modules/rarity-model/RarityModelComparison.slice";
import {
  createSessionDetailsSlice,
  type SessionDetailsSlice,
} from "../modules/session-details";
import {
  createSessionsSlice,
  type SessionsSlice,
} from "../modules/sessions/Sessions.slice";
import {
  createSettingsSlice,
  type SettingsSlice,
} from "../modules/settings/Settings.slice";
import {
  createSetupSlice,
  type SetupSlice,
} from "../modules/setup/Setup.slice";
import {
  createStatisticsSlice,
  type StatisticsSlice,
} from "../modules/statistics/Statistics.slice";
import {
  createUpdaterSlice,
  type UpdaterSlice,
} from "../modules/updater/Updater.slice";

enableMapSet();

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
  ChangelogSlice &
  OverlaySlice &
  PoeNinjaSlice &
  ProhibitedLibrarySlice &
  StatisticsSlice &
  OnboardingSlice &
  UpdaterSlice &
  RarityModelSlice &
  RarityModelComparisonSlice &
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
      const changelogSlice = createChangelogSlice(...a);
      const cardsSlice = createCardsSlice(...a);
      const poeNinjaSlice = createPoeNinjaSlice(...a);
      const statisticsSlice = createStatisticsSlice(...a);
      const onboardingSlice = createOnboardingSlice(...a);
      const updaterSlice = createUpdaterSlice(...a);
      const prohibitedLibrarySlice = createProhibitedLibrarySlice(...a);
      const rarityModelSlice = createRarityModelSlice(...a);
      const rarityModelComparisonSlice = createRarityModelComparisonSlice(...a);

      return {
        ...settingsSlice,
        ...setupSlice,
        ...sessionSlice,
        ...sessionsSlice,
        ...sessionDetailsSlice,
        ...appMenuSlice,
        ...changelogSlice,
        ...gameInfoSlice,
        ...overlaySlice,
        ...cardsSlice,
        ...poeNinjaSlice,
        ...prohibitedLibrarySlice,
        ...statisticsSlice,
        ...onboardingSlice,
        ...updaterSlice,
        ...rarityModelSlice,
        ...rarityModelComparisonSlice,

        hydrate: async () => {
          await Promise.all([
            settingsSlice.settings.hydrate(),
            setupSlice.setup.hydrate(),
            sessionSlice.currentSession.hydrate(),
            appMenuSlice.appMenu.hydrate(),
            gameInfoSlice.gameInfo.hydrate(),
            overlaySlice.overlay.hydrate(),
            onboardingSlice.onboarding.hydrate(),
          ]);
        },

        // Start all listeners
        startListeners: () => {
          const unsubscribeSession =
            sessionSlice.currentSession.startListening();
          const unsubscribeGameInfo = gameInfoSlice.gameInfo.startListening();
          const unsubscribePoeNinja = poeNinjaSlice.poeNinja.startListening();
          const unsubscribeOverlay = overlaySlice.overlay.startListening();
          const unsubscribeUpdater = updaterSlice.updater.startListening();
          const unsubscribeProhibitedLibrary =
            prohibitedLibrarySlice.prohibitedLibrary.startListening();

          return () => {
            unsubscribeSession();
            unsubscribeGameInfo();
            unsubscribePoeNinja();
            unsubscribeOverlay();
            unsubscribeUpdater();
            unsubscribeProhibitedLibrary();
          };
        },

        reset: () => {
          a[0](
            ({
              appMenu,
              settings,
              setup,
              gameInfo,
              sessions,
              sessionDetails,
              overlay,
              cards,
              changelog,
              poeNinja,
              prohibitedLibrary,
              statistics,
              onboarding,
              updater,
              rarityModel,
              ...state
            }) => {
              // Reset settings
              settings.isLoading = false;
              settings.error = null;

              // Reset setup
              setup.setupState = null;
              setup.validation = null;
              setup.isLoading = false;
              setup.error = null;

              // Reset session
              state.currentSession.poe1Session = null;
              state.currentSession.poe2Session = null;
              state.currentSession.isLoading = false;

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
              appMenu.isWhatsNewOpen = false;
              appMenu.whatsNewRelease = null;
              appMenu.whatsNewIsLoading = false;
              appMenu.whatsNewError = null;
              appMenu.whatsNewHasFetched = false;

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

              // Reset changelog
              changelog.releases = [];
              changelog.isLoading = false;
              changelog.error = null;
              changelog.hasFetched = false;

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
              poeNinja.refreshableAt = new Map();
              poeNinja.isRefreshing = false;
              poeNinja.refreshError = null;

              // Reset statistics
              statistics.statScope = "all-time";
              statistics.selectedLeague = "Keepers";

              // Reset onboarding
              onboarding.dismissedBeacons = [];
              onboarding.isLoading = false;
              onboarding.error = null;

              // Reset updater
              updater.updateInfo = null;
              updater.updateAvailable = false;
              updater.isDismissed = false;
              updater.status = "idle";
              updater.downloadProgress = {
                percent: 0,
                transferredBytes: 0,
                totalBytes: 0,
              };
              updater.error = null;

              // Reset prohibited library
              prohibitedLibrary.poe1Status = null;
              prohibitedLibrary.poe2Status = null;
              prohibitedLibrary.isLoading = false;
              prohibitedLibrary.loadError = null;

              // Reset rarity model
              rarityModel.availableFilters = [];
              rarityModel.selectedFilterId = null;
              rarityModel.isScanning = false;
              rarityModel.isParsing = false;
              rarityModel.scanError = null;
              rarityModel.parseError = null;
              rarityModel.lastScannedAt = null;

              // Reset rarity model comparison
              state.rarityModelComparison.selectedFilters = [];
              state.rarityModelComparison.parsedResults = new Map();
              state.rarityModelComparison.parsingFilterId = null;
              state.rarityModelComparison.parseErrors = new Map();
              state.rarityModelComparison.showDiffsOnly = false;
              state.rarityModelComparison.priorityPoeNinjaRarity = null;
              state.rarityModelComparison.priorityPlRarity = null;
              state.rarityModelComparison.tableSorting = [
                { id: "name", desc: false },
              ];
            },
          );
        },
      };
    }),
  ),
);
