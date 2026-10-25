import type { StateCreator } from "zustand";

import type {
  SetupState,
  StepValidationResult,
} from "~/main/modules/app-setup/AppSetup.types";
import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";
import type { SetupStep } from "~/main/modules/settings-store/SettingsStore.dto";
import type { BoundStore } from "~/renderer/store/store.types";
import type { GameType } from "~/types/data-stores";

export interface SetupSlice {
  // State
  setup: {
    setupState: SetupState | null;
    validation: StepValidationResult | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    hydrate: () => Promise<void>;
    validateCurrentStep: () => Promise<void>;
    /** Toggle a game on/off in the selected games list */
    toggleGame: (game: GameType) => Promise<void>;
    selectLeague: (game: "poe1" | "poe2", league: string) => Promise<void>;
    selectClientPath: (game: "poe1" | "poe2", path: string) => Promise<void>;
    advanceStep: () => Promise<boolean>;
    goBack: () => Promise<void>;
    completeSetup: () => Promise<boolean>;
    skipSetup: () => Promise<void>;
    resetSetup: () => Promise<void>;

    // Internal setters
    setSetupState: (state: SetupState) => void;
    setValidation: (validation: StepValidationResult | null) => void;
    setError: (error: string | null) => void;

    // Getters
    isSetupComplete: () => boolean;
    getCurrentStep: () => SetupStep;
    getSelectedGames: () => GameType[];
  };
}

