import type { ChartLegendItem } from "~/renderer/components/CombinedChartCanvas";
import type { useChartColors } from "~/renderer/hooks";
import {
  formatNullableBytes,
  formatNumber,
  formatPercent,
  formatShortDate,
} from "~/renderer/utils";

import type {
  AppPerformanceCaptureSummaryDTO,
  AppPerformanceMetricSummaryDTO,
  AppPerformanceSampleDTO,
} from "../../AppPerformance.types";
import type { PerformanceLine } from "../PerformanceLineChartCanvas/PerformanceLineChartCanvas.types";

export interface TrendPoint {
  capture: AppPerformanceCaptureSummaryDTO;
  summary: AppPerformanceMetricSummaryDTO;
  secondarySummary?: AppPerformanceMetricSummaryDTO;
}

export type TrendSample = AppPerformanceSampleDTO & {
  trendMin: number | null;
  trendAvg: number | null;
  trendMax: number | null;
  secondaryTrendMin: number | null;
  secondaryTrendAvg: number | null;
  secondaryTrendMax: number | null;
};

export type TrendSpecId = "fps" | "cpu" | "ram";

export interface TrendSpec {
  id: TrendSpecId;
  title: string;
  subtitle: string;
  color: string;
  maxColor?: string;
  secondaryColor?: string;
  getSummary: (
    capture: AppPerformanceCaptureSummaryDTO,
  ) => AppPerformanceMetricSummaryDTO;
  getSecondarySummary?: (
    capture: AppPerformanceCaptureSummaryDTO,
  ) => AppPerformanceMetricSummaryDTO;
  format: (value: number | null) => string;
  secondaryFormat?: (value: number | null) => string;
  secondaryLabel?: string;
}

export const SUMMARY_KEYS = [
  { id: "min", label: "Min" },
  { id: "avg", label: "Avg" },
  { id: "max", label: "Max" },
] as const;

export const REPORT_STEP_MS = 60_000;

export function createTrendSpecs(
  colors: ReturnType<typeof useChartColors>,
): TrendSpec[] {
  return [
    {
      id: "fps",
      title: "FPS",
      subtitle: "Renderer frame rate",
      color: colors.success,
      getSummary: (capture) => capture.fps,
      format: formatNumber,
    },
    {
      id: "cpu",
      title: "CPU",
      subtitle: "Soothsayer CPU",
      color: colors.warning,
      maxColor: colors.secondary,
      getSummary: (capture) => capture.cpu,
      format: formatPercent,
    },
    {
      id: "ram",
      title: "RAM",
      subtitle: "App memory value and share",
      color: colors.secondary,
      getSummary: (capture) => capture.appMemoryBytes,
      getSecondarySummary: (capture) => capture.memory,
      format: formatNullableBytes,
      secondaryFormat: formatPercent,
      secondaryLabel: "RAM %",
      secondaryColor: colors.primary,
    },
  ];
}

export function createTrendLines({
  colors,
  spec,
}: {
  colors: ReturnType<typeof useChartColors>;
  spec: TrendSpec;
}): PerformanceLine[] {
  if (spec.getSecondarySummary && spec.secondaryFormat) {
    return [
      {
        id: "trend-avg",
        label: "RAM Avg",
        color: spec.color,
        value: (sample) => (sample as TrendSample).trendAvg,
        valueFormatter: spec.format,
      },
      {
        id: "secondary-trend-avg",
        label: "RAM % Avg",
        color: spec.secondaryColor ?? colors.primary,
        value: (sample) => (sample as TrendSample).secondaryTrendAvg,
        axis: "secondary",
        valueFormatter: spec.secondaryFormat,
      },
    ];
  }

  return [
    {
      id: "trend-min",
      label: "Min",
      color: colors.bc40,
      value: (sample) => (sample as TrendSample).trendMin,
      valueFormatter: spec.format,
    },
    {
      id: "trend-avg",
      label: "Avg",
      color: spec.color,
      value: (sample) => (sample as TrendSample).trendAvg,
      valueFormatter: spec.format,
    },
    {
      id: "trend-max",
      label: "Max",
      color: spec.maxColor ?? colors.warning,
      value: (sample) => (sample as TrendSample).trendMax,
      valueFormatter: spec.format,
    },
  ];
}

export function createLegendItems(lines: PerformanceLine[]): ChartLegendItem[] {
  return lines.map((item) => ({
    id: item.id,
    label: item.label,
    visual: "line",
    color: item.color,
  }));
}

export function createTrendSample({
  capture,
  summary,
  secondarySummary,
  index,
}: {
  capture: AppPerformanceCaptureSummaryDTO;
  summary: AppPerformanceMetricSummaryDTO;
  secondarySummary?: AppPerformanceMetricSummaryDTO;
  index: number;
}): TrendSample {
  return {
    sampledAt: capture.startedAt,
    uptimeMs: 0,
    captureElapsedMs: index * REPORT_STEP_MS,
    route: "/app-performance",
    fps: null,
    systemCpuPercent: null,
    appCpuPercent: null,
    systemMemoryUsedPercent: null,
    systemMemoryTotalBytes: null,
    systemMemoryFreeBytes: null,
    appMemoryBytes: null,
    appMemoryPercent: null,
    mainHeapUsedBytes: null,
    rendererMemoryBytes: null,
    rendererHeapUsedBytes: null,
    trendMin: summary.min,
    trendAvg: summary.avg,
    trendMax: summary.max,
    secondaryTrendMin: secondarySummary?.min ?? null,
    secondaryTrendAvg: secondarySummary?.avg ?? null,
    secondaryTrendMax: secondarySummary?.max ?? null,
  };
}

export function resolveYMaxFloor(spec: TrendSpec): number {
  if (spec.id === "fps") return 60;
  return 1;
}

export function resolveSecondaryYMaxFloor(spec: TrendSpec): number | undefined {
  return spec.getSecondarySummary ? 100 : undefined;
}

export function formatReportIndex(value: number): string {
  return `#${Math.max(1, Math.round(value / REPORT_STEP_MS) + 1)}`;
}

export function formatReportDate(value: string): string {
  return formatShortDate(value);
}
