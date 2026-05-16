import type { useChartColors } from "~/renderer/hooks";
import {
  formatCompactBytes,
  formatNumber,
  formatPercent,
} from "~/renderer/utils";

import type { PerformanceLine } from "../AppPerformance.components/PerformanceLineChartCanvas/PerformanceLineChartCanvas.types";
import type { AppPerformanceChartKey } from "../AppPerformance.types";

export function normalizeAppPerformancePathname(pathname: string): string {
  const rawPathname = pathname || "/";
  const pathOnly = rawPathname.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

export function formatAppPerformanceRouteLabel(
  route: string | null | undefined,
): string {
  const pathname = normalizeAppPerformancePathname(route ?? "/");

  if (pathname === "/") return "/current-session";
  if (pathname === "/app-performance/live") return "/app-performance/live";
  if (pathname === "/overlay/opened") return "Overlay opened";
  if (pathname === "/overlay/closed") return "Overlay closed";
  if (/^\/app-performance\/[^/]+$/.test(pathname)) {
    return "/app-performance/:id";
  }
  if (/^\/sessions\/[^/]+$/.test(pathname)) return "/sessions/:id";
  if (/^\/cards\/[^/]+$/.test(pathname)) return "/cards/:id";

  return pathname;
}

export function normalizeAppPerformanceRoute(pathname: string): {
  route: string;
  label: string;
} {
  const route = normalizeAppPerformancePathname(pathname);
  return {
    route,
    label: formatAppPerformanceRouteLabel(route),
  };
}

export interface FormattedMetricStats {
  current: string;
  min: string;
  avg: string;
  max: string;
}

export interface NumericMetricStats {
  current: number | null;
  min: number | null;
  avg: number | null;
  max: number | null;
}

export interface AppPerformanceChartConfig {
  key: AppPerformanceChartKey;
  title: string;
  subtitle: string;
  lines: PerformanceLine[];
  statFormatter: (value: number | null) => string;
  yMaxFloor: number;
  secondaryYMaxFloor?: number;
  valueFormatter: (value: number | null) => string;
  secondaryValueFormatter?: (value: number | null) => string;
}

export function createAppPerformanceChartConfigs({
  colors,
}: {
  colors: ReturnType<typeof useChartColors>;
}): AppPerformanceChartConfig[] {
  return [
    {
      key: "fps",
      title: "FPS",
      subtitle: "Renderer frame cadence",
      yMaxFloor: 60,
      valueFormatter: formatNumber,
      lines: [
        {
          id: "fps",
          label: "Renderer FPS",
          color: colors.success,
          value: (sample) => sample.fps,
          connectNullGaps: true,
        },
      ],
      statFormatter: formatNumber,
    },
    {
      key: "cpu",
      title: "CPU",
      subtitle: "Soothsayer and system sampled CPU",
      yMaxFloor: 100,
      valueFormatter: formatPercent,
      lines: [
        {
          id: "app",
          label: "Soothsayer",
          color: colors.warning,
          value: (sample) => sample.appCpuPercent,
        },
        {
          id: "system",
          label: "System",
          color: colors.info,
          value: (sample) => sample.systemCpuPercent,
        },
      ],
      statFormatter: formatPercent,
    },
    {
      key: "memory",
      title: "Memory",
      subtitle: "Estimated usage, app renderers, JS heaps, and system share",
      yMaxFloor: 1,
      secondaryYMaxFloor: 100,
      valueFormatter: formatCompactBytes,
      secondaryValueFormatter: formatPercent,
      lines: [
        {
          id: "memory-usage",
          label: "Memory usage",
          color: colors.secondary,
          value: (sample) => sample.appMemoryBytes,
          connectNullGaps: true,
          valueFormatter: formatCompactBytes,
        },
        {
          id: "renderer-heap",
          label: "Renderer heap",
          color: colors.info,
          value: (sample) => sample.rendererHeapUsedBytes,
          connectNullGaps: true,
          valueFormatter: formatCompactBytes,
        },
        {
          id: "main-heap",
          label: "Main heap",
          color: colors.success,
          value: (sample) => sample.mainHeapUsedBytes,
          valueFormatter: formatCompactBytes,
        },
        {
          id: "system-percent",
          label: "System %",
          color: colors.bc30,
          value: (sample) => sample.systemMemoryUsedPercent,
          axis: "secondary",
          valueFormatter: formatPercent,
        },
      ],
      statFormatter: formatCompactBytes,
    },
  ];
}

export function createFormattedMetricStats<TSample>(
  samples: readonly TSample[],
  select: (sample: TSample) => number | null,
  format: (value: number | null) => string,
): FormattedMetricStats {
  let current: number | null = null;
  let min: number | null = null;
  let max: number | null = null;
  let sum = 0;
  let count = 0;

  for (const sample of samples) {
    const value = select(sample);
    if (typeof value !== "number" || !Number.isFinite(value)) continue;

    current = value;
    min = min === null ? value : Math.min(min, value);
    max = max === null ? value : Math.max(max, value);
    sum += value;
    count += 1;
  }

  return formatMetricStats(
    {
      current,
      min,
      avg: count > 0 ? sum / count : null,
      max,
    },
    format,
  );
}

export function formatMetricStats(
  stats: NumericMetricStats,
  format: (value: number | null) => string,
): FormattedMetricStats {
  return {
    current: format(stats.current),
    min: format(stats.min),
    avg: format(stats.avg),
    max: format(stats.max),
  };
}
