import type { StateCreator } from "zustand";

import { CurrentSessionChannel } from "~/main/modules/current-session/CurrentSession.channels";
import type { SettingsSlice } from "~/renderer/modules/settings";
import { trackEvent } from "~/renderer/modules/umami";
import type { DetailedDivinationCardStats } from "~/types/data-stores";

import type { OverlaySlice } from "../overlay";
import type { PoeNinjaSlice } from "../poe-ninja/PoeNinja.slice";

export interface SessionSlice {
  currentSession: {
    // State
    poe1Session: DetailedDivinationCardStats | null;
    poe2Session: DetailedDivinationCardStats | null;
    poe1SessionInfo: { league: string; startedAt: string } | null;
    poe2SessionInfo: { league: string; startedAt: string } | null;
    isLoading: boolean;

    // Actions
    hydrate: () => Promise<void>;
    startListening: () => () => void;
    startSession: () => Promise<void>;
    stopSession: () => Promise<void>;
    toggleCardPriceVisibility: (
      cardName: string,
      priceSource: "exchange" | "stash",
    ) => Promise<void>;

    // Internal setters
    updateSession: (
      game: "poe1" | "poe2",
      session: DetailedDivinationCardStats,
    ) => void;
    updateSessionInfo: (
      game: "poe1" | "poe2",
      info: { league: string; startedAt: string } | null,
    ) => void;
    clearSession: (game: "poe1" | "poe2") => void;

    // Getters
    getSession: () => DetailedDivinationCardStats | null;
    getSessionInfo: () => { league: string; startedAt: string } | null;
    getIsCurrentSessionActive: () => boolean;
    getTotalCards: (game: "poe1" | "poe2") => number;
    getChaosToDivineRatio: () => number;
  };
}

export const createSessionSlice: StateCreator<
  SessionSlice & SettingsSlice & PoeNinjaSlice & OverlaySlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  SessionSlice
