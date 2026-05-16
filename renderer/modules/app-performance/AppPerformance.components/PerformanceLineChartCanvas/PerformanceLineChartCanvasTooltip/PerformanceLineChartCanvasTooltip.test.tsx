import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type {
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../../../AppPerformance.types";
import { PerformanceLineChartCanvasTooltip } from "./PerformanceLineChartCanvasTooltip";

function sample(): AppPerformanceSampleDTO {
  return {
    sampledAt: "2024-05-04T00:00:00.000Z",
    uptimeMs: 1000,
    captureElapsedMs: 1000,
    route: "/cards/the-doctor",
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
  };
}

const marker: AppPerformanceRouteMarkerDTO = {
  id: "marker-1",
  route: "/app-performance/capture-1",
  label: "/app-performance/:id",
  markedAt: "2024-05-04T00:00:01.000Z",
  elapsedMs: 1000,
};

describe("PerformanceLineChartCanvasTooltip", () => {
  it("renders nothing without a hover state", () => {
    const { container } = renderWithProviders(
      <PerformanceLineChartCanvasTooltip
        hover={null}
        canvasHeight={220}
        canvasWidth={640}
        lines={[]}
        valueFormatter={(value) => `${value}`}
        xValueFormatter={(value) => `${value}ms`}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders marker and sample values with line-specific formatters", () => {
    renderWithProviders(
      <PerformanceLineChartCanvasTooltip
        hover={{
          x: 600,
          y: 4,
          marker,
          sample: sample(),
        }}
        canvasHeight={220}
        canvasWidth={640}
        lines={[
          {
            id: "fps",
            label: "FPS",
            color: "#00ff99",
            value: (item) => item.fps,
            valueFormatter: (value) => `${value} fps`,
          },
          {
            id: "memory",
            label: "Memory",
            color: "#cc66ff",
            axis: "secondary",
            value: (item) => item.appMemoryPercent,
          },
          {
            id: "cpu",
            label: "CPU",
            color: "#ffaa00",
            value: (item) => item.appCpuPercent,
          },
        ]}
        valueFormatter={(value) => `${value} value`}
        secondaryValueFormatter={(value) => `${value}%`}
        xValueFormatter={(value) => `${value}ms`}
      />,
    );

    expect(screen.getByText("/app-performance/:id")).toBeInTheDocument();
    expect(screen.getByText("/cards/:id")).toBeInTheDocument();
    expect(screen.getAllByText("1000ms")).toHaveLength(2);
    expect(screen.getByText("60 fps")).toBeInTheDocument();
    expect(screen.getByText("3%")).toBeInTheDocument();
    expect(screen.getByText("2 value")).toBeInTheDocument();
    expect(
      screen.getByTestId("app-performance-line-chart-tooltip"),
    ).toHaveStyle({
      left: "398px",
    });
  });

  it("keeps the tooltip inside the chart's vertical boundary", () => {
    renderWithProviders(
      <PerformanceLineChartCanvasTooltip
        hover={{
          x: 320,
          y: 216,
          marker: null,
          sample: sample(),
        }}
        canvasHeight={220}
        canvasWidth={640}
        lines={[
          {
            id: "fps",
            label: "FPS",
            color: "#00ff99",
            value: (item) => item.fps,
          },
        ]}
        valueFormatter={(value) => `${value} value`}
        xValueFormatter={(value) => `${value}ms`}
      />,
    );

    expect(
      screen.getByTestId("app-performance-line-chart-tooltip"),
    ).toHaveStyle({
      top: "52px",
    });
  });
});