export const createSetupSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SetupSlice
> = (set, get) => ({
  setup: {
    // Initial state
    setupState: null,
    validation: null,
    isLoading: false,
    error: null,

    hydrate: async () => {
      set(({ setup }) => {
        setup.isLoading = true;
        setup.error = null;
      });

      try {
        const setupState = await window.electron.appSetup.getSetupState();
        set(({ setup }) => {
          setup.setupState = setupState;
          setup.isLoading = false;
        });
      } catch (error) {
        console.error("[SetupSlice] Failed to hydrate setup state:", error);
        set(({ setup }) => {
          setup.error =
            error instanceof Error ? error.message : "Unknown error";
          setup.isLoading = false;
        });
      }
    },

    // Validate current step
    validateCurrentStep: async () => {
      try {
        const validation = await window.electron.appSetup.validateCurrentStep();
        set(({ setup }) => {
          setup.validation = validation;
        });
      } catch (error) {
        console.error("[SetupSlice] Failed to validate step:", error);
        set(({ setup }) => {
          setup.error =
            error instanceof Error ? error.message : "Validation failed";
        });
      }
    },

    // Toggle game on/off (Step 1)
    toggleGame: async (game: GameType) => {
      const { setup, settings } = get();
      const currentGames = setup.setupState?.selectedGames || [];

      let newGames: GameType[];
      if (currentGames.includes(game)) {
        // Remove game (but ensure at least one remains selected)
        newGames = currentGames.filter((g) => g !== game);
        // If removing would leave no games, don't allow it
        if (newGames.length === 0) {
          return;
        }
      } else {
        // Add game
        newGames = [...currentGames, game];
      }

      // Sort for consistent order (poe1 before poe2)
      newGames.sort();

      await settings.updateSetting("installedGames", newGames);
      // Keep active game in sync (set to first selected game)
      await settings.updateSetting("selectedGame", newGames[0]);

      // Refresh setup state from backend to reflect the change
      const setupState = await window.electron.appSetup.getSetupState();
      set(({ setup }) => {
        setup.setupState = setupState;
      });

      // Re-validate
      await get().setup.validateCurrentStep();
    },

    // Select league (Step 2)
    selectLeague: async (game: "poe1" | "poe2", league: string) => {
      const { settings } = get();
      const settingKey =
        game === "poe1" ? "poe1SelectedLeague" : "poe2SelectedLeague";
      await settings.updateSetting(settingKey, league);

      // Refresh setup state from backend to reflect the change
      const setupState = await window.electron.appSetup.getSetupState();
      set(({ setup }) => {
        setup.setupState = setupState;
      });

      // Re-validate
      await get().setup.validateCurrentStep();
    },

    // Select client path (Step 3)
    selectClientPath: async (game: "poe1" | "poe2", path: string) => {
      const { settings } = get();
      const settingKey =
        game === "poe1" ? "poe1ClientTxtPath" : "poe2ClientTxtPath";
      await settings.updateSetting(settingKey, path);

      // Refresh setup state from backend to reflect the change
      const setupState = await window.electron.appSetup.getSetupState();
      set(({ setup }) => {
        setup.setupState = setupState;
      });

      // Re-validate
      await get().setup.validateCurrentStep();
    },

    // Advance to next step
    advanceStep: async () => {
      set(({ setup }) => {
        setup.isLoading = true;
        setup.error = null;
      });

      try {
        const result = await window.electron.appSetup.advanceStep();

        if (result.success) {
          // Refresh state after advancing
          const setupState = await window.electron.appSetup.getSetupState();
          set(({ setup }) => {
            setup.setupState = setupState;
            setup.isLoading = false;
            setup.validation = null;
          });

          return true;
        }
        set(({ setup }) => {
          setup.error = result.error ?? "Failed to advance";
          setup.isLoading = false;
        });
        return false;
      } catch (error) {
        console.error("[SetupSlice] Failed to advance step:", error);
        set(({ setup }) => {
          setup.error =
            error instanceof Error ? error.message : "Unknown error";
          setup.isLoading = false;
        });
        return false;
      }
    },

    // Go back to previous step
    goBack: async () => {
      const { setup } = get();
      const currentStep = setup.setupState?.currentStep ?? 0;

      if (currentStep <= SETUP_STEPS.SELECT_GAME) return;

      set(({ setup }) => {
        setup.isLoading = true;
        setup.error = null;
      });

      try {
        const toStep = currentStep - 1;

        const result = await window.electron.appSetup.goToStep(
          toStep as SetupStep,
        );

        if (result.success) {
          const setupState = await window.electron.appSetup.getSetupState();
          set(({ setup }) => {
            setup.setupState = setupState;
            setup.isLoading = false;
            setup.validation = null;
          });
        } else {
          set(({ setup }) => {
            setup.error = result.error ?? "Failed to go back";
            setup.isLoading = false;
          });
        }
      } catch (error) {
        console.error("[SetupSlice] Failed to go back:", error);
        set(({ setup }) => {
          setup.error =
            error instanceof Error ? error.message : "Unknown error";
          setup.isLoading = false;
        });
      }
    },

    // Complete setup
    completeSetup: async () => {
      set(({ setup }) => {
        setup.isLoading = true;
        setup.error = null;
      });

      try {
        const result = await window.electron.appSetup.completeSetup();

        if (result.success) {
          const setupState = await window.electron.appSetup.getSetupState();
          set(({ setup }) => {
            setup.setupState = setupState;
            setup.isLoading = false;
          });
          return true;
        }
        set(({ setup }) => {
          setup.error = result.error ?? "Failed to complete setup";
          setup.isLoading = false;
        });
        return false;
      } catch (error) {
        console.error("[SetupSlice] Failed to complete setup:", error);
        set(({ setup }) => {
          setup.error =
            error instanceof Error ? error.message : "Unknown error";
          setup.isLoading = false;
        });
        return false;
      }
    },

    // Skip setup
    skipSetup: async () => {
      set(({ setup }) => {
        setup.isLoading = true;
        setup.error = null;
      });

      try {
        await window.electron.appSetup.skipSetup();
        const setupState = await window.electron.appSetup.getSetupState();
        set(({ setup }) => {
          setup.setupState = setupState;
          setup.isLoading = false;
        });
      } catch (error) {
        console.error("[SetupSlice] Failed to skip setup:", error);
        set(({ setup }) => {
          setup.error =
            error instanceof Error ? error.message : "Unknown error";
          setup.isLoading = false;
        });
      }
    },

    // Reset setup
    resetSetup: async () => {
      set(({ setup }) => {
        setup.isLoading = true;
        setup.error = null;
      });

      try {
        await window.electron.appSetup.resetSetup();
        const setupState = await window.electron.appSetup.getSetupState();
        set(({ setup }) => {
          setup.setupState = setupState;
          setup.isLoading = false;
          setup.validation = null;
        });
      } catch (error) {
        console.error("[SetupSlice] Failed to reset setup:", error);
        set(({ setup }) => {
          setup.error =
            error instanceof Error ? error.message : "Unknown error";
          setup.isLoading = false;
        });
      }
    },

    // Internal setters
    setSetupState: (state: SetupState) => {
      set(({ setup }) => {
        setup.setupState = state;
      });
    },

    setValidation: (validation: StepValidationResult | null) => {
      set(({ setup }) => {
        setup.validation = validation;
      });
    },

    setError: (error: string | null) => {
      set(({ setup }) => {
        setup.error = error;
      });
    },

    // Getters
    isSetupComplete: () => {
      return get().setup.setupState?.isComplete ?? false;
    },

    getCurrentStep: () => {
      return get().setup.setupState?.currentStep ?? 0;
    },

    getSelectedGames: () => {
      return get().setup.setupState?.selectedGames ?? [];
    },
  },
});
