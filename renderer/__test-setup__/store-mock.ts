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
    useCardDetails: () => useBoundStore().cardDetails,
    useCards: () => useBoundStore().cards,
    useSessions: () => useBoundStore().sessions,
    useChangelog: () => useBoundStore().changelog,
    useStatistics: () => useBoundStore().statistics,
    useOnboarding: () => useBoundStore().onboarding,
    useUpdater: () => useBoundStore().updater,
    useProfitForecast: () => useBoundStore().profitForecast,
    useRarityInsights: () => useBoundStore().rarityInsights,
    useRarityInsightsComparison: () => useBoundStore().rarityInsightsComparison,
    useCommunityUpload: () => useBoundStore().communityUpload,
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
