import clsx from "clsx";
import { FiLock, FiRefreshCw } from "react-icons/fi";

import { Button, Countdown, Search } from "~/renderer/components";
import { formatTickingTimer, useTickingTimer } from "~/renderer/hooks";
import { usePoeNinja, useSettings } from "~/renderer/store";

import RarityInsightsDropdown from "../RarityInsightsSidebar/RarityInsightsSidebar";

interface RarityInsightsHeaderActionsProps {
  onGlobalFilterChange: (value: string) => void;
}

const RarityInsightsHeaderActions = ({
  onGlobalFilterChange,
}: RarityInsightsHeaderActionsProps) => {
  const { getSelectedGame, getActiveGameViewSelectedLeague } = useSettings();
  const { isRefreshing, refreshPrices, getRefreshableAt } = usePoeNinja();

  const game = getSelectedGame();
  const league = getActiveGameViewSelectedLeague();

  // ─── Backend-driven cooldown ───────────────────────────────────────────

  const refreshableAt = getRefreshableAt(game, league);

  const cooldownTimer = useTickingTimer({
    referenceTime: refreshableAt,
    direction: "down",
  });

  const isOnCooldown = cooldownTimer.totalMs > 0;
  const refreshDisabled = isOnCooldown || isRefreshing;

  // ─── Refresh handler ──────────────────────────────────────────────────

  const handleRefreshPrices = async () => {
    if (isOnCooldown || isRefreshing || !league) return;
    await refreshPrices(game, league);
  };

  return (
    <div className="flex items-center gap-2">
      <Search
        onChange={onGlobalFilterChange}
        debounceMs={300}
        placeholder="Search cards..."
        size="sm"
        className="flex-1 w-[150px]"
        disabled={isRefreshing}
      />

      {/* Refresh poe.ninja prices button */}
      <div
        data-onboarding="rarity-insights-refresh"
        className={clsx(
          "tooltip tooltip-bottom",
          isOnCooldown ? "tooltip-warning" : "tooltip-primary",
        )}
        data-tip={
          isOnCooldown
            ? `Available in ${formatTickingTimer(cooldownTimer)}`
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

      <RarityInsightsDropdown />
    </div>
  );
};

export default RarityInsightsHeaderActions;
