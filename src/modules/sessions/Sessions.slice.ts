import type { StateCreator } from "zustand";
import type { GameType } from "../../../types/data-stores";
import type { SettingsSlice } from "../settings/Settings.slice";
import type {
  SessionSummary,
  SessionsPage,
} from "../../../electron/modules/sessions";
import type { DetailedDivinationCardStats } from "../../../types/data-stores";

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

    // Actions
    loadAllSessions: (game: GameType, page?: number) => Promise<void>;
    loadSessionDetail: (sessionId: string) => Promise<void>;
    clearSessionDetail: () => void;
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;

    // Getters
    getAllSessions: () => SessionSummary[];
    getSessionDetail: () => DetailedDivinationCardStats | null;
    getIsLoading: () => boolean;
    getError: () => string | null;
    getCurrentPage: () => number;
    getPageSize: () => number;
    getTotalPages: () => number;
    getTotalSessions: () => number;
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

    // Load all sessions for a game with pagination
    loadAllSessions: async (game: GameType, page?: number) => {
      set(({ sessions }) => {
        sessions.isLoading = true;
        sessions.error = null;
      });

      try {
        const currentPage = page ?? get().sessions.currentPage;
        const pageSize = get().sessions.pageSize;

        const response = await window.electron.sessions.getAll(
          game,
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
      const activeGame = get().settings.getActiveGame() as GameType | undefined;

      set(({ sessions }) => {
        sessions.currentPage = page;
      });

      if (activeGame) {
        loadAllSessions(activeGame, page);
      }
    },

    // Set page size
    setPageSize: (pageSize: number) => {
      const { loadAllSessions } = get().sessions;
      const activeGame = get().settings.getActiveGame() as GameType | undefined;

      set(({ sessions }) => {
        sessions.pageSize = pageSize;
        sessions.currentPage = 1; // Reset to first page when changing page size
      });

      if (activeGame) {
        loadAllSessions(activeGame, 1);
      }
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
  },
});
