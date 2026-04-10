import type { StateCreator } from "zustand";

import type {
  CardDropTimelinePointDTO,
  CardPersonalAnalyticsDTO,
  CardPriceHistoryDTO,
  PriceChangeSummary,
  RelatedCardsResultDTO,
} from "~/main/modules/card-details/CardDetails.dto";
import type { DivinationCardDTO } from "~/main/modules/divination-cards/DivinationCards.dto";
import type { SessionsPage } from "~/main/modules/sessions/Sessions.api";
import type { BoundStore } from "~/renderer/store/store.types";
import type { GameType, Rarity } from "~/types/data-stores";

import type {
  SessionSortColumn,
  SessionSortDirection,
  SessionSortState,
} from "../CardDetails.components/CardDetailsSessionList/types";

export type CardDetailsTab = "market" | "your-data";

export interface CardDetailsSlice {
  cardDetails: {
    // ─── Card State (resolved from slug) ────────────────────────────────
    /** The resolved divination card, or null if not yet loaded / not found. */
    card: DivinationCardDTO | null;
    /** Whether the card (and initial data) is currently being loaded. */
    isLoadingCard: boolean;
    /** Error message if card resolution failed. */
    cardError: string | null;

    // ─── Price History State ────────────────────────────────────────────
    priceHistory: CardPriceHistoryDTO | null;
    isLoadingPriceHistory: boolean;
    priceHistoryError: string | null;

    // ─── Personal Analytics State ──────────────────────────────────────
    personalAnalytics: CardPersonalAnalyticsDTO | null;
    isLoadingPersonalAnalytics: boolean;
    personalAnalyticsError: string | null;

    // ─── Sessions List State ───────────────────────────────────────────
    sessions: SessionsPage | null;
    isLoadingSessions: boolean;
    sessionsError: string | null;
    sessionsPage: number;
    sessionsSortState: SessionSortState;

    // ─── Related Cards State ───────────────────────────────────────────
    relatedCards: RelatedCardsResultDTO | null;
    isLoadingRelatedCards: boolean;

    // ─── Page-Local UI State ───────────────────────────────────────────
    /** The currently selected league filter on the card details page.
     *  "all" means no filtering (aggregate across all leagues). */
    selectedLeague: string;
    /** Whether a league switch is in progress (for loading overlays). */
    isLeagueSwitching: boolean;
    /** The active tab on the card details page. */
    activeTab: CardDetailsTab;

    // ─── Actions ────────────────────────────────────────────────────────

    /**
     * Unified initializer — resolves a card by URL slug and fetches
     * personal analytics + related cards in a single IPC round-trip.
     *
     * Called once when the card details page mounts (or when game/slug changes).
     * Replaces the previous pattern of separate `resolveCard` + `fetchPersonalAnalytics`
     * + `fetchRelatedCards` effects.
     */
    initializeCardDetails: (
      game: GameType,
      cardSlug: string,
      selectedLeague: string,
    ) => Promise<void>;

    /**
     * Re-fetch only personal analytics (e.g. on league switch).
     * Lighter than full init — card & related cards are unchanged.
     */
    refreshPersonalAnalytics: (
      game: GameType,
      cardName: string,
      selectedLeague: string,
    ) => Promise<void>;

    /** Update the selected league filter. Resets to "all" on clear. */
    setSelectedLeague: (league: string) => void;
    /** Switch the active tab. */
    setActiveTab: (tab: CardDetailsTab) => void;
    fetchPriceHistory: (
      game: GameType,
      league: string,
      cardName: string,
    ) => Promise<void>;
    fetchPersonalAnalytics: (
      game: GameType,
      league: string,
      cardName: string,
      selectedLeague?: string,
    ) => Promise<void>;
    fetchSessionsForCard: (
      game: GameType,
      cardName: string,
      page?: number,
      pageSize?: number,
      league?: string,
    ) => Promise<void>;
    /** Update the session list sort column/direction and re-fetch. */
    setSessionsSort: (
      column: SessionSortColumn,
      game: GameType,
      cardName: string,
      league?: string,
    ) => void;
    fetchRelatedCards: (game: GameType, cardName: string) => Promise<void>;
    clearCardDetails: () => void;

    // ─── Getters (Card) ─────────────────────────────────────────────────
    /** Get the resolved display rarity (PL → DTO PL → poe.ninja → fallback 4). */
    getDisplayRarity: () => Rarity;

    // ─── Getters (Price) ────────────────────────────────────────────────
    getPriceHistory: () => CardPriceHistoryDTO | null;
    getIsLoadingPriceHistory: () => boolean;
    getPriceHistoryError: () => string | null;
    getPriceChanges: () => PriceChangeSummary;
    getFullSetValue: () => number | null;
    getFullSetChaosValue: () => number | null;

    // ─── Getters (Personal Analytics) ───────────────────────────────────
    getPersonalAnalytics: () => CardPersonalAnalyticsDTO | null;
    getDropTimeline: () => CardDropTimelinePointDTO[];
    /** Derive the list of leagues the user has session data in. */
    getAvailableLeagues: () => string[];

    /**
     * Compare the user's actual drop rate against the statistical expectation.
     *
     * @param probability - The correct probability from the profit forecast row.
     * @returns Luck comparison data, or null if insufficient data.
     */
    getLuckComparison: (probability: number) => {
      expectedDrops: number;
      actualDrops: number;
      luckRatio: number;
      label: string;
      color: "success" | "error" | "warning";
      hasSufficientData: boolean;
    } | null;
  };
}

