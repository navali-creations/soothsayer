import type { StateCreator } from "zustand";

export interface OnboardingSlice {
  onboarding: {
    // State
    dismissedBeacons: string[];
    isLoading: boolean;
    error: string | null;

    // Actions
    hydrate: () => Promise<void>;
    isDismissed: (key: string) => boolean;
    dismiss: (key: string) => Promise<void>;
    reset: (key: string) => Promise<void>;
    resetAll: () => Promise<void>;
  };
}

export const createOnboardingSlice: StateCreator<
  OnboardingSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  OnboardingSlice
> = (set, get) => ({
  onboarding: {
    // Initial state
    dismissedBeacons: [],
    isLoading: false,
    error: null,

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
          "onboarding-dismissed-beacons",
        );

        set(
          ({ onboarding }) => {
            onboarding.dismissedBeacons = dismissed;
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

    // Check if a beacon is dismissed
    isDismissed: (key: string) => {
      const { onboarding } = get();
      return onboarding.dismissedBeacons.includes(key);
    },

    // Dismiss a beacon
    dismiss: async (key: string) => {
      const { onboarding } = get();

      // Don't add duplicates
      if (onboarding.dismissedBeacons.includes(key)) return;

      try {
        const newDismissed = [...onboarding.dismissedBeacons, key];
        await window.electron.settings.set(
          "onboarding-dismissed-beacons",
          newDismissed,
        );

        set(
          ({ onboarding }) => {
            onboarding.dismissedBeacons = newDismissed;
          },
          false,
          "onboarding/dismiss",
        );
      } catch (error) {
        console.error("Failed to dismiss beacon:", error);
        set(
          ({ onboarding }) => {
            onboarding.error =
              error instanceof Error
                ? error.message
                : "Failed to dismiss beacon";
          },
          false,
          "onboarding/dismiss/error",
        );
      }
    },

    // Reset a single beacon
    reset: async (key: string) => {
      const { onboarding } = get();

      try {
        const newDismissed = onboarding.dismissedBeacons.filter(
          (k) => k !== key,
        );
        await window.electron.settings.set(
          "onboarding-dismissed-beacons",
          newDismissed,
        );

        set(
          ({ onboarding }) => {
            onboarding.dismissedBeacons = newDismissed;
          },
          false,
          "onboarding/reset",
        );
      } catch (error) {
        console.error("Failed to reset beacon:", error);
        set(
          ({ onboarding }) => {
            onboarding.error =
              error instanceof Error ? error.message : "Failed to reset beacon";
          },
          false,
          "onboarding/reset/error",
        );
      }
    },

    // Reset all beacons
    resetAll: async () => {
      try {
        await window.electron.settings.set("onboarding-dismissed-beacons", []);

        set(
          ({ onboarding }) => {
            onboarding.dismissedBeacons = [];
          },
          false,
          "onboarding/resetAll",
        );
      } catch (error) {
        console.error("Failed to reset all beacons:", error);
        set(
          ({ onboarding }) => {
            onboarding.error =
              error instanceof Error
                ? error.message
                : "Failed to reset all beacons";
          },
          false,
          "onboarding/resetAll/error",
        );
      }
    },
  },
});
