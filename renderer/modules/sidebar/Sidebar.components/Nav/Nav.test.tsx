import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import { Nav } from "./Nav";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/hooks", () => ({
  formatTickingTimer: (timer: {
    hours: number;
    minutes: number;
    seconds: number;
  }) =>
    `${timer.hours}h ${String(timer.minutes).padStart(2, "0")}m ${String(
      timer.seconds,
    ).padStart(2, "0")}s`,
  useTickingTimer: vi.fn(() => ({ hours: 0, minutes: 2, seconds: 9 })),
}));

vi.mock("~/renderer/components", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiActivity: () => <span data-testid="icon-activity" />,
  FiBarChart2: () => <span data-testid="icon-bar-chart" />,
  FiCpu: () => <span data-testid="icon-cpu" />,
  FiTrendingUp: () => <span data-testid="icon-trending-up" />,
}));

vi.mock("react-icons/gi", () => ({
  GiCardRandom: () => <span data-testid="icon-card-random" />,
}));

vi.mock("react-icons/md", () => ({
  MdCompareArrows: () => <span data-testid="icon-compare-arrows" />,
}));

vi.mock("../SidebarPerformanceMiniCharts/SidebarPerformanceMiniCharts", () => ({
  SidebarPerformanceMiniCharts: ({ samples }: { samples: unknown[] }) => (
    <div data-sample-count={samples.length} data-testid="sidebar-mini-charts" />
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);
const mockUseTickingTimer = vi.mocked(useTickingTimer);

function setupStore(
  overrides: {
    appPerformanceMonitorEnabled?: boolean;
    isSampling?: boolean;
    captureStartedAt?: string | null;
    samples?: unknown[];
  } = {},
) {
  mockUseBoundStore.mockReturnValue({
    settings: {
      appPerformanceMonitorEnabled:
        overrides.appPerformanceMonitorEnabled ?? false,
    },
    appPerformance: {
      captureStartedAt: overrides.captureStartedAt ?? null,
      isSampling: overrides.isSampling ?? false,
      samples: overrides.samples ?? [],
    },
  } as never);
}

describe("Nav", () => {
  it("renders the base navigation links without app performance when disabled", () => {
    setupStore({ appPerformanceMonitorEnabled: false });

    renderWithProviders(<Nav />);

    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.getByText("Current Session")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Statistics")).toBeInTheDocument();
    expect(screen.getByText("Cards")).toBeInTheDocument();
    expect(screen.getByText("Profit Forecast")).toBeInTheDocument();
    expect(screen.getByText("Rarity Insights")).toBeInTheDocument();
    expect(screen.queryByText("App Performance")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-mini-charts")).not.toBeInTheDocument();
  });

  it("links to app performance index when diagnostics are enabled but idle", () => {
    setupStore({ appPerformanceMonitorEnabled: true, isSampling: false });

    renderWithProviders(<Nav />);

    const link = screen.getByText("App Performance").closest("a");

    expect(link).toHaveAttribute("href", "/app-performance");
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.queryByTestId("sidebar-mini-charts")).not.toBeInTheDocument();
    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: null,
      direction: "up",
      enabled: false,
    });
  });

  it("links to live capture, shows compact minute timer, and renders mini charts while sampling", () => {
    setupStore({
      appPerformanceMonitorEnabled: true,
      isSampling: true,
      captureStartedAt: "2026-05-13T10:00:00.000Z",
      samples: [{ fps: 60 }, { fps: 61 }],
    });

    renderWithProviders(<Nav />);

    const link = screen.getByText("App Perf...").closest("a");

    expect(link).toHaveAttribute("href", "/app-performance/live");
    expect(screen.getByText("2:09")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-mini-charts")).toHaveAttribute(
      "data-sample-count",
      "2",
    );
    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: "2026-05-13T10:00:00.000Z",
      direction: "up",
      enabled: true,
    });
  });

  it("formats active timers with an hour component", () => {
    mockUseTickingTimer.mockReturnValueOnce({
      hours: 1,
      minutes: 4,
      seconds: 5,
    } as never);
    setupStore({
      appPerformanceMonitorEnabled: true,
      isSampling: true,
      captureStartedAt: "2026-05-13T10:00:00.000Z",
    });

    renderWithProviders(<Nav />);

    expect(screen.getByText("1:04:05")).toBeInTheDocument();
  });
});
