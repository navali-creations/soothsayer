import clsx from "clsx";
import { useId } from "react";

import type {
  AppPerformanceMetricComparisonDirection,
  AppPerformanceMetricComparisonDTO,
  AppPerformanceMetricSummaryDTO,
} from "../../../AppPerformance.types";
import {
  buildMetricSummarySparklineSegments,
  type MetricSummarySparklineLine,
  resolveMetricSummarySparklineRange,
} from "./MetricSummaryCell.utils";

const METRIC_SUMMARY_KEYS = [
  { id: "min", label: "Min" },
  { id: "avg", label: "Avg" },
  { id: "max", label: "Max" },
] as const;

interface MetricSummaryCellProps {
  summary: AppPerformanceMetricSummaryDTO;
  comparison?: AppPerformanceMetricComparisonDTO;
  format: (value: number | null) => string;
  sparklineLines?: MetricSummarySparklineLine[];
}

export function MetricSummaryCell({
  summary,
  comparison,
  format,
  sparklineLines = [],
}: MetricSummaryCellProps) {
  const gradientIdPrefix = useId().replace(/:/g, "");
  const sparklineRange = resolveMetricSummarySparklineRange(sparklineLines);
  const sparklineSegments =
    sparklineRange === null
      ? []
      : sparklineLines.flatMap((line, lineIndex) => {
          const segments = buildMetricSummarySparklineSegments({
            points: line.points,
            range: sparklineRange,
          });

          return segments.map((segment, index) => ({
            id: `${line.id}-${index}`,
            lineIndex,
            areaPath: segment.areaPath,
            color: line.color,
            points: segment.points,
          }));
        });

  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-md border border-base-content/5 bg-gradient-to-br from-base-300/35 via-base-300/15 to-base-200/25 px-1.5 pt-1 pb-3.5">
      {sparklineSegments.length > 0 && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0.5 h-3.5 w-full"
          data-testid="metric-summary-sparkline"
          preserveAspectRatio="none"
          viewBox="0 0 100 16"
        >
          <defs>
            {sparklineSegments.map((line) => (
              <linearGradient
                key={line.id}
                id={`${gradientIdPrefix}-${line.id}`}
                x1="0"
                x2="0"
                y1="0"
                y2="16"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor={line.color}
                  stopOpacity={line.lineIndex === 0 ? 0.2 : 0.13}
                />
                <stop offset="100%" stopColor={line.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {sparklineSegments.map((line) => (
            <path
              key={`${line.id}-area`}
              d={line.areaPath}
              fill={`url(#${gradientIdPrefix}-${line.id})`}
            />
          ))}
          {sparklineSegments.map((line) => (
            <polyline
              key={line.id}
              points={line.points}
              fill="none"
              stroke={line.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1"
              opacity={line.lineIndex === 0 ? 0.34 : 0.24}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
      <div className="relative z-10 grid grid-cols-3 gap-1 text-[8px] font-medium uppercase leading-none text-base-content/35">
        {METRIC_SUMMARY_KEYS.map((item) => (
          <span key={item.id}>{item.label}</span>
        ))}
      </div>
      <div className="relative z-10 mt-1 grid grid-cols-3 gap-1 text-[11px] leading-tight tabular-nums">
        {METRIC_SUMMARY_KEYS.map((item) => (
          <span
            key={item.id}
            className={clsx(
              "truncate",
              getComparisonTextClasses(comparison?.[item.id] ?? null),
            )}
          >
            {format(summary[item.id])}
          </span>
        ))}
      </div>
    </div>
  );
}

function getComparisonTextClasses(
  comparison: AppPerformanceMetricComparisonDirection,
): Record<string, boolean> {
  return {
    "text-success": comparison === "lower",
    "text-error": comparison === "higher",
    "text-base-content/70": comparison !== "lower" && comparison !== "higher",
  };
}
