import { enableMapSet } from "immer";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  type AppMenuSlice,
  createAppMenuSlice,
} from "../modules/app-menu/AppMenu.slice/AppMenu.slice";
import {
  type CardDetailsSlice,
  createCardDetailsSlice,
} from "../modules/card-details/CardDetails.slice/CardDetails.slice";
import {
  type CardsSlice,
  createCardsSlice,
} from "../modules/cards/Cards.slice/Cards.slice";
import {
  type ChangelogSlice,
  createChangelogSlice,
} from "../modules/changelog/Changelog.slice/Changelog.slice";
import {
  createSessionSlice,
  type SessionSlice,
} from "../modules/current-session/CurrentSession.slice/CurrentSession.slice";
import {
  createGameInfoSlice,
  type GameInfoSlice,
} from "../modules/game-info/GameInfo.slice/GameInfo.slice";
import {
  createOnboardingSlice,
  type OnboardingSlice,
} from "../modules/onboarding/Onboarding.slice/Onboarding.slice";
import {
  createOverlaySlice,
  type OverlaySlice,
} from "../modules/overlay/Overlay.slice/Overlay.slice";
import {
  createPoeNinjaSlice,
  type PoeNinjaSlice,
} from "../modules/poe-ninja/PoeNinja.slice/PoeNinja.slice";
import {
  createProfitForecastSlice,
  type ProfitForecastSlice,
} from "../modules/profit-forecast/ProfitForecast.slice/ProfitForecast.slice";
import {
  createProhibitedLibrarySlice,
  type ProhibitedLibrarySlice,
} from "../modules/prohibited-library/ProhibitedLibrary.slice/ProhibitedLibrary.slice";
import {
  createRarityInsightsSlice,
  type RarityInsightsSlice,
} from "../modules/rarity-insights/RarityInsights.slice/RarityInsights.slice";
import {
  createRarityInsightsComparisonSlice,
  type RarityInsightsComparisonSlice,
} from "../modules/rarity-insights/RarityInsightsComparison.slice/RarityInsightsComparison.slice";
import {
  createSessionDetailsSlice,
  type SessionDetailsSlice,
} from "../modules/session-details";
import {
  createSessionsSlice,
  type SessionsSlice,
} from "../modules/sessions/Sessions.slice/Sessions.slice";
import {
  createSettingsSlice,
  type SettingsSlice,
} from "../modules/settings/Settings.slice/Settings.slice";
import {
  createStorageSlice,
  type StorageSlice,
} from "../modules/settings/Storage.slice/Storage.slice";
import {
  createSetupSlice,
  type SetupSlice,
} from "../modules/setup/Setup.slice/Setup.slice";
import {
  createStatisticsSlice,
  type StatisticsSlice,
} from "../modules/statistics/Statistics.slice/Statistics.slice";
import {
  createUpdaterSlice,
  type UpdaterSlice,
} from "../modules/updater/Updater.slice/Updater.slice";

enableMapSet();

interface RootActions {
  hydrate: () => Promise<void>;
  startListeners: () => () => void;
  reset: () => void;
}

type BoundStore = GameInfoSlice &
  SettingsSlice &
  StorageSlice &
  SetupSlice &
  SessionSlice &
  SessionsSlice &
  SessionDetailsSlice &
  CardDetailsSlice &
  CardsSlice &
  AppMenuSlice &
  ChangelogSlice &
  OverlaySlice &
  PoeNinjaSlice &
  ProhibitedLibrarySlice &
  StatisticsSlice &
  OnboardingSlice &
  UpdaterSlice &
  RarityInsightsSlice &
  ProfitForecastSlice &
  RarityInsightsComparisonSlice &
  RootActions;

