import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type { AppPerformanceCaptureSummaryDTO } from "../../AppPerformance.types";
import { AppPerformanceHistoryTrends } from "./AppPerformanceHistoryTrends";

vi.mock("~/renderer/hooks", async () => {
  const actual =
    await vi.importActual<typeof import("~/renderer/hooks")>(
      "~/renderer/hooks",
    );
  return {
    ...actual,
    useChartColors: () => ({
      success: "#00ff99",
      warning: "#ffaa00",
      info: "#00ccff",
      secondary: "#cc66ff",
      primary: "#aa44ff",
      bc40: "rgba(255,255,255,0.4)",
    }),
  };
});

vi.mock("../PerformanceLineChartCanvas/PerformanceLineChartCanvas", () => ({
  PerformanceLineChartCanvas: ({
    samples,
    emptyLabel,
    lines,
    secondaryValueFormatter,
    showBrush,
    dense,
    xRange,
    onXRangeChange,
  }: any) => (
    <button
      type="button"
      data-testid="trend-chart"
      data-lines={lines.map((line: { id: string }) => line.id).join(",")}
      data-secondary-axis={secondaryValueFormatter ? "true" : "false"}
      data-brush={showBrush ? "visible" : "hidden"}
      data-dense={dense ? "true" : "false"}
      data-range={xRange ? `${xRange.startMs}-${xRange.endMs}` : "full"}
      onClick={() => onXRangeChange?.({ startMs: 0, endMs: 60_000 })}
    >
      {samples.length === 0 ? emptyLabel : `${samples.length} points`}
    </button>
  ),
}));

function metric(min: number | null, avg: number | null, max: number | null) {
  return { min, avg, max };
}

function capture(
  id: string,
  overrides: Partial<AppPerformanceCaptureSummaryDTO> = {},
): AppPerformanceCaptureSummaryDTO {
  return {
    id,
    startedAt: "2024-05-04T02:54:00.000Z",
    stoppedAt: "2024-05-04T02:56:57.000Z",
    durationMs: 177_000,
    sampleCount: 120,
    routeMarkerCount: 3,
    estimatedSizeBytes: 33.2 * 1024,
    fps: metric(28, 92, 144),
    cpu: metric(0.9, 5.1, 12.1),
    memory: metric(1, 2.2, 2.8),
    appMemoryBytes: metric(
      673.6 * 1024 ** 2,
      1.43 * 1024 ** 3,
      1.75 * 1024 ** 3,
    ),
    systemMemory: metric(65, 66, 67),
    sparklineSamples: [],
    comparison: {
      fps: { min: null, avg: null, max: null },
      cpu: { min: null, avg: null, max: null },
      memory: { min: null, avg: null, max: null },
      appMemoryBytes: { min: null, avg: null, max: null },
    },
    ...overrides,
  };
}

describe("AppPerformanceHistoryTrends", () => {
  beforeEach(() => {
    useBoundStore.getState().reset();
  });

  it("renders skeleton cards while loading initial trends", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.captureHistory = [];
      appPerformance.isLoadingHistory = true;
    });

    const { container } = renderWithProviders(<AppPerformanceHistoryTrends />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders nothing for an empty non-loading trends view", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.captureHistory = [];
      appPerformance.isLoadingHistory = false;
    });

    const { container } = renderWithProviders(<AppPerformanceHistoryTrends />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders combined RAM trend card with latest summaries and chart points", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.captureHistory = [
        capture("newest"),
        capture("oldest", { startedAt: "2024-05-03T00:00:00.000Z" }),
      ];
      appPerformance.isLoadingHistory = false;
    });

    renderWithProviders(<AppPerformanceHistoryTrends />);

    expect(screen.getByText("Latest 2 reports")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "RAM" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "RAM %" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FPS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CPU" })).toBeInTheDocument();
    expect(screen.getAllByTestId("trend-chart")).toHaveLength(3);
    expect(screen.getAllByText("2 points")).toHaveLength(3);
    expect(screen.getByText("1.43 GB")).toBeInTheDocument();
    expect(screen.getByText("2.2% RAM %")).toBeInTheDocument();
    expect(screen.getByText("RAM % Avg")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("trend-chart")
        .some((chart) => chart.getAttribute("data-secondary-axis") === "true"),
    ).toBe(true);
  });

  it("focuses each trend chart with its own brush and compact siblings", async () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.captureHistory = [
        capture("newest"),
        capture("middle", { startedAt: "2024-05-03T00:00:00.000Z" }),
        capture("oldest", { startedAt: "2024-05-02T00:00:00.000Z" }),
      ];
      appPerformance.isLoadingHistory = false;
    });

    const { user } = renderWithProviders(<AppPerformanceHistoryTrends />);

    expect(screen.getAllByTitle("Focus chart")).toHaveLength(3);
    expect(screen.getAllByTestId("trend-chart")).toHaveLength(3);
    expect(screen.getAllByTestId("trend-chart")[0]).toHaveAttribute(
      "data-brush",
      "hidden",
    );

    await user.click(screen.getAllByTitle("Focus chart")[0]);

    const focusedCharts = screen.getAllByTestId("trend-chart");
    expect(screen.getByTitle("Collapse chart")).toBeInTheDocument();
    expect(focusedCharts).toHaveLength(3);
    expect(focusedCharts[0]).toHaveAttribute("data-brush", "visible");
    expect(focusedCharts[0]).toHaveAttribute("data-dense", "false");
    expect(focusedCharts[1]).toHaveAttribute("data-dense", "true");

    await user.click(focusedCharts[0]);

    expect(screen.getAllByTestId("trend-chart")[0]).toHaveAttribute(
      "data-range",
      "0-60000",
    );

    await user.click(screen.getByTitle("Collapse chart"));

    expect(screen.getAllByTitle("Focus chart")).toHaveLength(3);
    expect(screen.getAllByTestId("trend-chart")[0]).toHaveAttribute(
      "data-brush",
      "hidden",
    );
  });
});
