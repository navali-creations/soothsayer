import type { StateCreator } from "zustand";

import type { BoundStore } from "~/renderer/store/store.types";
import {
  type DetailedDivinationCardStats,
  type GameType,
  MAX_SESSION_INPUT_CHAOS,
} from "~/types/data-stores";

import { timelineBuffer } from "../CurrentSession.components/SessionProfitTimeline/timeline-buffer/timeline-buffer";
import {
  createPricingSaveQueue,
  toReactiveSession,
} from "../CurrentSession.utils/CurrentSession.utils";

export interface SessionSlice {
  currentSession: {
    // State
    poe1Session: DetailedDivinationCardStats | null;
    poe2Session: DetailedDivinationCardStats | null;
    poe1SessionInfo: { league: string; startedAt: string } | null;
    poe2SessionInfo: { league: string; startedAt: string } | null;
    isLoading: boolean;
    cardPriceThresholds: { poe1: number; poe2: number };
    cardPriceThresholdErrors: Record<GameType, string | null>;
    stackedDeckPriceOverrides: { poe1: number | null; poe2: number | null };
    stackedDeckPriceErrors: Record<GameType, string | null>;

    // Actions
    hydrate: () => Promise<void>;
    startListening: () => () => void;
    startSession: () => Promise<void>;
    stopSession: () => Promise<void>;
    toggleCardPriceVisibility: (cardName: string) => Promise<void>;
    setCardPriceThreshold: (chaosValue: number) => Promise<void>;
    setStackedDeckPriceOverride: (chaosValue: number | null) => Promise<void>;

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
> = (set, get) => {
  const thresholdSaves = createPricingSaveQueue<number>(
    (game, value) => window.electron.session.setCardPriceThreshold(game, value),
    (game, failed) =>
      set(({ currentSession }) => {
        currentSession.cardPriceThresholdErrors[game] = failed
          ? "Unable to save the threshold. Please try again."
          : null;
      }),
  );
  const deckPriceSaves = createPricingSaveQueue<number | null>(
    (game, value) =>
      window.electron.session.setStackedDeckPriceOverride(game, value),
    (game, failed) =>
      set(({ currentSession }) => {
        currentSession.stackedDeckPriceErrors[game] = failed
          ? "Unable to save the deck price. Please try again."
          : null;
      }),
  );
  const flushPricing = async (
    game: GameType,
    options = { retryFailed: false },
  ) => {
    const results = await Promise.all([
      thresholdSaves.flush(game, options),
      deckPriceSaves.flush(game, options),
    ]);
    return results.every(Boolean);
  };
  return {
    currentSession: {
      // Initial state
      poe1Session: null,
      poe2Session: null,
      poe1SessionInfo: null,
      poe2SessionInfo: null,
      isLoading: false,
      cardPriceThresholds: { poe1: 0, poe2: 0 },
      cardPriceThresholdErrors: { poe1: null, poe2: null },
      stackedDeckPriceOverrides: { poe1: null, poe2: null },
      stackedDeckPriceErrors: { poe1: null, poe2: null },

      // Hydrate: Load current session snapshot (for overlay/new windows)
      hydrate: async () => {
        set(({ currentSession }) => {
          currentSession.isLoading = true;
        });

        try {
          // Load both sessions in parallel
          const [
            poe1Session,
            poe2Session,
            poe1Info,
            poe2Info,
            poe1Threshold,
            poe2Threshold,
            poe1DeckPrice,
            poe2DeckPrice,
          ] = await Promise.all([
            window.electron.session.getCurrent("poe1"),
            window.electron.session.getCurrent("poe2"),
            window.electron.session.getInfo("poe1"),
            window.electron.session.getInfo("poe2"),
            window.electron.session.getCardPriceThreshold("poe1"),
            window.electron.session.getCardPriceThreshold("poe2"),
            window.electron.session.getStackedDeckPriceOverride("poe1"),
            window.electron.session.getStackedDeckPriceOverride("poe2"),
          ]);

          set(({ currentSession, poeNinja }) => {
            currentSession.cardPriceThresholds = {
              poe1: poe1Threshold,
              poe2: poe2Threshold,
            };
            currentSession.stackedDeckPriceOverrides = {
              poe1: poe1DeckPrice,
              poe2: poe2DeckPrice,
            };
            // Seed the timeline buffer with the active session's data
            // (must happen before we strip timeline/priceSnapshot from the store)
            const activeSession = poe1Info ? poe1Session : poe2Session;
            if (activeSession?.timeline) {
              timelineBuffer.seedFromTimeline(activeSession.timeline);
              if (activeSession.totals?.stackedDeckChaosCost !== undefined) {
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
                chaosToDivineRatio:
                  activeSession.priceSnapshot.chaosToDivineRatio,
                isReused: false,
              });
            }

            // Strip large immutable blobs from session data before storing.
            // The full priceSnapshot contains cardPrices records (hundreds of
            // entries) that never change during a session, but get
            // structurally cloned by Immer on every set() and snapshotted by
            // devtools — causing massive memory growth.
            //
            // We keep a minimal stub so components that check
            // `!!session.priceSnapshot` or read `.chaosToDivineRatio` still work.
            currentSession.poe1Session = toReactiveSession(poe1Session);
            currentSession.poe2Session = toReactiveSession(poe2Session);
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
              if (payload.data.totals?.stackedDeckChaosCost !== undefined) {
                timelineBuffer.setDeckCost(
                  payload.data.totals.stackedDeckChaosCost,
                );
              }
            }

            set(({ currentSession }) => {
              if (payload.data) {
                const stripped = toReactiveSession(payload.data);
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

        const unsubscribePricingUpdate =
          window.electron.session.onPricingUpdated?.((payload) => {
            const current = get().currentSession;
            const session =
              payload.game === "poe1"
                ? current.poe1Session
                : current.poe2Session;
            if (session?.id !== payload.sessionId) return;
            if (payload.game === get().settings.getSelectedGame()) {
              timelineBuffer.setDeckCost(payload.totals.stackedDeckChaosCost);
            }
            set(({ currentSession }) => {
              const data =
                payload.game === "poe1"
                  ? currentSession.poe1Session
                  : currentSession.poe2Session;
              if (data?.id === payload.sessionId) data.totals = payload.totals;
            });
          });

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
                if (
                  card.price ||
                  payload.delta.price ||
                  session.priceSnapshot ||
                  payload.delta.hidePrice
                ) {
                  const chaosValue =
                    payload.delta.price?.chaosValue ??
                    card.price?.chaosValue ??
                    0;
                  card.price = {
                    chaosValue,
                    divineValue:
                      payload.delta.price?.divineValue ??
                      card.price?.divineValue ??
                      0,
                    totalValue: chaosValue * payload.delta.newCount,
                    hidePrice:
                      payload.delta.hidePrice ?? card.price?.hidePrice ?? false,
                  };
                }
              } else {
                // New card — add to the array
                const newCard: any = {
                  name: payload.delta.cardName,
                  count: payload.delta.newCount,
                };
                if (
                  payload.delta.price ||
                  session.priceSnapshot ||
                  payload.delta.hidePrice
                ) {
                  newCard.price = {
                    chaosValue: payload.delta.price?.chaosValue ?? 0,
                    divineValue: payload.delta.price?.divineValue ?? 0,
                    totalValue:
                      (payload.delta.price?.chaosValue ?? 0) *
                      payload.delta.newCount,
                    hidePrice: payload.delta.hidePrice ?? false,
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
          unsubscribePricingUpdate?.();
        };
      },

      // Start a session
      startSession: async () => {
        const {
          settings: { getSelectedGame, getActiveGameViewSelectedLeague },
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
          if (!(await flushPricing(activeGameView, { retryFailed: true })))
            return;
          const result = await window.electron.session.start(
            activeGameView,
            activeGameViewSelectedLeague,
          );

          if (result.success) {
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
              if (sessionData?.totals?.stackedDeckChaosCost !== undefined) {
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
                  chaosToDivineRatio:
                    sessionData.priceSnapshot.chaosToDivineRatio,
                  isReused: false,
                });
              }

              // Strip cardPrices and timeline before storing — they're
              // large immutable blobs only needed for the seeding above.
              // Keep a minimal priceSnapshot stub for existence checks + ratios.
              const stripped = toReactiveSession(sessionData);

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
        } = get();
        const activeGameView = getSelectedGame();
        set(({ currentSession }) => {
          currentSession.isLoading = true;
        });

        try {
          if (!(await flushPricing(activeGameView))) return;
          const result = await window.electron.session.stop(activeGameView);

          if (!result.success) {
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
        const { currentSession } = get();
        const session = currentSession.getSession();

        if (!session?.totals) return 0;
        return session.totals.chaosToDivineRatio;
      },

      setStackedDeckPriceOverride: (chaosValue) => {
        if (
          chaosValue !== null &&
          (!Number.isFinite(chaosValue) ||
            chaosValue < 0 ||
            chaosValue > MAX_SESSION_INPUT_CHAOS)
        )
          return Promise.resolve();
        const game = get().settings.getSelectedGame();
        set(({ currentSession }) => {
          currentSession.stackedDeckPriceOverrides[game] = chaosValue;
          currentSession.stackedDeckPriceErrors[game] = null;
        });
        return deckPriceSaves.enqueue(game, chaosValue);
      },

      setCardPriceThreshold: (chaosValue) => {
        if (
          !Number.isFinite(chaosValue) ||
          chaosValue < 0 ||
          chaosValue > MAX_SESSION_INPUT_CHAOS
        )
          return Promise.resolve();
        const game = get().settings.getSelectedGame();
        set(({ currentSession }) => {
          currentSession.cardPriceThresholds[game] = chaosValue;
          currentSession.cardPriceThresholdErrors[game] = null;
        });
        return thresholdSaves.enqueue(game, chaosValue);
      },

      toggleCardPriceVisibility: async (cardName: string) => {
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

        const currentHidePrice = card.price?.hidePrice || false;

        // Call backend to update
        await window.electron.session.updateCardPriceVisibility(
          activeGameView,
          "current",
          cardName,
          !currentHidePrice,
        );

        // State update will come via listener, no need to manually update
      },
    },
  };
};
