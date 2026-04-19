import type { StateCreator } from "zustand";

import type { BoundStore } from "~/renderer/store/store.types";

export interface BannersSlice {
  banners: {
    /** Set of banner IDs that have been permanently dismissed. */
    dismissedIds: Set<string>;

    /** Whether the initial load from the DB has completed. */
    isLoaded: boolean;

    /** Load all dismissed banner IDs from the database. */
    loadDismissed: () => Promise<void>;

    /** Permanently dismiss a banner (persists to DB). */
    dismiss: (bannerId: string) => Promise<void>;

    /** Check if a specific banner has been dismissed. */
    isDismissed: (bannerId: string) => boolean;
  };
}

export const createBannersSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  BannersSlice
> = (set, get) => ({
  banners: {
    dismissedIds: new Set<string>(),
    isLoaded: false,

    loadDismissed: async () => {
      try {
        const ids = await window.electron.banners.getAllDismissed();
        set(
          ({ banners }) => {
            banners.dismissedIds = new Set(ids);
            banners.isLoaded = true;
          },
          false,
          "bannersSlice/loadDismissed/success",
        );
      } catch (error) {
        console.error(
          "[BannersSlice] Failed to load dismissed banners:",
          error,
        );
        set(
          ({ banners }) => {
            banners.isLoaded = true;
          },
          false,
          "bannersSlice/loadDismissed/error",
        );
      }
    },

    dismiss: async (bannerId: string) => {
      // Optimistically update the UI
      set(
        ({ banners }) => {
          banners.dismissedIds = new Set([...banners.dismissedIds, bannerId]);
        },
        false,
        "bannersSlice/dismiss/optimistic",
      );

      try {
        await window.electron.banners.dismiss(bannerId);
      } catch (error) {
        console.error("[BannersSlice] Failed to dismiss banner:", error);
        // Revert on failure
        set(
          ({ banners }) => {
            const next = new Set(banners.dismissedIds);
            next.delete(bannerId);
            banners.dismissedIds = next;
          },
          false,
          "bannersSlice/dismiss/revert",
        );
      }
    },

    isDismissed: (bannerId: string) => {
      return get().banners.dismissedIds.has(bannerId);
    },
  },
});
