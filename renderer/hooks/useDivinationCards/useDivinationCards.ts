import { useCallback, useEffect, useState } from "react";

import type {
  DetailedDivinationCardStats,
  SimpleDivinationCardStats,
} from "~/types/data-stores";

/**
 * The IPC endpoints return different shapes depending on scope:
 *
 * - `"session"` → `DetailedDivinationCardStats` (cards is `CardEntry[]`)
 * - `"all-time"` / `"league"` → `SimpleDivinationCardStats` (cards is `Record<string, SimpleCardEntry>`)
 *
 * Consumers must handle both shapes. The Statistics page, for example,
 * uses `Object.entries(stats.cards)` which works correctly with the
 * Record shape returned by the DataStore endpoints.
 */
type DivinationCardStats =
  | DetailedDivinationCardStats
  | SimpleDivinationCardStats;

type GameType = "poe1" | "poe2";
type StatScope = "session" | "all-time" | "league";

interface UseDivinationCardsOptions {
  game?: GameType;
  scope?: StatScope;
  league?: string;
}

export const useDivinationCards = (options: UseDivinationCardsOptions = {}) => {
  const { game = "poe1", scope = "session", league } = options;

  const [stats, setStats] = useState<DivinationCardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);

    let loadedStats: DivinationCardStats | null = null;

    try {
      if (scope === "session") {
        // Check if there's an active session
        const isActive = await window.electron?.session?.isActive(game);

        if (isActive) {
          // If session is active, load from current session
          loadedStats = await window.electron?.session?.getCurrent(game);
        } else {
          // No active session, return empty stats
          loadedStats = { totalCount: 0, cards: [] };
        }
      } else if (scope === "all-time") {
        // Load all-time stats from DataStore Service
        loadedStats = await window.electron?.dataStore?.getAllTime(game);
      } else if (scope === "league" && league) {
        // Load league-specific stats from DataStore Service
        loadedStats = await window.electron?.dataStore?.getLeague(game, league);
      }

      setStats(loadedStats);
    } catch (error) {
      console.error("Error loading stats:", error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [game, scope, league]);

  const loadAvailableLeagues = useCallback(async () => {
    try {
      const leagues = await window.electron?.dataStore?.getLeagues(game);
      setAvailableLeagues(leagues || []);
    } catch (error) {
      console.error("Error loading leagues:", error);
      setAvailableLeagues([]);
    }
  }, [game]);

  useEffect(() => {
    loadStats();
    loadAvailableLeagues();

    // Listen for session state changes to reload data
    const handleSessionStateChange = (data: {
      game: string;
      isActive: boolean;
      sessionInfo: any;
    }) => {
      if (data.game === game) {
        loadStats();
      }
    };

    // Listen for real-time session data updates (when cards are added)
    const handleSessionDataUpdate = (data: { game: string; data: any }) => {
      if (scope === "session" && data.game === game) {
        setStats(data.data);
      }
    };

    const cleanupSession = window.electron?.session?.onStateChanged(
      handleSessionStateChange,
    );
    const cleanupData = window.electron?.session?.onDataUpdated(
      handleSessionDataUpdate,
    );

    // Listen for incremental card delta updates
    const handleCardDelta = (data: { game: string; delta: any }) => {
      if (scope === "session" && data.game === game) {
        setStats((prev) => {
          if (!prev) return prev;
          // Only DetailedDivinationCardStats has a cards array
          if (!Array.isArray((prev as any).cards)) return prev;

          const detailed = prev as DetailedDivinationCardStats;
          const delta = data.delta;
          const updatedCards = [...(detailed.cards || [])];

          const existingIdx = updatedCards.findIndex(
            (c) => c.name === delta.cardName,
          );
          if (existingIdx >= 0) {
            updatedCards[existingIdx] = {
              ...updatedCards[existingIdx],
              count: delta.newCount,
              exchangePrice: updatedCards[existingIdx].exchangePrice
                ? {
                    ...updatedCards[existingIdx].exchangePrice!,
                    totalValue:
                      (updatedCards[existingIdx].exchangePrice!.chaosValue ??
                        0) * delta.newCount,
                  }
                : undefined,
              stashPrice: updatedCards[existingIdx].stashPrice
                ? {
                    ...updatedCards[existingIdx].stashPrice!,
                    totalValue:
                      (updatedCards[existingIdx].stashPrice!.chaosValue ?? 0) *
                      delta.newCount,
                  }
                : undefined,
            };
          } else {
            const newCard: any = {
              name: delta.cardName,
              count: delta.newCount,
            };
            if (delta.exchangePrice) {
              newCard.exchangePrice = {
                chaosValue: delta.exchangePrice.chaosValue,
                divineValue: delta.exchangePrice.divineValue,
                totalValue: delta.exchangePrice.chaosValue * delta.newCount,
                hidePrice: delta.hidePriceExchange ?? false,
              };
            }
            if (delta.stashPrice) {
              newCard.stashPrice = {
                chaosValue: delta.stashPrice.chaosValue,
                divineValue: delta.stashPrice.divineValue,
                totalValue: delta.stashPrice.chaosValue * delta.newCount,
                hidePrice: delta.hidePriceStash ?? false,
              };
            }
            if (delta.divinationCard) {
              newCard.divinationCard = delta.divinationCard;
            }
            updatedCards.push(newCard);
          }

          const updatedRecentDrops = delta.recentDrop
            ? [delta.recentDrop, ...(detailed.recentDrops || [])].slice(0, 20)
            : detailed.recentDrops;

          return {
            ...detailed,
            totalCount: delta.totalCount,
            cards: updatedCards,
            totals: delta.updatedTotals ?? detailed.totals,
            recentDrops: updatedRecentDrops,
          };
        });
      }
    };

    const cleanupCardDelta =
      window.electron?.session?.onCardDelta?.(handleCardDelta);

    return () => {
      cleanupSession?.();
      cleanupData?.();
      cleanupCardDelta?.();
    };
  }, [loadStats, loadAvailableLeagues, game, scope]);

  return {
    stats,
    loading,
    reload: loadStats,
    availableLeagues,
  };
};
