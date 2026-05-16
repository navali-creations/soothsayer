import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import type { AppPerformanceSampleDTO } from "~/renderer/modules/app-performance";

import type { MiniChartConfig } from "../SidebarPerformanceMiniCharts.utils";
import { MiniMetricChart } from "./MiniMetricChart";

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

const chart: MiniChartConfig = {
  id: "fps",
  title: "FPS",
  yMaxFloor: 60,
  format: (value) => (value === null ? "n/a" : String(value)),
  primaryValue: (entry) => entry.fps,
  lines: [
    {
      id: "fps",
      color: "#22c55e",
      value: (entry) => entry.fps,
    },
    {
      id: "target",
      color: "#ffffff",
      dashed: true,
      value: (entry) => entry.systemCpuPercent,
    },
  ],
};

function renderMiniMetricChart({
  chartConfig = chart,
  samples = [sample({ fps: 30 }), sample({ fps: 60 })],
}: {
  chartConfig?: MiniChartConfig;
  samples?: AppPerformanceSampleDTO[];
} = {}) {
  return renderWithProviders(
    <MiniMetricChart chart={chartConfig} samples={samples} />,
  );
}

describe("MiniMetricChart", () => {
  it("renders the chart title and latest metric value", () => {
    renderMiniMetricChart();

    expect(screen.getByText("FPS")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "FPS diagnostics chart" }),
    ).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.queryByText("Avg")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("draws one polyline per valid chart line and preserves dashed styling", () => {
    renderMiniMetricChart();

    const lines = screen
      .getByRole("img", { name: "FPS diagnostics chart" })
      .querySelectorAll("polyline");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("stroke", "#22c55e");
    expect(lines[1]).toHaveAttribute("stroke", "#ffffff");
    expect(lines[1]).toHaveAttribute("stroke-dasharray", "3 3");
  });

  it("draws muted dashed connectors across missing mini-chart values", () => {
    renderMiniMetricChart({
      chartConfig: {
        ...chart,
        lines: [{ ...chart.lines[0], connectNullGaps: true }],
      },
      samples: [
        sample({ fps: 30 }),
        sample({ fps: 60 }),
        sample({ fps: null }),
        sample({ fps: 90 }),
      ],
    });

    const lines = screen
      .getByRole("img", { name: "FPS diagnostics chart" })
      .querySelectorAll("polyline");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("stroke", "rgba(34, 197, 94, 0.45)");
    expect(lines[0]).toHaveAttribute("stroke-dasharray", "3 3");
    expect(lines[1]).toHaveAttribute("stroke", "#22c55e");
  });

  it("uses the secondary axis floor for secondary lines", () => {
    renderMiniMetricChart({
      chartConfig: {
        ...chart,
        secondaryYMaxFloor: 100,
        lines: [
          chart.lines[0],
          {
            id: "memory-percent",
            color: "#ffaa00",
            axis: "secondary",
            value: (entry) => entry.appMemoryPercent,
          },
        ],
      },
      samples: [
        sample({ fps: 60, appMemoryPercent: 10 }),
        sample({ fps: 30, appMemoryPercent: 50 }),
      ],
    });

    const lines = screen
      .getByRole("img", { name: "FPS diagnostics chart" })
      .querySelectorAll("polyline");

    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveAttribute("stroke", "#ffaa00");
  });

  it("renders n/a stats and no polylines when samples have no finite values", () => {
    renderMiniMetricChart({
      samples: [sample({ fps: null, systemCpuPercent: null })],
    });

    expect(screen.getByText("n/a")).toBeInTheDocument();
    expect(
      screen
        .getByRole("img", { name: "FPS diagnostics chart" })
        .querySelectorAll("polyline"),
    ).toHaveLength(0);
  });
});
