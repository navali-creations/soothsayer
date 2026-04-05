import type { StateCreator } from "zustand";

import type { BoundStore } from "~/renderer/store/store.types";
import type {
  AggregatedTimeline,
  CardPriceSnapshot,
  DetailedDivinationCardStats,
} from "~/types/data-stores";

import type { CardEntry } from "../SessionDetails.types";

export type PriceSource = "exchange" | "stash";

export interface SessionDetailsSlice {
  sessionDetails: {
    // State
    session: DetailedDivinationCardStats | null;
    timeline: AggregatedTimeline | null;
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
    getTimeline: () => AggregatedTimeline | null;
    getIsLoading: () => boolean;
    getError: () => string | null;
    getPriceSource: () => PriceSource;
    getCardData: () => CardEntry[];
    getPriceData: () => {
      chaosToDivineRatio: number;
      cardPrices: Record<string, CardPriceSnapshot>;
    };
    getTotalProfit: () => number;
    getNetProfit: () => { netProfit: number; totalDeckCost: number };
    getDuration: () => string;
    getHasTimeline: () => boolean;
  };
}

export const createSessionDetailsSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SessionDetailsSlice
> = (set, get) => ({
  sessionDetails: {
    // Initial state
    session: null,
    timeline: null,
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
        const timeline = await window.electron.session.getTimeline(sessionId);

        set(({ sessionDetails }) => {
          sessionDetails.session = session;
          sessionDetails.timeline = timeline;
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
        sessionDetails.timeline = null;
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

      if (!session?.cards) return;

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
      const sessionId = session.id;
      if (activeGame && sessionId) {
        try {
          await window.electron.session.updateCardPriceVisibility(
            activeGame as any,
            sessionId,
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
    getTimeline: () => get().sessionDetails.timeline,
    getIsLoading: () => get().sessionDetails.isLoading,
    getError: () => get().sessionDetails.error,
    getPriceSource: () => get().sessionDetails.priceSource,

    getCardData: () => {
      const { session, priceSource } = get().sessionDetails;
      if (!session?.cards) return [];

      return session.cards
        .map((entry) => {
          const priceInfo =
            priceSource === "exchange" ? entry.exchangePrice : entry.stashPrice;

          const chaosValue = priceInfo?.chaosValue || 0;
          const totalValue = priceInfo?.totalValue || 0;
          const hidePrice = priceInfo?.hidePrice || false;

          return {
            name: entry.name,
            count: entry.count,
            ratio: (entry.count / session.totalCount) * 100,
            chaosValue,
            totalValue,
            hidePrice,
            divinationCard: entry.divinationCard,
          };
        })
        .sort((a, b) => b.count - a.count);
    },

    getPriceData: () => {
      const { session, priceSource } = get().sessionDetails;
      if (!session?.priceSnapshot) {
        return { chaosToDivineRatio: 0, cardPrices: {} };
      }
      const source =
        priceSource === "stash"
          ? session.priceSnapshot.stash
          : session.priceSnapshot.exchange;
      return {
        chaosToDivineRatio: source.chaosToDivineRatio,
        cardPrices: source.cardPrices,
      };
    },

    getTotalProfit: () => {
      const cardData = get().sessionDetails.getCardData();
      return cardData.reduce((sum, card) => {
        if (card.hidePrice) return sum;
        return sum + card.totalValue;
      }, 0);
    },

    getNetProfit: () => {
      const { session } = get().sessionDetails;
      const totalProfit = get().sessionDetails.getTotalProfit();
      const deckCost = session?.priceSnapshot?.stackedDeckChaosCost ?? 0;
      const deckCount = session?.totalCount ?? 0;
      const cost = deckCost * deckCount;
      return {
        netProfit: totalProfit - cost,
        totalDeckCost: cost,
      };
    },

    getDuration: () => {
      const session = get().sessionDetails.session;
      return session?.duration ?? "—";
    },

    getHasTimeline: () => {
      const timeline = get().sessionDetails.timeline;
      return !!(timeline && timeline.buckets.length > 0);
    },
  },
});
