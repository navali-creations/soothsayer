import { useMemo } from "react";
import { FiInfo, FiMaximize2, FiMinimize2 } from "react-icons/fi";

import { Stat, StaticProfitSparkline } from "~/renderer/components";
import { buildLinePoints } from "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/utils/utils";
import { useSessionDetails } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";

interface SessionDetailsNetProfitStatProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export const SessionDetailsNetProfitStat = ({
  expanded = false,
  onToggleExpanded,
}: SessionDetailsNetProfitStatProps) => {
  const {
    getNetProfit,
    getPriceData,
    getHasTimeline,
    getTimeline,
    getSession,
  } = useSessionDetails();
  const { netProfit, totalDeckCost } = getNetProfit();
  const { chaosToDivineRatio } = getPriceData();
  const hasTimeline = getHasTimeline();
  const timeline = getTimeline();
  const session = getSession();

  const linePoints = useMemo(() => {
    if (!hasTimeline || !timeline) return undefined;
    const deckCost = session?.priceSnapshot?.stackedDeckChaosCost ?? 0;
    return buildLinePoints(timeline, deckCost);
  }, [timeline, hasTimeline, session?.priceSnapshot?.stackedDeckChaosCost]);

  const hasDeckCost = totalDeckCost > 0;
  const hasSparkline = linePoints != null && linePoints.length >= 2;

  return (
    <Stat className="flex-1 basis-1/5 relative overflow-hidden">
      {/* Sparkline background — only rendered when we have enough data points */}
      {hasSparkline && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <StaticProfitSparkline
            linePoints={linePoints}
            lineColor="rgba(236, 72, 153, 0.5)"
            className="absolute inset-0"
          />
        </div>
      )}

      {/* Info & Enlarge icons — top-right corner */}
      <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5">
        <div
          className="tooltip tooltip-bottom tooltip-primary"
          data-tip="The sparkline shows your net profit over time. Notable card drops appear as vertical bars on the expanded timeline."
        >
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle bg-base-300/60"
          >
            <FiInfo size={12} />
          </button>
        </div>
        {hasTimeline && onToggleExpanded && (
          <div
            className="tooltip tooltip-bottom tooltip-primary"
            data-tip={expanded ? "Collapse timeline" : "Expand timeline"}
          >
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle bg-base-300/60"
              onClick={onToggleExpanded}
            >
              {expanded ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
            </button>
          </div>
        )}
      </div>

      <div className="relative z-10">
        <Stat.Title>
          <span
            className="underline decoration-dotted cursor-help"
            title="Total Value minus the cost of Stacked Decks opened. Represents actual profit if you purchased the decks."
          >
            Net Profit
          </span>
        </Stat.Title>
        <Stat.Value
          className={`tabular-nums ${
            netProfit < 0 ? "text-error" : "text-success"
          }`}
        >
          {formatCurrency(netProfit, chaosToDivineRatio)}
        </Stat.Value>
        <Stat.Desc>
          {hasDeckCost
            ? `After ${Math.floor(totalDeckCost)}c deck cost`
            : "No deck cost data"}
        </Stat.Desc>
      </div>
    </Stat>
  );
};
