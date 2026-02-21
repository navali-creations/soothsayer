import { useCallback } from "react";
import { FiDatabase, FiRefreshCw } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

/**
 * Formats an ISO timestamp into a human-readable relative time string.
 * e.g. "2 minutes ago", "3 hours ago", "1 day ago"
 */
function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  return "just now";
}

const ProhibitedLibraryStatusBlock = () => {
  const {
    prohibitedLibrary: { poe1Status, poe2Status, isLoading, loadError, reload },
    settings: { getSelectedGame, getActiveGameViewSelectedLeague },
  } = useBoundStore();

  const activeGame = getSelectedGame();
  const activeLeague = getActiveGameViewSelectedLeague();
  const status = activeGame === "poe1" ? poe1Status : poe2Status;

  const handleReload = useCallback(async () => {
    await reload();
  }, [reload]);

  // Show league mismatch warning if PL data is from a different league
  const showLeagueMismatch =
    status?.hasData && status.league && status.league !== activeLeague;

  return (
    <div className="mt-3 rounded-lg bg-base-200/50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-base-content/80">
        <FiDatabase className="w-3.5 h-3.5" />
        <span>Prohibited Library Data</span>
      </div>

      {/* Error state */}
      {loadError && <p className="text-xs text-error">{loadError}</p>}

      {/* Active game status */}
      {status?.hasData ? (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-base-content/50">League</span>
            <span className="text-base-content/80 font-medium">
              {status.league ?? "Unknown"}
            </span>

            <span className="text-base-content/50">Cards loaded</span>
            <span className="text-base-content/80 font-medium">
              {status.cardCount} cards
            </span>

            {status.appVersion && (
              <>
                <span className="text-base-content/50">App version</span>
                <span className="text-base-content/80 font-medium">
                  v{status.appVersion}
                </span>
              </>
            )}

            <span className="text-base-content/50">Last loaded</span>
            <span className="text-base-content/80 font-medium">
              {status.lastLoadedAt
                ? formatRelativeTime(status.lastLoadedAt)
                : "Never"}
            </span>
          </div>

          {/* League mismatch warning */}
          {showLeagueMismatch && (
            <div className="flex items-start gap-1.5 mt-1 p-2 rounded bg-warning/10 border border-warning/20">
              <span className="text-warning text-xs leading-relaxed">
                Showing data from <strong>{status.league}</strong> (current
                league: <strong>{activeLeague}</strong>). Update available in
                next app release.
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-base-content/50">
          {isLoading ? "Loading status…" : "No data loaded yet"}
        </p>
      )}

      {/* PoE2 status */}
      {activeGame === "poe1" && poe2Status && !poe2Status.hasData && (
        <p className="text-xs text-base-content/40 italic">
          No PoE2 data bundled yet
        </p>
      )}
      {activeGame === "poe2" && poe1Status && !poe1Status.hasData && (
        <p className="text-xs text-base-content/40 italic">
          No PoE1 data bundled yet
        </p>
      )}

      {/* Reload button */}
      <div className="pt-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={handleReload}
          disabled={isLoading}
          loading={isLoading}
          className="gap-1"
        >
          {!isLoading && <FiRefreshCw className="w-3 h-3" />}
          Reload
        </Button>
      </div>
    </div>
  );
};

export default ProhibitedLibraryStatusBlock;
