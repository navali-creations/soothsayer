import type { StateCreator } from "zustand";
import type {
  SetupState,
  StepValidationResult,
} from "../../electron/modules/app-setup/AppSetup.types";
import type { SetupStep } from "../../electron/modules/settings-store/SettingsStore.dto";

export interface SetupSlice {
  // State
  setupState: SetupState | null;
  validation: StepValidationResult | null;

  isLoading: boolean;
  error: string | null;

  // Actions
  hydrate: () => Promise<void>;
  validateCurrentStep: () => Promise<void>;
  advanceStep: () => Promise<boolean>;
  goToStep: (step: SetupStep) => Promise<boolean>;
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
}

export const createSetupSlice: StateCreator<
  SetupSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SetupSlice
> = (set, get) => ({
  // Initial state
  setupState: null,
  validation: null,
  isLoading: false,
  error: null,

  hydrate: async () => {
    set({ isLoading: true, error: null });

    try {
      const setupState = await window.electron.appSetup.getSetupState();
      set({ setupState, isLoading: false });
    } catch (error) {
      console.error("Failed to hydrate setup state:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  // Validate current step
  validateCurrentStep: async () => {
    try {
      const validation = await window.electron.appSetup.validateCurrentStep();
      set({ validation });
    } catch (error) {
      console.error("Failed to validate step:", error);
      set({
        error: error instanceof Error ? error.message : "Validation failed",
      });
    }
  },

  // Advance to next step
  advanceStep: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electron.appSetup.advanceStep();

      if (result.success) {
        // Refresh state after advancing
        const setupState = await window.electron.appSetup.getSetupState();
        set({ setupState, isLoading: false, validation: null });
        return true;
      } else {
        set({ error: result.error ?? "Failed to advance", isLoading: false });
        return false;
      }
    } catch (error) {
      console.error("Failed to advance step:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
      return false;
    }
  },

  // Go to specific step
  goToStep: async (step) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electron.appSetup.goToStep(step);

      if (result.success) {
        const setupState = await window.electron.appSetup.getSetupState();
        set({ setupState, isLoading: false, validation: null });
        return true;
      } else {
        set({
          error: result.error ?? "Failed to change step",
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to go to step:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
      return false;
    }
  },

  // Complete setup
  completeSetup: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electron.appSetup.completeSetup();

      if (result.success) {
        const setupState = await window.electron.appSetup.getSetupState();
        set({ setupState, isLoading: false });
        return true;
      } else {
        set({
          error: result.error ?? "Failed to complete setup",
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to complete setup:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
      return false;
    }
  },

  // Skip setup
  skipSetup: async () => {
    try {
      await window.electron.appSetup.skipSetup();
      const setupState = await window.electron.appSetup.getSetupState();
      set({ setupState });
    } catch (error) {
      console.error("Failed to skip setup:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  // Reset setup
  resetSetup: async () => {
    try {
      await window.electron.appSetup.resetSetup();
      const setupState = await window.electron.appSetup.getSetupState();
      set({ setupState, validation: null, error: null });
    } catch (error) {
      console.error("Failed to reset setup:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  // Direct setters
  setSetupState: (setupState) => {
    set({ setupState });
  },

  setValidation: (validation) => {
    set({ validation });
  },

  setError: (error) => {
    set({ error });
  },

  // Getters
  isSetupComplete: () => {
    const { setupState } = get();
    return setupState?.isComplete ?? false;
  },

  getCurrentStep: () => {
    const { setupState } = get();
    return setupState?.currentStep ?? 0;
  },
});
