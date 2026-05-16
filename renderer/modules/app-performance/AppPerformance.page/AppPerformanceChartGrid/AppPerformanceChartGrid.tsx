import clsx from "clsx";

import { useAppPerformanceSelector } from "~/renderer/store";

import { PerformanceChartCard } from "../../AppPerformance.components";
import type { AppPerformanceChartConfig } from "../../AppPerformance.utils/AppPerformance.utils";

interface AppPerformanceChartGridProps {
  charts: AppPerformanceChartConfig[];
  compact?: boolean;
}

export function AppPerformanceChartGrid({
  charts,
  compact = false,
}: AppPerformanceChartGridProps) {
  const focusedChart = useAppPerformanceSelector(
    (appPerformance) => appPerformance.focusedChart,
  );

  return (
    <div
      className={clsx({
        contents: compact,
        "flex min-h-120 flex-col": focusedChart !== null && !compact,
        "grid grid-cols-1 gap-4 lg:grid-cols-3":
          focusedChart === null && !compact,
      })}
    >
      {charts.map((chart) => (
        <PerformanceChartCard
          key={chart.key}
          chartKey={chart.key}
          title={chart.title}
          subtitle={chart.subtitle}
          lines={chart.lines}
          statFormatter={chart.statFormatter}
          compact={compact}
          yMaxFloor={chart.yMaxFloor}
          secondaryYMaxFloor={chart.secondaryYMaxFloor}
          valueFormatter={chart.valueFormatter}
          secondaryValueFormatter={chart.secondaryValueFormatter}
        />
      ))}
    </div>
  );
}
