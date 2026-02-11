import type { StateCreator } from "zustand";

import type {
  DownloadProgress,
  UpdateInfo,
  UpdateStatus,
} from "~/main/modules/updater/Updater.service";

export interface UpdaterSlice {
  updater: {
    // State
    updateInfo: UpdateInfo | null;
    updateAvailable: boolean;
    isDismissed: boolean;
    status: UpdateStatus;
    downloadProgress: DownloadProgress;
    error: string | null;

    // Actions
    checkForUpdates: () => Promise<void>;
    downloadAndInstall: () => Promise<void>;
    dismiss: () => void;
    startListening: () => () => void;
  };
}

export const createUpdaterSlice: StateCreator<
  UpdaterSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  UpdaterSlice
> = (set, get) => ({
  updater: {
    // Initial state
    updateInfo: null,
    updateAvailable: false,
    isDismissed: false,
    status: "idle",
    downloadProgress: { percent: 0, transferredBytes: 0, totalBytes: 0 },
    error: null,

    // Manually trigger an update check
    checkForUpdates: async () => {
      try {
        const info = await window.electron?.updater.checkForUpdates();
        if (info?.updateAvailable) {
          set(
            ({ updater }) => {
              updater.updateInfo = info;
              updater.updateAvailable = true;
              updater.isDismissed = false;
              updater.status = "idle";
              updater.error = null;
            },
            false,
            "updaterSlice/checkForUpdates",
          );
        }
      } catch (error) {
        console.error("[Updater] Failed to check for updates:", error);
      }
    },

    // Install the already-downloaded update (Squirrel downloads automatically).
    // With autoUpdater the flow is:
    //   1. autoUpdater.checkForUpdates() triggers a background download
    //   2. "update-downloaded" event fires → status becomes "ready"
    //   3. User clicks → installUpdate → autoUpdater.quitAndInstall()
    //
    // If the update hasn't finished downloading yet (status is "downloading"),
    // we just wait — the UI already shows a progress indicator.
    downloadAndInstall: async () => {
      const { status } = get().updater;

      // Already downloaded → go straight to install (quit & restart)
      if (status === "ready") {
        set(
          ({ updater }) => {
            updater.error = null;
          },
          false,
          "updaterSlice/installUpdate",
        );

        const installResult = await window.electron?.updater.installUpdate();
        if (!installResult?.success) {
          set(
            ({ updater }) => {
              updater.status = "error";
              updater.error = installResult?.error ?? "Install failed";
            },
            false,
            "updaterSlice/installUpdateError",
          );
        }
        // If success, the app will quit — no further state updates needed
        return;
      }

      // Still downloading — nothing to do, the UI already shows progress
      if (status === "downloading") {
        return;
      }

      // If idle or error, trigger a fresh check (which auto-downloads)
      set(
        ({ updater }) => {
          updater.error = null;
          updater.status = "idle";
        },
        false,
        "updaterSlice/retryCheck",
      );

      try {
        const info = await window.electron?.updater.checkForUpdates();
        if (info?.updateAvailable) {
          set(
            ({ updater }) => {
              updater.updateInfo = info;
              updater.updateAvailable = true;
            },
            false,
            "updaterSlice/retryCheckResult",
          );
        }
      } catch (error) {
        console.error("[Updater] Retry check failed:", error);
        set(
          ({ updater }) => {
            updater.status = "error";
            updater.error = "Failed to check for updates";
          },
          false,
          "updaterSlice/retryCheckError",
        );
      }
    },

    // Dismiss the update indicator
    dismiss: () => {
      set(
        ({ updater }) => {
          updater.isDismissed = true;
        },
        false,
        "updaterSlice/dismiss",
      );
    },

    // Listen for events pushed from the main process
    startListening: () => {
      const cleanups: (() => void)[] = [];

      // Listen for update-available events (fired after download completes)
      if (window.electron?.updater?.onUpdateAvailable) {
        const cleanup = window.electron.updater.onUpdateAvailable(
          (info: UpdateInfo) => {
            set(
              ({ updater }) => {
                updater.updateInfo = info;
                updater.updateAvailable = true;
                updater.isDismissed = false;
                updater.status = "ready";
              },
              false,
              "updaterSlice/onUpdateAvailable",
            );
          },
        );
        cleanups.push(cleanup);
      }

      // Listen for download progress events
      if (window.electron?.updater?.onDownloadProgress) {
        const cleanup = window.electron.updater.onDownloadProgress(
          (progress: DownloadProgress) => {
            set(
              ({ updater }) => {
                updater.downloadProgress = progress;
                // If we're getting progress, we're downloading
                if (progress.percent < 100) {
                  updater.status = "downloading";
                }
              },
              false,
              "updaterSlice/onDownloadProgress",
            );
          },
        );
        cleanups.push(cleanup);
      }

      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    },
  },
});
