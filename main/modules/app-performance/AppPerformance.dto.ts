import type { AppPerformanceRetention } from "~/main/modules/settings-store";

export type { AppPerformanceRetention };

export interface AppPerformanceSampleDTO {
  sampledAt: string;
  uptimeMs: number;
  captureElapsedMs: number;
  route: string | null;

  fps: number | null;

  systemCpuPercent: number | null;
  appCpuPercent: number | null;

  systemMemoryUsedPercent: number | null;
  systemMemoryTotalBytes: number | null;
  systemMemoryFreeBytes: number | null;
  /** Displayed memory usage estimate: app renderer working sets plus JS heaps. */
  appMemoryBytes: number | null;
  appMemoryPercent: number | null;
  mainHeapUsedBytes: number | null;
  /** App renderer-window memory estimate, counting extra windows incrementally, in bytes. */
  rendererMemoryBytes: number | null;
  rendererHeapUsedBytes: number | null;
}

export interface AppPerformanceRouteMarkerDTO {
  id: string;
  route: string;
  label: string;
  markedAt: string;
  elapsedMs: number;
}

export interface AppPerformanceCaptureDTO {
  id: string;
  startedAt: string;
  stoppedAt: string | null;
}

export interface AppPerformanceMetricSummaryDTO {
  min: number | null;
  avg: number | null;
  max: number | null;
}

export interface AppPerformanceCaptureSparklineSampleDTO {
  captureElapsedMs: number;
  fps: number | null;
  appCpuPercent: number | null;
  appMemoryBytes: number | null;
  appMemoryPercent: number | null;
  systemMemoryUsedPercent: number | null;
}

export type AppPerformanceMetricComparisonDirection =
  | "lower"
  | "higher"
  | "same"
  | null;

export interface AppPerformanceMetricComparisonDTO {
  min: AppPerformanceMetricComparisonDirection;
  avg: AppPerformanceMetricComparisonDirection;
  max: AppPerformanceMetricComparisonDirection;
}

export interface AppPerformanceCaptureComparisonDTO {
  fps: AppPerformanceMetricComparisonDTO;
  cpu: AppPerformanceMetricComparisonDTO;
  memory: AppPerformanceMetricComparisonDTO;
  appMemoryBytes: AppPerformanceMetricComparisonDTO;
}

export interface AppPerformanceCaptureSummaryDTO
  extends AppPerformanceCaptureDTO {
  durationMs: number;
  sampleCount: number;
  routeMarkerCount: number;
  estimatedSizeBytes: number;
  fps: AppPerformanceMetricSummaryDTO;
  cpu: AppPerformanceMetricSummaryDTO;
  memory: AppPerformanceMetricSummaryDTO;
  systemMemory: AppPerformanceMetricSummaryDTO;
  appMemoryBytes: AppPerformanceMetricSummaryDTO;
  sparklineSamples: AppPerformanceCaptureSparklineSampleDTO[];
  comparison: AppPerformanceCaptureComparisonDTO;
}

export interface AppPerformanceListCapturesInputDTO {
  page?: number;
  pageSize?: number;
}

export interface AppPerformanceCaptureHistoryDTO {
  captures: AppPerformanceCaptureSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AppPerformanceStateDTO {
  capture: AppPerformanceCaptureDTO | null;
  isSampling: boolean;
  samples: AppPerformanceSampleDTO[];
  routeMarkers: AppPerformanceRouteMarkerDTO[];
}

export interface RendererPerformanceMetricsDTO {
  fps: number | null;
  rendererHeapUsedBytes: number | null;
}

export interface AppPerformanceRouteMarkerInputDTO {
  route: string;
  label: string;
}

export interface AppPerformanceExportResultDTO {
  success: boolean;
  canceled?: boolean;
  fileName?: string;
  error?: string;
}

export interface AppPerformanceDeleteResultDTO {
  success: boolean;
  deleted?: boolean;
  error?: string;
}

export interface AppPerformanceBulkDeleteResultDTO {
  success: boolean;
  deletedCount?: number;
  error?: string;
}
