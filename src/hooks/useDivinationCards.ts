import { useCallback, useEffect, useState } from "react";
import type { DivinationCardStats } from "../../types/electron";

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
          loadedStats = { totalCount: 0, cards: {} };
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

    return () => {
      cleanupSession?.();
      cleanupData?.();
    };
  }, [loadStats, loadAvailableLeagues, game, scope]);

  return {
    stats,
    loading,
    reload: loadStats,
    availableLeagues,
  };
};
