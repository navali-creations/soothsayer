import type { useChartColors } from "~/renderer/hooks";

import type { AppPerformanceCaptureSummaryDTO } from "../../AppPerformance.types";
import {
  createLegendItems,
  createTrendLines,
  createTrendSample,
  createTrendSpecs,
  formatReportDate,
  formatReportIndex,
  REPORT_STEP_MS,
  resolveSecondaryYMaxFloor,
  resolveYMaxFloor,
  type TrendSample,
  type TrendSpec,
} from "./AppPerformanceHistoryTrends.utils";

const colors = {
  success: "#00ff99",
  warning: "#ffaa00",
  info: "#00ccff",
  secondary: "#cc66ff",
  primary: "#aa44ff",
  bc40: "rgba(255,255,255,0.4)",
} as ReturnType<typeof useChartColors>;

function metric(min: number | null, avg: number | null, max: number | null) {
  return { min, avg, max };
}

function capture(): AppPerformanceCaptureSummaryDTO {
  return {
    id: "capture-1",
    startedAt: "2024-05-04T02:54:00.000Z",
    stoppedAt: "2024-05-04T02:56:57.000Z",
    durationMs: 177_000,
    sampleCount: 120,
    routeMarkerCount: 3,
    estimatedSizeBytes: 33.2 * 1024,
    fps: metric(28, 92, 144),
    cpu: metric(0.9, 5.1, 12.1),
    memory: metric(1, 2.2, 2.8),
    appMemoryBytes: metric(512, 1024, 2048),
    systemMemory: metric(65, 66, 67),
    sparklineSamples: [],
    comparison: {
      fps: metric(null, null, null),
      cpu: metric(null, null, null),
      memory: metric(null, null, null),
      appMemoryBytes: metric(null, null, null),
    },
  };
}

describe("AppPerformanceHistoryTrends utils", () => {
  it("creates trend specs for FPS, CPU, and RAM summaries", () => {
    const specs = createTrendSpecs(colors);
    const item = capture();

    expect(specs.map((spec) => spec.id)).toEqual(["fps", "cpu", "ram"]);
    expect(specs[0].getSummary(item)).toBe(item.fps);
    expect(specs[1].getSummary(item)).toBe(item.cpu);
    expect(specs[2].getSummary(item)).toBe(item.appMemoryBytes);
    expect(specs[2].getSecondarySummary?.(item)).toBe(item.memory);
    expect(specs[2].secondaryLabel).toBe("RAM %");
  });

  it("creates min, avg, and max lines for single-axis trends", () => {
    const fpsSpec = createTrendSpecs(colors)[0];
    const lines = createTrendLines({ colors, spec: fpsSpec });
    const sample = {
      trendMin: 28,
      trendAvg: 92,
      trendMax: 144,
    } as TrendSample;

    expect(lines.map((line) => line.label)).toEqual(["Min", "Avg", "Max"]);
    expect(lines.map((line) => line.value(sample))).toEqual([28, 92, 144]);
    expect(lines[2].color).toBe(colors.warning);
  });

  it("creates dual-axis RAM lines and falls back to the primary color", () => {
    const ramSpec: TrendSpec = {
      ...createTrendSpecs(colors)[2],
      secondaryColor: undefined,
    };
    const lines = createTrendLines({ colors, spec: ramSpec });
    const sample = {
      trendAvg: 1024,
      secondaryTrendAvg: 2.4,
    } as TrendSample;

    expect(lines.map((line) => line.id)).toEqual([
      "trend-avg",
      "secondary-trend-avg",
    ]);
    expect(lines[0].value(sample)).toBe(1024);
    expect(lines[1].value(sample)).toBe(2.4);
    expect(lines[1].axis).toBe("secondary");
    expect(lines[1].color).toBe(colors.primary);
  });

  it("creates legend items from lines", () => {
    expect(
      createLegendItems([
        {
          id: "fps",
          label: "FPS",
          color: "#00ff99",
          value: () => 60,
        },
      ]),
    ).toEqual([
      {
        id: "fps",
        label: "FPS",
        visual: "line",
        color: "#00ff99",
      },
    ]);
  });

  it("creates trend samples with optional secondary summaries", () => {
    const item = capture();
    const sample = createTrendSample({
      capture: item,
      summary: item.appMemoryBytes,
      secondarySummary: item.memory,
      index: 2,
    });

    expect(sample.captureElapsedMs).toBe(2 * REPORT_STEP_MS);
    expect(sample.trendMin).toBe(512);
    expect(sample.trendAvg).toBe(1024);
    expect(sample.trendMax).toBe(2048);
    expect(sample.secondaryTrendAvg).toBe(2.2);

    expect(
      createTrendSample({
        capture: item,
        summary: item.fps,
        index: 0,
      }).secondaryTrendAvg,
    ).toBeNull();
  });

  it("resolves axis floors and report labels", () => {
    const [fpsSpec, cpuSpec, ramSpec] = createTrendSpecs(colors);

    expect(resolveYMaxFloor(fpsSpec)).toBe(60);
    expect(resolveYMaxFloor(cpuSpec)).toBe(1);
    expect(resolveSecondaryYMaxFloor(ramSpec)).toBe(100);
    expect(resolveSecondaryYMaxFloor(cpuSpec)).toBeUndefined();
    expect(formatReportIndex(0)).toBe("#1");
    expect(formatReportIndex(2.2 * REPORT_STEP_MS)).toBe("#3");
    expect(formatReportDate("2024-05-04T02:54:00.000Z")).toBe(
      new Date("2024-05-04T02:54:00.000Z").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    );
  });
});
