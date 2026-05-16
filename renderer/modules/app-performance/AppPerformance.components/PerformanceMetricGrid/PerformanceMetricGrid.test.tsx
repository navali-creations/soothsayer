import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type { AppPerformanceSampleDTO } from "../../AppPerformance.types";
import { PerformanceMetricGrid } from "./PerformanceMetricGrid";

function sample(
  overrides: Partial<AppPerformanceSampleDTO> = {},
): AppPerformanceSampleDTO {
  return {
    sampledAt: "2024-05-04T00:00:00.000Z",
    uptimeMs: 1000,
    captureElapsedMs: 1000,
    route: "/current-session",
    fps: 143.5,
    systemCpuPercent: 12.25,
    appCpuPercent: 3.85,
    systemMemoryUsedPercent: 72.25,
    systemMemoryTotalBytes: 16 * 1024 ** 3,
    systemMemoryFreeBytes: 4 * 1024 ** 3,
    appMemoryBytes: 448 * 1024 ** 2,
    appMemoryPercent: 9.5,
    mainHeapUsedBytes: 128 * 1024 ** 2,
    rendererMemoryBytes: 256 * 1024 ** 2,
    rendererHeapUsedBytes: 64 * 1024 ** 2,
    ...overrides,
  };
}

describe("PerformanceMetricGrid", () => {
  beforeEach(() => {
    useBoundStore.getState().reset();
  });

  it("renders latest metric values", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.samples = [sample()];
    });

    renderWithProviders(<PerformanceMetricGrid />);

    expect(screen.getByText("FPS")).toBeInTheDocument();
    expect(screen.getByText("144")).toBeInTheDocument();
    expect(screen.getByText("renderer")).toBeInTheDocument();
    expect(screen.queryByText("target 144")).not.toBeInTheDocument();
    expect(screen.getByText("3.9%")).toBeInTheDocument();
    expect(screen.getByText("448.0 MB")).toBeInTheDocument();
    expect(
      screen.getByText("renderer 320.0 MB / main 128.0 MB"),
    ).toBeInTheDocument();
  });

  it("formats sub-gigabyte memory values as megabytes", () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.samples = [sample({ appMemoryBytes: 768 * 1024 ** 2 })];
    });

    renderWithProviders(<PerformanceMetricGrid />);

    expect(screen.getByText("768.0 MB")).toBeInTheDocument();
  });

  it("renders n/a fallbacks when a latest sample is not available", () => {
    renderWithProviders(<PerformanceMetricGrid />);

    expect(screen.getAllByText("n/a")).toHaveLength(3);
    expect(screen.getByText("system n/a")).toBeInTheDocument();
    expect(screen.getByText("renderer n/a / main n/a")).toBeInTheDocument();
  });
});
