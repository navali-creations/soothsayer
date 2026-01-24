import type { StateCreator } from "zustand";

import type { DetailedDivinationCardStats } from "~/types/data-stores";

import type { SettingsSlice } from "../settings/Settings.slice";

export type PriceSource = "exchange" | "stash";

export interface SessionDetailsSlice {
  sessionDetails: {
    // State
    session: DetailedDivinationCardStats | null;
    isLoading: boolean;
    error: string | null;
    priceSource: PriceSource;

    // Actions
    loadSession: (sessionId: string) => Promise<void>;
    clearSession: () => void;
    setPriceSource: (source: PriceSource) => void;
    toggleCardPriceVisibility: (
      cardName: string,
      priceSource: PriceSource,
    ) => Promise<void>;

    // Getters
    getSession: () => DetailedDivinationCardStats | null;
    getIsLoading: () => boolean;
    getError: () => string | null;
    getPriceSource: () => PriceSource;
  };
}

export const createSessionDetailsSlice: StateCreator<
  SessionDetailsSlice & SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SessionDetailsSlice
> = (set, get) => ({
  sessionDetails: {
    // Initial state
    session: null,
    isLoading: false,
    error: null,
    priceSource: "exchange",

    // Load session by ID
    loadSession: async (sessionId: string) => {
      set(({ sessionDetails }) => {
        sessionDetails.isLoading = true;
        sessionDetails.error = null;
      });

      try {
        const session = await window.electron.sessions.getById(sessionId);

        set(({ sessionDetails }) => {
          sessionDetails.session = session;
          sessionDetails.isLoading = false;
        });
      } catch (error) {
        console.error("[SessionDetailSlice] Failed to load session:", error);
        set(({ sessionDetails }) => {
          sessionDetails.error = (error as Error).message;
          sessionDetails.isLoading = false;
        });
      }
    },

    // Clear session when navigating away
    clearSession: () => {
      set(({ sessionDetails }) => {
        sessionDetails.session = null;
        sessionDetails.error = null;
      });
    },

    // Set price source (exchange/stash)
    setPriceSource: (source: PriceSource) => {
      set(({ sessionDetails }) => {
        sessionDetails.priceSource = source;
      });
    },

    // Toggle card price visibility
    toggleCardPriceVisibility: async (
      cardName: string,
      priceSource: PriceSource,
    ) => {
      const { sessionDetails, settings } = get();
      const session = sessionDetails.session;

      if (!session || !session.cards) return;

      const card = session.cards.find((c) => c.name === cardName);
      if (!card) return;

      const priceKey =
        priceSource === "exchange" ? "exchangePrice" : "stashPrice";
      const currentHidePrice = card[priceKey]?.hidePrice || false;

      // Optimistically update UI
      set(({ sessionDetails }) => {
        const card = sessionDetails.session?.cards?.find(
          (c) => c.name === cardName,
        );
        if (card?.[priceKey]) {
          card[priceKey]!.hidePrice = !currentHidePrice;
        }
      });

      // Persist to backend
      const activeGame = settings.getSelectedGame();
      if (activeGame && session.startedAt) {
        try {
          await window.electron.session.updateCardPriceVisibility(
            activeGame as any,
            sessionDetails.session?.startedAt || "", // Use session ID if available
            priceSource,
            cardName,
            !currentHidePrice,
          );
        } catch (error) {
          console.error("Failed to update price visibility:", error);
          // Revert optimistic update on error
          set(({ sessionDetails }) => {
            const card = sessionDetails.session?.cards?.find(
              (c) => c.name === cardName,
            );
            if (card?.[priceKey]) {
              card[priceKey]!.hidePrice = currentHidePrice;
            }
          });
        }
      }
    },

    // Getters
    getSession: () => get().sessionDetails.session,
    getIsLoading: () => get().sessionDetails.isLoading,
    getError: () => get().sessionDetails.error,
    getPriceSource: () => get().sessionDetails.priceSource,
  },
});
