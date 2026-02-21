import type { StateCreator } from "zustand";

import type { ProhibitedLibraryStatusDTO } from "~/main/modules/prohibited-library/ProhibitedLibrary.dto";

import type { CardsSlice } from "../cards/Cards.slice";
import type { SettingsSlice } from "../settings/Settings.slice";

export interface ProhibitedLibrarySlice {
  prohibitedLibrary: {
    // State
    poe1Status: ProhibitedLibraryStatusDTO | null;
    poe2Status: ProhibitedLibraryStatusDTO | null;
    isLoading: boolean;
    loadError: string | null;

    // Actions
    fetchStatus: () => Promise<void>;
    reload: () => Promise<void>;
    startListening: () => () => void;
  };
}

export const createProhibitedLibrarySlice: StateCreator<
  ProhibitedLibrarySlice & SettingsSlice & CardsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  ProhibitedLibrarySlice
> = (set, get) => ({
  prohibitedLibrary: {
    // Initial state
    poe1Status: null,
    poe2Status: null,
    isLoading: false,
    loadError: null,

    // Fetch status for both poe1 and poe2 in parallel
    fetchStatus: async () => {
      set(
        ({ prohibitedLibrary }) => {
          prohibitedLibrary.isLoading = true;
          prohibitedLibrary.loadError = null;
        },
        false,
        "prohibitedLibrarySlice/fetchStatus/start",
      );

      try {
        const [poe1Status, poe2Status] = await Promise.all([
          window.electron.prohibitedLibrary.getStatus("poe1"),
          window.electron.prohibitedLibrary.getStatus("poe2"),
        ]);

        set(
          ({ prohibitedLibrary }) => {
            prohibitedLibrary.poe1Status = poe1Status;
            prohibitedLibrary.poe2Status = poe2Status;
            prohibitedLibrary.isLoading = false;
          },
          false,
          "prohibitedLibrarySlice/fetchStatus/success",
        );
      } catch (error) {
        console.error(
          "[ProhibitedLibrarySlice] Failed to fetch status:",
          error,
        );
        set(
          ({ prohibitedLibrary }) => {
            prohibitedLibrary.isLoading = false;
            prohibitedLibrary.loadError =
              error instanceof Error
                ? error.message
                : "Failed to fetch Prohibited Library status";
          },
          false,
          "prohibitedLibrarySlice/fetchStatus/error",
        );
      }
    },

    // Reload PL data for the active game (derives game from settings slice)
    reload: async () => {
      const activeGame = get().settings.getSelectedGame();

      set(
        ({ prohibitedLibrary }) => {
          prohibitedLibrary.isLoading = true;
          prohibitedLibrary.loadError = null;
        },
        false,
        "prohibitedLibrarySlice/reload/start",
      );

      try {
        const result =
          await window.electron.prohibitedLibrary.reload(activeGame);

        if (!result.success) {
          set(
            ({ prohibitedLibrary }) => {
              prohibitedLibrary.isLoading = false;
              prohibitedLibrary.loadError =
                result.error ?? "Reload failed with unknown error";
            },
            false,
            "prohibitedLibrarySlice/reload/failed",
          );
          return;
        }

        // Refresh status after successful reload
        await get().prohibitedLibrary.fetchStatus();

        // Reload cards so UI reflects updated PL rarities
        await get().cards.loadCards();
      } catch (error) {
        console.error(
          "[ProhibitedLibrarySlice] Failed to reload PL data:",
          error,
        );
        set(
          ({ prohibitedLibrary }) => {
            prohibitedLibrary.isLoading = false;
            prohibitedLibrary.loadError =
              error instanceof Error
                ? error.message
                : "Failed to reload Prohibited Library data";
          },
          false,
          "prohibitedLibrarySlice/reload/error",
        );
      }
    },

    // Subscribe to IPC events from main process
    startListening: () => {
      const unsubscribeDataRefreshed =
        window.electron?.prohibitedLibrary?.onDataRefreshed?.((_game) => {
          // Refresh status and reload cards when PL data changes
          const { prohibitedLibrary, cards } = get();
          prohibitedLibrary.fetchStatus();
          cards.loadCards();
        });

      const unsubscribeLoadError =
        window.electron?.prohibitedLibrary?.onLoadError?.((error) => {
          console.error(
            "[ProhibitedLibrarySlice] Load error from main:",
            error,
          );
          set(
            ({ prohibitedLibrary }) => {
              prohibitedLibrary.loadError = error;
            },
            false,
            "prohibitedLibrarySlice/onLoadError",
          );
        });

      return () => {
        unsubscribeDataRefreshed?.();
        unsubscribeLoadError?.();
      };
    },
  },
});
