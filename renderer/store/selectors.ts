import { useShallow } from "zustand/react/shallow";

import { useBoundStore } from "./store";
import type { BoundStore } from "./store.types";

// ── Generic slice selector ───────────────────────────────────────────────────

/**
 * Select a single top-level slice from the store with shallow equality.
 * Components using this will only re-render when the selected slice actually
 * changes, instead of on every store mutation.
 *
 * @example
 * ```ts
 * const { overlay } = useBoundStore(); // ❌ subscribes to EVERYTHING
 * const overlay = useSlice("overlay"); // ✅ re-renders only when `overlay` changes
 * ```
 */
export function useSlice<K extends keyof BoundStore>(key: K): BoundStore[K] {
  return useBoundStore(useShallow((state) => state[key]));
}

// ── Per-slice convenience hooks ──────────────────────────────────────────────

/** Select the `settings` slice. */
export const useSettings = () => useSlice("settings");

/** Select the `storage` slice. */
export const useStorage = () => useSlice("storage");

/** Select the `setup` slice. */
export const useSetup = () => useSlice("setup");

/** Select the `currentSession` slice. */
export const useCurrentSession = () => useSlice("currentSession");

/** Select the `sessions` slice. */
export const useSessions = () => useSlice("sessions");

/** Select the `sessionDetails` slice. */
export const useSessionDetails = () => useSlice("sessionDetails");

/** Select the `cardDetails` slice. */
export const useCardDetails = () => useSlice("cardDetails");

/** Select the `appMenu` slice. */
export const useAppMenu = () => useSlice("appMenu");

/** Select the `gameInfo` slice. */
export const useGameInfo = () => useSlice("gameInfo");

/** Select the `overlay` slice. */
export const useOverlay = () => useSlice("overlay");

/** Select the `changelog` slice. */
export const useChangelog = () => useSlice("changelog");

/** Select the `cards` slice. */
export const useCards = () => useSlice("cards");

/** Select the `poeNinja` slice. */
export const usePoeNinja = () => useSlice("poeNinja");

/** Select the `statistics` slice. */
export const useStatistics = () => useSlice("statistics");

/** Select the `onboarding` slice. */
export const useOnboarding = () => useSlice("onboarding");

/** Select the `updater` slice. */
export const useUpdater = () => useSlice("updater");

/** Select the `profitForecast` slice. */
export const useProfitForecast = () => useSlice("profitForecast");

/** Select the `prohibitedLibrary` slice. */
export const useProhibitedLibrary = () => useSlice("prohibitedLibrary");

/** Select the `rarityInsights` slice. */
export const useRarityInsights = () => useSlice("rarityInsights");

/** Select the `rarityInsightsComparison` slice. */
export const useRarityInsightsComparison = () =>
  useSlice("rarityInsightsComparison");

// ── Root actions ─────────────────────────────────────────────────────────────

/**
 * Select the root-level actions (`hydrate`, `startListeners`, `reset`).
 * These are stable functions so shallow comparison keeps re-renders minimal.
 */
export const useRootActions = () =>
  useBoundStore(
    useShallow((state) => ({
      hydrate: state.hydrate,
      startListeners: state.startListeners,
      reset: state.reset,
    })),
  );
