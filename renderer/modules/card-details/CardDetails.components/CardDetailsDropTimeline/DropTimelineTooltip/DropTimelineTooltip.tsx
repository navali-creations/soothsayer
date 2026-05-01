import { Badge } from "~/renderer/components";
import { LegendIcon } from "~/renderer/components/CombinedChartCanvas";

import type { ChartDataPoint, DropTimelinePointMetrics } from "../types";
import {
  formatExpectedDrops,
  roundedExpectedDrops,
} from "./DropTimelineTooltip.utils";

interface DropTimelineTooltipProps {
  dataPoint: ChartDataPoint | null | undefined;
  metrics?: DropTimelinePointMetrics | null;
}

function DropTimelineTooltip({ dataPoint, metrics }: DropTimelineTooltipProps) {
  if (!dataPoint || dataPoint.isGap || dataPoint.isBoundary) return null;
  const expectedDrops = metrics?.anticipatedDrops ?? 0;
  const metExpected = dataPoint.count >= roundedExpectedDrops(expectedDrops);
  const sessionLabel =
    dataPoint.sessionCount === 1
      ? "1 session"
      : `${dataPoint.sessionCount.toLocaleString()} sessions`;
  const decksLabel = `${dataPoint.totalDecksOpened.toLocaleString()} decks`;

  const date = new Date(dataPoint.sessionStartedAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <div className="bg-base-300/95 backdrop-blur-sm border border-base-content/8 rounded-xl px-3.5 py-2.5 shadow-xl text-sm min-w-45">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-semibold text-base-content text-xs tracking-wide">
          {date}
        </p>
        <Badge
          variant="ghost"
          size="xs"
          className="font-medium max-w-30 truncate text-[10px] text-primary border border-primary/25 bg-primary/10"
        >
          {dataPoint.league}
        </Badge>
      </div>

      <div className="h-px bg-base-content/8 -mx-3.5 mb-2" />

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-base-content/50">
            <span className="text-primary">
              <LegendIcon visual="bar" color="currentColor" />
            </span>
            <span>Dropped</span>
          </span>
          <span
            className={`font-semibold tabular-nums ${
              metExpected ? "text-success" : "text-error"
            }`}
          >
            {dataPoint.count}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-base-content/50">
            <span className="text-base-content/35">
              <LegendIcon visual="bar" color="currentColor" />
            </span>
            <span>Expected</span>
          </span>
          <span className="font-semibold tabular-nums text-base-content">
            {formatExpectedDrops(expectedDrops)}
          </span>
        </div>
        <div className="h-px bg-base-content/6 -mx-3.5 my-1.5" />
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          <Badge
            variant="ghost"
            size="xs"
            className="font-medium text-[10px] text-base-content/70 border border-base-content/12 bg-base-content/[0.06]"
          >
            {decksLabel}
          </Badge>
          <Badge
            variant="ghost"
            size="xs"
            className="font-medium text-[10px] text-base-content/70 border border-base-content/12 bg-base-content/[0.06]"
          >
            {sessionLabel}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export default DropTimelineTooltip;
