import type { StateCreator } from "zustand";

import type { BoundStore } from "~/renderer/store/store.types";
import { getEffectiveRarity } from "~/renderer/utils/get-effective-rarity";

import type { DivinationCardRow } from "../Cards.types";

interface DivinationCardDTO extends DivinationCardRow {
  game: "poe1" | "poe2";
  createdAt: string;
  updatedAt: string;
}

type SortField = "name" | "rarity" | "stackSize";
type SortDirection = "asc" | "desc";

export interface CardsSlice {
  cards: {
    // State
    allCards: DivinationCardDTO[];
    isLoading: boolean;
    error: string | null;

    // Filters & sorting
    searchQuery: string;
    rarityFilter: number | "all";
    /** When false (default), cards with fromBoss === true are hidden */
    includeBossCards: boolean;
    /** When false (default), cards with isDisabled === true are hidden */
    includeDisabledCards: boolean;
    /** When true, shows all cards including those not in the current league pool */
    showAllCards: boolean;
    // Internal dedup keys (not part of public API)
    _lastCardsKey: string | null;
    _pendingCardsKey: string | null;
    sortField: SortField;
    sortDirection: SortDirection;

    // Pagination
    currentPage: number;
    pageSize: number;

    // Actions
    loadCards: () => Promise<void>;
    setSearchQuery: (query: string) => void;
    setRarityFilter: (rarity: number | "all") => void;
    setIncludeBossCards: (include: boolean) => void;
    setIncludeDisabledCards: (include: boolean) => void;
    setShowAllCards: (show: boolean) => void;
    setSortField: (field: SortField) => void;
    setSortDirection: (direction: SortDirection) => void;
    toggleSortDirection: () => void;
    setCurrentPage: (page: number) => void;
    setPageSize: (size: number) => void;

    // Getters
    getAllCards: () => DivinationCardDTO[];
    getFilteredAndSortedCards: () => DivinationCardDTO[];
    getPaginatedCards: () => DivinationCardDTO[];
    getTotalPages: () => number;
    getIsLoading: () => boolean;
    getError: () => string | null;
  };
}

export const createCardsSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  CardsSlice
> = (set, get) => ({
  cards: {
    // Initial state
    allCards: [],
    isLoading: false,
    error: null,
    searchQuery: "",
    rarityFilter: "all",
    includeBossCards: false,
    includeDisabledCards: false,
    showAllCards: false,
    _lastCardsKey: null,
    _pendingCardsKey: null,
    sortField: "name",
    sortDirection: "asc",
    currentPage: 1,
    pageSize: 20,

    // Load all cards for a game
    loadCards: async () => {
      const activeGame = get().settings.getSelectedGame();
      const key = activeGame;

      // Dedup: skip if we already loaded this exact key or a load is in-flight for it
      if (key === get().cards._lastCardsKey) return;
      if (key === get().cards._pendingCardsKey) return;

      set(({ cards }) => {
        cards.isLoading = true;
        cards.error = null;
        cards._pendingCardsKey = key;
      });

      try {
        // Always fetch all cards; pool filtering is handled client-side
        const fetchedCards = await window.electron.divinationCards.getAll(
          activeGame,
          false,
        );

        set(({ cards }) => {
          cards.allCards = fetchedCards;
          cards.isLoading = false;
          cards.currentPage = 1;
          cards._lastCardsKey = key;
          cards._pendingCardsKey = null;
        });
      } catch (error) {
        console.error("[CardsSlice] Failed to load cards:", error);
        set(({ cards }) => {
          cards.error = (error as Error).message;
          cards.isLoading = false;
          cards._pendingCardsKey = null;
        });
      }
    },

    // Set search query
    setSearchQuery: (query: string) => {
      set(({ cards }) => {
        cards.searchQuery = query;
        cards.currentPage = 1; // Reset to first page
      });
    },

    // Set rarity filter
    setRarityFilter: (rarity: number | "all") => {
      set(({ cards }) => {
        cards.rarityFilter = rarity;
        cards.currentPage = 1; // Reset to first page
      });
    },

    setIncludeBossCards: (include: boolean) => {
      set(({ cards }) => {
        cards.includeBossCards = include;
        cards.currentPage = 1; // Reset to first page
      });
    },

    setIncludeDisabledCards: (include: boolean) => {
      set(({ cards }) => {
        cards.includeDisabledCards = include;
        cards.currentPage = 1; // Reset to first page
      });
    },

    setShowAllCards: (show: boolean) => {
      set(({ cards }) => {
        cards.showAllCards = show;
        cards.currentPage = 1; // Reset to first page
      });
    },

    setSortField: (field: SortField) => {
      set(({ cards }) => {
        // If same field, toggle direction
        if (cards.sortField === field) {
          cards.sortDirection = cards.sortDirection === "asc" ? "desc" : "asc";
        } else {
          cards.sortField = field;
          cards.sortDirection = "asc";
        }
      });
    },

    // Set sort direction
    setSortDirection: (direction: SortDirection) => {
      set(({ cards }) => {
        cards.sortDirection = direction;
      });
    },

    // Toggle sort direction
    toggleSortDirection: () => {
      set(({ cards }) => {
        cards.sortDirection = cards.sortDirection === "asc" ? "desc" : "asc";
      });
    },

    // Set current page
    setCurrentPage: (page: number) => {
      set(({ cards }) => {
        cards.currentPage = page;
      });
    },

    // Set page size
    setPageSize: (size: number) => {
      set(({ cards }) => {
        cards.pageSize = size;
        cards.currentPage = 1; // Reset to first page
      });
    },

    // Get all cards
    getAllCards: () => get().cards.allCards,

    getFilteredAndSortedCards: () => {
      const {
        allCards,
        searchQuery,
        rarityFilter,
        includeBossCards,
        includeDisabledCards,
        sortField,
        sortDirection,
      } = get().cards;
      const { raritySource } = get().settings;

      let result = [...allCards];

      // Hide out-of-pool cards unless showAllCards is enabled (client-side filter)
      if (!get().cards.showAllCards) {
        result = result.filter((card) => card.inPool);
      }

      // Hide boss-exclusive cards unless explicitly included
      if (!includeBossCards) {
        result = result.filter((card) => !card.fromBoss);
      }

      // Hide disabled cards unless explicitly included
      if (!includeDisabledCards) {
        result = result.filter((card) => !card.isDisabled);
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter((card) =>
          card.name.toLowerCase().includes(query),
        );
      }

      // Apply rarity filter using effective rarity for the active source
      if (rarityFilter !== "all") {
        result = result.filter(
          (card) => getEffectiveRarity(card, raritySource) === rarityFilter,
        );
      }

      // Apply sorting
      result.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "rarity":
            aValue = getEffectiveRarity(a, raritySource);
            bValue = getEffectiveRarity(b, raritySource);
            break;
          case "stackSize":
            aValue = a.stackSize;
            bValue = b.stackSize;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });

      return result;
    },

    // Get paginated cards
    getPaginatedCards: () => {
      const { getFilteredAndSortedCards } = get().cards;
      const { currentPage, pageSize } = get().cards;

      const filtered = getFilteredAndSortedCards();
      const startIndex = (currentPage - 1) * pageSize;
      return filtered.slice(startIndex, startIndex + pageSize);
    },

    // Get total pages
    getTotalPages: () => {
      const { getFilteredAndSortedCards, pageSize } = get().cards;
      const filtered = getFilteredAndSortedCards();
      return Math.ceil(filtered.length / pageSize);
    },

    // Get loading state
    getIsLoading: () => get().cards.isLoading,

    // Get error
    getError: () => get().cards.error,
  },
});
