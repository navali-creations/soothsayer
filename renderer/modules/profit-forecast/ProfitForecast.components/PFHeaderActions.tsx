import clsx from "clsx";
import { useState } from "react";
import { FiHelpCircle, FiLock, FiRefreshCw } from "react-icons/fi";

import { Button, Countdown, Search } from "~/renderer/components";
import { formatTickingTimer, useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import PFHelpModal from "./PFHelpModal";

interface PFHeaderActionsProps {
  onGlobalFilterChange: (value: string) => void;
}

const PFHeaderActions = ({ onGlobalFilterChange }: PFHeaderActionsProps) => {
  const [helpOpen, setHelpOpen] = useState(false);

  const {
    settings: { getSelectedGame, getActiveGameViewSelectedLeague },
    poeNinja: { isRefreshing, refreshPrices, getRefreshableAt },
    profitForecast: { isLoading, isComputing, fetchData },
  } = useBoundStore();

  const game = getSelectedGame();
  const league = getActiveGameViewSelectedLeague();

  // ─── Backend-driven cooldown ───────────────────────────────────────────

  const refreshableAt = getRefreshableAt(game, league);

  const cooldownTimer = useTickingTimer({
    referenceTime: refreshableAt,
    direction: "down",
  });

  const isOnCooldown = cooldownTimer.totalMs > 0;
  const refreshDisabled = isOnCooldown || isRefreshing || isLoading;
  const controlsDisabled = isRefreshing || isLoading;

  // ─── Refresh handler ──────────────────────────────────────────────────

  const handleRefreshPrices = async () => {
    if (isOnCooldown || isRefreshing || !league) return;
    await refreshPrices(game, league);
    await fetchData(game, league);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Help modal */}
      <PFHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Help button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setHelpOpen(true)}
        className="gap-1"
      >
        <FiHelpCircle className="w-4 h-4" />
      </Button>

      {/* Search input */}
      <Search
        onChange={onGlobalFilterChange}
        debounceMs={300}
        placeholder="Search cards..."
        size="sm"
        className="flex-1 w-[150px]"
        disabled={controlsDisabled || isComputing}
      />

      {/* Refresh poe.ninja prices button */}
      <div
        className={clsx(
          "tooltip tooltip-left",
          isOnCooldown ? "tooltip-warning" : "tooltip-primary",
        )}
        data-tip={
          isOnCooldown
            ? `Available ${formatTickingTimer(cooldownTimer)}`
            : isRefreshing
              ? "Refreshing..."
              : "Fetch latest prices from poe.ninja"
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshPrices}
          disabled={refreshDisabled}
          className="gap-1.5"
        >
          {isOnCooldown ? (
            <FiLock className="w-3.5 h-3.5" />
          ) : (
            <FiRefreshCw
              className={clsx("w-3.5 h-3.5", {
                "animate-spin": isRefreshing,
              })}
            />
          )}
          {isRefreshing ? (
            "Refreshing..."
          ) : isOnCooldown ? (
            <Countdown timer={cooldownTimer} size="xs" />
          ) : (
            "Refresh poe.ninja"
          )}
        </Button>
      </div>
    </div>
  );
};

export default PFHeaderActions;
