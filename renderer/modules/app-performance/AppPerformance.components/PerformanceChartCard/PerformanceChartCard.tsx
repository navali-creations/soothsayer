import clsx from "clsx";
import { useMemo, useState } from "react";
import { FiMaximize2, FiMinimize2 } from "react-icons/fi";

import { Button } from "~/renderer/components";
import {
  ChartLegend,
  type ChartLegendItem,
} from "~/renderer/components/CombinedChartCanvas/ChartLegend";
import { useAppPerformanceShallow } from "~/renderer/store";

import type { AppPerformanceChartKey } from "../../AppPerformance.types";
import { formatMetricStats } from "../../AppPerformance.utils/AppPerformance.utils";
import { PerformanceLineChartCanvas } from "../PerformanceLineChartCanvas/PerformanceLineChartCanvas";
import type { PerformanceLine } from "../PerformanceLineChartCanvas/PerformanceLineChartCanvas.types";

interface MetricStats {
  current: string;
  min: string;
  avg: string;
  max: string;
}

interface TimeRange {
  startMs: number;
  endMs: number;
}

const LIVE_COMPACT_WINDOW_MS = 60_000;

interface PerformanceChartCardProps {
  chartKey: AppPerformanceChartKey;
  title: string;
  subtitle: string;
  lines: PerformanceLine[];
  statFormatter: (value: number | null) => string;
  compact?: boolean;
  yMaxFloor: number;
  secondaryYMaxFloor?: number;
  valueFormatter: (value: number | null) => string;
  secondaryValueFormatter?: (value: number | null) => string;
}

export function PerformanceChartCard({
  chartKey,
  title,
  subtitle,
  lines,
  statFormatter,
  compact = false,
  yMaxFloor,
  secondaryYMaxFloor,
  valueFormatter,
  secondaryValueFormatter,
}: PerformanceChartCardProps) {
  const {
    captureStartedAt,
    captureStoppedAt,
    focusedChart,
    isSampling,
    metricStats,
    routeMarkers,
    samples,
    setFocusedChart,
  } = useAppPerformanceShallow((appPerformance) => ({
    captureStartedAt: appPerformance.captureStartedAt,
    captureStoppedAt: appPerformance.captureStoppedAt,
    focusedChart: appPerformance.focusedChart,
    isSampling: appPerformance.isSampling,
    metricStats: appPerformance.metricStats[chartKey],
    routeMarkers: appPerformance.routeMarkers,
    samples: appPerformance.samples,
    setFocusedChart: appPerformance.setFocusedChart,
  }));
  const focused = focusedChart === chartKey;
  const [brushRange, setBrushRange] = useState<TimeRange | null>(null);
  const showBrush = focused && samples.length > 4;
  const handleFocusToggle = () => {
    setFocusedChart(focused ? null : chartKey);
  };
  const stats = useMemo<MetricStats>(
    () => formatMetricStats(metricStats, statFormatter),
    [metricStats, statFormatter],
  );
  const captureDurationMs =
    captureStartedAt && captureStoppedAt
      ? Math.max(
          1,
          new Date(captureStoppedAt).getTime() -
            new Date(captureStartedAt).getTime(),
        )
      : null;
  const effectiveBrushRange = useMemo(() => {
    if (showBrush) return brushRange;
    if (!isSampling || focused) return null;

    const latestElapsedMs = samples.at(-1)?.captureElapsedMs ?? null;
    if (latestElapsedMs === null || latestElapsedMs <= LIVE_COMPACT_WINDOW_MS) {
      return null;
    }

    return {
      startMs: latestElapsedMs - LIVE_COMPACT_WINDOW_MS,
      endMs: latestElapsedMs,
    };
  }, [brushRange, focused, isSampling, samples, showBrush]);
  const legendItems = useMemo<ChartLegendItem[]>(
    () =>
      lines.map((line) => ({
        id: line.id,
        label: line.label,
        visual: line.dashed ? "dashed-line" : "line",
        color: line.color,
      })),
    [lines],
  );
  const visibleRouteMarkers = focused ? routeMarkers : [];

  return (
    <section
      className={clsx("card min-w-0 bg-base-200 shadow-xl", {
        "min-h-140 flex-1": focused,
        "min-h-58": !focused && compact,
        "min-h-76": !focused && !compact,
      })}
    >
      <div className="card-body gap-2 p-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 shrink-0">
            <h2 className="card-title text-sm leading-tight">{title}</h2>
          </div>
          <p className="min-w-0 truncate text-xs text-base-content/45">
            {subtitle}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            square
            title={focused ? "Collapse chart" : "Focus chart"}
            onClick={handleFocusToggle}
          >
            {focused ? <FiMinimize2 /> : <FiMaximize2 />}
          </Button>
        </div>

        <div className="grid grid-cols-4 divide-x divide-base-content/8 overflow-hidden rounded-lg border border-base-content/8 bg-base-300/30">
          {[
            ["Last", stats.current],
            ["Min", stats.min],
            ["Avg", stats.avg],
            ["Max", stats.max],
          ].map(([label, value]) => (
            <div key={label} className="px-3 py-2">
              <div className="text-[10px] font-medium uppercase text-base-content/45">
                {label}
              </div>
              <div className="truncate text-sm font-semibold tabular-nums text-base-content/90">
                {value}
              </div>
            </div>
          ))}
        </div>

        <ChartLegend
          className="max-w-full flex-wrap justify-end gap-x-3 gap-y-1"
          items={legendItems}
        />

        <PerformanceLineChartCanvas
          samples={samples}
          routeMarkers={visibleRouteMarkers}
          lines={lines}
          yMaxFloor={yMaxFloor}
          secondaryYMaxFloor={secondaryYMaxFloor}
          valueFormatter={valueFormatter}
          secondaryValueFormatter={secondaryValueFormatter}
          xRange={effectiveBrushRange}
          showBrush={showBrush}
          live={isSampling}
          captureDurationMs={captureDurationMs}
          onXRangeChange={setBrushRange}
        />
      </div>
    </section>
  );
}
