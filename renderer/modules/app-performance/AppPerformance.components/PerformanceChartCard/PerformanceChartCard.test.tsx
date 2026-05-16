import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type { AppPerformanceSampleDTO } from "../../AppPerformance.types";
import { PerformanceChartCard } from "./PerformanceChartCard";

vi.mock("../PerformanceLineChartCanvas/PerformanceLineChartCanvas", () => ({
  PerformanceLineChartCanvas: ({
    routeMarkers,
    samples,
    showBrush,
    xRange,
    onXRangeChange,
  }: any) => (
    <button
      type="button"
      data-testid="chart-canvas"
      data-brush={showBrush ? "visible" : "hidden"}
      data-route-marker-count={routeMarkers.length}
      data-range={xRange ? `${xRange.startMs}-${xRange.endMs}` : "full"}
      onClick={() => onXRangeChange?.({ startMs: 1000, endMs: 2000 })}
    >
      {samples.length} samples
    </button>
  ),
}));

function sample(
  overrides: Partial<AppPerformanceSampleDTO> = {},
): AppPerformanceSampleDTO {
  return {
    sampledAt: "2024-05-04T00:00:00.000Z",
    uptimeMs: 1000,
    captureElapsedMs: 1000,
    route: "/current-session",
    fps: 60,
    systemCpuPercent: 12,
    appCpuPercent: 2,
    systemMemoryUsedPercent: 70,
    systemMemoryTotalBytes: 16 * 1024 ** 3,
    systemMemoryFreeBytes: 4 * 1024 ** 3,
    appMemoryBytes: 512 * 1024 ** 2,
    appMemoryPercent: 3,
    mainHeapUsedBytes: 128 * 1024 ** 2,
    rendererMemoryBytes: 256 * 1024 ** 2,
    rendererHeapUsedBytes: 64 * 1024 ** 2,
    ...overrides,
  };
}

describe("PerformanceChartCard", () => {
  const lines = [
    {
      id: "fps",
      label: "Renderer FPS",
      color: "#00ff99",
      value: (item: AppPerformanceSampleDTO) => item.fps,
    },
  ];

  beforeEach(() => {
    useBoundStore.getState().reset();
  });

  it("renders stats, legend, and focus controls", async () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.samples = [
        sample({ captureElapsedMs: 0, fps: 30 }),
        sample({ captureElapsedMs: 1000, fps: 60 }),
      ];
      appPerformance.routeMarkers = [
        {
          id: "marker-1",
          route: "/cards/the-doctor",
          label: "/cards/:id",
          markedAt: "2024-05-04T00:00:01.000Z",
          elapsedMs: 1000,
        },
      ];
    });
    const { user } = renderWithProviders(
      <PerformanceChartCard
        chartKey="fps"
        title="FPS"
        subtitle="Renderer cadence"
        lines={lines}
        statFormatter={(value) => (value === null ? "n/a" : String(value))}
        yMaxFloor={60}
        valueFormatter={(value) => (value === null ? "n/a" : String(value))}
      />,
    );

    expect(screen.getByRole("heading", { name: "FPS" })).toBeInTheDocument();
    expect(screen.getByText("Renderer cadence")).toBeInTheDocument();
    expect(screen.getByText("Last")).toBeInTheDocument();
    expect(screen.getByText("Renderer FPS")).toBeInTheDocument();
    expect(screen.queryByText("Target")).not.toBeInTheDocument();
    expect(
      screen.getByText("Renderer FPS").closest("div")?.parentElement,
    ).toHaveClass("flex-wrap", "gap-y-1");
    expect(screen.getByTestId("chart-canvas")).toHaveAttribute(
      "data-brush",
      "hidden",
    );
    expect(screen.getByTestId("chart-canvas")).toHaveAttribute(
      "data-route-marker-count",
      "0",
    );

    await user.click(screen.getByRole("button", { name: "Focus chart" }));

    expect(useBoundStore.getState().appPerformance.focusedChart).toBe("fps");
    expect(screen.getByTestId("chart-canvas")).toHaveAttribute(
      "data-route-marker-count",
      "1",
    );
  });

  it("shows the brush only when focused with enough samples and resets focus from collapse", async () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.focusedChart = "fps";
      appPerformance.samples = Array.from({ length: 5 }, (_, index) =>
        sample({ captureElapsedMs: index * 1000 }),
      );
      appPerformance.routeMarkers = [];
    });
    const { user } = renderWithProviders(
      <PerformanceChartCard
        chartKey="fps"
        title="FPS"
        subtitle="Renderer cadence"
        lines={lines}
        statFormatter={(value) => (value === null ? "n/a" : String(value))}
        compact
        yMaxFloor={60}
        valueFormatter={(value) => (value === null ? "n/a" : String(value))}
      />,
    );

    expect(screen.getByTestId("chart-canvas")).toHaveAttribute(
      "data-brush",
      "visible",
    );

    await user.click(screen.getByTestId("chart-canvas"));
    expect(screen.getByTestId("chart-canvas")).toHaveAttribute(
      "data-range",
      "1000-2000",
    );

    await user.click(screen.getByRole("button", { name: "Collapse chart" }));
    expect(useBoundStore.getState().appPerformance.focusedChart).toBeNull();
  });

  it("uses the latest minute for live compact charts", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.isSampling = true;
      appPerformance.samples = [
        sample({ captureElapsedMs: 0 }),
        sample({ captureElapsedMs: 65_000 }),
        sample({ captureElapsedMs: 125_000 }),
      ];
      appPerformance.routeMarkers = [];
    });

    renderWithProviders(
      <PerformanceChartCard
        chartKey="fps"
        title="FPS"
        subtitle="Renderer cadence"
        lines={lines}
        statFormatter={(value) => (value === null ? "n/a" : String(value))}
        yMaxFloor={60}
        valueFormatter={(value) => (value === null ? "n/a" : String(value))}
      />,
    );

    expect(screen.getByTestId("chart-canvas")).toHaveAttribute(
      "data-range",
      "65000-125000",
    );
    expect(screen.getByTestId("chart-canvas")).toHaveAttribute(
      "data-brush",
      "hidden",
    );
  });
});
