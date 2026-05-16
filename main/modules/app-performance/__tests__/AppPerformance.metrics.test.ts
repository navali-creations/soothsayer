import type { CpuInfo } from "node:os";

import { describe, expect, it } from "vitest";

import {
  aggregateElectronMetrics,
  calculateMemoryUsageBytes,
  calculateSystemCpuPercent,
  readCpuTimesSnapshot,
} from "../AppPerformance.metrics";

function makeCpuInfo(times: CpuInfo["times"]): CpuInfo {
  return {
    model: "test",
    speed: 2400,
    times,
  };
}

function makeProcessMetric(
  pid: number,
  percentCPUUsage: number,
  workingSetSize: number,
  privateBytes = workingSetSize,
): Electron.ProcessMetric {
  return {
    pid,
    type: "Browser",
    cpu: {
      cumulativeCPUUsage: 0,
      idleWakeupsPerSecond: 0,
      percentCPUUsage,
    },
    memory: {
      workingSetSize,
      peakWorkingSetSize: workingSetSize,
      privateBytes,
      sharedBytes: 0,
    },
  } as unknown as Electron.ProcessMetric;
}

describe("AppPerformance.metrics", () => {
  it("reads aggregate CPU idle and total ticks", () => {
    const snapshot = readCpuTimesSnapshot([
      makeCpuInfo({ user: 100, nice: 10, sys: 40, idle: 850, irq: 0 }),
      makeCpuInfo({ user: 50, nice: 0, sys: 20, idle: 930, irq: 0 }),
    ]);

    expect(snapshot).toEqual({
      idle: 1780,
      total: 2000,
    });
  });

  it("calculates system CPU percentage from two snapshots", () => {
    expect(
      calculateSystemCpuPercent(
        { idle: 100, total: 200 },
        { idle: 150, total: 300 },
      ),
    ).toBe(50);
  });

  it("returns null when system CPU cannot be calculated", () => {
    expect(calculateSystemCpuPercent(null, { idle: 1, total: 1 })).toBeNull();
    expect(
      calculateSystemCpuPercent(
        { idle: 10, total: 20 },
        { idle: 20, total: 20 },
      ),
    ).toBeNull();
  });

  it("aggregates Electron process CPU and renderer working-set memory", () => {
    const metrics = [
      makeProcessMetric(1, 12.5, 2048, 4096),
      makeProcessMetric(2, 7.25, 1024, 8192),
    ];

    expect(
      aggregateElectronMetrics(metrics, {
        primaryRendererPid: 2,
        rendererPids: [2],
      }),
    ).toEqual({
      appCpuPercent: 19.75,
      rendererMemoryBytes: 1_048_576,
    });
  });

  it("counts extra renderer windows by private memory when available", () => {
    const metrics = [
      makeProcessMetric(10, 1, 1_024),
      makeProcessMetric(20, 2, 2_048, 512),
      makeProcessMetric(30, 3, 4_096, 1_536),
    ];

    expect(
      aggregateElectronMetrics(metrics, {
        primaryRendererPid: 20,
        rendererPids: [20, 30],
      }),
    ).toEqual({
      appCpuPercent: 6,
      rendererMemoryBytes: 3_670_016,
    });
  });

  it("clamps invalid working-set memory to zero", () => {
    const metric = makeProcessMetric(1, 1, Number.NaN);

    expect(
      aggregateElectronMetrics([metric], {
        primaryRendererPid: 1,
        rendererPids: [1],
      }),
    ).toEqual({
      appCpuPercent: 1,
      rendererMemoryBytes: 0,
    });
  });

  it("combines renderer working set with renderer and main JS heaps", () => {
    expect(
      calculateMemoryUsageBytes({
        rendererMemoryBytes: 256,
        rendererHeapUsedBytes: 64,
        mainHeapUsedBytes: 32,
      }),
    ).toBe(352);
  });

  it("requires all component memory values before calculating memory usage", () => {
    expect(
      calculateMemoryUsageBytes({
        rendererMemoryBytes: null,
        rendererHeapUsedBytes: 64,
        mainHeapUsedBytes: 32,
      }),
    ).toBeNull();
    expect(
      calculateMemoryUsageBytes({
        rendererMemoryBytes: 256,
        rendererHeapUsedBytes: null,
        mainHeapUsedBytes: 32,
      }),
    ).toBeNull();
  });

  it("returns nulls when Electron has no process metrics", () => {
    expect(
      aggregateElectronMetrics([], {
        primaryRendererPid: null,
        rendererPids: [],
      }),
    ).toEqual({
      appCpuPercent: null,
      rendererMemoryBytes: null,
    });
  });
});
