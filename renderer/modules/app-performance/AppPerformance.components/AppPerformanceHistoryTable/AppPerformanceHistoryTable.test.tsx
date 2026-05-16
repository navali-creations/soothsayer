import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import type {
  AppPerformanceCaptureSparklineSampleDTO,
  AppPerformanceCaptureSummaryDTO,
} from "../../AppPerformance.types";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
      secondary: "#cc66ff",
      bc30: "rgba(255,255,255,0.3)",
    }),
  };
});

import { AppPerformanceHistoryTable } from "./AppPerformanceHistoryTable";

function metric(min: number | null, avg: number | null, max: number | null) {
  return { min, avg, max };
}

function sparklineSample(
  overrides: Partial<AppPerformanceCaptureSparklineSampleDTO> = {},
): AppPerformanceCaptureSparklineSampleDTO {
  return {
    captureElapsedMs: 0,
    fps: 120,
    appCpuPercent: 3,
    appMemoryBytes: 700 * 1024 ** 2,
    appMemoryPercent: 1,
    systemMemoryUsedPercent: 65,
    ...overrides,
  };
}

function capture(
  overrides: Partial<AppPerformanceCaptureSummaryDTO> = {},
): AppPerformanceCaptureSummaryDTO {
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
    appMemoryBytes: metric(
      673.6 * 1024 ** 2,
      1.43 * 1024 ** 3,
      1.75 * 1024 ** 3,
    ),
    systemMemory: metric(65, 66, 67),
    sparklineSamples: [
      sparklineSample({
        captureElapsedMs: 0,
        fps: 61,
        appCpuPercent: 1,
        appMemoryBytes: 610 * 1024 ** 2,
        appMemoryPercent: 0.9,
        systemMemoryUsedPercent: 65,
      }),
      sparklineSample({
        captureElapsedMs: 1_000,
        fps: 143,
        appCpuPercent: 5.9,
        appMemoryBytes: 706 * 1024 ** 2,
        appMemoryPercent: 1.1,
        systemMemoryUsedPercent: 66,
      }),
      sparklineSample({
        captureElapsedMs: 2_000,
        fps: 130,
        appCpuPercent: 2.4,
        appMemoryBytes: 806 * 1024 ** 2,
        appMemoryPercent: 1.2,
        systemMemoryUsedPercent: 67,
      }),
    ],
    comparison: {
      fps: { min: "lower", avg: "higher", max: "same" },
      cpu: { min: "same", avg: "higher", max: "higher" },
      memory: { min: null, avg: null, max: null },
      appMemoryBytes: { min: "lower", avg: "lower", max: "higher" },
    },
    ...overrides,
  };
}

