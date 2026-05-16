import { describe, expect, it } from "vitest";

import type {
  AppPerformanceCaptureDTO,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../AppPerformance.dto";
import { generateAppPerformanceReport } from "../AppPerformance.report";

const capture: AppPerformanceCaptureDTO = {
  id: "capture-1",
  startedAt: "2026-01-01T00:00:00.000Z",
  stoppedAt: "2026-01-01T00:01:00.000Z",
};

const sample: AppPerformanceSampleDTO = {
  sampledAt: "2026-01-01T00:00:05.000Z",
  uptimeMs: 5_000,
  captureElapsedMs: 5_000,
  route: "/cards",
  fps: 59.5,
  systemCpuPercent: 22.2,
  appCpuPercent: 8.4,
  systemMemoryUsedPercent: 65.1,
  systemMemoryTotalBytes: 16 * 1024 * 1024 * 1024,
  systemMemoryFreeBytes: 5 * 1024 * 1024 * 1024,
  appMemoryBytes: 512 * 1024 * 1024,
  appMemoryPercent: 3.1,
  mainHeapUsedBytes: 64 * 1024 * 1024,
  rendererMemoryBytes: 256 * 1024 * 1024,
  rendererHeapUsedBytes: 48 * 1024 * 1024,
};

const marker: AppPerformanceRouteMarkerDTO = {
  id: "marker-1",
  route: "/cards",
  label: "Cards",
  markedAt: "2026-01-01T00:00:04.000Z",
  elapsedMs: 4_000,
};

describe("generateAppPerformanceReport", () => {
  it("generates a text report with metadata, summary, timeline, and CSV samples", () => {
    const report = generateAppPerformanceReport({
      capture,
      samples: [sample],
      routeMarkers: [marker],
      metadata: {
        generatedAt: "2026-01-01T00:02:00.000Z",
        appVersion: "1.2.3",
        electron: "37.0.0",
        chrome: "138.0.0",
        node: "24.0.0",
        os: "Windows_NT 10.0.26100",
      },
    });

    expect(report).toContain("Soothsayer App Performance Report");
    expect(report).toContain("App version: 1.2.3");
    expect(report).toContain("Samples: 1");
    expect(report).toContain("Route markers: 1");
    expect(report).toContain("- 0m 04s Cards (/cards)");
    expect(report).toContain(
      "sampled_at,elapsed,route,fps,app_cpu_percent,system_cpu_percent,memory_usage_mb,main_heap_mb,renderer_heap_mb,renderer_working_set_mb,system_memory_used_percent",
    );
    expect(report).toContain(
      "2026-01-01T00:00:05.000Z,0m 05s,/cards,59.5,8.4,22.2,512.00,64.00,48.00,256.00,65.1",
    );
  });

  it("uses fallback text when there are no route markers or samples", () => {
    const report = generateAppPerformanceReport({
      capture: null,
      samples: [],
      routeMarkers: [],
      metadata: {
        generatedAt: "2026-01-01T00:02:00.000Z",
        appVersion: "dev",
        electron: "n/a",
        chrome: "n/a",
        node: "24.0.0",
        os: "Windows_NT",
      },
    });

    expect(report).toContain("Capture started: n/a");
    expect(report).toContain("Capture duration: 0m 00s");
    expect(report).toContain("- No route markers recorded.");
    expect(report).toContain("- FPS: current n/a");
  });

  it("uses aggregate stats and total counts when report rows are bounded", () => {
    const report = generateAppPerformanceReport({
      capture,
      samples: [sample],
      routeMarkers: [marker],
      sampleCount: 500,
      routeMarkerCount: 20,
      stats: {
        fps: { current: 30, min: 10, avg: 20, max: 60 },
        appCpu: { current: 8, min: 1, avg: 4, max: 12 },
        systemCpu: { current: 24, min: 10, avg: 20, max: 40 },
        appMemoryPercent: { current: 3, min: 1, avg: 2, max: 4 },
        systemMemory: { current: 65, min: 50, avg: 60, max: 80 },
        appMemoryBytes: {
          current: 512 * 1024 * 1024,
          min: 256 * 1024 * 1024,
          avg: 384 * 1024 * 1024,
          max: 768 * 1024 * 1024,
        },
      },
      metadata: {
        generatedAt: "2026-01-01T00:02:00.000Z",
        appVersion: "1.2.3",
        electron: "37.0.0",
        chrome: "138.0.0",
        node: "24.0.0",
        os: "Windows_NT 10.0.26100",
      },
    });

    expect(report).toContain("Samples: 500");
    expect(report).toContain("Route markers: 20");
    expect(report).toContain(
      "- FPS: current 30.0, min 10.0, avg 20.0, max 60.0",
    );
    expect(report).toContain("- Memory: usage current 512.0 MB");
  });
});
