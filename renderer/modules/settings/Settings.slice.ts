import type { StateCreator } from "zustand";

import type { UserSettingsDTO } from "~/main/modules/settings-store/SettingsStore.dto";

export interface SettingsSlice {
  settings: UserSettingsDTO & {
    // Additional state (not persisted in DB)
    isLoading: boolean;
    error: string | null;

    // Actions
    hydrate: () => Promise<void>;
    updateSetting: <K extends keyof UserSettingsDTO>(
      key: K,
      value: UserSettingsDTO[K],
    ) => Promise<void>;
    setSetting: <K extends keyof UserSettingsDTO>(
      key: K,
      value: UserSettingsDTO[K],
    ) => void;
    setSettings: (settings: UserSettingsDTO) => void;
    setError: (error: string | null) => void;

    // Getters - App behavior
    getAppExitAction: () => "exit" | "minimize";
    getAppOpenAtLogin: () => boolean;
    getAppOpenAtLoginMinimized: () => boolean;

    // Getters - File paths
    getPoe1ClientTxtPath: () => string | null;
    getPoe2ClientTxtPath: () => string | null;

    // Getters - Game and league selection
    getSelectedGame: () => "poe1" | "poe2";
    getActiveGameViewSelectedLeague: () => string;
    getSelectedPoe1League: () => string;
    getSelectedPoe2League: () => string;

    // Getters - Price sources
    getActiveGameViewPriceSource: () => "exchange" | "stash";
    setActiveGameViewPriceSource: (
      source: "exchange" | "stash",
    ) => Promise<void>;
  };
}

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SettingsSlice
> = (set, get) => ({
  settings: {
    // Initial state from UserSettingsDTO (with defaults)
    appExitAction: "exit",
    appOpenAtLogin: false,
    appOpenAtLoginMinimized: false,
    onboardingDismissedBeacons: [],
    overlayBounds: null,
    poe1ClientTxtPath: null,
    poe1SelectedLeague: "Standard",
    poe1PriceSource: "exchange",
    poe2ClientTxtPath: null,
    poe2SelectedLeague: "Standard",
    poe2PriceSource: "stash",
    selectedGame: "poe1",
    setupCompleted: false,
    setupStep: 0,
    setupVersion: 1,

    // Additional state
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
            // Only assign DTO properties
            settings.appExitAction = data.appExitAction;
            settings.appOpenAtLogin = data.appOpenAtLogin;
            settings.appOpenAtLoginMinimized = data.appOpenAtLoginMinimized;
            settings.poe1ClientTxtPath = data.poe1ClientTxtPath;
            settings.poe1SelectedLeague = data.poe1SelectedLeague;
            settings.poe1PriceSource = data.poe1PriceSource;
            settings.poe2ClientTxtPath = data.poe2ClientTxtPath;
            settings.poe2SelectedLeague = data.poe2SelectedLeague;
            settings.poe2PriceSource = data.poe2PriceSource;
            settings.selectedGame = data.selectedGame;
            settings.setupCompleted = data.setupCompleted;
            settings.setupStep = data.setupStep;
            settings.setupVersion = data.setupVersion;
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
    updateSetting: async <K extends keyof UserSettingsDTO>(
      key: K,
      value: UserSettingsDTO[K],
    ) => {
      const { settings } = get();

      // Optimistic update - update Zustand immediately
      const previousValue = settings[key];
      set(
        ({ settings }) => {
          (settings as any)[key] = value;
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
            (settings as any)[key] = previousValue;
            settings.error =
              error instanceof Error ? error.message : "Update failed";
          },
          false,
          `settingsSlice/updateSetting/${String(key)}/error`,
        );
      }
    },

    // Direct setter (for IPC listeners)
    setSetting: <K extends keyof UserSettingsDTO>(
      key: K,
      value: UserSettingsDTO[K],
    ) => {
      set(
        ({ settings }) => {
          (settings as any)[key] = value;
        },
        false,
        `settingsSlice/setSetting/${String(key)}`,
      );
    },

    // Set all settings at once
    setSettings: (newSettings: UserSettingsDTO) => {
      set(
        ({ settings }) => {
          settings.appExitAction = newSettings.appExitAction;
          settings.appOpenAtLogin = newSettings.appOpenAtLogin;
          settings.appOpenAtLoginMinimized =
            newSettings.appOpenAtLoginMinimized;
          settings.poe1ClientTxtPath = newSettings.poe1ClientTxtPath;
          settings.poe1SelectedLeague = newSettings.poe1SelectedLeague;
          settings.poe1PriceSource = newSettings.poe1PriceSource;
          settings.poe2ClientTxtPath = newSettings.poe2ClientTxtPath;
          settings.poe2SelectedLeague = newSettings.poe2SelectedLeague;
          settings.poe2PriceSource = newSettings.poe2PriceSource;
          settings.selectedGame = newSettings.selectedGame;
          settings.setupCompleted = newSettings.setupCompleted;
          settings.setupStep = newSettings.setupStep;
          settings.setupVersion = newSettings.setupVersion;
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
    getAppExitAction: () => {
      const { settings } = get();
      return settings.appExitAction;
    },

    getAppOpenAtLogin: () => {
      const { settings } = get();
      return settings.appOpenAtLogin;
    },

    getAppOpenAtLoginMinimized: () => {
      const { settings } = get();
      return settings.appOpenAtLoginMinimized;
    },

    // Getters - File paths
    getPoe1ClientTxtPath: () => {
      const { settings } = get();
      return settings.poe1ClientTxtPath;
    },

    getPoe2ClientTxtPath: () => {
      const { settings } = get();
      return settings.poe2ClientTxtPath;
    },

    // Getters - Game and league selection
    getSelectedGame: () => {
      const { settings } = get();
      return settings.selectedGame;
    },

    getActiveGameViewSelectedLeague: () => {
      const { settings } = get();
      const activeGame = settings.selectedGame;
      return activeGame === "poe1"
        ? settings.poe1SelectedLeague
        : settings.poe2SelectedLeague;
    },

    getSelectedPoe1League: () => {
      const { settings } = get();
      return settings.poe1SelectedLeague;
    },

    getSelectedPoe2League: () => {
      const { settings } = get();
      return settings.poe2SelectedLeague;
    },

    // Getters - Price sources
    getActiveGameViewPriceSource: () => {
      const { settings } = get();
      const activeGame = settings.selectedGame;
      return activeGame === "poe1"
        ? settings.poe1PriceSource
        : settings.poe2PriceSource;
    },

    setActiveGameViewPriceSource: async (source: "exchange" | "stash") => {
      const { settings } = get();
      const activeGame = settings.selectedGame;
      const key = activeGame === "poe1" ? "poe1PriceSource" : "poe2PriceSource";
      await settings.updateSetting(key, source);
    },
  },
});
