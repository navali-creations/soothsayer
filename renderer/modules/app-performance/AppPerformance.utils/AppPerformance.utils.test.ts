import {
  createAppPerformanceChartConfigs,
  createFormattedMetricStats,
  formatAppPerformanceRouteLabel,
  normalizeAppPerformancePathname,
} from "./AppPerformance.utils";

describe("AppPerformance utils", () => {
  it("normalizes app-performance pathnames before route labeling", () => {
    expect(normalizeAppPerformancePathname("cards/the-doctor?tab=prices")).toBe(
      "/cards/the-doctor",
    );
    expect(normalizeAppPerformancePathname("/cards/the-doctor///#prices")).toBe(
      "/cards/the-doctor",
    );
    expect(normalizeAppPerformancePathname("")).toBe("/");
  });

  it("formats known route labels", () => {
    expect(formatAppPerformanceRouteLabel("/")).toBe("/current-session");
    expect(formatAppPerformanceRouteLabel("/app-performance/live")).toBe(
      "/app-performance/live",
    );
    expect(formatAppPerformanceRouteLabel("/app-performance/capture-1")).toBe(
      "/app-performance/:id",
    );
    expect(formatAppPerformanceRouteLabel("/sessions/session-1")).toBe(
      "/sessions/:id",
    );
    expect(formatAppPerformanceRouteLabel("/cards/the-doctor")).toBe(
      "/cards/:id",
    );
    expect(formatAppPerformanceRouteLabel("/overlay/opened")).toBe(
      "Overlay opened",
    );
    expect(formatAppPerformanceRouteLabel("/overlay/closed")).toBe(
      "Overlay closed",
    );
    expect(formatAppPerformanceRouteLabel(null)).toBe("/current-session");
  });

  it("uses the shared muted chart color for memory System %", () => {
    const charts = createAppPerformanceChartConfigs({
      colors: {
        success: "#00ff99",
        warning: "#ffaa00",
        info: "#00ccff",
        secondary: "#cc66ff",
        primary: "#aa44ff",
        bc30: "rgba(255,255,255,0.3)",
        bc40: "rgba(255,255,255,0.4)",
      } as never,
    });

    const memoryChart = charts.find((chart) => chart.key === "memory");
    const systemPercentLine = memoryChart?.lines.find(
      (line) => line.id === "system-percent",
    );

    expect(systemPercentLine?.color).toBe("rgba(255,255,255,0.3)");
  });

  it("plots memory usage separately from component memory signals", () => {
    const charts = createAppPerformanceChartConfigs({
      colors: {
        success: "#00ff99",
        warning: "#ffaa00",
        info: "#00ccff",
        secondary: "#cc66ff",
        primary: "#aa44ff",
        bc30: "rgba(255,255,255,0.3)",
        bc40: "rgba(255,255,255,0.4)",
      } as never,
    });

    const memoryChart = charts.find((chart) => chart.key === "memory");

    expect(memoryChart?.lines.map((line) => line.id)).toEqual([
      "memory-usage",
      "renderer-heap",
      "main-heap",
      "system-percent",
    ]);
    expect(
      memoryChart?.lines
        .filter((line) => line.connectNullGaps)
        .map((line) => line.id),
    ).toEqual(["memory-usage", "renderer-heap"]);

    const fpsChart = charts.find((chart) => chart.key === "fps");
    expect(fpsChart?.lines.map((line) => line.id)).toEqual(["fps"]);
    expect(
      fpsChart?.lines
        .filter((line) => line.connectNullGaps)
        .map((line) => line.id),
    ).toEqual(["fps"]);
  });

  it("formats current, min, avg, and max from finite values", () => {
    const stats = createFormattedMetricStats(
      [
        { value: 3 },
        { value: null },
        { value: 9 },
        { value: Number.POSITIVE_INFINITY },
        { value: 6 },
      ],
      (sample) => sample.value,
      (value) => (value === null ? "n/a" : value.toFixed(1)),
    );

    expect(stats).toEqual({
      current: "6.0",
      min: "3.0",
      avg: "6.0",
      max: "9.0",
    });
  });

  it("finds the latest finite metric through sparse samples", () => {
    const samples = [{ value: 5 }] as Array<
      { value: number | null } | undefined
    >;
    samples.length = 3;

    const stats = createFormattedMetricStats(
      samples,
      (sample) => sample?.value ?? null,
      (value) => (value === null ? "n/a" : value.toFixed(1)),
    );

    expect(stats.current).toBe("5.0");
  });

  it("returns n/a when no finite values exist", () => {
    const stats = createFormattedMetricStats(
      [{ value: null }, { value: Number.NaN }],
      (sample) => sample.value,
      (value) => (value === null ? "n/a" : value.toFixed(1)),
    );

    expect(stats).toEqual({
      current: "n/a",
      min: "n/a",
      avg: "n/a",
      max: "n/a",
    });
  });
});
