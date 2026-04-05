import { useEffect, useMemo, useRef } from "react";
import { FiInfo, FiMaximize2, FiMinimize2 } from "react-icons/fi";
import { GiReceiveMoney } from "react-icons/gi";

import { AnimatedNumber, Stat } from "~/renderer/components";
import { useCurrentSession, useSettings } from "~/renderer/store";

import MiniProfitSparkline from "../../SessionProfitTimeline/MiniProfitSparkline/MiniProfitSparkline";
import { timelineBuffer } from "../../SessionProfitTimeline/timeline-buffer/timeline-buffer";

interface CurrentSessionNetProfitStatProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
  hasTimeline?: boolean;
}

const CurrentSessionNetProfitStat = ({
  expanded = false,
  onToggleExpanded,
  hasTimeline = false,
}: CurrentSessionNetProfitStatProps) => {
  const { getSession, getIsCurrentSessionActive } = useCurrentSession();
  const { getActiveGameViewPriceSource } = useSettings();

  const sessionData = getSession();
  const priceSource = getActiveGameViewPriceSource();
  const isActive = getIsCurrentSessionActive();

  // Track whether the sparkline has data via a ref + imperative subscription
  // so that buffer updates do NOT trigger React re-renders (avoids flicker).
  const sparklineWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const syncOpacity = () => {
      const el = sparklineWrapperRef.current;
      if (!el) return;
      const hasData =
        timelineBuffer.totalDrops > 0 || timelineBuffer.chartData.length > 0;
      el.style.opacity = hasData ? "1" : "0";
    };

    // Set initial opacity
    syncOpacity();

    // Subscribe — updates opacity imperatively, no React state change
    const unsub = timelineBuffer.subscribe(syncOpacity);
    return unsub;
  }, [isActive]);

  const { chaosToDivineRatio, netProfit, totalDeckCost } = useMemo(() => {
    if (!sessionData?.totals) {
      return { chaosToDivineRatio: 0, netProfit: 0, totalDeckCost: 0 };
    }
    return {
      chaosToDivineRatio: sessionData.totals[priceSource].chaosToDivineRatio,
      netProfit: sessionData.totals[priceSource].netProfit,
      totalDeckCost: sessionData.totals.totalDeckCost,
    };
  }, [sessionData?.totals, priceSource]);

  const hasSnapshot = !!sessionData?.priceSnapshot;
  const hasDeckCost = totalDeckCost > 0;
  const showAsDivine = Math.abs(netProfit) >= chaosToDivineRatio;

  return (
    <Stat className="bg-gradient-to-tl from-success/20 to-secondary/0 relative overflow-hidden">
      {/* Sparkline background — always rendered so ResizeObserver stays
          attached. Visibility is toggled imperatively via ref (no re-render). */}
      {isActive && (
        <div
          ref={sparklineWrapperRef}
          className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none"
          style={{ opacity: 0 }}
        >
          <MiniProfitSparkline className="absolute inset-0" />
        </div>
      )}

      <Stat.Figure className="absolute right-1 bottom-3">
        <GiReceiveMoney size={50} opacity={0.1} />
      </Stat.Figure>

      {/* Info & Enlarge icons — top-right corner */}
      <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5">
        <div
          className="tooltip tooltip-left tooltip-primary"
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
            className="tooltip tooltip-left tooltip-primary"
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
        <Stat.Value>
          {!hasSnapshot ? (
            <span className="text-base-content/50">N/A</span>
          ) : showAsDivine ? (
            <AnimatedNumber
              value={netProfit / chaosToDivineRatio}
              decimals={2}
              suffix="d"
              className={`tabular-nums ${netProfit < 0 ? "text-error" : ""}`}
            />
          ) : (
            <AnimatedNumber
              value={netProfit}
              decimals={2}
              suffix="c"
              className={`tabular-nums ${netProfit < 0 ? "text-error" : ""}`}
            />
          )}
        </Stat.Value>
        <Stat.Desc>
          {!hasSnapshot ? (
            <span className="text-base-content/50">No pricing data</span>
          ) : !hasDeckCost ? (
            <span className="text-base-content/50">No deck cost data</span>
          ) : showAsDivine ? (
            <span className="flex gap-1">
              <span className="-mt-0.5">≈</span>{" "}
              <AnimatedNumber value={netProfit} decimals={0} suffix=" chaos" />
              <span className="text-base-content/40">
                (-
                <AnimatedNumber value={totalDeckCost} decimals={0} suffix="c" />
                {" decks)"}
              </span>
            </span>
          ) : (
            <span className="flex gap-1">
              <span className="-mt-0.5">≈</span>{" "}
              <AnimatedNumber
                value={netProfit / chaosToDivineRatio}
                decimals={2}
                suffix=" divine"
              />
              <span className="text-base-content/40">
                (-
                <AnimatedNumber value={totalDeckCost} decimals={0} suffix="c" />
                {" decks)"}
              </span>
            </span>
          )}
        </Stat.Desc>
      </div>
    </Stat>
  );
};

export default CurrentSessionNetProfitStat;
