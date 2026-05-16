import type {
  AppPerformanceCaptureDTO,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "./AppPerformance.dto";

export interface AppPerformanceMetricStats {
  current: number | null;
  min: number | null;
  avg: number | null;
  max: number | null;
}

export interface AppPerformanceReportStats {
  fps: AppPerformanceMetricStats;
  appCpu: AppPerformanceMetricStats;
  systemCpu: AppPerformanceMetricStats;
  appMemoryPercent: AppPerformanceMetricStats;
  systemMemory: AppPerformanceMetricStats;
  appMemoryBytes: AppPerformanceMetricStats;
}

export interface AppPerformanceStorageCounts {
  captureCount: number;
  sampleCount: number;
  routeMarkerCount: number;
}

// Average row sizes in bytes, estimated from the app-performance schema.
const AVG_CAPTURE_ROW_BYTES = 120;
const AVG_SAMPLE_ROW_BYTES = 180;
const AVG_ROUTE_MARKER_ROW_BYTES = 160;

export function computeStats(
  values: Array<number | null>,
): AppPerformanceMetricStats {
  const numeric = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (numeric.length === 0) {
    return { current: null, min: null, avg: null, max: null };
  }

  const current = [...values]
    .reverse()
    .find(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );

  const sum = numeric.reduce((total, value) => total + value, 0);
  return {
    current: current ?? null,
    min: Math.min(...numeric),
    avg: sum / numeric.length,
    max: Math.max(...numeric),
  };
}

export function estimateAppPerformanceStorageBytes({
  captureCount,
  sampleCount,
  routeMarkerCount,
}: AppPerformanceStorageCounts): number {
  return (
    Math.max(0, captureCount) * AVG_CAPTURE_ROW_BYTES +
    Math.max(0, sampleCount) * AVG_SAMPLE_ROW_BYTES +
    Math.max(0, routeMarkerCount) * AVG_ROUTE_MARKER_ROW_BYTES
  );
}

export function resolveCaptureDurationMs(
  capture: AppPerformanceCaptureDTO | null,
  samples: AppPerformanceSampleDTO[],
): number {
  if (samples.length > 0) {
    return samples[samples.length - 1].captureElapsedMs;
  }

  if (!capture) return 0;
  const start = new Date(capture.startedAt).getTime();
  const stop = capture.stoppedAt
    ? new Date(capture.stoppedAt).getTime()
    : Date.now();
  return Math.max(0, stop - start);
}

export function formatRouteTimeline(
  markers: AppPerformanceRouteMarkerDTO[],
): string[] {
  if (markers.length === 0) return ["- No route markers recorded."];

  return markers.map(
    (marker) =>
      `- ${formatDuration(marker.elapsedMs)} ${marker.label} (${marker.route})`,
  );
}

export function formatCsvSample(sample: AppPerformanceSampleDTO): string {
  return [
    sample.sampledAt,
    formatDuration(sample.captureElapsedMs),
    csvEscape(sample.route ?? ""),
    formatNumber(sample.fps),
    formatNumber(sample.appCpuPercent),
    formatNumber(sample.systemCpuPercent),
    sample.appMemoryBytes === null
      ? ""
      : (sample.appMemoryBytes / 1024 / 1024).toFixed(2),
    sample.mainHeapUsedBytes === null
      ? ""
      : (sample.mainHeapUsedBytes / 1024 / 1024).toFixed(2),
    sample.rendererHeapUsedBytes === null
      ? ""
      : (sample.rendererHeapUsedBytes / 1024 / 1024).toFixed(2),
    sample.rendererMemoryBytes === null
      ? ""
      : (sample.rendererMemoryBytes / 1024 / 1024).toFixed(2),
    formatNumber(sample.systemMemoryUsedPercent),
  ].join(",");
}

export function csvEscape(value: string): string {
  if (!value.includes(",") && !value.includes('"')) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

export function formatNumber(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(1);
}

export function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)}%`;
}

export function formatBytes(value: number | null): string {
  if (value === null) return "n/a";
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(
      seconds,
    ).padStart(2, "0")}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
