import { vi } from "vitest";

/**
 * Creates the mock factory object for `vi.mock("~/renderer/store", ...)`.
 *
 * Because `vi.mock()` is hoisted above imports by Vitest, each test file must
 * still call `vi.mock()` itself. However, instead of duplicating the ~30-line
 * factory inline, tests can delegate to this function:
 *
 * ```ts
 * import { createStoreMock } from "~/renderer/__test-setup__/store-mock";
 *
 * const { useBoundStore, ...storeMock } = vi.hoisted(() => createStoreMock());
 *
 * vi.mock("~/renderer/store", () => storeMock);
 * ```
 *
 * `useBoundStore` is a `vi.fn()` that tests can configure per-test via
 * `vi.mocked(useBoundStore).mockReturnValue({ ... })`.
 */
export function createStoreMock() {
  const useBoundStore = vi.fn();

  const storeMock = {
    useBoundStore,
    useCurrentSession: () => useBoundStore().currentSession,
    useSettings: () => useBoundStore().settings,
    usePoeNinja: () => useBoundStore().poeNinja,
    useSessionDetails: () => useBoundStore().sessionDetails,
    useOverlay: () => useBoundStore().overlay,
    useAppMenu: () => useBoundStore().appMenu,
    useSetup: () => useBoundStore().setup,
    useStorage: () => useBoundStore().storage,
    useGameInfo: () => useBoundStore().gameInfo,
    useLeagues: () => useBoundStore().leagues,
    useCardDetails: () => useBoundStore().cardDetails,
    useCards: () => useBoundStore().cards,
    useSessions: () => useBoundStore().sessions,
    useChangelog: () => useBoundStore().changelog,
    useStatistics: () => useBoundStore().statistics,
    useOnboarding: () => useBoundStore().onboarding,
    useOnboardingState: () => {
      const onboarding = useBoundStore().onboarding;
      return {
        dismissedBeacons: onboarding.dismissedBeacons,
        isLoading: onboarding.isLoading,
        error: onboarding.error,
        beaconHostRefreshKey: onboarding.beaconHostRefreshKey,
      };
    },
    useOnboardingActions: () => {
      const onboarding = useBoundStore().onboarding;
      return {
        hydrate: onboarding.hydrate,
        isDismissed: onboarding.isDismissed,
        dismiss: onboarding.dismiss,
        dismissAll: onboarding.dismissAll,
        reset: onboarding.reset,
        resetOne: onboarding.resetOne,
        resetAll: onboarding.resetAll,
        refreshBeaconHost: onboarding.refreshBeaconHost,
        getAllBeaconStates: onboarding.getAllBeaconStates,
      };
    },
    useUpdater: () => useBoundStore().updater,
    useProfitForecast: () => useBoundStore().profitForecast,
    useRarityInsights: () => useBoundStore().rarityInsights,
    useRarityInsightsComparison: () => useBoundStore().rarityInsightsComparison,
    useBanners: () => ({
      dismissedIds: new Set<string>(),
      isLoaded: true,
      loadDismissed: vi.fn(),
      dismiss: vi.fn(),
      isDismissed: vi.fn().mockReturnValue(false),
      ...useBoundStore().banners,
    }),
    useCommunityUpload: () => ({
      backfillLeagues: [],
      isBackfilling: false,
      backfillDismissed: false,
      checkBackfill: vi.fn(),
      triggerBackfill: vi.fn(),
      dismissBackfill: vi.fn(),
      ...useBoundStore().communityUpload,
    }),
    useRootActions: () => {
      const s = useBoundStore();
      return {
        hydrate: s.hydrate,
        startListeners: s.startListeners,
        reset: s.reset,
      };
    },
    useSlice: (key: string) => useBoundStore()?.[key],
  };

  return storeMock;
}
