import type { StateCreator } from "zustand";

export interface AppMenuSlice {
  appMenu: {
    // State
    isMaximized: boolean;

    // Actions
    hydrate: () => Promise<void>;
    minimize: () => void;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    close: () => void;
    setIsMaximized: (isMaximized: boolean) => void;
  };
}

export const createAppMenuSlice: StateCreator<
  AppMenuSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  AppMenuSlice
> = (set) => ({
  appMenu: {
    // Initial state
    isMaximized: false,

    // Hydrate initial maximized state from Electron
    hydrate: async () => {
      try {
        const isMaximized = await window.electron?.app.isMaximized();
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
      window.electron?.app.minimize();
    },

    maximize: async () => {
      await window.electron?.app.maximize();
      const newState = await window.electron?.app.isMaximized();
      set(
        ({ appMenu }) => {
          appMenu.isMaximized = newState ?? false;
        },
        false,
        "appMenuSlice/maximize",
      );
    },

    unmaximize: async () => {
      await window.electron?.app.unmaximize();
      const newState = await window.electron?.app.isMaximized();
      set(
        ({ appMenu }) => {
          appMenu.isMaximized = newState ?? false;
        },
        false,
        "appMenuSlice/unmaximize",
      );
    },

    close: () => {
      window.electron?.app.close();
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
  },
});
