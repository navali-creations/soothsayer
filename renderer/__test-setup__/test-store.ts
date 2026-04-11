/**
 * Zustand test store helper.
 *
 * Creates isolated store instances for testing so that each test starts
 * with a clean slate. Supports partial state overrides for setting up
 * specific test scenarios without needing to go through the full
 * hydration / IPC flow.
 *
 * Usage:
 *
 *   import { createTestStore } from '~/renderer/__test-setup__/test-store';
 *
 *   let store: ReturnType<typeof createTestStore>;
 *
 *   beforeEach(() => {
 *     store = createTestStore();
 *   });
 *
 *   it('should do something', () => {
 *     store.getState().setup.toggleGame('poe2');
 *     expect(store.getState().setup.getSelectedGames()).toContain('poe2');
 *   });
 *
 * With partial state overrides:
 *
 *   const store = createTestStore({
 *     setup: {
 *       setupState: { currentStep: 2, isComplete: false, selectedGames: ['poe1'], ... },
 *     },
 *   });
 */

import { enableMapSet } from "immer";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { createAppMenuSlice } from "~/renderer/modules/app-menu/AppMenu.slice/AppMenu.slice";
import { createCardDetailsSlice } from "~/renderer/modules/card-details/CardDetails.slice/CardDetails.slice";
import { createCardsSlice } from "~/renderer/modules/cards/Cards.slice/Cards.slice";
import { createChangelogSlice } from "~/renderer/modules/changelog/Changelog.slice/Changelog.slice";
import { createSessionSlice } from "~/renderer/modules/current-session/CurrentSession.slice/CurrentSession.slice";
import { createGameInfoSlice } from "~/renderer/modules/game-info/GameInfo.slice/GameInfo.slice";
import { createOnboardingSlice } from "~/renderer/modules/onboarding/Onboarding.slice/Onboarding.slice";
import { createOverlaySlice } from "~/renderer/modules/overlay/Overlay.slice/Overlay.slice";
import { createPoeNinjaSlice } from "~/renderer/modules/poe-ninja/PoeNinja.slice/PoeNinja.slice";
import { createProfitForecastSlice } from "~/renderer/modules/profit-forecast/ProfitForecast.slice/ProfitForecast.slice";
import { createRarityInsightsSlice } from "~/renderer/modules/rarity-insights/RarityInsights.slice/RarityInsights.slice";
import { createRarityInsightsComparisonSlice } from "~/renderer/modules/rarity-insights/RarityInsightsComparison.slice/RarityInsightsComparison.slice";
import { createSessionDetailsSlice } from "~/renderer/modules/session-details/SessionDetails.slice/SessionDetails.slice";
import { createSessionsSlice } from "~/renderer/modules/sessions/Sessions.slice/Sessions.slice";
import { createSettingsSlice } from "~/renderer/modules/settings/Settings.slice/Settings.slice";
import { createStorageSlice } from "~/renderer/modules/settings/Storage.slice/Storage.slice";
import { createSetupSlice } from "~/renderer/modules/setup/Setup.slice/Setup.slice";
import { createStatisticsSlice } from "~/renderer/modules/statistics/Statistics.slice/Statistics.slice";
import { createUpdaterSlice } from "~/renderer/modules/updater/Updater.slice/Updater.slice";
import type { BoundStore } from "~/renderer/store/store.types";

enableMapSet();

// ─── Root store type (imported from production) ───────────────────

// ─── Deep partial type for overrides ───────────────────────────────────────

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type StoreOverrides = DeepPartial<BoundStore>;

// ─── Deep merge helper ─────────────────────────────────────────────────────

function deepMerge<T extends Record<string, any>>(
  target: T,
  source: DeepPartial<T>,
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== null &&
      sourceVal !== undefined &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === "object" &&
      targetVal !== null &&
      !Array.isArray(targetVal) &&
      typeof targetVal !== "function"
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, any>,
        sourceVal as DeepPartial<Record<string, any>>,
      ) as T[keyof T];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}

// ─── Store factory ─────────────────────────────────────────────────────────

/**
 * Create an isolated Zustand store instance for testing.
 *
 * This mirrors the production `useBoundStore` but creates a fresh instance
 * each time so tests don't share state. The store is NOT connected to
 * React — it's a vanilla Zustand store for unit-testing slice logic.
 *
 * @param overrides - Optional deep-partial overrides to apply on top of the
 *   default initial state. Useful for setting up specific test scenarios.
 */
export function createTestStore(overrides?: StoreOverrides) {
  const store = create<BoundStore>()(
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
        const rarityInsightsSlice = createRarityInsightsSlice(...a);
        const rarityInsightsComparisonSlice =
          createRarityInsightsComparisonSlice(...a);

        const baseState: BoundStore = {
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
          ...statisticsSlice,
          ...onboardingSlice,
          ...updaterSlice,
          ...rarityInsightsSlice,
          ...rarityInsightsComparisonSlice,

          hydrate: async () => {
            // No-op in tests — tests set state directly via overrides or
            // by calling individual slice actions.
          },

          startListeners: () => {
            // No-op in tests — return a no-op cleanup function.
            return () => {};
          },

          reset: () => {
            // No-op in tests — create a new store instead.
          },
        };

        // Apply overrides if provided
        if (overrides) {
          return deepMerge(baseState, overrides);
        }

        return baseState;
      }),
      { enabled: false }, // Disable Redux DevTools in tests
    ),
  );

  return store;
}

export type TestStore = ReturnType<typeof createTestStore>;
