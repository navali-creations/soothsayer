import type { StateCreator } from "zustand";

import type { SessionSummary } from "~/main/modules/sessions";
import type { BoundStore } from "~/renderer/store/store.types";
import type { DetailedDivinationCardStats } from "~/types/data-stores";

export type SessionsBulkMode =
  | "export-rich"
  | "export-simple"
  | "delete"
  | null;

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
    // Sparkline state
    sparklines: Record<string, { x: number; profit: number }[]>;
    // Bulk mode state
    bulkMode: SessionsBulkMode;
    selectedSessionIds: string[];
    isDeleteConfirmOpen: boolean;
    deleteError: string | null;
    isDeleting: boolean;

    // Actions
    loadAllSessions: (page?: number) => Promise<void>;
    loadSessionDetail: (sessionId: string) => Promise<void>;
    clearSessionDetail: () => void;
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    setSelectedLeague: (league: string) => void;
    searchSessions: (cardName: string, page?: number) => Promise<void>;
    setSearchQuery: (query: string) => void;
    setBulkMode: (mode: SessionsBulkMode) => void;
    toggleSessionSelection: (sessionId: string) => void;
    selectAllVisible: () => void;
    selectAll: () => Promise<void>;
    clearSelection: () => void;
    openDeleteConfirm: () => void;
    closeDeleteConfirm: () => void;
    setDeleteError: (error: string | null) => void;
    setIsDeleting: (isDeleting: boolean) => void;

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
    getSparklines: () => Record<string, { x: number; profit: number }[]>;
    getBulkMode: () => SessionsBulkMode;
    getIsBulkMode: () => boolean;
    getIsDeleteMode: () => boolean;
    getSelectedSessionIds: () => string[];
    getSelectedCount: () => number;
    getIsSessionSelected: (id: string) => boolean;
    getIsDeleteConfirmOpen: () => boolean;
    getDeleteError: () => string | null;
    getIsDeleting: () => boolean;
  };
}

export const createSessionsSlice: StateCreator<
  BoundStore,
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
    sparklines: {},
    bulkMode: null,
    selectedSessionIds: [],
    isDeleteConfirmOpen: false,
    deleteError: null,
    isDeleting: false,

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
          sessionsState.sparklines = {};
        });

        // Fetch sparkline data for loaded sessions (deck-cost adjusted server-side)
        const sessionIds = response.sessions.map((s) => s.sessionId);
        if (sessionIds.length > 0) {
          try {
            const sparklines =
              await window.electron.sessions.getSparklines(sessionIds);

            set(({ sessions: sessionsState }) => {
              sessionsState.sparklines = sparklines;
            });
          } catch (err) {
            // Sparkline fetch is non-critical — don't block the UI
            console.warn("[SessionsSlice] Failed to load sparklines:", err);
          }
        }
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
      const { loadAllSessions } = get().sessions;

      set(({ sessions }) => {
        sessions.selectedLeague = league;
        sessions.currentPage = 1;
      });

      loadAllSessions(1);
    },

    // Set search query
    setSearchQuery: (query: string) => {
      set(({ sessions }) => {
        sessions.searchQuery = query;
      });
    },

    // Bulk mode actions
    setBulkMode: (mode: SessionsBulkMode) => {
      set(({ sessions }) => {
        sessions.bulkMode = mode;
        if (mode === null) {
          sessions.selectedSessionIds = [];
          sessions.isDeleteConfirmOpen = false;
          sessions.deleteError = null;
          sessions.isDeleting = false;
        }
      });
    },

    toggleSessionSelection: (sessionId: string) => {
      set(({ sessions }) => {
        const idx = sessions.selectedSessionIds.indexOf(sessionId);
        if (idx >= 0) {
          sessions.selectedSessionIds.splice(idx, 1);
        } else {
          sessions.selectedSessionIds.push(sessionId);
        }
      });
    },

    selectAllVisible: () => {
      set(({ sessions }) => {
        const allIds = sessions.allSessions.map((s) => s.sessionId);
        const existing = new Set(sessions.selectedSessionIds);
        for (const id of allIds) {
          if (!existing.has(id)) {
            sessions.selectedSessionIds.push(id);
          }
        }
      });
    },

    selectAll: async () => {
      const activeGame = get().settings.getSelectedGame();
      const allIds =
        await window.electron.sessions.getAllSessionIds(activeGame);
      set(({ sessions }) => {
        sessions.selectedSessionIds = allIds;
      });
    },

    clearSelection: () => {
      set(({ sessions }) => {
        sessions.selectedSessionIds = [];
      });
    },

    openDeleteConfirm: () => {
      set(({ sessions }) => {
        sessions.deleteError = null;
        sessions.isDeleteConfirmOpen = true;
      });
    },

    closeDeleteConfirm: () => {
      set(({ sessions }) => {
        sessions.deleteError = null;
        sessions.isDeleteConfirmOpen = false;
      });
    },

    setDeleteError: (error: string | null) => {
      set(({ sessions }) => {
        sessions.deleteError = error;
      });
    },

    setIsDeleting: (isDeleting: boolean) => {
      set(({ sessions }) => {
        sessions.isDeleting = isDeleting;
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
    getSparklines: () => get().sessions.sparklines,
    getBulkMode: () => get().sessions.bulkMode,
    getIsBulkMode: () => get().sessions.bulkMode !== null,
    getIsDeleteMode: () => get().sessions.bulkMode === "delete",
    getSelectedSessionIds: () => get().sessions.selectedSessionIds,
    getSelectedCount: () => get().sessions.selectedSessionIds.length,
    getIsSessionSelected: (id: string) =>
      get().sessions.selectedSessionIds.includes(id),
    getIsDeleteConfirmOpen: () => get().sessions.isDeleteConfirmOpen,
    getDeleteError: () => get().sessions.deleteError,
    getIsDeleting: () => get().sessions.isDeleting,

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
          sessionsState.sparklines = {};
        });

        // Fetch sparkline data for loaded sessions (deck-cost adjusted server-side)
        const sessionIds = response.sessions.map((s) => s.sessionId);
        if (sessionIds.length > 0) {
          try {
            const sparklines =
              await window.electron.sessions.getSparklines(sessionIds);

            set(({ sessions: sessionsState }) => {
              sessionsState.sparklines = sparklines;
            });
          } catch (err) {
            // Sparkline fetch is non-critical — don't block the UI
            console.warn("[SessionsSlice] Failed to load sparklines:", err);
          }
        }
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
