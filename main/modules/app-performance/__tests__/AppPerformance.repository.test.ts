import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import type {
  AppPerformanceCaptureDTO,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../AppPerformance.dto";
import { AppPerformanceRepository } from "../AppPerformance.repository";

let db: Database.Database;
let testDb: TestDatabase;
let repository: AppPerformanceRepository;

const baseSample: AppPerformanceSampleDTO = {
  sampledAt: "2026-01-01T00:00:01.000Z",
  uptimeMs: 1_000,
  captureElapsedMs: 1_000,
  route: "/cards",
  fps: 60,
  systemCpuPercent: 20,
  appCpuPercent: 8,
  systemMemoryUsedPercent: 62,
  systemMemoryTotalBytes: 16 * 1024 * 1024 * 1024,
  systemMemoryFreeBytes: 6 * 1024 * 1024 * 1024,
  appMemoryBytes: 400 * 1024 * 1024,
  appMemoryPercent: 2.4,
  mainHeapUsedBytes: 80 * 1024 * 1024,
  rendererMemoryBytes: 240 * 1024 * 1024,
  rendererHeapUsedBytes: 48 * 1024 * 1024,
};

const baseMarker: AppPerformanceRouteMarkerDTO = {
  id: "marker-1",
  route: "/cards",
  label: "Cards",
  markedAt: "2026-01-01T00:00:01.000Z",
  elapsedMs: 1_000,
};

const neutralComparison = {
  fps: { min: null, avg: null, max: null },
  cpu: { min: null, avg: null, max: null },
  memory: { min: null, avg: null, max: null },
  appMemoryBytes: { min: null, avg: null, max: null },
};

function createCapture(
  overrides: Partial<AppPerformanceCaptureDTO> = {},
): AppPerformanceCaptureDTO {
  return {
    id: "capture-1",
    startedAt: "2026-01-01T00:00:00.000Z",
    stoppedAt: null,
    ...overrides,
  };
}

describe("AppPerformanceRepository", () => {
  beforeEach(() => {
    testDb = createTestDatabase();
    db = testDb.db;
    repository = new AppPerformanceRepository(db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("persists and reads a capture with samples and route markers", () => {
    const capture = createCapture();
    repository.createCapture(capture);
    repository.insertSamples(capture.id, [baseSample]);
    repository.insertRouteMarker(capture.id, baseMarker);

    expect(repository.getStateForCapture(capture.id, true)).toEqual({
      capture,
      isSampling: true,
      samples: [baseSample],
      routeMarkers: [baseMarker],
    });

    repository.stopCapture(capture.id, "2026-01-01T00:00:10.000Z");

    expect(repository.getCapture(capture.id)?.stoppedAt).toBe(
      "2026-01-01T00:00:10.000Z",
    );
    expect(repository.getRowCounts()).toEqual({
      captures: 1,
      samples: 1,
      routeMarkers: 1,
    });
  });

  it("can read a bounded capture state window in chronological order", () => {
    const capture = createCapture();
    repository.createCapture(capture);

    repository.insertSamples(
      capture.id,
      Array.from({ length: 5 }, (_, index) => ({
        ...baseSample,
        sampledAt: `2026-01-01T00:00:0${index + 1}.000Z`,
        captureElapsedMs: (index + 1) * 1000,
      })),
    );
    for (let index = 0; index < 5; index++) {
      repository.insertRouteMarker(capture.id, {
        ...baseMarker,
        id: `marker-${index + 1}`,
        markedAt: `2026-01-01T00:00:0${index + 1}.000Z`,
        elapsedMs: (index + 1) * 1000,
      });
    }

    const state = repository.getStateForCapture(capture.id, false, {
      sampleLimit: 2,
      routeMarkerLimit: 3,
    });

    expect(state.samples.map((sample) => sample.captureElapsedMs)).toEqual([
      4_000, 5_000,
    ]);
    expect(state.routeMarkers.map((marker) => marker.id)).toEqual([
      "marker-3",
      "marker-4",
      "marker-5",
    ]);
  });

  it("can read a bounded capture state span across the full duration", () => {
    const capture = createCapture();
    repository.createCapture(capture);

    repository.insertSamples(
      capture.id,
      Array.from({ length: 5 }, (_, index) => ({
        ...baseSample,
        sampledAt: `2026-01-01T00:00:0${index + 1}.000Z`,
        captureElapsedMs: (index + 1) * 1000,
      })),
    );

    const state = repository.getStateForCapture(capture.id, false, {
      sampleLimit: 3,
      sampleMode: "span",
    });

    expect(state.samples.map((sample) => sample.captureElapsedMs)).toEqual([
      1_000, 3_000, 5_000,
    ]);
  });

  it("builds bounded report data with full-capture counts and stats", () => {
    const capture = createCapture();
    repository.createCapture(capture);

    repository.insertSamples(
      capture.id,
      Array.from({ length: 5 }, (_, index) => ({
        ...baseSample,
        sampledAt: `2026-01-01T00:00:0${index + 1}.000Z`,
        captureElapsedMs: (index + 1) * 1000,
        fps: index === 4 ? null : (index + 1) * 10,
        appCpuPercent: index + 1,
        systemCpuPercent: (index + 1) * 2,
        appMemoryPercent: index + 1,
        systemMemoryUsedPercent: 60 + index,
        appMemoryBytes: (index + 1) * 100,
      })),
    );
    for (let index = 0; index < 5; index++) {
      repository.insertRouteMarker(capture.id, {
        ...baseMarker,
        id: `marker-${index + 1}`,
        markedAt: `2026-01-01T00:00:0${index + 1}.000Z`,
        elapsedMs: (index + 1) * 1000,
      });
    }

    const reportData = repository.getReportDataForCapture(capture.id, false, {
      sampleLimit: 2,
      routeMarkerLimit: 3,
    });

    expect(reportData.samples.map((sample) => sample.captureElapsedMs)).toEqual(
      [4_000, 5_000],
    );
    expect(reportData.routeMarkers.map((marker) => marker.id)).toEqual([
      "marker-3",
      "marker-4",
      "marker-5",
    ]);
    expect(reportData.sampleCount).toBe(5);
    expect(reportData.routeMarkerCount).toBe(5);
    expect(reportData.stats.fps).toEqual({
      current: 40,
      min: 10,
      avg: 25,
      max: 40,
    });
    expect(reportData.stats.appCpu).toEqual({
      current: 5,
      min: 1,
      avg: 3,
      max: 5,
    });
  });

  it("cleans up captures older than the configured retention", () => {
    const oldCapture = createCapture({
      id: "old",
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    const recentCapture = createCapture({
      id: "recent",
      startedAt: "2026-01-09T00:00:00.000Z",
    });

    repository.createCapture(oldCapture);
    repository.createCapture(recentCapture);
    repository.insertSamples(oldCapture.id, [baseSample]);
    repository.insertSamples(recentCapture.id, [
      { ...baseSample, sampledAt: "2026-01-09T00:00:01.000Z" },
    ]);
    repository.insertRouteMarker(oldCapture.id, baseMarker);
    repository.insertRouteMarker(recentCapture.id, {
      ...baseMarker,
      id: "recent-marker",
      markedAt: "2026-01-09T00:00:01.000Z",
    });

    expect(repository.cleanup("7d", new Date("2026-01-10T00:00:00.000Z"))).toBe(
      1,
    );

    expect(repository.getCapture(oldCapture.id)).toBeNull();
    expect(repository.getCapture(recentCapture.id)).toEqual(recentCapture);
    expect(repository.getRowCounts()).toEqual({
      captures: 1,
      samples: 1,
      routeMarkers: 1,
    });
  });

  it("cleans up expired captures in bounded batches", () => {
    for (let index = 0; index < 205; index += 1) {
      repository.createCapture(
        createCapture({
          id: `old-${index}`,
          startedAt: "2026-01-01T00:00:00.000Z",
        }),
      );
    }
    const recentCapture = createCapture({
      id: "recent",
      startedAt: "2026-01-09T00:00:00.000Z",
    });
    repository.createCapture(recentCapture);

    expect(repository.cleanup("7d", new Date("2026-01-10T00:00:00.000Z"))).toBe(
      205,
    );
    expect(repository.countCaptures()).toBe(1);
    expect(repository.getCapture(recentCapture.id)).toEqual(recentCapture);
  });

  it("keeps existing captures for indefinite retention", () => {
    repository.createCapture(createCapture());

    expect(
      repository.cleanup("indefinite", new Date("2026-01-10T00:00:00.000Z")),
    ).toBe(0);
    expect(repository.hasData()).toBe(true);
  });

  it("closes open captures left behind by an interrupted app run", () => {
    const openCapture = createCapture({ id: "open" });
    const closedCapture = createCapture({
      id: "closed",
      stoppedAt: "2026-01-01T00:00:10.000Z",
    });

    repository.createCapture(openCapture);
    repository.createCapture(closedCapture);

    expect(repository.closeOpenCaptures("2026-01-01T00:00:20.000Z")).toBe(1);
    expect(repository.getCapture(openCapture.id)?.stoppedAt).toBe(
      "2026-01-01T00:00:20.000Z",
    );
    expect(repository.getCapture(closedCapture.id)?.stoppedAt).toBe(
      "2026-01-01T00:00:10.000Z",
    );
  });

  it("lists capture summaries with sample and route marker counts", () => {
    const capture = createCapture({
      id: "summary",
      startedAt: "2026-01-01T00:00:00.000Z",
      stoppedAt: "2026-01-01T00:00:10.000Z",
    });
    repository.createCapture(capture);
    repository.insertSamples(capture.id, [
      baseSample,
      {
        ...baseSample,
        sampledAt: "2026-01-01T00:00:05.000Z",
        captureElapsedMs: 5_000,
        fps: 30,
        appCpuPercent: 12,
        systemMemoryUsedPercent: 68,
        appMemoryBytes: 600 * 1024 * 1024,
        appMemoryPercent: 3.6,
      },
    ]);
    repository.insertRouteMarker(capture.id, baseMarker);

    expect(repository.listCaptureSummaries({ limit: 5 })).toEqual([
      {
        ...capture,
        durationMs: 5_000,
        sampleCount: 2,
        routeMarkerCount: 1,
        estimatedSizeBytes: 640,
        fps: {
          min: 30,
          avg: 45,
          max: 60,
        },
        cpu: {
          min: 8,
          avg: 10,
          max: 12,
        },
        memory: {
          min: 2.4,
          avg: 3,
          max: 3.6,
        },
        systemMemory: {
          min: 62,
          avg: 65,
          max: 68,
        },
        appMemoryBytes: {
          min: 400 * 1024 * 1024,
          avg: 500 * 1024 * 1024,
          max: 600 * 1024 * 1024,
        },
        sparklineSamples: [
          {
            captureElapsedMs: 1_000,
            fps: 60,
            appCpuPercent: 8,
            appMemoryBytes: 400 * 1024 * 1024,
            appMemoryPercent: 2.4,
            systemMemoryUsedPercent: 62,
          },
          {
            captureElapsedMs: 5_000,
            fps: 30,
            appCpuPercent: 12,
            appMemoryBytes: 600 * 1024 * 1024,
            appMemoryPercent: 3.6,
            systemMemoryUsedPercent: 68,
          },
        ],
        comparison: neutralComparison,
      },
    ]);
  });

  it("returns bounded chronological sparkline samples for capture summaries", () => {
    const capture = createCapture();
    repository.createCapture(capture);
    repository.insertSamples(
      capture.id,
      Array.from({ length: 50 }, (_, index) => ({
        ...baseSample,
        sampledAt: `2026-01-01T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
        captureElapsedMs: (index + 1) * 1000,
        appCpuPercent: index % 2 === 0 ? 2 : 12,
      })),
    );

    const [summary] = repository.listCaptureSummaries({ limit: 5 });
    const cpuValues = summary.sparklineSamples.map(
      (sample) => sample.appCpuPercent,
    );

    expect(summary.sparklineSamples.length).toBeLessThanOrEqual(36);
    expect(summary.sparklineSamples[0].captureElapsedMs).toBe(1_000);
    expect(
      summary.sparklineSamples.at(-1)?.captureElapsedMs,
    ).toBeLessThanOrEqual(50_000);
    expect(
      cpuValues.some(
        (value, index) =>
          index > 0 &&
          value !== null &&
          cpuValues[index - 1] !== null &&
          value < cpuValues[index - 1]!,
      ),
    ).toBe(true);
  });

  it("compares capture summaries against the previous global capture before pagination", () => {
    const oldest = createCapture({
      id: "oldest",
      startedAt: "2026-01-01T00:00:00.000Z",
    });
    const middle = createCapture({
      id: "middle",
      startedAt: "2026-01-02T00:00:00.000Z",
    });
    const newest = createCapture({
      id: "newest",
      startedAt: "2026-01-03T00:00:00.000Z",
    });

    repository.createCapture(oldest);
    repository.createCapture(middle);
    repository.createCapture(newest);
    repository.insertSamples(oldest.id, [
      {
        ...baseSample,
        sampledAt: "2026-01-01T00:00:01.000Z",
        fps: 60,
        appCpuPercent: 8,
        appMemoryBytes: 400,
        appMemoryPercent: 2,
      },
    ]);
    repository.insertSamples(middle.id, [
      {
        ...baseSample,
        sampledAt: "2026-01-02T00:00:01.000Z",
        fps: 55,
        appCpuPercent: 10,
        appMemoryBytes: 500,
        appMemoryPercent: 3,
      },
    ]);
    repository.insertSamples(newest.id, [
      {
        ...baseSample,
        sampledAt: "2026-01-03T00:00:01.000Z",
        fps: 55,
        appCpuPercent: 7,
        appMemoryBytes: 500,
        appMemoryPercent: 2.5,
      },
    ]);

    expect(
      repository.listCaptureSummaries({ limit: 1, offset: 1 })[0].comparison,
    ).toEqual({
      fps: { min: "lower", avg: "lower", max: "lower" },
      cpu: { min: "higher", avg: "higher", max: "higher" },
      memory: { min: "higher", avg: "higher", max: "higher" },
      appMemoryBytes: { min: "higher", avg: "higher", max: "higher" },
    });
  });

  it("paginates capture summaries", () => {
    repository.createCapture(
      createCapture({
        id: "older",
        startedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    repository.createCapture(
      createCapture({
        id: "newer",
        startedAt: "2026-01-02T00:00:00.000Z",
      }),
    );

    expect(
      repository
        .listCaptureSummaries({ limit: 1, offset: 1 })
        .map((capture) => capture.id),
    ).toEqual(["older"]);
    expect(repository.countCaptures()).toBe(2);
  });

  it("deletes a capture with its samples and route markers", () => {
    const capture = createCapture();
    repository.createCapture(capture);
    repository.insertSamples(capture.id, [baseSample]);
    repository.insertRouteMarker(capture.id, baseMarker);

    expect(repository.deleteCapture(capture.id)).toBe(1);

    expect(repository.getCapture(capture.id)).toBeNull();
    expect(repository.getRowCounts()).toEqual({
      captures: 0,
      samples: 0,
      routeMarkers: 0,
    });
  });

  it("deletes multiple captures in one batch", () => {
    const first = createCapture({ id: "delete-first" });
    const second = createCapture({ id: "delete-second" });
    const kept = createCapture({ id: "keep" });
    repository.createCapture(first);
    repository.createCapture(second);
    repository.createCapture(kept);
    repository.insertSamples(first.id, [baseSample]);
    repository.insertRouteMarker(second.id, baseMarker);

    expect(repository.deleteCaptures([first.id, second.id, first.id])).toBe(2);

    expect(repository.getCapture(first.id)).toBeNull();
    expect(repository.getCapture(second.id)).toBeNull();
    expect(repository.getCapture(kept.id)).toEqual(kept);
    expect(repository.getRowCounts()).toEqual({
      captures: 1,
      samples: 0,
      routeMarkers: 0,
    });
  });
});
