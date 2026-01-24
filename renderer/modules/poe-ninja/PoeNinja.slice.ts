import type { StateCreator } from "zustand";

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

    // Getters
    getAutoRefreshInfo: (
      game: string,
      league: string,
    ) => AutoRefreshInfo | undefined;
    getNextRefreshTime: (game: string, league: string) => Date | null;
    isAutoRefreshActive: (game: string, league: string) => boolean;
    getSnapshotAge: () => number | null; // Returns age in hours
    getTimeUntilNextRefresh: (game: string, league: string) => number | null; // Returns time in ms
  };
}

export const createPoeNinjaSlice: StateCreator<
  PoeNinjaSlice,
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

    // Start listening to snapshot events
    startListening: () => {
      const unsubscribeSnapshotCreated =
        window.electron?.snapshots?.onSnapshotCreated?.((snapshotInfo) => {
          const { poeNinja } = get();
          console.log("[PoeNinja] Snapshot created:", snapshotInfo);
          poeNinja.updateSnapshotOnCreate(snapshotInfo);
        });

      const unsubscribeSnapshotReused =
        window.electron?.snapshots?.onSnapshotReused?.((snapshotInfo) => {
          const { poeNinja } = get();
          console.log("[PoeNinja] Snapshot reused:", snapshotInfo);
          poeNinja.updateSnapshotOnReuse(
            snapshotInfo.id,
            snapshotInfo.fetchedAt,
          );
        });

      const unsubscribeAutoRefreshStarted =
        window.electron?.snapshots?.onAutoRefreshStarted?.((info) => {
          const { poeNinja } = get();
          console.log("[PoeNinja] Auto-refresh started:", info);
          poeNinja.setAutoRefreshActive(
            info.game,
            info.league,
            info.intervalHours,
          );
        });

      const unsubscribeAutoRefreshStopped =
        window.electron?.snapshots?.onAutoRefreshStopped?.((info) => {
          const { poeNinja } = get();
          console.log("[PoeNinja] Auto-refresh stopped:", info);
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
  },
});
