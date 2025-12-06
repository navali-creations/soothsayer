import type { StateCreator } from "zustand";
import type { SettingsStoreSchema } from "../../electron/modules/settings-store/SettingsStore.schemas";

export interface SettingsSlice {
  // State
  settings: SettingsStoreSchema | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  hydrate: () => Promise<void>;
  updateSetting: <K extends keyof SettingsStoreSchema>(
    key: K,
    value: SettingsStoreSchema[K],
  ) => Promise<void>;
  setSetting: <K extends keyof SettingsStoreSchema>(
    key: K,
    value: SettingsStoreSchema[K],
  ) => void;
  setSettings: (settings: SettingsStoreSchema) => void;
  setError: (error: string | null) => void;

  // Getters (computed values)
  isSetupComplete: () => boolean;
  isTourComplete: () => boolean;
  getSelectedGame: () => SettingsStoreSchema["selected-game"] | null;
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SettingsSlice
> = (set, get) => ({
  // Initial state
  settings: null,
  isLoading: false,
  error: null,

  // Hydrate settings from main process on app load
  hydrate: async () => {
    set({ isLoading: true, error: null });

    try {
      const settings = await window.electron.settings.getAll(); // Changed from window.api
      set({ settings, isLoading: false });
    } catch (error) {
      console.error("Failed to hydrate settings:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  // Update a setting (optimistic update)
  updateSetting: async (key, value) => {
    const { settings } = get();
    if (!settings) return;

    // Optimistic update - update Zustand immediately
    const previousValue = settings[key];
    set((state) => {
      if (state.settings) {
        state.settings[key] = value;
      }
    });

    try {
      // Sync with main process
      await window.electron.settings.set(key, value); // Changed from window.api
    } catch (error) {
      console.error(`Failed to update setting ${String(key)}:`, error);

      // Rollback on error
      set((state) => {
        if (state.settings) {
          state.settings[key] = previousValue;
        }
        state.error = error instanceof Error ? error.message : "Update failed";
      });
    }
  },

  // Direct setter (for IPC listeners)
  setSetting: (key, value) => {
    set((state) => {
      if (state.settings) {
        state.settings[key] = value;
      }
    });
  },

  // Set all settings at once
  setSettings: (settings) => {
    set({ settings });
  },

  // Set error
  setError: (error) => {
    set({ error });
  },

  // Computed getters
  isSetupComplete: () => {
    const { settings } = get();
    return settings?.["setup-completed"] ?? false;
  },

  isTourComplete: () => {
    const { settings } = get();
    return settings?.["tour-completed"] ?? false;
  },

  getSelectedGame: () => {
    const { settings } = get();
    return settings?.["selected-game"] ?? null;
  },
});
