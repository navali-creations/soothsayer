import type { StateCreator } from "zustand";

import type { CardsSlice } from "../cards/Cards.slice";

export interface SnapshotInfo {
  id: string;
  leagueId: string;
  league: string;
  game: string;
  fetchedAt: string;
  exchangeChaosToDivine: number;
  stashChaosToDivine: number;
  isReused: boolean;
}

export interface AutoRefreshInfo {
  league: string;
  game: string;
  isActive: boolean;
  nextRefreshTime: string | null;
  intervalHours: number;
}

export interface PoeNinjaSlice {
  poeNinja: {
    // State - Latest snapshot info
    currentSnapshot: SnapshotInfo | null;

    // State - Auto-refresh tracking
    autoRefreshes: Map<string, AutoRefreshInfo>;

    // State - Cache status
    exchangeCacheStatus: {
      isCached: boolean;
      lastFetchTime: string | null;
    };
    stashCacheStatus: {
      isCached: boolean;
      lastFetchTime: string | null;
    };

    // State - Loading
    isLoading: boolean;
    error: string | null;

    // State - Per-league price refresh
    /** ISO timestamp keyed by "game:league" — when the next refresh becomes available */
    refreshableAt: Map<string, string | null>;
    isRefreshing: boolean;
    refreshError: string | null;

    // Actions - Initialization
    startListening: () => () => void;

    // Actions - Snapshot
    setCurrentSnapshot: (snapshot: SnapshotInfo | null) => void;
    updateSnapshotOnReuse: (snapshotId: string, fetchedAt: string) => void;
    updateSnapshotOnCreate: (snapshot: SnapshotInfo) => void;

    // Actions - Auto-refresh
    setAutoRefreshActive: (
      game: string,
      league: string,
      intervalHours: number,
    ) => void;
    setAutoRefreshInactive: (game: string, league: string) => void;
    updateNextRefreshTime: (game: string, league: string) => void;

    // Actions - Cache
    markExchangeCached: () => void;
    markStashCached: () => void;
    clearCacheStatus: () => void;

    // Actions - Price refresh
    /**
     * Fetch / reuse a snapshot for the given game & league, update card
     * rarities on the backend, reload cards, and store the backend-provided
     * `refreshableAt` timestamp so the UI can show a cooldown.
     */
    refreshPrices: (game: string, league: string) => Promise<void>;
    /**
     * Query the backend for the current cooldown status of a game/league
     * without triggering a refresh. Useful on page mount / league switch
     * to seed the cooldown timer.
     */
    checkRefreshStatus: (game: string, league: string) => Promise<void>;

    // Getters
    getAutoRefreshInfo: (
      game: string,
      league: string,
    ) => AutoRefreshInfo | undefined;
    getNextRefreshTime: (game: string, league: string) => Date | null;
    isAutoRefreshActive: (game: string, league: string) => boolean;
    getSnapshotAge: () => number | null; // Returns age in hours
    getTimeUntilNextRefresh: (game: string, league: string) => number | null; // Returns time in ms

    // Getters - Price refresh
    /**
     * Returns the ISO timestamp at which the refresh button becomes available
     * for this game/league, or `null` if no cooldown is active (i.e. the
     * button should be enabled).
     */
    getRefreshableAt: (game: string, league: string) => string | null;
  };
}

export const createPoeNinjaSlice: StateCreator<
  PoeNinjaSlice & CardsSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  PoeNinjaSlice
