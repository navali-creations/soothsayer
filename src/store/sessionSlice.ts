// src/store/sessionSlice.ts
import type { StateCreator } from "zustand";
import type { GameVersion as GameType } from "../../electron/modules/settings-store/SettingsStore.schemas";
import type { DetailedDivinationCardStats } from "../../types/data-stores";

export interface SessionSlice {
  // State
  poe1Session: DetailedDivinationCardStats | null;
  poe2Session: DetailedDivinationCardStats | null;
  poe1SessionInfo: { league: string; startedAt: string } | null;
  poe2SessionInfo: { league: string; startedAt: string } | null;
  isLoading: boolean;

  // Actions
  hydrate: () => Promise<void>;
  startListening: () => () => void;
  startSession: (game: GameType, league: string) => Promise<void>;
  stopSession: (game: GameType) => Promise<void>;

  // Internal setters
  updateSession: (game: GameType, session: DetailedDivinationCardStats) => void;
  updateSessionInfo: (
    game: GameType,
    info: { league: string; startedAt: string } | null,
  ) => void;
  clearSession: (game: GameType) => void;

  // Getters
  getSession: (game: GameType) => DetailedDivinationCardStats | null;
  getSessionInfo: (
    game: GameType,
  ) => { league: string; startedAt: string } | null;
  isActive: (game: GameType) => boolean;
  getTotalCards: (game: GameType) => number;
}

export const createSessionSlice: StateCreator<
  SessionSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SessionSlice
> = (set, get) => ({
  // Initial state
  poe1Session: null,
  poe2Session: null,
  poe1SessionInfo: null,
  poe2SessionInfo: null,
  isLoading: false,

  // Hydrate: Load current session snapshot (for overlay/new windows)
  hydrate: async () => {
    set({ isLoading: true });

    try {
      // Load both sessions in parallel
      const [poe1Session, poe2Session, poe1Info, poe2Info] = await Promise.all([
        window.electron.session.getCurrent("poe1"),
        window.electron.session.getCurrent("poe2"),
        window.electron.session.getInfo("poe1"),
        window.electron.session.getInfo("poe2"),
      ]);

      set({
        poe1Session,
        poe2Session,
        poe1SessionInfo: poe1Info,
        poe2SessionInfo: poe2Info,
        isLoading: false,
      });

      console.log("[SessionSlice] Hydrated:", {
        poe1Session,
        poe2Session,
        poe1Info,
        poe2Info,
      });
    } catch (error) {
      console.error("[SessionSlice] Failed to hydrate:", error);
      set({ isLoading: false });
    }
  },

  // Start listening to real-time updates
  startListening: () => {
    console.log("[SessionSlice] Starting listeners...");

    // Listen for session state changes (start/stop)
    const unsubscribeStateChange = window.electron.session.onStateChanged(
      (payload) => {
        console.log("[SessionSlice] State change received:", payload);

        set((state) => {
          if (payload.game === "poe1") {
            state.poe1SessionInfo = payload.isActive
              ? payload.sessionInfo
              : null;
            if (!payload.isActive) {
              state.poe1Session = null;
            }
          } else {
            state.poe2SessionInfo = payload.isActive
              ? payload.sessionInfo
              : null;
            if (!payload.isActive) {
              state.poe2Session = null;
            }
          }
        });

        console.log("[SessionSlice] State updated after state change");
      },
    );

    // Listen for session data updates (card counts)
    const unsubscribeDataUpdate = window.electron.session.onDataUpdated(
      (payload) => {
        console.log("[SessionSlice] Data update received:", {
          game: payload.game,
          totalCards: payload.data?.totalCards,
          cardCount: Object.keys(payload.data?.cards || {}).length,
        });

        set((state) => {
          if (payload.data) {
            if (payload.game === "poe1") {
              console.log("[SessionSlice] Updating poe1Session", {
                oldTotal: state.poe1Session?.totalCount,
                newTotal: payload.data.totalCount,
              });
              state.poe1Session = payload.data;
            } else {
              console.log("[SessionSlice] Updating poe2Session", {
                oldTotal: state.poe2Session?.totalCount,
                newTotal: payload.data.totalCount,
              });
              state.poe2Session = payload.data;
            }
          } else {
            if (payload.game === "poe1") {
              state.poe1Session = null;
            } else {
              state.poe2Session = null;
            }
          }
        });

        console.log("[SessionSlice] State updated after data update");
      },
    );

    // Return cleanup function
    return () => {
      console.log("[SessionSlice] Cleaning up listeners...");
      unsubscribeStateChange();
      unsubscribeDataUpdate();
    };
  },

  // Start a session
  startSession: async (game, league) => {
    set({ isLoading: true });

    try {
      const result = await window.electron.session.start(game, league);

      if (result.success) {
        // Session info will be updated via the listener
        console.log(`[SessionSlice] Session started for ${game}`);
      } else {
        throw new Error(result.error || "Failed to start session");
      }
    } catch (error) {
      console.error("[SessionSlice] Failed to start session:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Stop a session
  stopSession: async (game) => {
    set({ isLoading: true });

    try {
      const result = await window.electron.session.stop(game);

      if (result.success) {
        console.log(`[SessionSlice] Session stopped for ${game}`);
      } else {
        throw new Error(result.error || "Failed to stop session");
      }
    } catch (error) {
      console.error("[SessionSlice] Failed to stop session:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Internal setters
  updateSession: (game, session) => {
    console.log(`[SessionSlice] updateSession called for ${game}`, {
      totalCards: session.totalCount,
    });

    set((state) => {
      if (game === "poe1") {
        state.poe1Session = session;
      } else {
        state.poe2Session = session;
      }
    });
  },

  updateSessionInfo: (game, info) => {
    console.log(`[SessionSlice] updateSessionInfo called for ${game}`, info);

    set((state) => {
      if (game === "poe1") {
        state.poe1SessionInfo = info;
      } else {
        state.poe2SessionInfo = info;
      }
    });
  },

  clearSession: (game) => {
    console.log(`[SessionSlice] clearSession called for ${game}`);

    set((state) => {
      if (game === "poe1") {
        state.poe1Session = null;
        state.poe1SessionInfo = null;
      } else {
        state.poe2Session = null;
        state.poe2SessionInfo = null;
      }
    });
  },

  // Getters
  getSession: (game) => {
    const { poe1Session, poe2Session } = get();
    return game === "poe1" ? poe1Session : poe2Session;
  },

  getSessionInfo: (game) => {
    const { poe1SessionInfo, poe2SessionInfo } = get();
    return game === "poe1" ? poe1SessionInfo : poe2SessionInfo;
  },

  isActive: (game) => {
    return get().getSessionInfo(game) !== null;
  },

  getTotalCards: (game) => {
    const session = get().getSession(game);
    return session?.totalCount ?? 0;
  },
});
