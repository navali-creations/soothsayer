import type {
  AppPerformanceCaptureDTO,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "./AppPerformance.dto";
import {
  type AppPerformanceReportStats,
  computeStats,
  formatBytes,
  formatCsvSample,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRouteTimeline,
  resolveCaptureDurationMs,
} from "./AppPerformance.utils";

export interface AppPerformanceReportMetadata {
  generatedAt: string;
  appVersion: string;
  electron: string;
  chrome: string;
  node: string;
  os: string;
}

export function generateAppPerformanceReport({
  capture,
  samples,
  routeMarkers,
  sampleCount,
  routeMarkerCount,
  stats,
  metadata,
}: {
  capture: AppPerformanceCaptureDTO | null;
  samples: AppPerformanceSampleDTO[];
  routeMarkers: AppPerformanceRouteMarkerDTO[];
  sampleCount?: number;
  routeMarkerCount?: number;
  stats?: AppPerformanceReportStats;
  metadata: AppPerformanceReportMetadata;
}): string {
  const reportStats = stats ?? computeReportStats(samples);
  const {
    fps,
    appCpu,
    systemCpu,
    appMemoryPercent,
    systemMemory,
    appMemoryBytes,
  } = reportStats;

  const captureDurationMs = resolveCaptureDurationMs(capture, samples);
  const totalSamples = sampleCount ?? samples.length;
  const totalRouteMarkers = routeMarkerCount ?? routeMarkers.length;
  const lines: string[] = [
    "Soothsayer App Performance Report",
    `Generated: ${metadata.generatedAt}`,
    `App version: ${metadata.appVersion}`,
    `Electron: ${metadata.electron}`,
    `Chrome: ${metadata.chrome}`,
    `Node: ${metadata.node}`,
    `OS: ${metadata.os}`,
    `Capture started: ${capture?.startedAt ?? "n/a"}`,
    `Capture stopped: ${capture?.stoppedAt ?? "active"}`,
    `Capture duration: ${formatDuration(captureDurationMs)}`,
    `Samples: ${totalSamples}`,
    `Route markers: ${totalRouteMarkers}`,
    "",
    "Summary",
    `- FPS: current ${formatNumber(fps.current)}, min ${formatNumber(
      fps.min,
    )}, avg ${formatNumber(fps.avg)}, max ${formatNumber(fps.max)}`,
    `- CPU: app avg ${formatPercent(appCpu.avg)}, peak ${formatPercent(
      appCpu.max,
    )}; system avg ${formatPercent(systemCpu.avg)}, peak ${formatPercent(
      systemCpu.max,
    )}`,
    `- Memory: usage current ${formatBytes(
      appMemoryBytes.current,
    )} (${formatPercent(appMemoryPercent.current)}), peak ${formatBytes(
      appMemoryBytes.max,
    )}; system current ${formatPercent(systemMemory.current)}`,
    "",
    "Route Timeline",
    ...formatRouteTimeline(routeMarkers),
    "",
    "Recent Samples",
    "sampled_at,elapsed,route,fps,app_cpu_percent,system_cpu_percent,memory_usage_mb,main_heap_mb,renderer_heap_mb,renderer_working_set_mb,system_memory_used_percent",
    ...samples.slice(-240).map(formatCsvSample),
    "",
    "Notes",
    "- FPS is measured from the renderer and can be throttled when the app is hidden or minimized.",
    "- CPU and memory are sampled values and can be noisy.",
    "- Samples are local and are not uploaded automatically.",
  ];

  return `${lines.join("\n")}\n`;
}

function computeReportStats(
  samples: AppPerformanceSampleDTO[],
): AppPerformanceReportStats {
  return {
    fps: computeStats(samples.map((s) => s.fps)),
    appCpu: computeStats(samples.map((s) => s.appCpuPercent)),
    systemCpu: computeStats(samples.map((s) => s.systemCpuPercent)),
    appMemoryPercent: computeStats(samples.map((s) => s.appMemoryPercent)),
    systemMemory: computeStats(samples.map((s) => s.systemMemoryUsedPercent)),
    appMemoryBytes: computeStats(samples.map((s) => s.appMemoryBytes)),
  };
}
