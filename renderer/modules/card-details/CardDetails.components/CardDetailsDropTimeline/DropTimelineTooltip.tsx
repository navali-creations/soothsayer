import type { TooltipProps } from "recharts";

import type { ChartDataPoint } from "./types";

// ─── Custom Tooltip ────────────────────────────────────────────────────────

function DropTimelineTooltip({
  active,
  payload,
}: TooltipProps<number | string | Array<number | string>, number | string>) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload as ChartDataPoint | undefined;
  if (!data || data.isGap || data.isBoundary) return null;

  const date = new Date(data.sessionStartedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-base-300 border border-base-content/10 rounded-lg p-3 shadow-lg text-sm space-y-1.5">
      <p className="font-semibold text-base-content">{date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-base-content/50">League</span>
        <span className="font-semibold text-right">{data.league}</span>
        <span className="text-base-content/50">Dropped</span>
        <span className="font-semibold tabular-nums text-right">
          {data.count}
        </span>
        {data.sessionCount > 1 && (
          <>
            <span className="text-base-content/50">Sessions</span>
            <span className="font-semibold tabular-nums text-right">
              {data.sessionCount}
            </span>
          </>
        )}
        <span className="text-base-content/50">Cumulative</span>
        <span className="font-semibold tabular-nums text-right">
          {data.cumulativeCount}
        </span>
        <span className="text-base-content/50">Decks Opened</span>
        <span className="font-semibold tabular-nums text-right">
          {data.totalDecksOpened.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default DropTimelineTooltip;
