import type { StateCreator } from "zustand";

import type { KnownRarity, Rarity, RaritySource } from "~/types/data-stores";

import type { SettingsSlice } from "../settings/Settings.slice";

interface DivinationCardDTO {
  id: string;
  name: string;
  stackSize: number;
  description: string;
  rewardHtml: string;
  artSrc: string;
  flavourHtml: string;
  rarity: Rarity;
  filterRarity: KnownRarity | null;
  prohibitedLibraryRarity: Rarity | null;
  fromBoss: boolean;
  game: "poe1" | "poe2";
  createdAt: string;
  updatedAt: string;
}

type SortField = "name" | "rarity" | "stackSize";
type SortDirection = "asc" | "desc";

function getEffectiveRarity(
  card: DivinationCardDTO,
  raritySource: RaritySource,
): Rarity {
  switch (raritySource) {
    case "filter":
      return card.filterRarity ?? card.rarity;
    case "prohibited-library":
      return card.prohibitedLibraryRarity ?? card.rarity;
    default:
      return card.rarity;
  }
}

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
  CardsSlice & SettingsSlice,
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
    sortField: "name",
    sortDirection: "asc",
    currentPage: 1,
    pageSize: 20,

    // Load all cards for a game
    loadCards: async () => {
      const activeGame = get().settings.getSelectedGame();
      set(({ cards }) => {
        cards.isLoading = true;
        cards.error = null;
      });

      try {
        const fetchedCards =
          await window.electron.divinationCards.getAll(activeGame);

        set(({ cards }) => {
          cards.allCards = fetchedCards;
          cards.isLoading = false;
          cards.currentPage = 1; // Reset to first page when loading new data
        });
      } catch (error) {
        console.error("[CardsSlice] Failed to load cards:", error);
        set(({ cards }) => {
          cards.error = (error as Error).message;
          cards.isLoading = false;
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
        sortField,
        sortDirection,
      } = get().cards;
      const { raritySource } = get().settings;

      let result = [...allCards];

      // Hide boss-exclusive cards unless explicitly included
      if (!includeBossCards) {
        result = result.filter((card) => !card.fromBoss);
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
