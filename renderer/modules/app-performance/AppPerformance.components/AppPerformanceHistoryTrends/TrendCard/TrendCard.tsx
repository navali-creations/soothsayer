import clsx from "clsx";
import { useMemo, useState } from "react";
import { FiMaximize2, FiMinimize2 } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { ChartLegend } from "~/renderer/components/CombinedChartCanvas";
import type { useChartColors } from "~/renderer/hooks";
import { useAppPerformanceSelector } from "~/renderer/store";

import { PerformanceLineChartCanvas } from "../../PerformanceLineChartCanvas/PerformanceLineChartCanvas";
import {
  createLegendItems,
  createTrendLines,
  createTrendSample,
  formatReportDate,
  formatReportIndex,
  resolveSecondaryYMaxFloor,
  resolveYMaxFloor,
  SUMMARY_KEYS,
  type TrendPoint,
  type TrendSample,
  type TrendSpec,
  type TrendSpecId,
} from "../AppPerformanceHistoryTrends.utils";
import { SummaryCell } from "../SummaryCell/SummaryCell";

interface TimeRange {
  startMs: number;
  endMs: number;
}

interface TrendCardProps {
  spec: TrendSpec;
  colors: ReturnType<typeof useChartColors>;
  focused: boolean;
  compact?: boolean;
  onFocusChange: (trend: TrendSpecId | null) => void;
}

export function TrendCard({
  spec,
  colors,
  focused,
  compact = false,
  onFocusChange,
}: TrendCardProps) {
  const captures = useAppPerformanceSelector(
    (appPerformance) => appPerformance.captureHistory,
  );
  const [brushRange, setBrushRange] = useState<TimeRange | null>(null);
  const chronologicalCaptures = useMemo(
    () => [...captures].reverse(),
    [captures],
  );
  const points = useMemo<TrendPoint[]>(
    () =>
      chronologicalCaptures.map((capture) => ({
        capture,
        summary: spec.getSummary(capture),
        secondarySummary: spec.getSecondarySummary?.(capture),
      })),
    [chronologicalCaptures, spec],
  );
  const latest = points.at(-1) ?? null;
  const lines = useMemo(
    () => createTrendLines({ colors, spec }),
    [colors, spec],
  );
  const legendItems = useMemo(() => createLegendItems(lines), [lines]);
  const trendSamples = useMemo<TrendSample[]>(
    () =>
      points.map((point, index) =>
        createTrendSample({
          capture: point.capture,
          summary: point.summary,
          secondarySummary: point.secondarySummary,
          index,
        }),
      ),
    [points],
  );
  const xTicks = useMemo(
    () => trendSamples.map((sample) => sample.captureElapsedMs),
    [trendSamples],
  );
  const captureDurationMs =
    trendSamples.length > 0
      ? trendSamples[trendSamples.length - 1].captureElapsedMs
      : null;
  const showBrush = focused && trendSamples.length > 1;
  const effectiveBrushRange = showBrush ? brushRange : null;
  const handleFocusToggle = () => {
    onFocusChange(focused ? null : spec.id);
  };

  return (
    <article
      className={clsx(
        "min-w-0 rounded-lg bg-base-200 p-2.5 shadow-xl",
        focused ? "min-h-140 flex-1" : compact ? "min-h-58" : "min-h-60",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold leading-tight">
            {spec.title}
          </h2>
          <p className="mt-0.5 truncate text-xs text-base-content/45">
            {spec.subtitle}
          </p>
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-base-content/35">
          {latest ? formatReportDate(latest.capture.startedAt) : "n/a"}
        </span>
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
      <div className="mt-2 grid grid-cols-3 divide-x divide-base-content/8 overflow-hidden rounded-md border border-base-content/8 bg-base-300/30">
        {SUMMARY_KEYS.map((item) => (
          <SummaryCell
            key={item.id}
            label={item.label}
            value={latest?.summary[item.id] ?? null}
            secondaryValue={latest?.secondarySummary?.[item.id] ?? null}
            format={spec.format}
            secondaryFormat={spec.secondaryFormat}
            secondaryLabel={spec.secondaryLabel}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end">
        <ChartLegend className="justify-end gap-2" items={legendItems} />
      </div>
      <div
        className={clsx("mt-1.5 flex min-w-0 rounded-lg bg-base-300/20", {
          "h-88": focused,
          "h-32": !focused,
        })}
      >
        <PerformanceLineChartCanvas
          samples={trendSamples}
          routeMarkers={[]}
          lines={lines}
          xRange={effectiveBrushRange}
          showBrush={showBrush}
          live={false}
          dense={!focused}
          captureDurationMs={captureDurationMs}
          yMaxFloor={resolveYMaxFloor(spec)}
          secondaryYMaxFloor={resolveSecondaryYMaxFloor(spec)}
          valueFormatter={spec.format}
          secondaryValueFormatter={spec.secondaryFormat}
          xValueFormatter={formatReportIndex}
          xTicks={xTicks}
          emptyLabel="No trend data"
          onXRangeChange={setBrushRange}
        />
      </div>
    </article>
  );
}
