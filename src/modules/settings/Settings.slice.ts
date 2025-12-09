import type { StateCreator } from "zustand";
import type {
  GameVersion,
  SettingsStoreSchema,
} from "../../../electron/modules/settings-store/SettingsStore.schemas";

export interface SettingsSlice {
  settings: {
    // State
    data: SettingsStoreSchema | null;
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

    // Getters - App behavior
    getReleaseChannel: () => SettingsStoreSchema["release-channel"];
    getAppExitAction: () => SettingsStoreSchema["app-exit-action"];
    getAppOpenAtLogin: () => boolean;
    getAppOpenAtLoginMinimized: () => boolean;

    // Getters - File paths
    getPoe1ClientTxtPath: () => string | undefined;
    getPoe2ClientTxtPath: () => string | undefined;
    getCollectionPath: () => string | undefined;

    // Getters - Game and league selection
    getActiveGame: () => Omit<GameVersion, "both">;
    getActiveGameViewSelectedLeague: () => string | undefined;
    getInstalledGames: () => GameVersion | undefined;
    getSelectedPoe1League: () => string;
    getSelectedPoe2League: () => string;

    // Getters - Setup and onboarding
    isTourComplete: () => boolean;
    isSetupComplete: () => boolean;
    getSetupStep: () => SettingsStoreSchema["setup-step"];
    getSetupVersion: () => number;
  };
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SettingsSlice
> = (set, get) => ({
  settings: {
    // Initial state
    data: null,
    isLoading: false,
    error: null,

    // Hydrate settings from main process on app load
    hydrate: async () => {
      set(
        ({ settings }) => {
          settings.isLoading = true;
          settings.error = null;
        },
        false,
        "settingsSlice/hydrate/start",
      );

      try {
        const data = await window.electron.settings.getAll();
        set(
          ({ settings }) => {
            settings.data = data;
            settings.isLoading = false;
          },
          false,
          "settingsSlice/hydrate/success",
        );
      } catch (error) {
        console.error("Failed to hydrate settings:", error);
        set(
          ({ settings }) => {
            settings.error =
              error instanceof Error ? error.message : "Unknown error";
            settings.isLoading = false;
          },
          false,
          "settingsSlice/hydrate/error",
        );
      }
    },

    // Update a setting (optimistic update)
    updateSetting: async (key, value) => {
      const { settings } = get();
      if (!settings.data) return;

      // Optimistic update - update Zustand immediately
      const previousValue = settings.data[key];
      set(
        ({ settings }) => {
          if (settings.data) {
            settings.data[key] = value;
          }
        },
        false,
        `settingsSlice/updateSetting/${String(key)}`,
      );

      try {
        // Sync with main process
        await window.electron.settings.set(key, value);
      } catch (error) {
        console.error(`Failed to update setting ${String(key)}:`, error);

        // Rollback on error
        set(
          ({ settings }) => {
            if (settings.data) {
              settings.data[key] = previousValue;
            }
            settings.error =
              error instanceof Error ? error.message : "Update failed";
          },
          false,
          `settingsSlice/updateSetting/${String(key)}/error`,
        );
      }
    },

    // Direct setter (for IPC listeners)
    setSetting: (key, value) => {
      set(
        ({ settings }) => {
          if (settings.data) {
            settings.data[key] = value;
          }
        },
        false,
        `settingsSlice/setSetting/${String(key)}`,
      );
    },

    // Set all settings at once
    setSettings: (newSettings) => {
      set(
        ({ settings }) => {
          settings.data = newSettings;
        },
        false,
        "settingsSlice/setSettings",
      );
    },

    // Set error
    setError: (error) => {
      set(
        ({ settings }) => {
          settings.error = error;
        },
        false,
        "settingsSlice/setError",
      );
    },

    // Getters - App behavior
    getReleaseChannel: () => {
      const { settings } = get();
      return settings.data?.["release-channel"] ?? "stable";
    },

    getAppExitAction: () => {
      const { settings } = get();
      return settings.data?.["app-exit-action"] ?? "minimize-to-tray";
    },

    getAppOpenAtLogin: () => {
      const { settings } = get();
      return settings.data?.["app-open-at-login"] ?? false;
    },

    getAppOpenAtLoginMinimized: () => {
      const { settings } = get();
      return settings.data?.["app-open-at-login-minimized"] ?? false;
    },

    // Getters - File paths
    getPoe1ClientTxtPath: () => {
      const { settings } = get();
      return settings.data?.["poe1-client-txt-path"];
    },

    getPoe2ClientTxtPath: () => {
      const { settings } = get();
      return settings.data?.["poe2-client-txt-path"];
    },

    getCollectionPath: () => {
      const { settings } = get();
      return settings.data?.["collection-path"];
    },

    // Getters - Game and league selection
    getActiveGame: () => {
      const { settings } = get();
      return settings.data?.["active-game"];
    },

    getActiveGameViewSelectedLeague: () => {
      const { settings } = get();
      const activeGameView = settings.getActiveGame() as Extract<
        GameVersion,
        "poe1" | "poe2"
      >;

      return settings.data?.[`selected-${activeGameView}-league`];
    },

    getInstalledGames: () => {
      const { settings } = get();
      return settings.data?.["installed-games"];
    },

    getSelectedPoe1League: () => {
      const { settings } = get();
      return settings.data?.["selected-poe1-league"] ?? "Standard";
    },

    getSelectedPoe2League: () => {
      const { settings } = get();
      return settings.data?.["selected-poe2-league"] ?? "Standard";
    },

    // Getters - Setup and onboarding
    isTourComplete: () => {
      const { settings } = get();
      return settings.data?.["tour-completed"] ?? false;
    },

    isSetupComplete: () => {
      const { settings } = get();
      return settings.data?.["setup-completed"] ?? false;
    },

    getSetupStep: () => {
      const { settings } = get();
      return settings.data?.["setup-step"] ?? 0;
    },

    getSetupVersion: () => {
      const { settings } = get();
      return settings.data?.["setup-version"] ?? 1;
    },
  },
});
