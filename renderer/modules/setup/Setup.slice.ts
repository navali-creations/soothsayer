import type { StateCreator } from "zustand";

import type {
  SetupState,
  StepValidationResult,
} from "~/main/modules/app-setup/AppSetup.types";
import {
  getGameSelectionType,
  SETUP_STEPS,
} from "~/main/modules/app-setup/AppSetup.types";
import type { SetupStep } from "~/main/modules/settings-store/SettingsStore.dto";
import { trackEvent } from "~/renderer/modules/umami";
import type { GameType } from "~/types/data-stores";

import type { SettingsSlice } from "../settings";

export interface SetupSlice {
  // State
  setup: {
    setupState: SetupState | null;
    validation: StepValidationResult | null;
    isLoading: boolean;
    error: string | null;
    setupStartTime: number | null;

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
    trackSetupStarted: () => void;

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
  SetupSlice & SettingsSlice,
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
    setupStartTime: null,

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

      // Track game selection change
      trackEvent("setup-game-toggled", {
        game,
        action: currentGames.includes(game) ? "removed" : "added",
        games: newGames,
        selection_type: getGameSelectionType(newGames),
      });

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
      const { settings, setup } = get();
      const settingKey =
        game === "poe1" ? "poe1SelectedLeague" : "poe2SelectedLeague";
      await settings.updateSetting(settingKey, league);

      // Track league selection
      if (league) {
        const selectedGames = setup.setupState?.selectedGames || [];
        trackEvent("setup-league-selected", {
          game,
          league,
          selection_type: getGameSelectionType(selectedGames),
        });
      }

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
      const { settings, setup } = get();
      const settingKey =
        game === "poe1" ? "poe1ClientTxtPath" : "poe2ClientTxtPath";
      await settings.updateSetting(settingKey, path);

      // Track client path selection
      const selectedGames = setup.setupState?.selectedGames || [];
      trackEvent("setup-client-path-selected", {
        game,
        has_path: true,
        selection_type: getGameSelectionType(selectedGames),
      });

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
        const { setup } = get();
        const currentStep = setup.setupState?.currentStep ?? 0;
        const selectedGames = setup.setupState?.selectedGames || [];
        const selectionType = getGameSelectionType(selectedGames);

        // Track step completion before advancing
        if (currentStep === SETUP_STEPS.SELECT_GAME) {
          trackEvent("setup-step-completed-game", {
            step_number: 1,
            step_name: "game",
            selectedGames,
            selection_type: selectionType,
          });
        } else if (currentStep === SETUP_STEPS.SELECT_LEAGUE) {
          const poe1League = setup.setupState?.poe1League;
          const poe2League = setup.setupState?.poe2League;
          trackEvent("setup-step-completed-league", {
            step_number: 2,
            step_name: "league",
            selectedGames,
            selection_type: selectionType,
            poe1League: selectedGames.includes("poe1") ? poe1League : undefined,
            poe2League: selectedGames.includes("poe2") ? poe2League : undefined,
          });
        }

        const result = await window.electron.appSetup.advanceStep();

        if (result.success) {
          // Refresh state after advancing
          const setupState = await window.electron.appSetup.getSetupState();
          set(({ setup }) => {
            setup.setupState = setupState;
            setup.isLoading = false;
            setup.validation = null;
          });

          // Track step viewed for next step
          const nextStep = setupState.currentStep;
          const nextSelectedGames = setupState.selectedGames;
          const nextSelectionType = getGameSelectionType(nextSelectedGames);

          if (nextStep === SETUP_STEPS.SELECT_LEAGUE) {
            trackEvent("setup-step-viewed-league", {
              step_number: 2,
              step_name: "league",
              selectedGames: nextSelectedGames,
              selection_type: nextSelectionType,
            });
          } else if (nextStep === SETUP_STEPS.SELECT_CLIENT_PATH) {
            trackEvent("setup-step-viewed-client-path", {
              step_number: 3,
              step_name: "client-path",
              selectedGames: nextSelectedGames,
              selection_type: nextSelectionType,
            });
          }

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

        // Track step back navigation
        trackEvent("setup-step-back", {
          from_step: currentStep,
          to_step: toStep,
        });

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
        const { setup } = get();
        const selectedGames = setup.setupState?.selectedGames || [];
        const selectionType = getGameSelectionType(selectedGames);
        const poe1League = setup.setupState?.poe1League;
        const poe2League = setup.setupState?.poe2League;

        // Track final step completion
        trackEvent("setup-step-completed-client-path", {
          step_number: 3,
          step_name: "client-path",
          selectedGames,
          selection_type: selectionType,
          hasClientPath: true,
        });

        const result = await window.electron.appSetup.completeSetup();

        if (result.success) {
          const setupState = await window.electron.appSetup.getSetupState();
          set(({ setup }) => {
            setup.setupState = setupState;
            setup.isLoading = false;
          });

          // Track overall setup completion
          const timeTaken = setup.setupStartTime
            ? Date.now() - setup.setupStartTime
            : undefined;

          trackEvent("setup-completed", {
            selectedGames,
            selection_type: selectionType,
            poe1League: selectedGames.includes("poe1") ? poe1League : undefined,
            poe2League: selectedGames.includes("poe2") ? poe2League : undefined,
            totalSteps: 3,
            timeTaken,
            completion_status: "completed",
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
      const { setup } = get();
      const currentStep = setup.setupState?.currentStep ?? 0;

      const stepNames: Record<number, string> = {
        [SETUP_STEPS.SELECT_GAME]: "game",
        [SETUP_STEPS.SELECT_LEAGUE]: "league",
        [SETUP_STEPS.SELECT_CLIENT_PATH]: "client-path",
      };

      // Track setup skip
      trackEvent("setup-skipped", {
        currentStep,
        stepName: stepNames[currentStep] || "unknown",
        reason: "user_skip",
        completion_status: "skipped",
      });

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

    // Track setup started (call on mount)
    trackSetupStarted: () => {
      set(({ setup }) => {
        setup.setupStartTime = Date.now();
      });

      trackEvent("setup-started", {
        timestamp: new Date().toISOString(),
      });
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
