import { FiInfo } from "react-icons/fi";

import { Stat } from "~/renderer/components";

export interface CardPoolBreakdown {
  total: number;
  bossOnly: number;
  disabled: number;
  droppable: number;
}

interface StatsUniqueCardsCollectedProps {
  collectedCount: number;
  totalAvailable: number | null;
  breakdown: CardPoolBreakdown | null;
}

export const StatsUniqueCardsCollected = ({
  collectedCount,
  totalAvailable,
  breakdown,
}: StatsUniqueCardsCollectedProps) => {
  const hasTotal = totalAvailable !== null && totalAvailable > 0;
  const percentage = hasTotal
    ? Math.round((collectedCount / totalAvailable) * 100)
    : null;

  const tooltipText = breakdown
    ? `${breakdown.total} total in league · ${breakdown.bossOnly} boss-only · ${breakdown.disabled} disabled · ${breakdown.droppable} droppable`
    : null;

  return (
    <Stat className="flex-1 basis-1/4 min-w-0 relative">
      {tooltipText && (
        <div className="absolute top-1.5 right-1.5 z-10">
          <div
            className="tooltip tooltip-left tooltip-primary"
            data-tip={tooltipText}
          >
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle opacity-40 hover:opacity-80"
            >
              <FiInfo size={12} />
            </button>
          </div>
        </div>
      )}
      <Stat.Title>Unique Cards Collected</Stat.Title>
      <Stat.Value className="text-lg tabular-nums">
        {hasTotal ? (
          <>
            {collectedCount}
            <span className="text-sm opacity-50 ml-0.5">
              / {totalAvailable}
            </span>
          </>
        ) : (
          collectedCount
        )}
      </Stat.Value>
      <Stat.Desc>
        {percentage !== null ? (
          <div className="flex items-center gap-2 mt-1">
            <progress
              className="progress progress-primary w-20 h-2"
              value={percentage}
              max={100}
            />
            <span>{percentage}%</span>
          </div>
        ) : (
          "Different cards found"
        )}
      </Stat.Desc>
    </Stat>
  );
};
