import type { StateCreator } from "zustand";

import type { LatestReleaseInfo } from "~/main/modules/updater/Updater.api";

export interface AppMenuSlice {
  appMenu: {
    // State
    isMaximized: boolean;
    isWhatsNewOpen: boolean;
    whatsNewRelease: LatestReleaseInfo | null;
    whatsNewIsLoading: boolean;
    whatsNewError: string | null;
    whatsNewHasFetched: boolean;

    // Actions
    hydrate: () => Promise<void>;
    minimize: () => void;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    close: () => void;
    setIsMaximized: (isMaximized: boolean) => void;
    openWhatsNew: () => Promise<void>;
    closeWhatsNew: () => void;
  };
}

export const createAppMenuSlice: StateCreator<
  AppMenuSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  AppMenuSlice
> = (set, get) => ({
  appMenu: {
    // Initial state
    isMaximized: false,
    isWhatsNewOpen: false,
    whatsNewRelease: null,
    whatsNewIsLoading: false,
    whatsNewError: null,
    whatsNewHasFetched: false,

    // Hydrate initial maximized state from Electron
    hydrate: async () => {
      try {
        const isMaximized = await window.electron?.mainWindow.isMaximized();
        set(
          ({ appMenu }) => {
            appMenu.isMaximized = isMaximized ?? false;
          },
          false,
          "appMenuSlice/hydrate",
        );
      } catch (_error) {
        // Silently handle - IPC handlers may not be ready during initial load
        set(
          ({ appMenu }) => {
            appMenu.isMaximized = false;
          },
          false,
          "appMenuSlice/hydrate",
        );
      }
    },

    // Window control actions
    minimize: () => {
      window.electron?.mainWindow.minimize();
    },

    maximize: async () => {
      await window.electron?.mainWindow.maximize();
      const newState = await window.electron?.mainWindow.isMaximized();
      set(
        ({ appMenu }) => {
          appMenu.isMaximized = newState ?? false;
        },
        false,
        "appMenuSlice/maximize",
      );
    },

    unmaximize: async () => {
      await window.electron?.mainWindow.unmaximize();
      const newState = await window.electron?.mainWindow.isMaximized();
      set(
        ({ appMenu }) => {
          appMenu.isMaximized = newState ?? false;
        },
        false,
        "appMenuSlice/unmaximize",
      );
    },

    close: () => {
      window.electron?.mainWindow.close();
    },

    setIsMaximized: (isMaximized) => {
      set(
        ({ appMenu }) => {
          appMenu.isMaximized = isMaximized;
        },
        false,
        "appMenuSlice/setIsMaximized",
      );
    },

    // What's New modal actions
    openWhatsNew: async () => {
      set(
        ({ appMenu }) => {
          appMenu.isWhatsNewOpen = true;
        },
        false,
        "appMenuSlice/openWhatsNew",
      );

      // Skip fetch if we already have the release info
      if (get().appMenu.whatsNewHasFetched && get().appMenu.whatsNewRelease) {
        return;
      }

      set(
        ({ appMenu }) => {
          appMenu.whatsNewIsLoading = true;
          appMenu.whatsNewError = null;
        },
        false,
        "appMenuSlice/openWhatsNew/fetchStart",
      );

      try {
        const result = await window.electron.updater.getLatestRelease();

        if (result) {
          set(
            ({ appMenu }) => {
              appMenu.whatsNewRelease = result;
              appMenu.whatsNewIsLoading = false;
              appMenu.whatsNewHasFetched = true;
            },
            false,
            "appMenuSlice/openWhatsNew/fetchSuccess",
          );
        } else {
          set(
            ({ appMenu }) => {
              appMenu.whatsNewError = "Could not fetch release information.";
              appMenu.whatsNewIsLoading = false;
              appMenu.whatsNewHasFetched = true;
            },
            false,
            "appMenuSlice/openWhatsNew/fetchEmpty",
          );
        }
      } catch (err) {
        set(
          ({ appMenu }) => {
            appMenu.whatsNewError = (err as Error).message;
            appMenu.whatsNewIsLoading = false;
            appMenu.whatsNewHasFetched = true;
          },
          false,
          "appMenuSlice/openWhatsNew/fetchError",
        );
      }
    },

    closeWhatsNew: () => {
      set(
        ({ appMenu }) => {
          appMenu.isWhatsNewOpen = false;
        },
        false,
        "appMenuSlice/closeWhatsNew",
      );
    },
  },
});
