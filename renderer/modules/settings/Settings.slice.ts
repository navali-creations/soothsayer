import type { StateCreator } from "zustand";

import type {
  CustomSoundFile,
  UserSettingsDTO,
} from "~/main/modules/settings-store/SettingsStore.dto";

export interface SettingsSlice {
  settings: UserSettingsDTO & {
    // Additional state (not persisted in DB)
    isLoading: boolean;
    error: string | null;

    // Audio UI state (not persisted)
    audioDetectedFiles: CustomSoundFile[];
    audioIsScanning: boolean;
    audioPreviewingFile: string | null;

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

    // Audio UI actions
    scanCustomSounds: () => Promise<void>;
    setAudioPreviewingFile: (filePath: string | null) => void;

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
    installedGames: ["poe1"],
    setupCompleted: false,
    setupStep: 0,
    setupVersion: 1,
    audioEnabled: true,
    audioVolume: 0.5,
    audioRarity1Path: null,
    audioRarity2Path: null,
    audioRarity3Path: null,
    raritySource: "poe.ninja",
    selectedFilterId: null,

    // Additional state
    isLoading: false,
    error: null,

    // Audio UI state
    audioDetectedFiles: [],
    audioIsScanning: false,
    audioPreviewingFile: null,

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

        console.log(
          `[SettingsSlice] Hydrated settings from DB: ` +
            `game=${data.selectedGame}, ` +
            `poe1League="${data.poe1SelectedLeague}", ` +
            `poe2League="${data.poe2SelectedLeague}", ` +
            `poe1ClientPath=${
              data.poe1ClientTxtPath
                ? '"' + data.poe1ClientTxtPath + '"'
                : "null"
            }, ` +
            `setupCompleted=${data.setupCompleted}`,
        );

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
            settings.installedGames = data.installedGames;
            settings.setupCompleted = data.setupCompleted;
            settings.setupStep = data.setupStep;
            settings.setupVersion = data.setupVersion;
            settings.audioEnabled = data.audioEnabled;
            settings.audioVolume = data.audioVolume;
            settings.audioRarity1Path = data.audioRarity1Path;
            settings.audioRarity2Path = data.audioRarity2Path;
            settings.audioRarity3Path = data.audioRarity3Path;
            settings.raritySource = data.raritySource;
            settings.selectedFilterId = data.selectedFilterId;
            settings.isLoading = false;
          },
          false,
          "settingsSlice/hydrate/success",
        );
      } catch (error) {
        console.error(
          "[SettingsSlice] ⚠️ HYDRATION FAILED — settings are using hardcoded defaults " +
            '(poe1League="Standard", poe1ClientPath=null). ' +
            "This will cause incorrect league selection if the user starts a session.",
          error,
        );
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

    // Audio UI actions
    scanCustomSounds: async () => {
      set(
        ({ settings }) => {
          settings.audioIsScanning = true;
        },
        false,
        "settingsSlice/scanCustomSounds/start",
      );

      try {
        const files = await window.electron.settings.scanCustomSounds();
        set(
          ({ settings }) => {
            settings.audioDetectedFiles = files;
            settings.audioIsScanning = false;
          },
          false,
          "settingsSlice/scanCustomSounds/success",
        );
      } catch (error) {
        console.error("Failed to scan custom sounds:", error);
        set(
          ({ settings }) => {
            settings.audioIsScanning = false;
          },
          false,
          "settingsSlice/scanCustomSounds/error",
        );
      }
    },

    setAudioPreviewingFile: (filePath: string | null) => {
      set(
        ({ settings }) => {
          settings.audioPreviewingFile = filePath;
        },
        false,
        "settingsSlice/setAudioPreviewingFile",
      );
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
          settings.installedGames = newSettings.installedGames;
          settings.setupCompleted = newSettings.setupCompleted;
          settings.setupStep = newSettings.setupStep;
          settings.setupVersion = newSettings.setupVersion;
          settings.audioEnabled = newSettings.audioEnabled;
          settings.audioVolume = newSettings.audioVolume;
          settings.audioRarity1Path = newSettings.audioRarity1Path;
          settings.audioRarity2Path = newSettings.audioRarity2Path;
          settings.audioRarity3Path = newSettings.audioRarity3Path;
          settings.raritySource = newSettings.raritySource;
          settings.selectedFilterId = newSettings.selectedFilterId;
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
