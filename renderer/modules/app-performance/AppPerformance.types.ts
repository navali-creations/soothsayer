export type {
  AppPerformanceBulkDeleteResultDTO,
  AppPerformanceCaptureComparisonDTO,
  AppPerformanceCaptureDTO,
  AppPerformanceCaptureHistoryDTO,
  AppPerformanceCaptureSparklineSampleDTO,
  AppPerformanceCaptureSummaryDTO,
  AppPerformanceDeleteResultDTO,
  AppPerformanceExportResultDTO,
  AppPerformanceListCapturesInputDTO,
  AppPerformanceMetricComparisonDirection,
  AppPerformanceMetricComparisonDTO,
  AppPerformanceMetricSummaryDTO,
  AppPerformanceRetention,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceRouteMarkerInputDTO,
  AppPerformanceSampleDTO,
  AppPerformanceStateDTO,
  RendererPerformanceMetricsDTO,
} from "~/main/modules/app-performance/AppPerformance.dto";

export type AppPerformanceChartKey = "fps" | "cpu" | "memory";
export type AppPerformanceIndexView = "captures" | "trends";
