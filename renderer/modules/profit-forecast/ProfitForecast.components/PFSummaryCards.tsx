import clsx from "clsx";
import { FiLock, FiRefreshCw } from "react-icons/fi";

import { Countdown, GroupedStats, Stat } from "~/renderer/components";
import { useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import { formatDivine } from "../ProfitForecast.utils";

/** Skeleton matching stat-value with text-lg (18px / 1.75rem line-height). */
const Skeleton = ({ className = "w-20" }: { className?: string }) => (
  <div
    className={`skeleton rounded ${className}`}
    style={{ height: "1.75rem" }}
  />
);

/** Skeleton matching stat-desc (12px / 1rem line-height). */
const SkeletonDesc = () => (
  <div className="skeleton rounded w-24" style={{ height: "1rem" }} />
);

const PFSummaryCards = () => {
  const {
    settings: { getSelectedGame, getActiveGameViewSelectedLeague },
    profitForecast: {
      isLoading,
      isComputing,
      evPerDeck,
      chaosToDivineRatio,
      baseRate,
      baseRateSource,
      snapshotFetchedAt,
      getTotalCost,
      getTotalRevenue,
      getNetPnL,
      getBreakEvenRate,
      getAvgCostPerDeck,
      hasData,
      fetchData,
    },
    poeNinja: { isRefreshing, refreshPrices, getRefreshableAt },
  } = useBoundStore();

  const game = getSelectedGame();
  const league = getActiveGameViewSelectedLeague();

  // ─── Cooldown logic (mirrors PFHeaderActions) ──────────────────────────

  const refreshableAt = getRefreshableAt(game, league);

  const cooldownTimer = useTickingTimer({
    referenceTime: refreshableAt,
    direction: "down",
  });

  const isOnCooldown = cooldownTimer.totalMs > 0;
  const refreshDisabled = isOnCooldown || isRefreshing || isLoading;

  const handleRefresh = async () => {
    if (isOnCooldown || isRefreshing || !league) return;
    await refreshPrices(game, league);
    await fetchData(game, league);
  };

  // ─── Derived values ────────────────────────────────────────────────────

  const showSkeleton = isLoading || isComputing || isRefreshing;
  const dataAvailable = hasData() && !isLoading;

  const totalCost = dataAvailable ? getTotalCost() : 0;
  const totalRevenue = dataAvailable ? getTotalRevenue() : 0;
  const netPnL = dataAvailable ? getNetPnL() : 0;
  const breakEvenRate = dataAvailable ? getBreakEvenRate() : 0;
  const avgCostPerDeck = dataAvailable ? getAvgCostPerDeck() : 0;

  const pnlIsPositive = netPnL >= 0;
  const breakEvenIsGood = baseRate > breakEvenRate && breakEvenRate > 0;

  const avgCostPerDeckDivine =
    chaosToDivineRatio > 0 ? avgCostPerDeck / chaosToDivineRatio : 0;

  const evPerDeckDivine =
    chaosToDivineRatio > 0 ? evPerDeck / chaosToDivineRatio : 0;

  const formattedSnapshotDate = (() => {
    if (!snapshotFetchedAt) return null;
    try {
      const date = new Date(snapshotFetchedAt);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  })();

  return (
    <GroupedStats direction="horizontal" className="shadow-sm shrink-0 w-full">
      {/* Base Rate */}
      <Stat data-onboarding="pf-base-rate">
        <Stat.Title>
          <span className="inline-flex items-center gap-1.5">
            Base Rate
            {dataAvailable && baseRateSource === "derived" && (
              <span className="badge badge-xs badge-warning">derived</span>
            )}
          </span>
        </Stat.Title>
        <Stat.Value className="text-lg">
          {showSkeleton ? (
            <Skeleton />
          ) : dataAvailable && baseRate > 0 ? (
            `${baseRate} decks/div`
          ) : (
            "—"
          )}
        </Stat.Value>
        <Stat.Desc>
          {showSkeleton ? (
            <SkeletonDesc />
          ) : dataAvailable && formattedSnapshotDate ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-base-content/50">
                {formattedSnapshotDate}
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshDisabled}
                className={clsx(
                  "badge badge-xs gap-1 cursor-pointer select-none transition-colors",
                  refreshDisabled
                    ? "badge-ghost text-base-content/30 cursor-not-allowed"
                    : "badge-info badge-outline",
                )}
              >
                {isOnCooldown ? (
                  <>
                    <FiLock className="w-2.5 h-2.5" />
                    <Countdown
                      timer={cooldownTimer}
                      size="xs"
                      alwaysShowHours
                      showLabels
                      labelPosition="absolute"
                    />
                  </>
                ) : (
                  <>
                    <FiRefreshCw
                      className={clsx("w-2.5 h-2.5", {
                        "animate-spin": isRefreshing,
                      })}
                    />
                    Refresh
                  </>
                )}
              </button>
            </span>
          ) : null}
        </Stat.Desc>
      </Stat>

      {/* You Spend */}
      <Stat>
        <Stat.Title>You Spend</Stat.Title>
        <Stat.Value className="text-lg">
          {showSkeleton ? (
            <Skeleton />
          ) : dataAvailable ? (
            formatDivine(totalCost, chaosToDivineRatio)
          ) : (
            "—"
          )}
        </Stat.Value>
        <Stat.Desc>
          {showSkeleton ? (
            <SkeletonDesc />
          ) : dataAvailable ? (
            `avg ${avgCostPerDeckDivine.toFixed(2)} d/deck`
          ) : null}
        </Stat.Desc>
      </Stat>

      {/* Expected Return */}
      <Stat>
        <Stat.Title>Expected Return</Stat.Title>
        <Stat.Value className="text-lg">
          {showSkeleton ? (
            <Skeleton />
          ) : dataAvailable ? (
            formatDivine(totalRevenue, chaosToDivineRatio)
          ) : (
            "—"
          )}
        </Stat.Value>
        <Stat.Desc>
          {showSkeleton ? (
            <SkeletonDesc />
          ) : dataAvailable ? (
            `${evPerDeckDivine.toFixed(2)} d avg value/deck`
          ) : null}
        </Stat.Desc>
      </Stat>

      {/* Net Profit */}
      <Stat>
        <Stat.Title>Net Profit</Stat.Title>
        <Stat.Value
          className={`text-lg ${
            dataAvailable ? (pnlIsPositive ? "text-success" : "text-error") : ""
          }`}
        >
          {showSkeleton ? (
            <Skeleton />
          ) : dataAvailable ? (
            `${netPnL >= 0 ? "+" : "\u2212"}${formatDivine(
              Math.abs(netPnL),
              chaosToDivineRatio,
            )}`
          ) : (
            "—"
          )}
        </Stat.Value>
        <Stat.Desc>&nbsp;</Stat.Desc>
      </Stat>

      {/* Break-Even Rate */}
      <Stat data-onboarding="pf-break-even-rate">
        <Stat.Title>Break-Even Rate</Stat.Title>
        <Stat.Value
          className={`text-lg ${
            dataAvailable && breakEvenRate > 0
              ? breakEvenIsGood
                ? "text-success"
                : "text-error"
              : ""
          }`}
        >
          {showSkeleton ? (
            <Skeleton />
          ) : dataAvailable && breakEvenRate > 0 ? (
            `${Math.ceil(breakEvenRate)} decks/div`
          ) : (
            "—"
          )}
        </Stat.Value>
        <Stat.Desc>
          {showSkeleton ? (
            <SkeletonDesc />
          ) : dataAvailable && breakEvenRate > 0 ? (
            `need \u2265 ${Math.ceil(breakEvenRate)} to break even`
          ) : null}
        </Stat.Desc>
      </Stat>
    </GroupedStats>
  );
};

export default PFSummaryCards;