> = (set, get) => ({
  poeNinja: {
    // Initial state
    currentSnapshot: null,
    autoRefreshes: new Map(),
    exchangeCacheStatus: {
      isCached: false,
      lastFetchTime: null,
    },
    stashCacheStatus: {
      isCached: false,
      lastFetchTime: null,
    },
    isLoading: false,
    error: null,

    // Initial state - Price refresh
    refreshableAt: new Map(),
    isRefreshing: false,
    refreshError: null,

    // Start listening to snapshot events
    startListening: () => {
      const unsubscribeSnapshotCreated =
        window.electron?.snapshots?.onSnapshotCreated?.((snapshotInfo) => {
          const { poeNinja } = get();
          poeNinja.updateSnapshotOnCreate(snapshotInfo);
        });

      const unsubscribeSnapshotReused =
        window.electron?.snapshots?.onSnapshotReused?.((snapshotInfo) => {
          const { poeNinja } = get();
          poeNinja.updateSnapshotOnReuse(
            snapshotInfo.id,
            snapshotInfo.fetchedAt,
          );
        });

      const unsubscribeAutoRefreshStarted =
        window.electron?.snapshots?.onAutoRefreshStarted?.((info) => {
          const { poeNinja } = get();
          poeNinja.setAutoRefreshActive(
            info.game,
            info.league,
            info.intervalHours,
          );
        });

      const unsubscribeAutoRefreshStopped =
        window.electron?.snapshots?.onAutoRefreshStopped?.((info) => {
          const { poeNinja } = get();
          poeNinja.setAutoRefreshInactive(info.game, info.league);
        });

      // Return cleanup function
      return () => {
        unsubscribeSnapshotCreated?.();
        unsubscribeSnapshotReused?.();
        unsubscribeAutoRefreshStarted?.();
        unsubscribeAutoRefreshStopped?.();
      };
    },

    // Snapshot actions
    setCurrentSnapshot: (snapshot) => {
      set(
        ({ poeNinja }) => {
          poeNinja.currentSnapshot = snapshot;
        },
        false,
        "poeNinjaSlice/setCurrentSnapshot",
      );
    },

    updateSnapshotOnReuse: (snapshotId, fetchedAt) => {
      set(
        ({ poeNinja }) => {
          if (poeNinja.currentSnapshot) {
            poeNinja.currentSnapshot.id = snapshotId;
            poeNinja.currentSnapshot.fetchedAt = fetchedAt;
            poeNinja.currentSnapshot.isReused = true;
          }
        },
        false,
        "poeNinjaSlice/updateSnapshotOnReuse",
      );
    },

    updateSnapshotOnCreate: (snapshot) => {
      set(
        ({ poeNinja }) => {
          poeNinja.currentSnapshot = {
            ...snapshot,
            isReused: false,
          };
        },
        false,
        "poeNinjaSlice/updateSnapshotOnCreate",
      );
    },

    // Auto-refresh actions
    setAutoRefreshActive: (game, league, intervalHours) => {
      set(
        ({ poeNinja }) => {
          const key = `${game}:${league}`;
          const nextRefreshTime = new Date();
          nextRefreshTime.setHours(nextRefreshTime.getHours() + intervalHours);

          poeNinja.autoRefreshes.set(key, {
            league,
            game,
            isActive: true,
            nextRefreshTime: nextRefreshTime.toISOString(),
            intervalHours,
          });
        },
        false,
        "poeNinjaSlice/setAutoRefreshActive",
      );
    },

    setAutoRefreshInactive: (game, league) => {
      set(
        ({ poeNinja }) => {
          const key = `${game}:${league}`;
          const existing = poeNinja.autoRefreshes.get(key);

          if (existing) {
            poeNinja.autoRefreshes.set(key, {
              ...existing,
              isActive: false,
              nextRefreshTime: null,
            });
          }
        },
        false,
        "poeNinjaSlice/setAutoRefreshInactive",
      );
    },

    updateNextRefreshTime: (game, league) => {
      set(
        ({ poeNinja }) => {
          const key = `${game}:${league}`;
          const info = poeNinja.autoRefreshes.get(key);

          if (info?.isActive) {
            const nextRefreshTime = new Date();
            nextRefreshTime.setHours(
              nextRefreshTime.getHours() + info.intervalHours,
            );

            poeNinja.autoRefreshes.set(key, {
              ...info,
              nextRefreshTime: nextRefreshTime.toISOString(),
            });
          }
        },
        false,
        "poeNinjaSlice/updateNextRefreshTime",
      );
    },

    // Cache actions
    markExchangeCached: () => {
      set(
        ({ poeNinja }) => {
          poeNinja.exchangeCacheStatus = {
            isCached: true,
            lastFetchTime: new Date().toISOString(),
          };
        },
        false,
        "poeNinjaSlice/markExchangeCached",
      );
    },

    markStashCached: () => {
      set(
        ({ poeNinja }) => {
          poeNinja.stashCacheStatus = {
            isCached: true,
            lastFetchTime: new Date().toISOString(),
          };
        },
        false,
        "poeNinjaSlice/markStashCached",
      );
    },

    clearCacheStatus: () => {
      set(
        ({ poeNinja }) => {
          poeNinja.exchangeCacheStatus = {
            isCached: false,
            lastFetchTime: null,
          };
          poeNinja.stashCacheStatus = {
            isCached: false,
            lastFetchTime: null,
          };
        },
        false,
        "poeNinjaSlice/clearCacheStatus",
      );
    },

    // ─── Price refresh actions ───────────────────────────────────────────

    refreshPrices: async (game, league) => {
      set(
        ({ poeNinja }) => {
          poeNinja.isRefreshing = true;
          poeNinja.refreshError = null;
        },
        false,
        "poeNinjaSlice/refreshPrices/start",
      );

      try {
        const result = await window.electron.snapshots.refreshPrices(
          game,
          league,
        );

        set(
          ({ poeNinja }) => {
            const key = `${game}:${league}`;
            poeNinja.refreshableAt.set(key, result.refreshableAt);
            poeNinja.isRefreshing = false;
          },
          false,
          "poeNinjaSlice/refreshPrices/success",
        );

        // Reload cards so the table reflects updated rarities
        await get().cards.loadCards();
      } catch (error) {
        console.error("[PoeNinjaSlice] Failed to refresh prices:", error);
        set(
          ({ poeNinja }) => {
            poeNinja.isRefreshing = false;
            poeNinja.refreshError =
              error instanceof Error
                ? error.message
                : "Failed to refresh poe.ninja prices";
          },
          false,
          "poeNinjaSlice/refreshPrices/error",
        );
      }
    },

    checkRefreshStatus: async (game, league) => {
      try {
        const status = await window.electron.snapshots.getRefreshStatus(
          game,
          league,
        );

        set(
          ({ poeNinja }) => {
            const key = `${game}:${league}`;
            poeNinja.refreshableAt.set(key, status.refreshableAt);
          },
          false,
          "poeNinjaSlice/checkRefreshStatus",
        );
      } catch (error) {
        console.error("[PoeNinjaSlice] Failed to check refresh status:", error);
        // Non-critical — just leave the cooldown as-is
      }
    },

    // Getters
    getAutoRefreshInfo: (game, league) => {
      const { poeNinja } = get();
      const key = `${game}:${league}`;
      return poeNinja.autoRefreshes.get(key);
    },

    getNextRefreshTime: (game, league) => {
      const { poeNinja } = get();
      const info = poeNinja.getAutoRefreshInfo(game, league);

      if (info?.nextRefreshTime) {
        return new Date(info.nextRefreshTime);
      }

      return null;
    },

    isAutoRefreshActive: (game, league) => {
      const { poeNinja } = get();
      const info = poeNinja.getAutoRefreshInfo(game, league);
      return info?.isActive ?? false;
    },

    getSnapshotAge: () => {
      const { poeNinja } = get();

      if (!poeNinja.currentSnapshot) {
        return null;
      }

      const fetchedAt = new Date(poeNinja.currentSnapshot.fetchedAt);
      const now = new Date();
      const diffMs = now.getTime() - fetchedAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      return diffHours;
    },

    getTimeUntilNextRefresh: (game, league) => {
      const { poeNinja } = get();
      const nextRefreshTime = poeNinja.getNextRefreshTime(game, league);

      if (!nextRefreshTime) {
        return null;
      }

      const now = new Date();
      const diffMs = nextRefreshTime.getTime() - now.getTime();

      return Math.max(0, diffMs);
    },

    getRefreshableAt: (game, league) => {
      const { poeNinja } = get();
      const key = `${game}:${league}`;
      return poeNinja.refreshableAt.get(key) ?? null;
    },
  },
});
