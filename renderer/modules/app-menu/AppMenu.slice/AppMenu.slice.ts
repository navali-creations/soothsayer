import type { StateCreator } from "zustand";

import type { LatestReleaseInfo } from "~/main/modules/updater/Updater.api";
import type { BoundStore } from "~/renderer/store/store.types";

import {
  getWhatsNewReleasesForView,
  selectInitialWhatsNewRelease,
} from "../AppMenu.utils/AppMenu.utils";

async function persistLastSeenAppVersion(version: string): Promise<void> {
  await window.electron?.settings.set("lastSeenAppVersion", version);
}

export interface AppMenuSlice {
  appMenu: {
    // State
    isMaximized: boolean;
    isWhatsNewOpen: boolean;
    whatsNewRelease: LatestReleaseInfo | null;
    whatsNewReleases: LatestReleaseInfo[];
    whatsNewSelectedVersion: string | null;
    whatsNewIsLoading: boolean;
    whatsNewError: string | null;
    whatsNewHasFetched: boolean;
    whatsNewFromVersion: string | null;
    whatsNewCurrentVersion: string | null;

    // Actions
    hydrate: () => Promise<void>;
    minimize: () => void;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    close: () => void;
    setIsMaximized: (isMaximized: boolean) => void;
    openWhatsNew: () => Promise<void>;
    closeWhatsNew: () => void;
    selectWhatsNewRelease: (version: string) => void;
  };
}

export const createAppMenuSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  AppMenuSlice
> = (set, get) => ({
  appMenu: {
    // Initial state
    isMaximized: false,
    isWhatsNewOpen: false,
    whatsNewRelease: null,
    whatsNewReleases: [],
    whatsNewSelectedVersion: null,
    whatsNewIsLoading: false,
    whatsNewError: null,
    whatsNewHasFetched: false,
    whatsNewFromVersion: null,
    whatsNewCurrentVersion: null,

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

      // Detect post-update launch: compare current version with last seen version
      try {
        const currentVersion = await window.electron?.app.getVersion();
        console.log(currentVersion);
        if (currentVersion) {
          const lastSeenVersion =
            await window.electron?.settings.get("lastSeenAppVersion");

          if (lastSeenVersion && lastSeenVersion !== currentVersion) {
            set(
              ({ appMenu }) => {
                appMenu.whatsNewFromVersion = lastSeenVersion;
                appMenu.whatsNewCurrentVersion = currentVersion;
              },
              false,
              "appMenuSlice/hydrate/whatsNewVersions",
            );

            // User just updated — show What's New after a short delay
            setTimeout(() => {
              get().appMenu.openWhatsNew();
            }, 3000);

            return;
          }

          await persistLastSeenAppVersion(currentVersion);
        }
      } catch (_error) {
        // Silently handle — version check is non-critical
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
      if (
        get().appMenu.whatsNewHasFetched &&
        get().appMenu.whatsNewRelease &&
        get().appMenu.whatsNewReleases.length > 0
      ) {
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
        const recentReleases =
          await window.electron.updater.getRecentReleases();
        const { whatsNewFromVersion, whatsNewCurrentVersion } = get().appMenu;
        const releases = getWhatsNewReleasesForView(
          recentReleases,
          whatsNewFromVersion,
          whatsNewCurrentVersion,
        );
        const result = selectInitialWhatsNewRelease(
          releases,
          !!whatsNewFromVersion,
        );

        if (result) {
          set(
            ({ appMenu }) => {
              appMenu.whatsNewRelease = result;
              appMenu.whatsNewReleases = releases;
              appMenu.whatsNewSelectedVersion = result.version;
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
              appMenu.whatsNewReleases = [];
              appMenu.whatsNewSelectedVersion = null;
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
            appMenu.whatsNewReleases = [];
            appMenu.whatsNewSelectedVersion = null;
            appMenu.whatsNewIsLoading = false;
            appMenu.whatsNewHasFetched = true;
          },
          false,
          "appMenuSlice/openWhatsNew/fetchError",
        );
      }
    },

    closeWhatsNew: () => {
      const { whatsNewCurrentVersion, whatsNewReleases } = get().appMenu;
      const versionToMarkSeen =
        whatsNewCurrentVersion && whatsNewReleases.length > 0
          ? whatsNewCurrentVersion
          : null;

      set(
        ({ appMenu }) => {
          const latestRelease = appMenu.whatsNewReleases.at(-1);
          if (latestRelease) {
            appMenu.whatsNewRelease = latestRelease;
            appMenu.whatsNewSelectedVersion = latestRelease.version;
          }
          appMenu.whatsNewFromVersion = null;
          appMenu.whatsNewCurrentVersion = null;
          appMenu.isWhatsNewOpen = false;
        },
        false,
        "appMenuSlice/closeWhatsNew",
      );

      if (versionToMarkSeen) {
        void persistLastSeenAppVersion(versionToMarkSeen).catch(
          () => undefined,
        );
      }
    },

    selectWhatsNewRelease: (version: string) => {
      set(
        ({ appMenu }) => {
          const release = appMenu.whatsNewReleases.find(
            (candidate) => candidate.version === version,
          );

          if (!release) {
            return;
          }

          appMenu.whatsNewRelease = release;
          appMenu.whatsNewSelectedVersion = release.version;
        },
        false,
        "appMenuSlice/selectWhatsNewRelease",
      );
    },
  },
});
