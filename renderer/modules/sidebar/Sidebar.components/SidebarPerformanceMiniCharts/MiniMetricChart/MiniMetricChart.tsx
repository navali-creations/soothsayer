import type { AppPerformanceSampleDTO } from "~/renderer/modules/app-performance";

import {
  buildLineGapConnectors,
  buildLineSegments,
  CHART_HEIGHT,
  CHART_WIDTH,
  getMiniLineGapColor,
  type MiniChartConfig,
  metricStats,
  resolveYMax,
} from "../SidebarPerformanceMiniCharts.utils";

interface MiniMetricChartProps {
  chart: MiniChartConfig;
  samples: AppPerformanceSampleDTO[];
}

export function MiniMetricChart({ chart, samples }: MiniMetricChartProps) {
  const stats = metricStats(samples, chart.primaryValue, chart.format);
  const primaryYMax = resolveYMax(samples, chart.lines, chart.yMaxFloor);
  const secondaryYMax =
    chart.secondaryYMaxFloor === undefined
      ? primaryYMax
      : resolveYMax(
          samples,
          chart.lines,
          chart.secondaryYMaxFloor,
          "secondary",
        );

  return (
    <section className="overflow-hidden rounded-lg border border-base-content/8 bg-base-200/55 p-2 shadow">
      <div className="flex items-center justify-between gap-2 text-[9px] leading-tight">
        <span className="truncate font-semibold text-base-content/80">
          {chart.title}
        </span>
        <span className="min-w-0 shrink-0 rounded-md border border-base-content/8 bg-base-300/35 px-1.5 py-0.5 font-semibold tabular-nums text-base-content/85">
          {stats.current}
        </span>
      </div>
      <div className="mt-1 overflow-hidden rounded-md border border-base-content/8 bg-base-300/35 p-1">
        <svg
          className="h-9 min-w-0 w-full overflow-visible"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${chart.title} diagnostics chart`}
        >
          <rect
            x="0"
            y="0"
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            rx="3"
            className="fill-base-300/55"
          />
          {chart.lines.map((line) => {
            const yMax =
              line.axis === "secondary" ? secondaryYMax : primaryYMax;
            const connectors = line.connectNullGaps
              ? buildLineGapConnectors(samples, line, yMax)
              : [];
            const segments = buildLineSegments(samples, line, yMax);

            return (
              <g key={line.id}>
                {connectors.map((points, index) => (
                  <polyline
                    key={`${line.id}-gap-${index}`}
                    points={points}
                    fill="none"
                    stroke={getMiniLineGapColor(line.color)}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {segments.map((points, index) => (
                  <polyline
                    key={`${line.id}-${index}`}
                    points={points}
                    fill="none"
                    stroke={line.color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={line.dashed ? "3 3" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