> = (set, get) => ({
  currentSession: {
    // Initial state
    poe1Session: null,
    poe2Session: null,
    poe1SessionInfo: null,
    poe2SessionInfo: null,
    isLoading: false,

    // Hydrate: Load current session snapshot (for overlay/new windows)
    hydrate: async () => {
      set(({ currentSession }) => {
        currentSession.isLoading = true;
      });

      try {
        // Load both sessions in parallel
        const [poe1Session, poe2Session, poe1Info, poe2Info] =
          await Promise.all([
            window.electron.session.getCurrent("poe1"),
            window.electron.session.getCurrent("poe2"),
            window.electron.session.getInfo("poe1"),
            window.electron.session.getInfo("poe2"),
          ]);

        set(({ currentSession, poeNinja }) => {
          currentSession.poe1Session = poe1Session;
          currentSession.poe2Session = poe2Session;
          currentSession.poe1SessionInfo = poe1Info;
          currentSession.poe2SessionInfo = poe2Info;
          currentSession.isLoading = false;

          // Sync snapshot to poeNinja slice if we have one
          const activeSession = poe1Info ? poe1Session : poe2Session;
          const activeInfo = poe1Info || poe2Info;

          if (activeSession?.priceSnapshot && activeInfo) {
            const [game, league] = activeInfo.league.split(":");
            poeNinja.setCurrentSnapshot({
              id: "session-snapshot", // We don't have the snapshot ID from session data
              leagueId: activeInfo.league,
              league: league || activeInfo.league,
              game: game || "poe1",
              fetchedAt: activeSession.priceSnapshot.timestamp,
              exchangeChaosToDivine:
                activeSession.priceSnapshot.exchange.chaosToDivineRatio,
              stashChaosToDivine:
                activeSession.priceSnapshot.stash.chaosToDivineRatio,
              isReused: false,
            });
          }
        });
      } catch (error) {
        console.error("[SessionSlice] Failed to hydrate:", error);
        set(({ currentSession }) => {
          currentSession.isLoading = false;
        });
      }
    },

    // Start listening to real-time updates
    startListening: () => {
      // Listen for session state changes (start/stop)
      const unsubscribeStateChange = window.electron.session.onStateChanged(
        (payload) => {
          set(({ currentSession }) => {
            if (payload.game === "poe1") {
              currentSession.poe1SessionInfo = payload.isActive
                ? payload.sessionInfo
                : null;
              if (!payload.isActive) {
                currentSession.poe1Session = null;
              }
            } else {
              currentSession.poe2SessionInfo = payload.isActive
                ? payload.sessionInfo
                : null;
              if (!payload.isActive) {
                currentSession.poe2Session = null;
              }
            }

            // If the backend confirms a session is now active (or stopped),
            // clear the loading flag so the UI exits "Starting session…"
            // even if the startSession() IPC call chain is still in-flight.
            if (currentSession.isLoading) {
              currentSession.isLoading = false;
            }
          });
        },
      );

      // Listen for session data updates (card counts)
      const unsubscribeDataUpdate = window.electron.session.onDataUpdated(
        (payload) => {
          set(({ currentSession }) => {
            if (payload.data) {
              if (payload.game === "poe1") {
                currentSession.poe1Session = payload.data;
              } else {
                currentSession.poe2Session = payload.data;
              }
            } else {
              if (payload.game === "poe1") {
                currentSession.poe1Session = null;
              } else {
                currentSession.poe2Session = null;
              }
            }
          });
        },
      );

      // Return cleanup function
      return () => {
        unsubscribeStateChange();
        unsubscribeDataUpdate();
      };
    },

    // Start a session
    startSession: async () => {
      const {
        settings: { getSelectedGame, getActiveGameViewSelectedLeague },
        overlay: { isVisible },
      } = get();
      const activeGameView = getSelectedGame();
      const activeGameViewSelectedLeague = getActiveGameViewSelectedLeague();

      if (!activeGameView || !activeGameViewSelectedLeague) return;

      set(({ currentSession }) => {
        currentSession.isLoading = true;
      });

      try {
        const result = await window.electron.session.start(
          activeGameView,
          activeGameViewSelectedLeague,
        );

        if (result.success) {
          trackEvent(CurrentSessionChannel.Start, {
            game: activeGameView,
            league: activeGameViewSelectedLeague,
            overlayVisible: isVisible,
          });

          // Immediately fetch the current session data (including priceSnapshot)
          const sessionData =
            await window.electron.session.getCurrent(activeGameView);
          const sessionInfo =
            await window.electron.session.getInfo(activeGameView);

          set(({ currentSession, poeNinja }) => {
            if (activeGameView === "poe1") {
              currentSession.poe1Session = sessionData;
              currentSession.poe1SessionInfo = sessionInfo;
            } else {
              currentSession.poe2Session = sessionData;
              currentSession.poe2SessionInfo = sessionInfo;
            }

            // Sync snapshot to poeNinja slice if we have one
            if (sessionData?.priceSnapshot && sessionInfo) {
              const [game, league] = sessionInfo.league.split(":");
              poeNinja.setCurrentSnapshot({
                id: "session-snapshot",
                leagueId: sessionInfo.league,
                league: league || sessionInfo.league,
                game: game || activeGameView,
                fetchedAt: sessionData.priceSnapshot.timestamp,
                exchangeChaosToDivine:
                  sessionData.priceSnapshot.exchange.chaosToDivineRatio,
                stashChaosToDivine:
                  sessionData.priceSnapshot.stash.chaosToDivineRatio,
                isReused: false,
              });
            }
          });
        } else {
          throw new Error(result.error || "Failed to start session");
        }
      } catch (error) {
        console.error("[SessionSlice] Failed to start session:", error);
      } finally {
        set(({ currentSession }) => {
          currentSession.isLoading = false;
        });
      }
    },

    // Stop a session
    stopSession: async () => {
      const {
        settings: { getSelectedGame },
        overlay: { isVisible },
      } = get();
      const activeGameView = getSelectedGame();
      set(({ currentSession }) => {
        currentSession.isLoading = true;
      });

      try {
        const result = await window.electron.session.stop(activeGameView);

        if (result.success) {
          trackEvent(CurrentSessionChannel.Stop, {
            game: result.game,
            league: result.league,
            durationMs: result.durationMs,
            totalCount: result.totalCount,
            overlayVisible: isVisible,
          });
        } else {
          throw new Error(result.error || "Failed to stop session");
        }
      } catch (error) {
        console.error("[SessionSlice] Failed to stop session:", error);
      } finally {
        set(({ currentSession }) => {
          currentSession.isLoading = false;
        });
      }
    },

    // Internal setters
    updateSession: (game, session) => {
      set(({ currentSession }) => {
        if (game === "poe1") {
          currentSession.poe1Session = session;
        } else {
          currentSession.poe2Session = session;
        }
      });
    },

    updateSessionInfo: (game, info) => {
      set(({ currentSession }) => {
        if (game === "poe1") {
          currentSession.poe1SessionInfo = info;
        } else {
          currentSession.poe2SessionInfo = info;
        }
      });
    },

    clearSession: (game) => {
      set(({ currentSession }) => {
        if (game === "poe1") {
          currentSession.poe1Session = null;
          currentSession.poe1SessionInfo = null;
        } else {
          currentSession.poe2Session = null;
          currentSession.poe2SessionInfo = null;
        }
      });
    },

    // Getters
    getSession: () => {
      const { currentSession, settings } = get();
      const activeGameView = settings.getSelectedGame();
      return activeGameView === "poe1"
        ? currentSession.poe1Session
        : currentSession.poe2Session;
    },

    getSessionInfo: () => {
      const { currentSession, settings } = get();
      const activeGameView = settings.getSelectedGame();

      return activeGameView === "poe1"
        ? currentSession.poe1SessionInfo
        : currentSession.poe2SessionInfo;
    },

    getIsCurrentSessionActive: () => {
      return get().currentSession.getSessionInfo() !== null;
    },

    getTotalCards: () => {
      const session = get().currentSession.getSession();
      return session?.totalCount ?? 0;
    },

    getChaosToDivineRatio: () => {
      const { currentSession, settings } = get();
      const session = currentSession.getSession();
      const priceSource = settings.getActiveGameViewPriceSource();

      if (!session?.totals) return 0;
      return session.totals[priceSource].chaosToDivineRatio;
    },

    toggleCardPriceVisibility: async (
      cardName: string,
      priceSource: "exchange" | "stash",
    ) => {
      const {
        settings: { getSelectedGame },
        currentSession: { getSession },
      } = get();

      const activeGameView = getSelectedGame();
      const session = getSession();

      if (!session) return;

      // Find current card and get current hidePrice state
      const card = session.cards.find((c) => c.name === cardName);
      if (!card) return;

      const currentHidePrice =
        priceSource === "stash"
          ? card.stashPrice?.hidePrice || false
          : card.exchangePrice?.hidePrice || false;

      // Call backend to update
      await window.electron.session.updateCardPriceVisibility(
        activeGameView,
        "current",
        priceSource,
        cardName,
        !currentHidePrice,
      );

      // State update will come via listener, no need to manually update
    },
  },
});
