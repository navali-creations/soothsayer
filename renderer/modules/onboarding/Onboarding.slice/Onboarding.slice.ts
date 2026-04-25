import type { StateCreator } from "zustand";

import { SettingsKey } from "~/main/modules/settings-store/SettingsStore.keys";
import type { BoundStore } from "~/renderer/store/store.types";

import { allOnboardingBeaconIds } from "../onboarding-config/onboarding-labels";

export interface OnboardingSlice {
  onboarding: {
    // State
    dismissedBeacons: string[];
    isLoading: boolean;
    error: string | null;
    beaconHostRefreshKey: number;

    // Actions
    hydrate: () => Promise<void>;
    isDismissed: (key: string) => boolean;
    dismiss: (key: string) => Promise<void>;
    dismissAll: () => Promise<void>;
    reset: (key: string) => Promise<void>;
    resetOne: (key: string) => Promise<void>;
    resetAll: () => Promise<void>;
    refreshBeaconHost: () => void;
    getAllBeaconStates: () => { id: string; dismissed: boolean }[];
  };
}

const uniqueOnboardingBeaconIds = [...new Set(allOnboardingBeaconIds)];

const areArraysEqual = (left: string[], right: string[]) => {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
};

export const createOnboardingSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  OnboardingSlice
> = (set, get) => {
  let dismissedBeaconsMutationQueue = Promise.resolve();

  const enqueueDismissedBeaconsMutation = async ({
    computeNext,
    successAction,
    errorAction,
    errorMessage,
  }: {
    computeNext: (current: string[]) => string[];
    successAction: string;
    errorAction: string;
    errorMessage: string;
  }) => {
    dismissedBeaconsMutationQueue = dismissedBeaconsMutationQueue.then(
      async () => {
        const currentDismissed = get().onboarding.dismissedBeacons || [];
        const nextDismissed = computeNext(currentDismissed);

        if (areArraysEqual(currentDismissed, nextDismissed)) {
          return;
        }

        try {
          await window.electron.settings.set(
            SettingsKey.OnboardingDismissedBeacons,
            nextDismissed,
          );

          set(
            ({ onboarding }) => {
              onboarding.dismissedBeacons = nextDismissed;
            },
            false,
            successAction,
          );
        } catch (error) {
          console.error(errorMessage, error);
          set(
            ({ onboarding }) => {
              onboarding.error =
                error instanceof Error ? error.message : errorMessage;
            },
            false,
            errorAction,
          );
        }
      },
    );

    await dismissedBeaconsMutationQueue;
  };

  return {
    onboarding: {
      // Initial state
      dismissedBeacons: [],
      isLoading: false,
      error: null,
      beaconHostRefreshKey: 0,

      // Hydrate from settings
      hydrate: async () => {
        set(
          ({ onboarding }) => {
            onboarding.isLoading = true;
            onboarding.error = null;
          },
          false,
          "onboarding/hydrate/start",
        );

        try {
          const dismissed = await window.electron.settings.get(
            SettingsKey.OnboardingDismissedBeacons,
          );

          set(
            ({ onboarding }) => {
              onboarding.dismissedBeacons = Array.isArray(dismissed)
                ? dismissed
                : [];
              onboarding.isLoading = false;
            },
            false,
            "onboarding/hydrate/success",
          );
        } catch (error) {
          console.error("Failed to hydrate onboarding state:", error);
          set(
            ({ onboarding }) => {
              onboarding.error =
                error instanceof Error ? error.message : "Unknown error";
              onboarding.isLoading = false;
            },
            false,
            "onboarding/hydrate/error",
          );
        }
      },

      isDismissed: (key: string) => {
        const { onboarding } = get();
        const beacons = onboarding.dismissedBeacons || [];
        return beacons.includes(key);
      },

      dismiss: async (key: string) => {
        await enqueueDismissedBeaconsMutation({
          computeNext: (currentDismissed) => {
            if (currentDismissed.includes(key)) {
              return currentDismissed;
            }

            return [...currentDismissed, key];
          },
          successAction: "onboarding/dismiss",
          errorAction: "onboarding/dismiss/error",
          errorMessage: "Failed to dismiss beacon",
        });
      },

      dismissAll: async () => {
        await enqueueDismissedBeaconsMutation({
          computeNext: () => uniqueOnboardingBeaconIds,
          successAction: "onboarding/dismissAll",
          errorAction: "onboarding/dismissAll/error",
          errorMessage: "Failed to dismiss all beacons",
        });
      },

      reset: async (key: string) => {
        await enqueueDismissedBeaconsMutation({
          computeNext: (currentDismissed) => {
            return currentDismissed.filter(
              (dismissedKey) => dismissedKey !== key,
            );
          },
          successAction: "onboarding/reset",
          errorAction: "onboarding/reset/error",
          errorMessage: "Failed to reset beacon",
        });
      },

      resetOne: async (key: string) => {
        await get().onboarding.reset(key);
      },

      resetAll: async () => {
        await enqueueDismissedBeaconsMutation({
          computeNext: () => [],
          successAction: "onboarding/resetAll",
          errorAction: "onboarding/resetAll/error",
          errorMessage: "Failed to reset all beacons",
        });
      },

      refreshBeaconHost: () => {
        set(
          ({ onboarding }) => {
            onboarding.beaconHostRefreshKey += 1;
          },
          false,
          "onboarding/refreshBeaconHost",
        );
      },

      getAllBeaconStates: () => {
        const dismissed = new Set(get().onboarding.dismissedBeacons || []);

        return uniqueOnboardingBeaconIds.map((id) => ({
          id,
          dismissed: dismissed.has(id),
        }));
      },
    },
  };
};
