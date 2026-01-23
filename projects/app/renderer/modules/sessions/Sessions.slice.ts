import type { StateCreator } from "zustand";

import type { SessionSummary } from "../../../electron/modules/sessions";
import type { DetailedDivinationCardStats } from "../../../types/data-stores";
import type { SettingsSlice } from "../settings/Settings.slice";

export interface SessionsSlice {
  sessions: {
    // State
    allSessions: SessionSummary[];
    currentSessionDetail: DetailedDivinationCardStats | null;
    isLoading: boolean;
    error: string | null;
    // Pagination state
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalSessions: number;
    // Filter state
    selectedLeague: string;
    searchQuery: string;

    // Actions
    loadAllSessions: (page?: number) => Promise<void>;
    loadSessionDetail: (sessionId: string) => Promise<void>;
    clearSessionDetail: () => void;
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    setSelectedLeague: (league: string) => void;
    searchSessions: (cardName: string, page?: number) => Promise<void>;
    setSearchQuery: (query: string) => void;

    // Getters
    getAllSessions: () => SessionSummary[];
    getSessionDetail: () => DetailedDivinationCardStats | null;
    getIsLoading: () => boolean;
    getError: () => string | null;
    getCurrentPage: () => number;
    getPageSize: () => number;
    getTotalPages: () => number;
    getTotalSessions: () => number;
    getSelectedLeague: () => string;
    getSearchQuery: () => string;
    getUniqueLeagues: () => string[];
    getFilteredSessions: () => SessionSummary[];
  };
}

export const createSessionsSlice: StateCreator<
  SessionsSlice & SettingsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SessionsSlice
> = (set, get) => ({
  sessions: {
    // Initial state
    allSessions: [],
    currentSessionDetail: null,
    isLoading: false,
    error: null,
    currentPage: 1,
    pageSize: 20,
    totalPages: 0,
    totalSessions: 0,
    selectedLeague: "all",
    searchQuery: "",

    // Load all sessions for a game with pagination
    loadAllSessions: async (page?: number) => {
      set(({ sessions }) => {
        sessions.isLoading = true;
        sessions.error = null;
      });

      try {
        const activeGame = get().settings.getSelectedGame();
        const currentPage = page ?? get().sessions.currentPage;
        const pageSize = get().sessions.pageSize;

        const response = await window.electron.sessions.getAll(
          activeGame,
          currentPage,
          pageSize,
        );

        set(({ sessions: sessionsState }) => {
          sessionsState.allSessions = response.sessions;
          sessionsState.currentPage = response.page;
          sessionsState.pageSize = response.pageSize;
          sessionsState.totalPages = response.totalPages;
          sessionsState.totalSessions = response.total;
          sessionsState.isLoading = false;
        });
      } catch (error) {
        console.error("[SessionsSlice] Failed to load sessions:", error);
        set(({ sessions }) => {
          sessions.error = (error as Error).message;
          sessions.isLoading = false;
        });
      }
    },

    // Load detailed session data
    loadSessionDetail: async (sessionId: string) => {
      set(({ sessions }) => {
        sessions.isLoading = true;
        sessions.error = null;
      });

      try {
        const sessionDetail = await window.electron.sessions.getById(sessionId);

        set(({ sessions }) => {
          sessions.currentSessionDetail = sessionDetail;
          sessions.isLoading = false;
        });
      } catch (error) {
        console.error("[SessionsSlice] Failed to load session detail:", error);
        set(({ sessions }) => {
          sessions.error = (error as Error).message;
          sessions.isLoading = false;
        });
      }
    },

    // Clear session detail when navigating away
    clearSessionDetail: () => {
      set(({ sessions }) => {
        sessions.currentSessionDetail = null;
      });
    },

    // Set current page and reload
    setPage: (page: number) => {
      const { loadAllSessions } = get().sessions;

      set(({ sessions }) => {
        sessions.currentPage = page;
      });

      loadAllSessions(page);
    },

    // Set page size
    setPageSize: (pageSize: number) => {
      const { loadAllSessions } = get().sessions;

      set(({ sessions }) => {
        sessions.pageSize = pageSize;
        sessions.currentPage = 1; // Reset to first page when changing page size
      });

      loadAllSessions(1);
    },

    // Set selected league filter
    setSelectedLeague: (league: string) => {
      set(({ sessions }) => {
        sessions.selectedLeague = league;
      });
    },

    // Set search query
    setSearchQuery: (query: string) => {
      set(({ sessions }) => {
        sessions.searchQuery = query;
      });
    },

    // Getters
    getAllSessions: () => get().sessions.allSessions,
    getSessionDetail: () => get().sessions.currentSessionDetail,
    getIsLoading: () => get().sessions.isLoading,
    getError: () => get().sessions.error,
    getCurrentPage: () => get().sessions.currentPage,
    getPageSize: () => get().sessions.pageSize,
    getTotalPages: () => get().sessions.totalPages,
    getTotalSessions: () => get().sessions.totalSessions,
    getSelectedLeague: () => get().sessions.selectedLeague,
    getSearchQuery: () => get().sessions.searchQuery,

    // Get unique leagues from all sessions
    getUniqueLeagues: () => {
      const allSessions = get().sessions.allSessions;
      const uniqueLeagues = new Set(allSessions.map((s) => s.league));
      return ["all", ...Array.from(uniqueLeagues)];
    },

    // Get filtered sessions based on selected league
    getFilteredSessions: () => {
      const allSessions = get().sessions.allSessions;
      const selectedLeague = get().sessions.selectedLeague;

      if (selectedLeague === "all") {
        return allSessions;
      }
      return allSessions.filter((s) => s.league === selectedLeague);
    },

    // Search sessions by card name
    searchSessions: async (cardName: string, page?: number) => {
      set(({ sessions }) => {
        sessions.isLoading = true;
        sessions.error = null;
      });

      try {
        const activeGame = get().settings.getSelectedGame();
        const currentPage = page ?? get().sessions.currentPage;
        const pageSize = get().sessions.pageSize;

        const response = await window.electron.sessions.searchByCard(
          activeGame,
          cardName,
          currentPage,
          pageSize,
        );

        set(({ sessions: sessionsState }) => {
          sessionsState.allSessions = response.sessions;
          sessionsState.currentPage = response.page;
          sessionsState.pageSize = response.pageSize;
          sessionsState.totalPages = response.totalPages;
          sessionsState.totalSessions = response.total;
          sessionsState.isLoading = false;
        });
      } catch (error) {
        console.error("[SessionsSlice] Failed to search sessions:", error);
        set(({ sessions }) => {
          sessions.error = (error as Error).message;
          sessions.isLoading = false;
        });
      }
    },
  },
});
