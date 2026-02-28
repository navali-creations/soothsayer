import clsx from "clsx";
import { FiLock, FiRefreshCw } from "react-icons/fi";

import { Button, Countdown, Search } from "~/renderer/components";
import { formatTickingTimer, useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import RarityModelDropdown from "./RarityModelSidebar";

interface RarityModelHeaderActionsProps {
  onGlobalFilterChange: (value: string) => void;
  isParsing: boolean;
}

const RarityModelHeaderActions = ({
  onGlobalFilterChange,
  isParsing,
}: RarityModelHeaderActionsProps) => {
  const {
    rarityModel: { isScanning },
    settings: { getSelectedGame, getActiveGameViewSelectedLeague },
    rarityModelComparison: { rescan },
    poeNinja: { isRefreshing, refreshPrices, getRefreshableAt },
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
        disabled={isParsing || isRefreshing}
      />

      {/* Refresh poe.ninja prices button */}
      <div
        data-onboarding="rarity-model-refresh"
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

      <div data-onboarding="rarity-model-scan" className="flex">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => !isScanning && !isParsing && rescan()}
          disabled={isScanning || isRefreshing}
          className="gap-1.5"
        >
          <FiRefreshCw
            className={clsx("w-3.5 h-3.5", {
              "animate-spin": isScanning,
            })}
          />
          {isScanning ? "Scanning..." : "Scan"}
        </Button>

        <RarityModelDropdown />
      </div>
    </div>
  );
};

export default RarityModelHeaderActions;