export const useBoundStore = create<BoundStore>()(
  devtools(
    immer((...a) => {
      const settingsSlice = createSettingsSlice(...a);
      const storageSlice = createStorageSlice(...a);
      const setupSlice = createSetupSlice(...a);
      const sessionSlice = createSessionSlice(...a);
      const sessionsSlice = createSessionsSlice(...a);
      const sessionDetailsSlice = createSessionDetailsSlice(...a);
      const cardDetailsSlice = createCardDetailsSlice(...a);
      const appMenuSlice = createAppMenuSlice(...a);
      const gameInfoSlice = createGameInfoSlice(...a);
      const overlaySlice = createOverlaySlice(...a);
      const changelogSlice = createChangelogSlice(...a);
      const cardsSlice = createCardsSlice(...a);
      const poeNinjaSlice = createPoeNinjaSlice(...a);
      const statisticsSlice = createStatisticsSlice(...a);
      const onboardingSlice = createOnboardingSlice(...a);
      const updaterSlice = createUpdaterSlice(...a);
      const profitForecastSlice = createProfitForecastSlice(...a);
      const prohibitedLibrarySlice = createProhibitedLibrarySlice(...a);
      const rarityInsightsSlice = createRarityInsightsSlice(...a);
      const rarityInsightsComparisonSlice = createRarityInsightsComparisonSlice(
        ...a,
      );

      return {
        ...settingsSlice,
        ...storageSlice,
        ...setupSlice,
        ...sessionSlice,
        ...sessionsSlice,
        ...sessionDetailsSlice,
        ...cardDetailsSlice,
        ...appMenuSlice,
        ...changelogSlice,
        ...gameInfoSlice,
        ...overlaySlice,
        ...cardsSlice,
        ...poeNinjaSlice,
        ...profitForecastSlice,
        ...prohibitedLibrarySlice,
        ...statisticsSlice,
        ...onboardingSlice,
        ...updaterSlice,
        ...rarityInsightsSlice,
        ...rarityInsightsComparisonSlice,

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

          // Check disk space after hydration (non-blocking)
          storageSlice.storage.checkDiskSpace();

          // Scan for available loot filters once at startup (non-blocking).
          // Skipped in E2E mode — tests seed filter data directly into the DB
          // and store, bypassing the filesystem scanner entirely.
          if (!(window as any).electron?.__E2E_TESTING) {
            rarityInsightsSlice.rarityInsights.scanFilters();
          }
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
              rarityInsights,
              ...state
            }) => {
              // Reset settings
              settings.isLoading = false;
              settings.error = null;
              settings.overlayFontSize = 1.0;
              settings.overlayToolbarFontSize = 1.0;

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

              // Reset card details
              state.cardDetails.priceHistory = null;
              state.cardDetails.isLoadingPriceHistory = false;
              state.cardDetails.priceHistoryError = null;
              state.cardDetails.personalAnalytics = null;
              state.cardDetails.isLoadingPersonalAnalytics = false;
              state.cardDetails.personalAnalyticsError = null;
              state.cardDetails.sessions = null;
              state.cardDetails.isLoadingSessions = false;
              state.cardDetails.sessionsError = null;
              state.cardDetails.sessionsPage = 1;

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
              overlay.isLocked = true;
              overlay.isLeftHalf = false;

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
              statistics.snapshotMeta = null;
              statistics.isExporting = false;

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

              // Reset rarity insights
              rarityInsights.availableFilters = [];
              rarityInsights.selectedFilterId = null;
              rarityInsights.isScanning = false;
              rarityInsights.isParsing = false;
              rarityInsights.scanError = null;
              rarityInsights.parseError = null;
              rarityInsights.lastScannedAt = null;

              // Reset profit forecast
              state.profitForecast.rows = [];
              state.profitForecast.totalWeight = 0;
              state.profitForecast.evPerDeck = 0;
              state.profitForecast.snapshotFetchedAt = null;
              state.profitForecast.chaosToDivineRatio = 0;
              state.profitForecast.stackedDeckChaosCost = 0;
              state.profitForecast.baseRate = 0;
              state.profitForecast.isLoading = false;
              state.profitForecast.isComputing = false;
              state.profitForecast.error = null;
              state.profitForecast.selectedBatch = 10000;
              state.profitForecast.minPriceThreshold = 5;
              state.profitForecast.stepDrop = 2;
              state.profitForecast.subBatchSize = 5000;

              // Reset rarity insights comparison
              state.rarityInsightsComparison.selectedFilters = [];
              state.rarityInsightsComparison.parsedResults = new Map();
              state.rarityInsightsComparison.parsingFilterId = null;
              state.rarityInsightsComparison.parseErrors = new Map();
              state.rarityInsightsComparison.showDiffsOnly = false;
              state.rarityInsightsComparison.priorityPoeNinjaRarity = null;
              state.rarityInsightsComparison.priorityPlRarity = null;
              state.rarityInsightsComparison.tableSorting = [
                { id: "name", desc: false },
              ];

              // Reset storage
              state.storage.info = null;
              state.storage.leagueUsage = [];
              state.storage.isLoading = false;
              state.storage.error = null;
              state.storage.isDiskLow = false;
              state.storage.deletingLeagueId = null;
            },
          );
        },
      };
    }),
  ),
);

// ── E2E Test Bridge ──────────────────────────────────────────────────────────
// Expose the Zustand store on `window` so that Playwright E2E tests can
// read/mutate state directly (e.g. injecting seeded filter metadata into
// `rarityInsights.availableFilters` after DB seeding).
//
// Gated behind the explicit `__E2E_TESTING` flag set by the preload script,
// which is itself gated behind the `E2E_TESTING` env-var. This flag is NOT
// present in production builds (Vite dead-code-eliminates it).
if ((window as any).electron?.__E2E_TESTING === true) {
  (window as any).__zustandStore = useBoundStore;
}
