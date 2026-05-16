import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";

import { AppPerformanceCapturePage } from "../AppPerformanceCapture.page/AppPerformanceCapture.page";
import { AppPerformanceLivePage } from "../AppPerformanceLive.page/AppPerformanceLive.page";
import { AppPerformancePage } from "./AppPerformance.page";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockStoreListeners = vi.hoisted(() => new Set<() => void>());
const notifyMockStore = vi.hoisted(
  () => () =>
    mockStoreListeners.forEach((listener) => {
      listener();
    }),
);
const mockAppPerformance = vi.hoisted(() => ({
  samples: [] as any[],
  routeMarkers: [] as any[],
  focusedChart: null as any,
  setFocusedChart: vi.fn(),
  error: null as string | null,
  captureHistory: [] as any[],
  captureHistoryPage: 1,
  captureHistoryPageSize: 5,
  captureHistoryTotal: 0,
  captureHistoryTotalPages: 1,
  captureId: null as string | null,
  captureStartedAt: null as string | null,
  captureStoppedAt: null as string | null,
  deletingCaptureId: null as string | null,
  isLoadingCapture: false,
  isLoadingHistory: false,
  isSampling: false,
  indexView: "captures" as "captures" | "trends",
  deleteMode: false,
  selectedCaptureIds: [] as string[],
  isDeleteConfirmOpen: false,
  deleteError: null as string | null,
  isBulkDeleting: false,
  isStartingCapture: false,
  loadCapture: vi.fn(),
  loadCaptureHistory: vi.fn(),
  startCapture: vi.fn(),
  setStartingCapture: vi.fn((isStarting: boolean) => {
    mockAppPerformance.isStartingCapture = isStarting;
    notifyMockStore();
  }),
  setIndexView: vi.fn((view: "captures" | "trends") => {
    if (mockAppPerformance.deleteMode) return;
    mockAppPerformance.indexView = view;
    notifyMockStore();
  }),
  startDeleteMode: vi.fn(() => {
    mockAppPerformance.indexView = "captures";
    mockAppPerformance.deleteMode = true;
    mockAppPerformance.selectedCaptureIds = [];
    mockAppPerformance.deleteError = null;
    notifyMockStore();
  }),
  cancelDeleteMode: vi.fn(() => {
    mockAppPerformance.deleteMode = false;
    mockAppPerformance.selectedCaptureIds = [];
    mockAppPerformance.isDeleteConfirmOpen = false;
    mockAppPerformance.deleteError = null;
    mockAppPerformance.isBulkDeleting = false;
    notifyMockStore();
  }),
  toggleCaptureSelection: vi.fn((captureId: string) => {
    mockAppPerformance.selectedCaptureIds =
      mockAppPerformance.selectedCaptureIds.includes(captureId)
        ? mockAppPerformance.selectedCaptureIds.filter((id) => id !== captureId)
        : [...mockAppPerformance.selectedCaptureIds, captureId];
    notifyMockStore();
  }),
  toggleAllVisibleCaptureSelection: vi.fn(() => {
    const selectableIds = mockAppPerformance.captureHistory
      .filter((capture) => capture.stoppedAt !== null)
      .map((capture) => capture.id);
    const selected = new Set(mockAppPerformance.selectedCaptureIds);
    const allSelected =
      selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
    for (const id of selectableIds) {
      if (allSelected) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
    }
    mockAppPerformance.selectedCaptureIds = Array.from(selected);
    notifyMockStore();
  }),
  openDeleteConfirm: vi.fn(() => {
    mockAppPerformance.isDeleteConfirmOpen = true;
    mockAppPerformance.deleteError = null;
    notifyMockStore();
  }),
  closeDeleteConfirm: vi.fn(() => {
    mockAppPerformance.isDeleteConfirmOpen = false;
    mockAppPerformance.deleteError = null;
    notifyMockStore();
  }),
  confirmBulkDelete: vi.fn(async () => {
    mockAppPerformance.isBulkDeleting = true;
    notifyMockStore();
    try {
      const result = await window.electron.appPerformance.deleteCaptures(
        mockAppPerformance.selectedCaptureIds,
      );
      if (!result.success) throw new Error(result.error ?? "delete failed");
      const nextPage =
        mockAppPerformance.selectedCaptureIds.length >=
          mockAppPerformance.captureHistory.length &&
        mockAppPerformance.captureHistoryPage > 1
          ? mockAppPerformance.captureHistoryPage - 1
          : mockAppPerformance.captureHistoryPage;
      await mockAppPerformance.loadCaptureHistory(nextPage);
      mockAppPerformance.deleteMode = false;
      mockAppPerformance.isDeleteConfirmOpen = false;
      mockAppPerformance.selectedCaptureIds = [];
    } catch (error) {
      mockAppPerformance.deleteError =
        error instanceof Error ? error.message : "delete failed";
    } finally {
      mockAppPerformance.isBulkDeleting = false;
      notifyMockStore();
    }
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

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
      bc30: "rgba(255,255,255,0.3)",
      bc40: "rgba(255,255,255,0.4)",
    }),
  };
});

