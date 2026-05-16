import { describe, expect, it } from "vitest";

import type { AppPerformanceSampleDTO } from "~/renderer/modules/app-performance";

import {
  buildLineGapConnectors,
  buildLineSegments,
  getMiniLineGapColor,
  type MiniLine,
  resolveYMax,
} from "./SidebarPerformanceMiniCharts.utils";

function sample(
  overrides: Partial<AppPerformanceSampleDTO> = {},
): AppPerformanceSampleDTO {
  return {
    sampledAt: "2026-05-13T10:00:00.000Z",
    uptimeMs: 1000,
    captureElapsedMs: 1000,
    route: "/",
    fps: 60,
    systemCpuPercent: 20,
    appCpuPercent: 5,
    systemMemoryUsedPercent: 50,
    systemMemoryTotalBytes: 1000,
    systemMemoryFreeBytes: 500,
    appMemoryBytes: 100,
    appMemoryPercent: 10,
    mainHeapUsedBytes: 40,
    rendererMemoryBytes: 80,
    rendererHeapUsedBytes: 30,
    ...overrides,
  };
}

const primaryLine: MiniLine = {
  id: "fps",
  color: "#22c55e",
  value: (entry) => entry.fps,
};

const secondaryLine: MiniLine = {
  id: "memory",
  axis: "secondary",
  color: "#ffaa00",
  value: (entry) => entry.appMemoryPercent,
};

describe("SidebarPerformanceMiniCharts utils", () => {
  it("uses the line color with lower alpha for mini-chart gap connectors", () => {
    expect(getMiniLineGapColor("#22c55e")).toBe("rgba(34, 197, 94, 0.45)");
  });

  it("resolves primary y max from finite primary line values and floor", () => {
    expect(
      resolveYMax(
        [sample({ fps: 30 }), sample({ fps: 120 })],
        [primaryLine, secondaryLine],
        60,
      ),
    ).toBe(120);
  });

  it("resolves secondary y max using only secondary lines", () => {
    expect(
      resolveYMax(
        [sample({ fps: 240, appMemoryPercent: 42 })],
        [primaryLine, secondaryLine],
        100,
        "secondary",
      ),
    ).toBe(100);
  });

  it("falls back to at least one when floor and values are zero", () => {
    expect(
      resolveYMax(
        [sample({ fps: null }), sample({ fps: Number.NaN })],
        [primaryLine],
        0,
      ),
    ).toBe(1);
  });

  it("builds line segments for continuous finite values", () => {
    expect(
      buildLineSegments(
        [sample({ fps: 0 }), sample({ fps: 30 }), sample({ fps: 60 })],
        primaryLine,
        60,
      ),
    ).toEqual(["3.0,27.0 60.0,15.0 117.0,3.0"]);
  });

  it("splits segments across null values and drops one-point segments", () => {
    expect(
      buildLineSegments(
        [
          sample({ fps: 10 }),
          sample({ fps: 20 }),
          sample({ fps: null }),
          sample({ fps: 40 }),
          sample({ fps: Number.POSITIVE_INFINITY }),
          sample({ fps: 60 }),
        ],
        primaryLine,
        60,
      ),
    ).toEqual(["3.0,23.0 25.8,19.0"]);
  });

  it("builds dashed connectors across missing mini-chart values", () => {
    expect(
      buildLineGapConnectors(
        [
          sample({ fps: 10 }),
          sample({ fps: 20 }),
          sample({ fps: null }),
          sample({ fps: 40 }),
          sample({ fps: Number.POSITIVE_INFINITY }),
          sample({ fps: 60 }),
        ],
        primaryLine,
        60,
      ),
    ).toEqual(["25.8,19.0 71.4,11.0", "71.4,11.0 117.0,3.0"]);
  });

  it("clamps values outside the y range", () => {
    expect(
      buildLineSegments(
        [sample({ fps: -10 }), sample({ fps: 120 })],
        primaryLine,
        60,
      ),
    ).toEqual(["3.0,27.0 117.0,3.0"]);
  });
});