/** Minimum total decks before "Your Luck" comparison is meaningful. */
const MIN_DECKS_FOR_LUCK = 100;

export const createCardDetailsSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  CardDetailsSlice
> = (set, get) => ({
  cardDetails: {
    // ─── Initial State ───────────────────────────────────────────────────
    card: null,
    isLoadingCard: false,
    cardError: null,

    priceHistory: null,
    isLoadingPriceHistory: false,
    priceHistoryError: null,

    personalAnalytics: null,
    isLoadingPersonalAnalytics: false,
    personalAnalyticsError: null,

    sessions: null,
    isLoadingSessions: false,
    sessionsError: null,
    sessionsPage: 1,
    sessionsSortState: { column: "date", direction: "desc" },

    relatedCards: null,
    isLoadingRelatedCards: false,

    selectedLeague: "all",
    isLeagueSwitching: false,
    activeTab: "your-data",

    // ─── Unified Initializer ─────────────────────────────────────────────

    initializeCardDetails: async (
      game: GameType,
      cardSlug: string,
      selectedLeague: string,
    ) => {
      set(
        ({ cardDetails }) => {
          cardDetails.card = null;
          cardDetails.isLoadingCard = true;
          cardDetails.cardError = null;
          cardDetails.personalAnalytics = null;
          cardDetails.isLoadingPersonalAnalytics = true;
          cardDetails.relatedCards = null;
          cardDetails.isLoadingRelatedCards = true;
        },
        false,
        "cardDetailsSlice/initializeCardDetails/start",
      );

      try {
        const leagueArg = selectedLeague === "all" ? undefined : selectedLeague;
        const result = await window.electron.cardDetails.resolveCardBySlug(
          game,
          cardSlug,
          leagueArg,
        );

        if (!result) {
          set(
            ({ cardDetails }) => {
              cardDetails.card = null;
              cardDetails.isLoadingCard = false;
              cardDetails.cardError = "Card not found";
              cardDetails.isLoadingPersonalAnalytics = false;
              cardDetails.isLoadingRelatedCards = false;
            },
            false,
            "cardDetailsSlice/initializeCardDetails/notFound",
          );
          return;
        }

        set(
          ({ cardDetails }) => {
            cardDetails.card = result.card;
            cardDetails.isLoadingCard = false;
            cardDetails.cardError = null;
            cardDetails.personalAnalytics = result.personalAnalytics;
            cardDetails.isLoadingPersonalAnalytics = false;
            cardDetails.relatedCards = result.relatedCards;
            cardDetails.isLoadingRelatedCards = false;
          },
          false,
          "cardDetailsSlice/initializeCardDetails/success",
        );
      } catch (error) {
        console.error(
          "[CardDetailsSlice] Failed to initialize card details:",
          error,
        );
        set(
          ({ cardDetails }) => {
            cardDetails.card = null;
            cardDetails.isLoadingCard = false;
            cardDetails.cardError =
              error instanceof Error
                ? error.message
                : "Failed to load card details";
            cardDetails.isLoadingPersonalAnalytics = false;
            cardDetails.isLoadingRelatedCards = false;
          },
          false,
          "cardDetailsSlice/initializeCardDetails/error",
        );
      }
    },

    // ─── Refresh Personal Analytics (league switch) ──────────────────────

    refreshPersonalAnalytics: async (
      game: GameType,
      cardName: string,
      selectedLeague: string,
    ) => {
      set(
        ({ cardDetails }) => {
          cardDetails.isLoadingPersonalAnalytics = true;
          cardDetails.isLeagueSwitching = true;
          cardDetails.personalAnalyticsError = null;
        },
        false,
        "cardDetailsSlice/refreshPersonalAnalytics/start",
      );

      try {
        const leagueArg = selectedLeague === "all" ? undefined : selectedLeague;
        const data = await window.electron.cardDetails.getPersonalAnalytics(
          game,
          selectedLeague ?? "all",
          cardName,
          leagueArg,
        );

        set(
          ({ cardDetails }) => {
            cardDetails.personalAnalytics = data;
            cardDetails.isLoadingPersonalAnalytics = false;
            cardDetails.isLeagueSwitching = false;
          },
          false,
          "cardDetailsSlice/refreshPersonalAnalytics/success",
        );
      } catch (error) {
        console.error(
          "[CardDetailsSlice] Failed to refresh personal analytics:",
          error,
        );
        set(
          ({ cardDetails }) => {
            cardDetails.personalAnalyticsError =
              error instanceof Error
                ? error.message
                : "Failed to load personal analytics";
            cardDetails.isLoadingPersonalAnalytics = false;
            cardDetails.isLeagueSwitching = false;
          },
          false,
          "cardDetailsSlice/refreshPersonalAnalytics/error",
        );
      }
    },

    // ─── Set Selected League ─────────────────────────────────────────────

    setSelectedLeague: (league: string) => {
      set(
        ({ cardDetails }) => {
          cardDetails.selectedLeague = league;
        },
        false,
        "cardDetailsSlice/setSelectedLeague",
      );
    },

    setActiveTab: (tab: CardDetailsTab) => {
      set(
        ({ cardDetails }) => {
          cardDetails.activeTab = tab;
        },
        false,
        "cardDetailsSlice/setActiveTab",
      );
    },

    // ─── Fetch Price History (Milestone 2) ───────────────────────────────

    fetchPriceHistory: async (
      game: GameType,
      league: string,
      cardName: string,
    ) => {
      set(
        ({ cardDetails }) => {
          cardDetails.isLoadingPriceHistory = true;
          cardDetails.priceHistoryError = null;
        },
        false,
        "cardDetailsSlice/fetchPriceHistory/start",
      );

      try {
        const data = await window.electron.cardDetails.getPriceHistory(
          game,
          league,
          cardName,
        );

        set(
          ({ cardDetails }) => {
            cardDetails.priceHistory = data;
            cardDetails.isLoadingPriceHistory = false;
          },
          false,
          "cardDetailsSlice/fetchPriceHistory/success",
        );
      } catch (error) {
        console.error(
          "[CardDetailsSlice] Failed to fetch price history:",
          error,
        );
        set(
          ({ cardDetails }) => {
            cardDetails.priceHistoryError =
              error instanceof Error
                ? error.message
                : "Failed to load price history";
            cardDetails.isLoadingPriceHistory = false;
          },
          false,
          "cardDetailsSlice/fetchPriceHistory/error",
        );
      }
    },

    // ─── Fetch Personal Analytics (Milestone 3) ─────────────────────────

    fetchPersonalAnalytics: async (
      game: GameType,
      league: string,
      cardName: string,
      selectedLeague?: string,
    ) => {
      set(
        ({ cardDetails }) => {
          cardDetails.isLoadingPersonalAnalytics = true;
          cardDetails.isLeagueSwitching = true;
          cardDetails.personalAnalyticsError = null;
        },
        false,
        "cardDetailsSlice/fetchPersonalAnalytics/start",
      );

      try {
        const data = await window.electron.cardDetails.getPersonalAnalytics(
          game,
          league,
          cardName,
          selectedLeague,
        );

        set(
          ({ cardDetails }) => {
            cardDetails.personalAnalytics = data;
            cardDetails.isLoadingPersonalAnalytics = false;
            cardDetails.isLeagueSwitching = false;
          },
          false,
          "cardDetailsSlice/fetchPersonalAnalytics/success",
        );
      } catch (error) {
        console.error(
          "[CardDetailsSlice] Failed to fetch personal analytics:",
          error,
        );
        set(
          ({ cardDetails }) => {
            cardDetails.personalAnalyticsError =
              error instanceof Error
                ? error.message
                : "Failed to load personal analytics";
            cardDetails.isLoadingPersonalAnalytics = false;
            cardDetails.isLeagueSwitching = false;
          },
          false,
          "cardDetailsSlice/fetchPersonalAnalytics/error",
        );
      }
    },

    // ─── Fetch Sessions For Card (Milestone 3) ──────────────────────────

    setSessionsSort: (
      column: SessionSortColumn,
      game: GameType,
      cardName: string,
      league?: string,
    ) => {
      const prev = get().cardDetails.sessionsSortState;
      const newDirection: SessionSortDirection =
        prev.column === column
          ? prev.direction === "asc"
            ? "desc"
            : "asc"
          : "desc";

      set(
        ({ cardDetails }) => {
          cardDetails.sessionsSortState = {
            column,
            direction: newDirection,
          };
          // Reset to page 1 when sort changes
          cardDetails.sessionsPage = 1;
        },
        false,
        "cardDetailsSlice/setSessionsSort",
      );

      // Re-fetch with the new sort
      const PAGE_SIZE = 5;
      get().cardDetails.fetchSessionsForCard(
        game,
        cardName,
        1,
        PAGE_SIZE,
        league,
      );
    },

    fetchSessionsForCard: async (
      game: GameType,
      cardName: string,
      page = 1,
      pageSize = 10,
      league?: string,
    ) => {
      const { column, direction } = get().cardDetails.sessionsSortState;

      set(
        ({ cardDetails }) => {
          cardDetails.isLoadingSessions = true;
          cardDetails.sessionsError = null;
          cardDetails.sessionsPage = page;
        },
        false,
        "cardDetailsSlice/fetchSessionsForCard/start",
      );

      try {
        const data = await window.electron.sessions.searchByCard(
          game,
          cardName,
          page,
          pageSize,
          league,
          column,
          direction,
        );

        set(
          ({ cardDetails }) => {
            cardDetails.sessions = data;
            cardDetails.isLoadingSessions = false;
          },
          false,
          "cardDetailsSlice/fetchSessionsForCard/success",
        );
      } catch (error) {
        console.error(
          "[CardDetailsSlice] Failed to fetch sessions for card:",
          error,
        );
        set(
          ({ cardDetails }) => {
            cardDetails.sessionsError =
              error instanceof Error
                ? error.message
                : "Failed to load sessions";
            cardDetails.isLoadingSessions = false;
          },
          false,
          "cardDetailsSlice/fetchSessionsForCard/error",
        );
      }
    },

    // ─── Fetch Related Cards ─────────────────────────────────────────────

    fetchRelatedCards: async (game: GameType, cardName: string) => {
      set(
        ({ cardDetails }) => {
          cardDetails.isLoadingRelatedCards = true;
        },
        false,
        "cardDetailsSlice/fetchRelatedCards/start",
      );

      try {
        const data = await window.electron.cardDetails.getRelatedCards(
          game,
          cardName,
        );

        set(
          ({ cardDetails }) => {
            cardDetails.relatedCards = data;
            cardDetails.isLoadingRelatedCards = false;
          },
          false,
          "cardDetailsSlice/fetchRelatedCards/success",
        );
      } catch (error) {
        console.error(
          "[CardDetailsSlice] Failed to fetch related cards:",
          error,
        );
        set(
          ({ cardDetails }) => {
            cardDetails.relatedCards = null;
            cardDetails.isLoadingRelatedCards = false;
          },
          false,
          "cardDetailsSlice/fetchRelatedCards/error",
        );
      }
    },

    // ─── Clear All State ─────────────────────────────────────────────────

    clearCardDetails: () => {
      set(
        ({ cardDetails }) => {
          // Card
          cardDetails.card = null;
          cardDetails.isLoadingCard = false;
          cardDetails.cardError = null;

          // Price history
          cardDetails.priceHistory = null;
          cardDetails.isLoadingPriceHistory = false;
          cardDetails.priceHistoryError = null;

          // Personal analytics
          cardDetails.personalAnalytics = null;
          cardDetails.isLoadingPersonalAnalytics = false;
          cardDetails.personalAnalyticsError = null;

          // Sessions
          cardDetails.sessions = null;
          cardDetails.isLoadingSessions = false;
          cardDetails.sessionsError = null;
          cardDetails.sessionsPage = 1;
          cardDetails.sessionsSortState = { column: "date", direction: "desc" };

          // Related cards
          cardDetails.relatedCards = null;
          cardDetails.isLoadingRelatedCards = false;

          // UI state
          cardDetails.selectedLeague = "all";
          cardDetails.isLeagueSwitching = false;
          cardDetails.activeTab = "your-data";
        },
        false,
        "cardDetailsSlice/clearCardDetails",
      );
    },

    // ─── Price Getters (Milestone 2) ─────────────────────────────────────

    // ─── Card Getters ────────────────────────────────────────────────────

    getDisplayRarity: () => {
      const { card } = get().cardDetails;
      // PL rarity from card DTO → poe.ninja rarity → fallback 4
      return (card?.prohibitedLibraryRarity ?? card?.rarity ?? 4) as Rarity;
    },

    // ─── Price Getters ───────────────────────────────────────────────────

    getPriceHistory: () => get().cardDetails.priceHistory,

    getIsLoadingPriceHistory: () => get().cardDetails.isLoadingPriceHistory,

    getPriceHistoryError: () => get().cardDetails.priceHistoryError,

    getPriceChanges: () => {
      const history = get().cardDetails.priceHistory;
      return history?.priceChanges ?? {};
    },

    /**
     * Calculate the full set value in divine orbs.
     * Full set = stackSize × unit divine rate.
     * Reads stackSize from the resolved card in the store.
     */
    getFullSetValue: () => {
      const { card, priceHistory } = get().cardDetails;
      if (!card || !priceHistory?.currentDivineRate) return null;
      const stackSize = card.stackSize ?? 1;
      return Math.round(priceHistory.currentDivineRate * stackSize * 100) / 100;
    },

    /**
     * Calculate the full set value in chaos orbs.
     * Full set = stackSize × unit divine rate / chaosToDivineRatio.
     * Reads stackSize from the resolved card in the store.
     */
    getFullSetChaosValue: () => {
      const { card, priceHistory } = get().cardDetails;
      if (
        !card ||
        !priceHistory?.currentDivineRate ||
        !priceHistory.chaosToDivineRatio
      ) {
        return null;
      }
      const stackSize = card.stackSize ?? 1;
      // chaosToDivineRatio from poe.ninja is typically < 1 (e.g. 0.001235)
      // meaning 1 chaos = 0.001235 divine, so 1 divine = 1/0.001235 chaos
      const chaosPerDivine = 1 / priceHistory.chaosToDivineRatio;
      const chaosValue =
        priceHistory.currentDivineRate * stackSize * chaosPerDivine;
      return Math.round(chaosValue);
    },

    // ─── Personal Analytics Getters (Milestone 3) ────────────────────────

    getPersonalAnalytics: () => get().cardDetails.personalAnalytics,

    getDropTimeline: () => {
      return get().cardDetails.personalAnalytics?.dropTimeline ?? [];
    },

    getAvailableLeagues: () => {
      const analytics = get().cardDetails.personalAnalytics;
      if (!analytics?.leagueDateRanges) return [];
      return analytics.leagueDateRanges.map((lr) => lr.name);
    },

    getLuckComparison: (probability: number) => {
      const analytics = get().cardDetails.personalAnalytics;
      if (!analytics) return null;
      if (probability <= 0) return null;

      const totalDecks = analytics.totalDecksOpenedAllSessions;
      const hasSufficientData = totalDecks >= MIN_DECKS_FOR_LUCK;

      const expectedDrops = totalDecks * probability;
      const actualDrops = analytics.totalLifetimeDrops;

      // Avoid division by zero
      if (expectedDrops <= 0) {
        return {
          expectedDrops: 0,
          actualDrops,
          luckRatio: actualDrops > 0 ? Number.POSITIVE_INFINITY : 1,
          label: actualDrops > 0 ? "∞× luckier" : "As expected",
          color: actualDrops > 0 ? ("success" as const) : ("warning" as const),
          hasSufficientData,
        };
      }

      const luckRatio = Math.round((actualDrops / expectedDrops) * 100) / 100;

      let label: string;
      let color: "success" | "error" | "warning";

      if (luckRatio >= 1.2) {
        label = `${luckRatio.toFixed(1)}× luckier than average`;
        color = "success";
      } else if (luckRatio <= 0.8) {
        label = `${luckRatio.toFixed(1)}× — below expected`;
        color = "error";
      } else {
        label = "About average";
        color = "warning";
      }

      return {
        expectedDrops: Math.round(expectedDrops * 100) / 100,
        actualDrops,
        luckRatio,
        label,
        color,
        hasSufficientData,
      };
    },
  },
});