describe("AppPerformanceHistoryTable", () => {
  const baseState = {
    captures: [capture(), capture({ id: "capture-2", stoppedAt: null })],
    isLoading: false,
    deletingCaptureId: null as string | null,
    page: 1,
    pageSize: 5,
    total: 12,
    totalPages: 3,
    deleteMode: false,
    selectedCaptureIds: [] as string[],
  };

  function setupHistoryState(overrides: Partial<typeof baseState> = {}) {
    const state = { ...baseState, ...overrides };
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.captureHistory = state.captures;
      appPerformance.isLoadingHistory = state.isLoading;
      appPerformance.deletingCaptureId = state.deletingCaptureId;
      appPerformance.captureHistoryPage = state.page;
      appPerformance.captureHistoryPageSize = state.pageSize;
      appPerformance.captureHistoryTotal = state.total;
      appPerformance.captureHistoryTotalPages = state.totalPages;
      appPerformance.deleteMode = state.deleteMode;
      appPerformance.selectedCaptureIds = state.selectedCaptureIds;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    useBoundStore.getState().reset();
  });

  it("renders capture metrics with RAM bytes and RAM percent", () => {
    setupHistoryState();

    const { container } = renderWithProviders(
      <AppPerformanceHistoryTable title="Diagnostics captures" />,
    );
    const table = container.querySelector("table");

    expect(screen.getByText("Diagnostics captures")).toBeInTheDocument();
    expect(screen.getByText("FPS")).toBeInTheDocument();
    expect(screen.getByText("RAM")).toBeInTheDocument();
    expect(screen.getByText("RAM %")).toBeInTheDocument();
    expect(screen.getAllByText("1.43GB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2.2%").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("metric-summary-sparkline")).toHaveLength(8);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 to 5 of 12")).toBeInTheDocument();
    expect(table?.className).toContain("[&_thead_th]:text-[0.68rem]");
    expect(table?.className).toContain("[&_tbody_tr:hover]:bg-white/[0.05]");
  });

  it("draws RAM percent and system percent behind the RAM percent summary", () => {
    setupHistoryState();

    renderWithProviders(
      <AppPerformanceHistoryTable title="Diagnostics captures" />,
    );

    const sparklines = screen.getAllByTestId("metric-summary-sparkline");
    const ramPercentSparkline = sparklines[3];
    const ramPercentLines = ramPercentSparkline.querySelectorAll("polyline");
    const ramPercentAreas = ramPercentSparkline.querySelectorAll("path");
    const ramPercentGradients =
      ramPercentSparkline.querySelectorAll("linearGradient");

    expect(ramPercentSparkline.parentElement).toHaveClass("bg-gradient-to-br");
    expect(ramPercentLines).toHaveLength(2);
    expect(ramPercentAreas).toHaveLength(2);
    expect(ramPercentLines[0]).toHaveAttribute("stroke", "#ffaa00");
    expect(ramPercentLines[1]).toHaveAttribute(
      "stroke",
      "rgba(255,255,255,0.3)",
    );
    expect(ramPercentAreas[0].getAttribute("fill")).toContain("url(");
    expect(ramPercentAreas[1].getAttribute("fill")).toContain("url(");
    expect(ramPercentGradients[0].querySelector("stop")).toHaveAttribute(
      "stop-color",
      "#ffaa00",
    );
    expect(ramPercentGradients[1].querySelector("stop")).toHaveAttribute(
      "stop-color",
      "rgba(255,255,255,0.3)",
    );
  });

  it("draws actual timeline values across the full metric cell width", () => {
    setupHistoryState();

    renderWithProviders(
      <AppPerformanceHistoryTable title="Diagnostics captures" />,
    );

    const cpuSparkline = screen.getAllByTestId("metric-summary-sparkline")[1];
    const [cpuLine] = cpuSparkline.querySelectorAll("polyline");

    expect(cpuSparkline).toHaveAttribute("viewBox", "0 0 100 16");
    expect(cpuSparkline).toHaveClass("bottom-0.5");
    expect(cpuSparkline).toHaveClass("w-full");
    expect(cpuSparkline.parentElement).toHaveClass("w-full");
    expect(cpuLine).toHaveAttribute("points", "1.0,14.0 50.0,2.0 99.0,10.6");
  });

  it("renders empty and loading states", () => {
    setupHistoryState({ captures: [], total: 0, isLoading: true });

    renderWithProviders(
      <AppPerformanceHistoryTable title="Diagnostics captures" />,
    );

    expect(
      screen.getByText("No diagnostics captures yet."),
    ).toBeInTheDocument();
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });

  it("supports pagination callbacks", async () => {
    window.electron.appPerformance.listCaptures.mockResolvedValue({
      captures: [],
      total: 12,
      page: 1,
      pageSize: 5,
      totalPages: 3,
    });
    setupHistoryState({ page: 2 });

    const { user } = renderWithProviders(
      <AppPerformanceHistoryTable title="Diagnostics captures" />,
    );

    const paginationButtons = document.querySelectorAll("button");
    await user.click(paginationButtons[0]);
    await user.click(paginationButtons[1]);

    await waitFor(() => {
      expect(window.electron.appPerformance.listCaptures).toHaveBeenCalledWith({
        page: 1,
        pageSize: 5,
      });
      expect(window.electron.appPerformance.listCaptures).toHaveBeenCalledWith({
        page: 2,
        pageSize: 5,
      });
    });
  });

  it("navigates to a capture detail view when a row is clicked", async () => {
    setupHistoryState();

    const { user } = renderWithProviders(
      <AppPerformanceHistoryTable title="Diagnostics captures" />,
    );
    const [firstRow] = document.querySelectorAll("tbody tr");

    await user.click(firstRow);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/app-performance/$captureId",
      params: { captureId: "capture-1" },
    });
  });

  it("renders delete mode checkboxes and disables active captures", async () => {
    setupHistoryState({
      deleteMode: true,
      captures: baseState.captures,
      selectedCaptureIds: ["capture-1"],
    });

    const { user } = renderWithProviders(
      <AppPerformanceHistoryTable title="Diagnostics captures" />,
    );

    const selectAll = screen.getByLabelText("Select all visible captures");
    const [selectedCapture, activeCapture] = screen.getAllByLabelText(
      /Select diagnostics capture from/i,
    );

    expect(selectAll).toBeChecked();
    expect(selectedCapture).toBeChecked();
    expect(activeCapture).toBeDisabled();

    await user.click(selectAll);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useBoundStore.getState().appPerformance.selectedCaptureIds).toEqual(
      [],
    );

    const [unselectedCapture] = screen.getAllByLabelText(
      /Select diagnostics capture from/i,
    );
    await user.click(unselectedCapture);

    expect(useBoundStore.getState().appPerformance.selectedCaptureIds).toEqual([
      "capture-1",
    ]);
  });
});
