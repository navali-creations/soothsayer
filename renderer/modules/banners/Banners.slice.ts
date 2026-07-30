import type { StateCreator } from "zustand";

import type { BannerId } from "~/main/modules/banners/Banners.types";
import type { BoundStore } from "~/renderer/store/store.types";

type BannersLoadStatus = "idle" | "loading" | "ready" | "error";

const LOAD_RETRY_DELAYS_MS = [100, 500];

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

export interface BannersSlice {
  banners: {
    /** Set of banner IDs that have been permanently dismissed. */
    dismissedIds: Set<BannerId>;

    /** State of the persisted-dismissal hydration. */
    loadStatus: BannersLoadStatus;

    /** Load all dismissed banner IDs from the database. */
    loadDismissed: () => Promise<void>;

    /** Permanently dismiss a banner (persists to DB). */
    dismiss: (bannerId: BannerId) => Promise<boolean>;

    /** Reflect a dismissal already committed atomically by another main workflow. */
    markDismissed: (bannerId: BannerId) => void;
  };
}

export const createBannersSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  BannersSlice
> = (set, get) => ({
  banners: {
    dismissedIds: new Set<BannerId>(),
    loadStatus: "idle",

    loadDismissed: async () => {
      set(
        ({ banners }) => {
          banners.loadStatus = "loading";
        },
        false,
        "bannersSlice/loadDismissed/start",
      );

      for (
        let attempt = 0;
        attempt <= LOAD_RETRY_DELAYS_MS.length;
        attempt += 1
      ) {
        if (attempt > 0) {
          await wait(LOAD_RETRY_DELAYS_MS[attempt - 1]);
        }

        try {
          const result = await window.electron.banners.getAllDismissed();
          if (!result.success) {
            throw new Error(result.error);
          }

          set(
            ({ banners }) => {
              banners.dismissedIds = new Set(result.bannerIds);
              banners.loadStatus = "ready";
            },
            false,
            "bannersSlice/loadDismissed/success",
          );
          return;
        } catch {}
      }

      console.error("[BannersSlice] Failed to load dismissed banners.");
      set(
        ({ banners }) => {
          banners.loadStatus = "error";
        },
        false,
        "bannersSlice/loadDismissed/error",
      );
    },

    dismiss: async (bannerId: BannerId) => {
      const wasDismissed = get().banners.dismissedIds.has(bannerId);

      // Optimistically update the UI
      set(
        ({ banners }) => {
          banners.dismissedIds = new Set([...banners.dismissedIds, bannerId]);
        },
        false,
        "bannersSlice/dismiss/optimistic",
      );

      try {
        const result = await window.electron.banners.dismiss(bannerId);
        if (!result.success) {
          throw new Error(result.error);
        }
        return true;
      } catch {
        console.error("[BannersSlice] Failed to dismiss banner.");
        // Revert on failure
        if (!wasDismissed) {
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
        return false;
      }
    },

    markDismissed: (bannerId: BannerId) => {
      set(
        ({ banners }) => {
          banners.dismissedIds = new Set([...banners.dismissedIds, bannerId]);
        },
        false,
        "bannersSlice/markDismissed",
      );
    },
  },
});