vi.mock("~/renderer/store", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const useMockAppPerformance = () => {
    const [, setVersion] = React.useState(0);
    React.useEffect(() => {
      const listener = () => setVersion((version) => version + 1);
      mockStoreListeners.add(listener);
      return () => {
        mockStoreListeners.delete(listener);
      };
    }, []);
    return mockAppPerformance;
  };

  return {
    useAppPerformance: useMockAppPerformance,
    useAppPerformanceSelector: (selector: any) =>
      selector(useMockAppPerformance()),
    useAppPerformanceShallow: (selector: any) =>
      selector(useMockAppPerformance()),
  };
});

vi.mock("~/renderer/components", () => {
  function PageContainer({ children }: { children: ReactNode }) {
    return <main>{children}</main>;
  }
  PageContainer.Header = ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      <div>{actions}</div>
    </header>
  );
  PageContainer.Content = ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <section className={className}>{children}</section>;

  return {
    Button: ({
      children,
      loading,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
    }) => (
      <button type="button" {...props}>
        {loading ? "Loading " : null}
        {children}
      </button>
    ),
    Link: ({
      children,
      to,
      className,
    }: {
      children: ReactNode;
      to: string;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
    PageContainer,
  };
});

vi.mock("../../AppPerformance.components", () => ({
  AppPerformanceActions: () => <div data-testid="performance-actions" />,
  AppPerformanceHistoryTable: () => (
    <div data-testid="history-table">
      history table{" "}
      {mockAppPerformance.deleteMode ? "delete mode" : "view mode"}{" "}
      {mockAppPerformance.selectedCaptureIds.length} selected
      <button
        type="button"
        onClick={() => mockAppPerformance.loadCaptureHistory(2)}
      >
        go page 2
      </button>
      <button
        type="button"
        onClick={() => mockAppPerformance.toggleCaptureSelection("capture-1")}
      >
        toggle capture 1
      </button>
      <button
        type="button"
        onClick={mockAppPerformance.toggleAllVisibleCaptureSelection}
      >
        toggle page
      </button>
    </div>
  ),
  AppPerformanceHistoryTrends: () => <div data-testid="history-trends" />,
  DeleteCapturesModal: () => (
    <div data-testid="delete-modal">
      {mockAppPerformance.isDeleteConfirmOpen
        ? `open ${mockAppPerformance.selectedCaptureIds.length}`
        : "closed"}
      {mockAppPerformance.deleteError ? (
        <span>{mockAppPerformance.deleteError}</span>
      ) : null}
      <button type="button" onClick={mockAppPerformance.confirmBulkDelete}>
        confirm delete
      </button>
    </div>
  ),
  PerformanceChartCard: ({
    title,
    lines,
    statFormatter,
    valueFormatter,
    chartKey,
    compact,
  }: any) => {
    const samples = mockAppPerformance.samples;
    const firstSample = samples[0] ?? null;
    const values = firstSample
      ? lines.map((line: any) => line.value(firstSample))
      : [];
    const stat = values[0] ?? null;
    return (
      <div data-testid="chart-card">
        <span>{title}</span>
        <span>{statFormatter(stat)}</span>
        <span>{valueFormatter(values[0] ?? null)}</span>
        {compact ? <span>compact</span> : null}
        <button
          type="button"
          onClick={() => mockAppPerformance.setFocusedChart(chartKey)}
        >
          focus {title}
        </button>
      </div>
    );
  },
  PerformanceMetricGrid: () => <div data-testid="metric-grid" />,
}));

describe("AppPerformance pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockAppPerformance, {
      samples: [],
      routeMarkers: [],
      focusedChart: null,
      error: null,
      captureHistory: [],
      captureHistoryPage: 1,
      captureHistoryPageSize: 5,
      captureHistoryTotal: 0,
      captureHistoryTotalPages: 1,
      captureId: null,
      captureStartedAt: null,
      captureStoppedAt: null,
      deletingCaptureId: null,
      isLoadingCapture: false,
      isLoadingHistory: false,
      isSampling: false,
      indexView: "captures",
      deleteMode: false,
      selectedCaptureIds: [],
      isDeleteConfirmOpen: false,
      deleteError: null,
      isBulkDeleting: false,
      isStartingCapture: false,
    });
    mockAppPerformance.loadCapture.mockResolvedValue(undefined);
    mockAppPerformance.loadCaptureHistory.mockResolvedValue(undefined);
    mockAppPerformance.startCapture.mockResolvedValue(undefined);
    window.electron.appPerformance.deleteCapture.mockResolvedValue({
      success: true,
      deleted: true,
    });
  });

  it("loads capture history on the index page and switches between captures and trends", async () => {
    const { user } = renderWithProviders(<AppPerformancePage />);

    await waitFor(() => {
      expect(mockAppPerformance.loadCaptureHistory).toHaveBeenCalledWith(1);
    });
    expect(screen.getByTestId("history-table")).toHaveTextContent("view mode");

    await user.click(screen.getByRole("radio", { name: "Trends" }));

    expect(screen.getByTestId("history-trends")).toBeInTheDocument();
  });

  it("starts diagnostics from the index actions and redirects to the live route", async () => {
    const { user } = renderWithProviders(<AppPerformancePage />);

    await user.click(
      screen.getByRole("button", { name: /Start diagnostics/i }),
    );

    expect(mockAppPerformance.startCapture).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/app-performance/live" });
  });

  it("enters delete mode from the more actions menu", async () => {
    mockAppPerformance.captureHistoryTotal = 2;
    const { user } = renderWithProviders(<AppPerformancePage />);

    await user.click(
      screen.getByRole("button", { name: "More App Performance actions" }),
    );
    await user.click(screen.getByRole("button", { name: /Delete captures/i }));

    expect(screen.getByTestId("history-table")).toHaveTextContent(
      "delete mode",
    );
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("handles history pagination and the delete-selection workflow", async () => {
    mockAppPerformance.captureHistory = [
      {
        id: "capture-1",
        stoppedAt: "2024-05-04T00:01:00.000Z",
      },
    ];
    mockAppPerformance.captureHistoryTotal = 1;
    mockAppPerformance.captureHistoryPage = 2;
    const { user } = renderWithProviders(<AppPerformancePage />);

    await user.click(screen.getByRole("button", { name: "go page 2" }));
    expect(mockAppPerformance.loadCaptureHistory).toHaveBeenCalledWith(2);

    await user.click(
      screen.getByRole("button", { name: "More App Performance actions" }),
    );
    await user.click(screen.getByRole("button", { name: /Delete captures/i }));
    await user.click(screen.getByRole("button", { name: "toggle capture 1" }));

    expect(screen.getByTestId("history-table")).toHaveTextContent("1 selected");

    await user.click(
      screen.getByRole("button", { name: "Delete captures (1)" }),
    );
    await user.click(screen.getByRole("button", { name: "confirm delete" }));

    expect(window.electron.appPerformance.deleteCaptures).toHaveBeenCalledWith([
      "capture-1",
    ]);
    expect(mockAppPerformance.loadCaptureHistory).toHaveBeenCalledWith(1);
  });

  it("cancels delete mode and keeps tab changes disabled while deleting", async () => {
    mockAppPerformance.captureHistory = [
      {
        id: "capture-1",
        stoppedAt: "2024-05-04T00:01:00.000Z",
      },
    ];
    mockAppPerformance.captureHistoryTotal = 1;
    const { user } = renderWithProviders(<AppPerformancePage />);

    await user.click(
      screen.getByRole("button", { name: "More App Performance actions" }),
    );
    await user.click(screen.getByRole("button", { name: /Delete captures/i }));

    await user.click(screen.getByRole("button", { name: "toggle page" }));
    expect(screen.getByTestId("history-table")).toHaveTextContent("1 selected");

    await user.click(screen.getByRole("button", { name: /Deselect page/i }));
    expect(screen.getByTestId("history-table")).toHaveTextContent("0 selected");

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(screen.getByTestId("history-table")).toHaveTextContent("view mode");
  });

  it("shows bulk-delete errors without leaving delete confirmation", async () => {
    mockAppPerformance.captureHistory = [
      {
        id: "capture-1",
        stoppedAt: "2024-05-04T00:01:00.000Z",
      },
    ];
    mockAppPerformance.captureHistoryTotal = 1;
    window.electron.appPerformance.deleteCaptures.mockResolvedValue({
      success: false,
      error: "active capture",
    });
    const { user } = renderWithProviders(<AppPerformancePage />);

    await user.click(
      screen.getByRole("button", { name: "More App Performance actions" }),
    );
    await user.click(screen.getByRole("button", { name: /Delete captures/i }));
    await user.click(screen.getByRole("button", { name: "toggle capture 1" }));
    await user.click(
      screen.getByRole("button", { name: "Delete captures (1)" }),
    );
    await user.click(screen.getByRole("button", { name: "confirm delete" }));

    await waitFor(() => {
      expect(screen.getByTestId("delete-modal")).toHaveTextContent(
        "active capture",
      );
    });
  });

  it("renders live empty state when the live route is opened without an active capture", async () => {
    const { user } = renderWithProviders(<AppPerformanceLivePage />);

    expect(screen.getByText("No live diagnostics capture")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics are not running")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Start diagnostics/i }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/app-performance/live" });
  });

  it("loads historical captures by route id and renders missing capture copy", async () => {
    mockAppPerformance.isLoadingCapture = false;

    renderWithProviders(
      <AppPerformanceCapturePage captureId="capture-missing" />,
    );

    await waitFor(() => {
      expect(mockAppPerformance.loadCapture).toHaveBeenCalledWith(
        "capture-missing",
      );
    });

    expect(
      screen.getByText("Diagnostics capture is unavailable"),
    ).toBeInTheDocument();
  });

  it("renders the loading state while a routed historical capture is loading", () => {
    mockAppPerformance.isLoadingCapture = true;

    renderWithProviders(
      <AppPerformanceCapturePage captureId="capture-loading" />,
    );

    expect(screen.getByText("Loading diagnostics capture")).toBeInTheDocument();
  });

  it("renders an already loaded routed capture without reloading it", () => {
    mockAppPerformance.captureId = "capture-1";
    mockAppPerformance.captureStartedAt = "2024-05-04T00:00:00.000Z";
    mockAppPerformance.captureStoppedAt = "2024-05-04T00:01:00.000Z";
    mockAppPerformance.samples = [
      {
        sampledAt: "2024-05-04T00:00:01.000Z",
        uptimeMs: 1000,
        captureElapsedMs: 1000,
        route: "/app-performance/:id",
        fps: 60,
        systemCpuPercent: 10,
        appCpuPercent: 5,
        systemMemoryUsedPercent: 70,
        systemMemoryTotalBytes: 16 * 1024 ** 3,
        systemMemoryFreeBytes: 4 * 1024 ** 3,
        appMemoryBytes: 1024 ** 3,
        appMemoryPercent: 6.25,
        mainHeapUsedBytes: 128 * 1024 ** 2,
        rendererMemoryBytes: 256 * 1024 ** 2,
        rendererHeapUsedBytes: 64 * 1024 ** 2,
      },
    ];

    renderWithProviders(<AppPerformanceCapturePage captureId="capture-1" />);

    expect(mockAppPerformance.loadCapture).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("chart-card")).toHaveLength(3);
    expect(screen.getAllByText("60").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5.0%").length).toBeGreaterThan(0);
  });

  it("renders live charts and metric grid while sampling", () => {
    mockAppPerformance.isSampling = true;
    mockAppPerformance.captureId = "capture-active";
    mockAppPerformance.captureStartedAt = "2024-05-04T00:00:00.000Z";
    mockAppPerformance.samples = [
      {
        sampledAt: "2024-05-04T00:00:01.000Z",
        uptimeMs: 1000,
        captureElapsedMs: 1000,
        route: "/app-performance/live",
        fps: 60,
        systemCpuPercent: 10,
        appCpuPercent: 5,
        systemMemoryUsedPercent: 70,
        systemMemoryTotalBytes: 16 * 1024 ** 3,
        systemMemoryFreeBytes: 4 * 1024 ** 3,
        appMemoryBytes: 1024 ** 3,
        appMemoryPercent: 6.25,
        mainHeapUsedBytes: 128 * 1024 ** 2,
        rendererMemoryBytes: 256 * 1024 ** 2,
        rendererHeapUsedBytes: 64 * 1024 ** 2,
      },
    ];

    renderWithProviders(<AppPerformanceLivePage />);

    expect(screen.getByTestId("metric-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart-card")).toHaveLength(3);
  });

  it("renders focused and compact chart groups", () => {
    mockAppPerformance.isSampling = true;
    mockAppPerformance.captureId = "capture-active";
    mockAppPerformance.captureStartedAt = "2024-05-04T00:00:00.000Z";
    mockAppPerformance.focusedChart = "fps";

    renderWithProviders(<AppPerformanceLivePage />);

    expect(screen.getAllByTestId("chart-card")).toHaveLength(3);
    expect(screen.getAllByText("compact")).toHaveLength(2);
  });
});
