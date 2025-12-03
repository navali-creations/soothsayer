import { useState, useEffect, useCallback } from "react";

type GameType = "poe1" | "poe2";

interface SessionInfo {
  league: string;
  startedAt: string;
}

interface UseSessionOptions {
  game?: GameType;
}

export const useSession = (options: UseSessionOptions = {}) => {
  const { game = "poe1" } = options;

  const [isActive, setIsActive] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check session status
  const checkStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const active = await window.electron.session.isActive(game);
      setIsActive(active);

      if (active) {
        const info = await window.electron.session.getInfo(game);
        setSessionInfo(info);
      } else {
        setSessionInfo(null);
      }
    } catch (err) {
      console.error("Error checking session status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [game]);

  // Start session
  const start = useCallback(
    async (league: string) => {
      try {
        setError(null);
        const result = await window.electron.session.start(game, league);

        if (result.success) {
          // State will be updated by the event listener
          return { success: true };
        } else {
          setError(result.error || "Failed to start session");
          return { success: false, error: result.error };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [game],
  );

  // Stop session
  const stop = useCallback(async () => {
    try {
      setError(null);
      const result = await window.electron.session.stop(game);

      if (result.success) {
        // State will be updated by the event listener
        return { success: true };
      } else {
        setError(result.error || "Failed to stop session");
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [game]);

  // Listen for session state changes
  useEffect(() => {
    // Initial check
    checkStatus();

    // Subscribe to state changes
    const cleanup = window.electron.session.onStateChanged((data) => {
      // Only update if it's for our game
      if (data.game === game) {
        setIsActive(data.isActive);
        setSessionInfo(data.sessionInfo);
      }
    });

    return cleanup;
  }, [game, checkStatus]);

  return {
    isActive,
    sessionInfo,
    loading,
    error,
    start,
    stop,
    refresh: checkStatus,
  };
};
