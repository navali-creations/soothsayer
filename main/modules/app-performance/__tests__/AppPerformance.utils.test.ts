import { describe, expect, it, vi } from "vitest";

import type {
  AppPerformanceCaptureDTO,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../AppPerformance.dto";
import {
  computeStats,
  csvEscape,
  estimateAppPerformanceStorageBytes,
  formatBytes,
  formatCsvSample,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRouteTimeline,
  resolveCaptureDurationMs,
} from "../AppPerformance.utils";

const sample: AppPerformanceSampleDTO = {
  sampledAt: "2026-01-01T00:00:05.000Z",
  uptimeMs: 5_000,
  captureElapsedMs: 5_000,
  route: '/cards,"quoted"',
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

describe("AppPerformance.utils", () => {
  describe("computeStats", () => {
    it("returns current, min, avg, and max for finite values", () => {
      expect(computeStats([1, null, Number.NaN, 3, 2])).toEqual({
        current: 2,
        min: 1,
        avg: 2,
        max: 3,
      });
    });

    it("returns null stats when there are no finite values", () => {
      expect(computeStats([null, Number.NaN])).toEqual({
        current: null,
        min: null,
        avg: null,
        max: null,
      });
    });
  });

  describe("estimateAppPerformanceStorageBytes", () => {
    it("estimates capture storage from row counts", () => {
      expect(
        estimateAppPerformanceStorageBytes({
          captureCount: 1,
          sampleCount: 2,
          routeMarkerCount: 1,
        }),
      ).toBe(640);
    });

    it("clamps negative row counts to zero", () => {
      expect(
        estimateAppPerformanceStorageBytes({
          captureCount: -1,
          sampleCount: -2,
          routeMarkerCount: -3,
        }),
      ).toBe(0);
    });
  });

  describe("resolveCaptureDurationMs", () => {
    it("uses the latest sample elapsed time when samples exist", () => {
      expect(
        resolveCaptureDurationMs(null, [
          { ...sample, captureElapsedMs: 1_000 },
          { ...sample, captureElapsedMs: 3_000 },
        ]),
      ).toBe(3_000);
    });

    it("uses capture start and stop time when there are no samples", () => {
      const capture: AppPerformanceCaptureDTO = {
        id: "capture-1",
        startedAt: "2026-01-01T00:00:00.000Z",
        stoppedAt: "2026-01-01T00:01:00.000Z",
      };

      expect(resolveCaptureDurationMs(capture, [])).toBe(60_000);
    });

    it("uses Date.now for active captures", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:02:00.000Z"));

      const capture: AppPerformanceCaptureDTO = {
        id: "capture-1",
        startedAt: "2026-01-01T00:01:00.000Z",
        stoppedAt: null,
      };

      expect(resolveCaptureDurationMs(capture, [])).toBe(60_000);

      vi.useRealTimers();
    });
  });

  describe("formatters", () => {
    it("formats numbers, percents, bytes, and durations", () => {
      expect(formatNumber(null)).toBe("n/a");
      expect(formatNumber(1.23)).toBe("1.2");
      expect(formatPercent(1.23)).toBe("1.2%");
      expect(formatBytes(null)).toBe("n/a");
      expect(formatBytes(512 * 1024 * 1024)).toBe("512.0 MB");
      expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
      expect(formatDuration(3_725_000)).toBe("1h 02m 05s");
      expect(formatDuration(65_000)).toBe("1m 05s");
    });

    it("escapes CSV fields with commas or quotes", () => {
      expect(csvEscape("plain")).toBe("plain");
      expect(csvEscape('/cards,"quoted"')).toBe('"/cards,""quoted"""');
    });
  });

  describe("report row helpers", () => {
    it("formats route timeline rows", () => {
      const marker: AppPerformanceRouteMarkerDTO = {
        id: "marker-1",
        route: "/cards",
        label: "Cards",
        markedAt: "2026-01-01T00:00:04.000Z",
        elapsedMs: 4_000,
      };

      expect(formatRouteTimeline([marker])).toEqual([
        "- 0m 04s Cards (/cards)",
      ]);
      expect(formatRouteTimeline([])).toEqual(["- No route markers recorded."]);
    });

    it("formats CSV sample rows", () => {
      expect(formatCsvSample(sample)).toBe(
        '2026-01-01T00:00:05.000Z,0m 05s,"/cards,""quoted""",59.5,8.4,22.2,512.00,64.00,48.00,256.00,65.1',
      );
    });
  });
});
