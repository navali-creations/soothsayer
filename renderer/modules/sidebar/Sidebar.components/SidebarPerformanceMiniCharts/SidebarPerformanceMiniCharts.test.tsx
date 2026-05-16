import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import type { AppPerformanceSampleDTO } from "~/renderer/modules/app-performance";

import { SidebarPerformanceMiniCharts } from "./SidebarPerformanceMiniCharts";

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
      bc30: "rgba(255,255,255,0.3)",
    }),
  };
});

function sample(
  overrides: Partial<AppPerformanceSampleDTO> = {},
): AppPerformanceSampleDTO {
  return {
    sampledAt: "2024-05-04T00:00:00.000Z",
    uptimeMs: 1000,
    captureElapsedMs: 1000,
    route: "/current-session",
    fps: 120,
    systemCpuPercent: 20,
    appCpuPercent: 5,
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

describe("SidebarPerformanceMiniCharts", () => {
  it("renders three compact metric charts with stats", () => {
    renderWithProviders(
      <SidebarPerformanceMiniCharts
        samples={[
          sample({ fps: 60, appCpuPercent: 2 }),
          sample({ fps: 120, appCpuPercent: 5 }),
        ]}
      />,
    );

    expect(
      screen.getByTestId("sidebar-performance-charts"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "FPS diagnostics chart" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "CPU diagnostics chart" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "RAM diagnostics chart" }),
    ).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(
      screen
        .getByRole("img", { name: "FPS diagnostics chart" })
        .querySelectorAll("polyline"),
    ).toHaveLength(1);
  });

  it("renders RAM usage, component, and percent lines with the combined chart colors", () => {
    renderWithProviders(
      <SidebarPerformanceMiniCharts
        samples={[
          sample({
            appMemoryBytes: 512 * 1024 ** 2,
            mainHeapUsedBytes: 96 * 1024 ** 2,
            rendererHeapUsedBytes: 48 * 1024 ** 2,
            systemMemoryUsedPercent: 60,
          }),
          sample({
            appMemoryBytes: 768 * 1024 ** 2,
            mainHeapUsedBytes: 128 * 1024 ** 2,
            rendererHeapUsedBytes: 64 * 1024 ** 2,
            systemMemoryUsedPercent: 70,
          }),
        ]}
      />,
    );

    const ramChart = screen.getByRole("img", {
      name: "RAM diagnostics chart",
    });
    const ramLines = ramChart.querySelectorAll("polyline");

    expect(ramLines).toHaveLength(4);
    expect(ramLines[0]).toHaveAttribute("stroke", "#cc66ff");
    expect(ramLines[1]).toHaveAttribute("stroke", "#00ccff");
    expect(ramLines[2]).toHaveAttribute("stroke", "#00ff99");
    expect(ramLines[3]).toHaveAttribute("stroke", "rgba(255,255,255,0.3)");
  });

  it("renders n/a stats and no polyline segments without values", () => {
    renderWithProviders(
      <SidebarPerformanceMiniCharts
        samples={[
          sample({
            fps: null,
            appCpuPercent: null,
            systemCpuPercent: null,
            appMemoryBytes: null,
            appMemoryPercent: null,
            mainHeapUsedBytes: null,
            rendererMemoryBytes: null,
            rendererHeapUsedBytes: null,
            systemMemoryUsedPercent: null,
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("n/a").length).toBeGreaterThan(0);
    const chartLineCount = screen
      .getAllByRole("img", { name: /diagnostics chart/i })
      .reduce(
        (total, chart) => total + chart.querySelectorAll("polyline").length,
        0,
      );
    expect(chartLineCount).toBe(0);
  });
});
