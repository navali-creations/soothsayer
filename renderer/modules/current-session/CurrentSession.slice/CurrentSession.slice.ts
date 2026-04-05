import type { StateCreator } from "zustand";

import { CurrentSessionChannel } from "~/main/modules/current-session/CurrentSession.channels";
import { trackEvent } from "~/renderer/modules/umami";
import type { BoundStore } from "~/renderer/store/store.types";
import type { DetailedDivinationCardStats } from "~/types/data-stores";

import { timelineBuffer } from "../CurrentSession.components/SessionProfitTimeline/timeline-buffer/timeline-buffer";

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

    // Getters
    getSession: () => DetailedDivinationCardStats | null;
    getSessionInfo: () => { league: string; startedAt: string } | null;
    getIsCurrentSessionActive: () => boolean;
    getChaosToDivineRatio: () => number;
  };
}

export const createSessionSlice: StateCreator<
  BoundStore,
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
          // Seed the timeline buffer with the active session's data
          // (must happen before we strip timeline/priceSnapshot from the store)
          const activeSession = poe1Info ? poe1Session : poe2Session;
          if (activeSession?.timeline) {
            timelineBuffer.seedFromTimeline(activeSession.timeline);
            if (activeSession.totals?.stackedDeckChaosCost) {
              timelineBuffer.setDeckCost(
                activeSession.totals.stackedDeckChaosCost,
              );
            }
          }

          // Sync snapshot to poeNinja slice if we have one
          const activeInfo = poe1Info || poe2Info;

          if (activeSession?.priceSnapshot && activeInfo) {
            const [game, league] = activeInfo.league.split(":");
            poeNinja.setCurrentSnapshot({
              id: activeSession.snapshotId ?? "session-snapshot",
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

          // Strip large immutable blobs from session data before storing.
          // The full priceSnapshot contains cardPrices records (hundreds of
          // entries × 2 sources) that never change during a session, but get
          // structurally cloned by Immer on every set() and snapshotted by
          // devtools — causing massive memory growth.
          //
          // We keep a minimal stub so components that check
          // `!!session.priceSnapshot` or read `.chaosToDivineRatio` still work.
          const strip = (s: typeof poe1Session): typeof poe1Session => {
            if (!s) return s;
            const { priceSnapshot, timeline: _tl, ...rest } = s;
            if (priceSnapshot) {
              (rest as any).priceSnapshot = {
                timestamp: priceSnapshot.timestamp,
                stackedDeckChaosCost: priceSnapshot.stackedDeckChaosCost,
                exchange: {
                  chaosToDivineRatio: priceSnapshot.exchange.chaosToDivineRatio,
                  cardPrices: {},
                },
                stash: {
                  chaosToDivineRatio: priceSnapshot.stash.chaosToDivineRatio,
                  cardPrices: {},
                },
              };
            }
            return rest as typeof s;
          };

          currentSession.poe1Session = strip(poe1Session);
          currentSession.poe2Session = strip(poe2Session);
          currentSession.poe1SessionInfo = poe1Info;
          currentSession.poe2SessionInfo = poe2Info;
          currentSession.isLoading = false;
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
                timelineBuffer.reset();
              }
            } else {
              currentSession.poe2SessionInfo = payload.isActive
                ? payload.sessionInfo
                : null;
              if (!payload.isActive) {
                currentSession.poe2Session = null;
                timelineBuffer.reset();
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

      // Listen for session data updates (full refresh — only fires on
      // price visibility toggle, not per card drop)
      const unsubscribeDataUpdate = window.electron.session.onDataUpdated(
        (payload) => {
          // Re-seed the timeline buffer OUTSIDE the Zustand updater so the
          // large timeline object is never stored in the reactive state.
          // This fires after hidePrice toggles — the main process now
          // returns a timeline rebuilt with hidePrice-aware values.
          const selectedGame = get().settings.getSelectedGame();
          if (payload.data?.timeline && payload.game === selectedGame) {
            timelineBuffer.seedFromTimeline(payload.data.timeline);
            if (payload.data.totals?.stackedDeckChaosCost) {
              timelineBuffer.setDeckCost(
                payload.data.totals.stackedDeckChaosCost,
              );
            }
          }

          set(({ currentSession }) => {
            if (payload.data) {
              // Strip cardPrices and timeline — same as hydration.
              const { priceSnapshot, timeline: _tl, ...rest } = payload.data;
              if (priceSnapshot) {
                (rest as any).priceSnapshot = {
                  timestamp: priceSnapshot.timestamp,
                  stackedDeckChaosCost: priceSnapshot.stackedDeckChaosCost,
                  exchange: {
                    chaosToDivineRatio:
                      priceSnapshot.exchange.chaosToDivineRatio,
                    cardPrices: {},
                  },
                  stash: {
                    chaosToDivineRatio: priceSnapshot.stash.chaosToDivineRatio,
                    cardPrices: {},
                  },
                };
              }
              const stripped = rest as typeof payload.data;
              if (payload.game === "poe1") {
                currentSession.poe1Session = stripped;
              } else {
                currentSession.poe2Session = stripped;
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

      // Listen for timeline deltas — write directly to the mutable buffer,
      // bypassing Zustand/Immer entirely. This is the hot path (1 per card drop).
      const unsubscribeTimelineDelta =
        window.electron.session.onTimelineDelta?.((payload) => {
          const selectedGame = get().settings.getSelectedGame();
          if (payload.game === selectedGame) {
            timelineBuffer.applyDelta(payload.delta);
          }
        });

      // Listen for incremental card deltas — apply to existing session in-place
      // instead of replacing the entire session object. This is the hot path.
      const unsubscribeCardDelta = window.electron.session.onCardDelta?.(
        (payload) => {
          const selectedGame = get().settings.getSelectedGame();
          if (payload.game !== selectedGame) return;

          set(({ currentSession }) => {
            const session =
              payload.game === "poe1"
                ? currentSession.poe1Session
                : currentSession.poe2Session;

            if (!session) return;

            // Update total count
            session.totalCount = payload.delta.totalCount;

            // Update totals
            if (payload.delta.updatedTotals) {
              session.totals = payload.delta.updatedTotals;
            }

            // Update or add the card entry
            const existingCardIndex = session.cards.findIndex(
              (c) => c.name === payload.delta.cardName,
            );

            if (existingCardIndex >= 0) {
              // Update existing card count and prices
              const card = session.cards[existingCardIndex];
              card.count = payload.delta.newCount;
              // Update total values (price * count)
              if (card.exchangePrice && payload.delta.exchangePrice) {
                card.exchangePrice.totalValue =
                  payload.delta.exchangePrice.chaosValue *
                  payload.delta.newCount;
              }
              if (card.stashPrice && payload.delta.stashPrice) {
                card.stashPrice.totalValue =
                  payload.delta.stashPrice.chaosValue * payload.delta.newCount;
              }
            } else {
              // New card — add to the array
              const newCard: any = {
                name: payload.delta.cardName,
                count: payload.delta.newCount,
              };
              if (payload.delta.exchangePrice) {
                newCard.exchangePrice = {
                  chaosValue: payload.delta.exchangePrice.chaosValue,
                  divineValue: payload.delta.exchangePrice.divineValue,
                  totalValue:
                    payload.delta.exchangePrice.chaosValue *
                    payload.delta.newCount,
                  hidePrice: payload.delta.hidePriceExchange ?? false,
                };
              }
              if (payload.delta.stashPrice) {
                newCard.stashPrice = {
                  chaosValue: payload.delta.stashPrice.chaosValue,
                  divineValue: payload.delta.stashPrice.divineValue,
                  totalValue:
                    payload.delta.stashPrice.chaosValue *
                    payload.delta.newCount,
                  hidePrice: payload.delta.hidePriceStash ?? false,
                };
              }
              if (payload.delta.divinationCard) {
                newCard.divinationCard = payload.delta.divinationCard;
              }
              session.cards.push(newCard);
            }

            // Update recent drops — prepend new drop and keep last 20
            if (payload.delta.recentDrop) {
              if (!session.recentDrops) {
                session.recentDrops = [];
              }
              session.recentDrops.unshift(payload.delta.recentDrop);
              if (session.recentDrops.length > 20) {
                session.recentDrops.length = 20;
              }
            }
          });
        },
      );

      // Return cleanup function
      return () => {
        unsubscribeStateChange();
        unsubscribeDataUpdate();
        unsubscribeTimelineDelta?.();
        unsubscribeCardDelta?.();
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

      if (!activeGameView || !activeGameViewSelectedLeague) {
        console.warn(
          `[SessionSlice] startSession aborted: game=${activeGameView}, league=${activeGameViewSelectedLeague}`,
        );
        return;
      }

      console.log(
        `[SessionSlice] Starting session: game=${activeGameView}, league="${activeGameViewSelectedLeague}"`,
      );

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
            // Seed the timeline buffer (before stripping cardPrices)
            if (sessionData?.timeline) {
              timelineBuffer.seedFromTimeline(sessionData.timeline);
            }
            if (sessionData?.totals?.stackedDeckChaosCost) {
              timelineBuffer.setDeckCost(
                sessionData.totals.stackedDeckChaosCost,
              );
            }

            // Sync snapshot to poeNinja slice if we have one
            if (sessionData?.priceSnapshot && sessionInfo) {
              const [game, league] = sessionInfo.league.split(":");
              poeNinja.setCurrentSnapshot({
                id: sessionData.snapshotId ?? "session-snapshot",
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

            // Strip cardPrices and timeline before storing — they're
            // large immutable blobs only needed for the seeding above.
            // Keep a minimal priceSnapshot stub for existence checks + ratios.
            let stripped = sessionData;
            if (sessionData) {
              const { priceSnapshot, timeline: _tl, ...rest } = sessionData;
              if (priceSnapshot) {
                (rest as any).priceSnapshot = {
                  timestamp: priceSnapshot.timestamp,
                  stackedDeckChaosCost: priceSnapshot.stackedDeckChaosCost,
                  exchange: {
                    chaosToDivineRatio:
                      priceSnapshot.exchange.chaosToDivineRatio,
                    cardPrices: {},
                  },
                  stash: {
                    chaosToDivineRatio: priceSnapshot.stash.chaosToDivineRatio,
                    cardPrices: {},
                  },
                };
              }
              stripped = rest as typeof sessionData;
            }

            if (activeGameView === "poe1") {
              currentSession.poe1Session = stripped;
              currentSession.poe1SessionInfo = sessionInfo;
            } else {
              currentSession.poe2Session = stripped;
              currentSession.poe2SessionInfo = sessionInfo;
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
