import { useMemo } from "react";

import { useChartColors } from "~/renderer/hooks";
import type { AppPerformanceSampleDTO } from "~/renderer/modules/app-performance";
import {
  formatCompactBytes,
  formatNumber,
  formatWholePercent,
} from "~/renderer/utils";

import { MiniMetricChart } from "./MiniMetricChart/MiniMetricChart";
import {
  MAX_MINI_CHART_SAMPLES,
  type MiniChartConfig,
} from "./SidebarPerformanceMiniCharts.utils";

interface SidebarPerformanceMiniChartsProps {
  samples: AppPerformanceSampleDTO[];
}

export function SidebarPerformanceMiniCharts({
  samples,
}: SidebarPerformanceMiniChartsProps) {
  const colors = useChartColors();
  const recentSamples = useMemo(
    () => samples.slice(-MAX_MINI_CHART_SAMPLES),
    [samples],
  );
  const charts = useMemo<MiniChartConfig[]>(
    () => [
      {
        id: "fps",
        title: "FPS",
        yMaxFloor: 60,
        format: formatNumber,
        primaryValue: (sample) => sample.fps,
        lines: [
          {
            id: "fps",
            color: colors.success,
            connectNullGaps: true,
            value: (sample) => sample.fps,
          },
        ],
      },
      {
        id: "cpu",
        title: "CPU",
        yMaxFloor: 100,
        format: formatWholePercent,
        primaryValue: (sample) => sample.appCpuPercent,
        lines: [
          {
            id: "app",
            color: colors.warning,
            connectNullGaps: true,
            value: (sample) => sample.appCpuPercent,
          },
          {
            id: "system",
            color: colors.info,
            connectNullGaps: true,
            value: (sample) => sample.systemCpuPercent,
          },
        ],
      },
      {
        id: "memory",
        title: "RAM",
        yMaxFloor: 1,
        secondaryYMaxFloor: 100,
        format: formatCompactBytes,
        primaryValue: (sample) => sample.appMemoryBytes,
        lines: [
          {
            id: "memory-usage",
            color: colors.secondary,
            connectNullGaps: true,
            value: (sample) => sample.appMemoryBytes,
          },
          {
            id: "renderer-heap",
            color: colors.info,
            connectNullGaps: true,
            value: (sample) => sample.rendererHeapUsedBytes,
          },
          {
            id: "main-heap",
            color: colors.success,
            value: (sample) => sample.mainHeapUsedBytes,
          },
          {
            id: "system-percent",
            color: colors.bc30,
            axis: "secondary",
            value: (sample) => sample.systemMemoryUsedPercent,
          },
        ],
      },
    ],
    [colors],
  );

  return (
    <div className="mt-3 space-y-2" data-testid="sidebar-performance-charts">
      {charts.map((chart) => (
        <MiniMetricChart key={chart.id} chart={chart} samples={recentSamples} />
      ))}
    </div>
  );
}
