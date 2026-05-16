import type {
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../../AppPerformance.types";
import type { PerformanceLine } from "./PerformanceLineChartCanvas.types";
import {
  buildLineGapConnectors,
  buildLineSegments,
  findMarkerLabelLane,
  formatElapsed,
  formatRouteLabel,
  getBrushDomain,
  getBrushLayout,
  getChartLayout,
  getRouteMarkerStrokeStyle,
  isOverlayRouteMarker,
  normalizeTimeRange,
  numericRangeToTimeRange,
  resolveLineGapColor,
  selectSamplesForTimeRange,
  selectSpanSamples,
  timeRangeToNumericRange,
} from "./PerformanceLineChartCanvas.utils";

function sample(
  captureElapsedMs: number,
  value: number | null,
): AppPerformanceSampleDTO {
  return {
    sampledAt: "2024-05-04T00:00:00.000Z",
    uptimeMs: captureElapsedMs,
    captureElapsedMs,
    route: "/current-session",
    fps: value,
    systemCpuPercent: null,
    appCpuPercent: null,
    systemMemoryUsedPercent: null,
    systemMemoryTotalBytes: null,
    systemMemoryFreeBytes: null,
    appMemoryBytes: null,
    appMemoryPercent: null,
    mainHeapUsedBytes: null,
    rendererMemoryBytes: null,
    rendererHeapUsedBytes: null,
  };
}

describe("PerformanceLineChartCanvas utils", () => {
  it("builds line segments around null and non-finite values", () => {
    const line: PerformanceLine = {
      id: "fps",
      label: "FPS",
      color: "#00ff99",
      value: (item) => item.fps,
    };

    expect(
      buildLineSegments(
        [
          sample(0, 30),
          sample(1_000, Number.POSITIVE_INFINITY),
          sample(2_000, 60),
          sample(3_000, null),
          sample(4_000, 90),
        ],
        line,
        (value) => value / 1_000,
        (value) => value * 2,
      ),
    ).toEqual([[{ x: 0, y: 60 }], [{ x: 2, y: 120 }], [{ x: 4, y: 180 }]]);
  });

  it("builds muted connectors between separated line segments", () => {
    expect(
      buildLineGapConnectors([
        [
          { x: 0, y: 10 },
          { x: 1, y: 20 },
        ],
        [{ x: 4, y: 40 }],
        [
          { x: 6, y: 60 },
          { x: 7, y: 70 },
        ],
      ]),
    ).toEqual([
      [
        { x: 1, y: 20 },
        { x: 4, y: 40 },
      ],
      [
        { x: 4, y: 40 },
        { x: 6, y: 60 },
      ],
    ]);
  });

  it("uses the line color with lower alpha for chart gap connectors", () => {
    expect(resolveLineGapColor("rgb(204, 102, 255)")).toBe(
      "rgba(204, 102, 255, 0.45)",
    );
  });

  it("selects visible samples with boundary neighbors", () => {
    const samples = [
      sample(0, 10),
      sample(10, 20),
      sample(20, 30),
      sample(30, 40),
    ];

    expect(
      selectSamplesForTimeRange(samples, 12, 22).map(
        (item) => item.captureElapsedMs,
      ),
    ).toEqual([10, 20, 30]);
  });

  it("selects span samples across long chart inputs", () => {
    const samples = Array.from({ length: 5 }, (_, index) =>
      sample(index * 1_000, index),
    );

    expect(
      selectSpanSamples(samples, 3).map((item) => item.captureElapsedMs),
    ).toEqual([0, 2_000, 4_000]);
  });

  it("finds reusable, new, and least-overlapping marker label lanes", () => {
    expect(findMarkerLabelLane([20, 80], 40, 3)).toBe(0);
    expect(findMarkerLabelLane([80], 40, 3)).toBe(1);
    expect(findMarkerLabelLane([100, 20, 70], 40, 3)).toBe(1);
  });

  it("normalizes time ranges and converts brush ranges", () => {
    const fullXDomain = { xMin: 0, xMax: 60_000 };

    expect(
      normalizeTimeRange({ startMs: 20_000, endMs: 10_000 }, fullXDomain),
    ).toEqual({ startMs: 10_000, endMs: 20_000 });
    expect(
      normalizeTimeRange({ startMs: 10_000, endMs: 11_000 }, fullXDomain),
    ).toBeNull();
    expect(normalizeTimeRange(null, fullXDomain)).toBeNull();
    expect(getBrushDomain(fullXDomain)).toEqual({ min: 0, max: 60_000 });
    expect(timeRangeToNumericRange({ startMs: 1, endMs: 2 })).toEqual({
      start: 1,
      end: 2,
    });
    expect(numericRangeToTimeRange({ start: 3, end: 4 })).toEqual({
      startMs: 3,
      endMs: 4,
    });
  });

  it("resolves chart and brush layouts", () => {
    expect(getChartLayout(640)).toEqual({ left: 42, right: 624 });
    expect(getChartLayout(640, true)).toEqual({ left: 42, right: 598 });
    expect(getChartLayout(30)).toEqual({ left: 42, right: 43 });

    expect(getBrushLayout(640, 220).outer).toEqual({
      left: 42,
      right: 624,
      top: 172,
      bottom: 206,
    });
    expect(getBrushLayout(640, 220, true).plot.left).toBe(52);
  });

  it("formats elapsed time and route marker labels", () => {
    const marker: AppPerformanceRouteMarkerDTO = {
      id: "marker-1",
      route: "/cards/the-doctor",
      label: "/cards/:id",
      markedAt: "2024-05-04T00:00:01.000Z",
      elapsedMs: 65_000,
    };
    const overlayMarker: AppPerformanceRouteMarkerDTO = {
      id: "marker-2",
      route: "/overlay/opened",
      label: "Overlay opened",
      markedAt: "2024-05-04T00:00:02.000Z",
      elapsedMs: 66_000,
    };

    expect(formatElapsed(65_000)).toBe("1:05");
    expect(formatRouteLabel(marker)).toBe("/cards/:id");
    expect(formatRouteLabel(overlayMarker)).toBe("Overlay opened");
    expect(isOverlayRouteMarker(overlayMarker)).toBe(true);
    expect(isOverlayRouteMarker(marker)).toBe(false);
    expect(getRouteMarkerStrokeStyle(overlayMarker)).not.toBe(
      getRouteMarkerStrokeStyle(marker),
    );
  });
});
