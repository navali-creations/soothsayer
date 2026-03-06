import { FiAlertTriangle, FiInfo, FiZap } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

/**
 * "Your Luck" comparison section.
 *
 * Compares the user's actual drop rate against the statistical expectation
 * based on Prohibited Library weight data and total stacked decks opened.
 *
 * Reads `totalWeight` from the `profitForecast` slice and computes
 * the luck comparison via the `cardDetails.getLuckComparison` getter.
 */
const YourLuckSection = () => {
  const {
    cardDetails: { getLuckComparison },
    profitForecast: { totalWeight },
  } = useBoundStore();

  const luck = getLuckComparison(totalWeight);

  if (!luck) return null;

  const colorClass =
    luck.color === "success"
      ? "text-success"
      : luck.color === "error"
        ? "text-error"
        : "text-warning";

  const bgClass =
    luck.color === "success"
      ? "bg-success/10 border-success/20"
      : luck.color === "error"
        ? "bg-error/10 border-error/20"
        : "bg-warning/10 border-warning/20";

  return (
    <div className="space-y-2">
      <span className="text-base-content/50 text-sm flex items-center gap-1">
        <FiZap className="w-3 h-3" /> Your Luck
      </span>

      <div className={`p-3 rounded-lg border ${bgClass}`}>
        <p className={`text-sm font-semibold ${colorClass}`}>{luck.label}</p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
          <div>
            <span className="text-base-content/50">Expected</span>
            <p className="font-semibold tabular-nums">
              {luck.expectedDrops.toFixed(2)} drops
            </p>
          </div>
          <div>
            <span className="text-base-content/50">Actual</span>
            <p className="font-semibold tabular-nums">
              {luck.actualDrops.toLocaleString()} drops
            </p>
          </div>
        </div>

        {luck.luckRatio !== 1 &&
          Number.isFinite(luck.luckRatio) &&
          luck.luckRatio > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-base-content/50">
                <span>Luck ratio</span>
                <span className={`font-semibold tabular-nums ${colorClass}`}>
                  {luck.luckRatio.toFixed(2)}×
                </span>
              </div>
              {/* Visual bar */}
              <div className="w-full bg-base-300 rounded-full h-1.5 mt-1 overflow-hidden relative">
                {/* Center marker for "expected" (1×) */}
                <div className="absolute left-1/2 top-0 h-full w-px bg-base-content/20" />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    luck.color === "success"
                      ? "bg-success"
                      : luck.color === "error"
                        ? "bg-error"
                        : "bg-warning"
                  }`}
                  style={{
                    width: `${Math.min(
                      Math.max((luck.luckRatio / 2) * 100, 5),
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

        {!luck.hasSufficientData && (
          <div className="flex items-start gap-1.5 mt-2 text-xs text-base-content/40">
            <FiAlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              Not enough data for a reliable comparison. Open more stacked decks
              for better accuracy.
            </span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-1.5 text-xs text-base-content/30">
        <FiInfo className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          Based on total stacked decks opened across all sessions. Actual
          results may include cards from other sources (e.g. map drops).
        </span>
      </div>
    </div>
  );
};

export default YourLuckSection;
