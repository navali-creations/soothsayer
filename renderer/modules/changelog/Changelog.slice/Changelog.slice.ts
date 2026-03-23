import type { StateCreator } from "zustand";

import type { ChangelogRelease } from "~/main/modules/updater/Updater.api";

export interface ChangelogSlice {
  changelog: {
    // State
    releases: ChangelogRelease[];
    isLoading: boolean;
    error: string | null;
    hasFetched: boolean;

    // Actions
    fetchChangelog: () => Promise<void>;
    reset: () => void;
  };
}

export const createChangelogSlice: StateCreator<
  ChangelogSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  ChangelogSlice
> = (set, get) => ({
  changelog: {
    // Initial state
    releases: [],
    isLoading: false,
    error: null,
    hasFetched: false,

    // Fetch parsed changelog from main process
    fetchChangelog: async () => {
      // Skip if already fetched successfully
      if (get().changelog.hasFetched && get().changelog.releases.length > 0)
        return;

      set(
        ({ changelog }) => {
          changelog.isLoading = true;
          changelog.error = null;
        },
        false,
        "changelogSlice/fetchChangelog/start",
      );

      try {
        const result = await window.electron.updater.getChangelog();

        if (result.success) {
          set(
            ({ changelog }) => {
              changelog.releases = result.releases;
              changelog.isLoading = false;
              changelog.hasFetched = true;
            },
            false,
            "changelogSlice/fetchChangelog/success",
          );
        } else {
          set(
            ({ changelog }) => {
              changelog.error = result.error ?? "Failed to load changelog";
              changelog.isLoading = false;
              changelog.hasFetched = true;
            },
            false,
            "changelogSlice/fetchChangelog/error",
          );
        }
      } catch (err) {
        set(
          ({ changelog }) => {
            changelog.error = (err as Error).message;
            changelog.isLoading = false;
            changelog.hasFetched = true;
          },
          false,
          "changelogSlice/fetchChangelog/error",
        );
      }
    },

    // Reset changelog state
    reset: () => {
      set(
        ({ changelog }) => {
          changelog.releases = [];
          changelog.isLoading = false;
          changelog.error = null;
          changelog.hasFetched = false;
        },
        false,
        "changelogSlice/reset",
      );
    },
  },
});
