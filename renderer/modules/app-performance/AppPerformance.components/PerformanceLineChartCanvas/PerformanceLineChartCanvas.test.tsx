import type { ComponentProps } from "react";

import {
  fireEvent,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";

import type {
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../../AppPerformance.types";
import { PerformanceLineChartCanvas } from "./PerformanceLineChartCanvas";

const mockContainerElRef = vi.hoisted(() => ({
  current: null as HTMLDivElement | null,
}));
const mockCanvasRef = vi.hoisted(() => ({
  current: null as HTMLCanvasElement | null,
}));
const mockSetupCanvas = vi.hoisted(() => vi.fn());
const mockEnsureCanvasBackingStore = vi.hoisted(() => vi.fn(() => true));
const mockCtx = vi.hoisted(() => ({
  save: vi.fn(),
  restore: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
  setLineDash: vi.fn(),
  clearRect: vi.fn(),
  setTransform: vi.fn(),
}));

vi.mock("~/renderer/hooks", async () => {
  const actual =
    await vi.importActual<typeof import("~/renderer/hooks")>(
      "~/renderer/hooks",
    );
  return {
    ...actual,
    useChartColors: () => ({
      b2: "#120018",
      b3: "#1d0626",
      bc06: "rgba(255,255,255,0.06)",
      bc15: "rgba(255,255,255,0.15)",
      bc30: "rgba(255,255,255,0.3)",
      bc40: "rgba(255,255,255,0.4)",
      bc50: "rgba(255,255,255,0.5)",
    }),
  };
});

vi.mock("~/renderer/lib/canvas-core", async () => {
  const actual = await vi.importActual<any>("~/renderer/lib/canvas-core");
  return {
    ...actual,
    ensureCanvasBackingStore: mockEnsureCanvasBackingStore,
    setupCanvas: mockSetupCanvas,
    useCanvasResize: () => ({
      containerRef: (node: HTMLDivElement | null) => {
        mockContainerElRef.current = node;
      },
      containerElRef: mockContainerElRef,
      canvasRef: mockCanvasRef,
      canvasSize: { width: 640, height: 220 },
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

const routeMarker: AppPerformanceRouteMarkerDTO = {
  id: "marker-1",
  route: "/app-performance/capture-1",
  label: "/app-performance/:id",
  markedAt: "2024-05-04T00:00:01.000Z",
  elapsedMs: 1000,
};

describe("PerformanceLineChartCanvas", () => {
  const lines = [
    {
      id: "fps",
      label: "FPS",
      color: "#00ff99",
      value: (item: AppPerformanceSampleDTO) => item.fps,
    },
    {
      id: "target",
      label: "Target",
      color: "#ffffff",
      dashed: true,
      value: (item: AppPerformanceSampleDTO) => item.systemCpuPercent,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    mockContainerElRef.current = null;
    mockCanvasRef.current = null;
    mockSetupCanvas.mockReturnValue({
      ctx: mockCtx,
      width: 640,
      height: 220,
    });
  });

  function renderChart(
    overrides: Partial<ComponentProps<typeof PerformanceLineChartCanvas>> = {},
  ) {
    return renderWithProviders(
      <PerformanceLineChartCanvas
        samples={[
          sample({ captureElapsedMs: 0, fps: 30 }),
          sample({ captureElapsedMs: 1000, fps: 60 }),
          sample({ captureElapsedMs: 2000, fps: null }),
          sample({ captureElapsedMs: 3000, fps: 90 }),
        ]}
        routeMarkers={[routeMarker]}
        lines={lines}
        showBrush
        live={false}
        captureDurationMs={3000}
        yMaxFloor={60}
        valueFormatter={(value) => (value === null ? "n/a" : `${value}`)}
        {...overrides}
      />,
    );
  }

  it("draws chart content and route marker labels", () => {
    renderChart();

    expect(
      screen.getByTestId("app-performance-line-chart-canvas"),
    ).toHaveAttribute("data-chart-point-count", "4");
    expect(mockSetupCanvas).toHaveBeenCalled();
    expect(mockEnsureCanvasBackingStore).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      "/app-performance/:id",
      expect.any(Number),
      expect.any(Number),
    );
    expect(
      mockCtx.fillRect.mock.calls.some(([, , width, height]) => {
        return width === "/app-performance/:id".length * 6 + 8 && height === 13;
      }),
    ).toBe(true);
    expect(mockCtx).toMatchObject({
      shadowBlur: 4,
      shadowColor: "rgba(0, 0, 0, 0.85)",
      shadowOffsetX: 0,
      shadowOffsetY: 1,
    });
    expect(mockCtx.strokeRect).toHaveBeenCalled();
  });

  it("renders a hover tooltip for nearby samples and markers", () => {
    renderChart();
    const container = screen.getByTestId("app-performance-line-chart-canvas")
      .parentElement as HTMLDivElement;
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 640,
      height: 220,
      right: 640,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(container, { clientX: 236, clientY: 80 });

    expect(screen.getByText("/app-performance/:id")).toBeInTheDocument();
    expect(screen.getByText("/current-session")).toBeInTheDocument();
    expect(screen.getByText("Current route")).toBeInTheDocument();
    expect(screen.getByText("FPS")).toBeInTheDocument();
  });

  it("uses a narrow right gutter when no secondary y-axis is shown", () => {
    renderChart();

    expect(mockCtx.lineTo).toHaveBeenCalledWith(624, expect.any(Number));
  });

  it("draws secondary y-axis labels on the right", () => {
    renderChart({
      lines: [
        {
          id: "bytes",
          label: "RAM",
          color: "#cc66ff",
          value: (item) => item.appMemoryBytes,
        },
        {
          id: "percent",
          label: "RAM %",
          color: "#00ccff",
          axis: "secondary",
          value: (item) => item.appMemoryPercent,
        },
      ],
      yMaxFloor: 1024 ** 3,
      secondaryYMaxFloor: 100,
      valueFormatter: (value) => (value === null ? "n/a" : `${value}B`),
      secondaryValueFormatter: (value) =>
        value === null ? "n/a" : `${value}%`,
    });

    expect(mockCtx.fillText).toHaveBeenCalledWith(
      "100%",
      636,
      expect.any(Number),
    );
    expect(mockCtx.lineTo).toHaveBeenCalledWith(598, expect.any(Number));
  });

  it("zooms, resets, and drags the brush without propagating wheel scroll", () => {
    const onXRangeChange = vi.fn();
    renderChart({ onXRangeChange });
    const container = screen.getByTestId("app-performance-line-chart-canvas")
      .parentElement as HTMLDivElement;
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 640,
      height: 220,
      right: 640,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientY: 188,
      deltaY: -120,
    });

    container.dispatchEvent(wheelEvent);
    fireEvent.doubleClick(container, { clientY: 188 });
    fireEvent.pointerDown(container, {
      clientX: 320,
      clientY: 188,
      pointerId: 1,
    });
    fireEvent.pointerMove(container, {
      clientX: 340,
      clientY: 188,
      pointerId: 1,
    });
    fireEvent.pointerUp(container, { pointerId: 1 });

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(onXRangeChange).toHaveBeenCalled();
    expect(onXRangeChange).toHaveBeenCalledWith(null);
  });

  it("draws an empty label and ignores unavailable canvas backing stores", () => {
    renderChart({
      samples: [],
      routeMarkers: [],
      showBrush: false,
      emptyLabel: "No measurements",
    });

    expect(mockCtx.fillText).toHaveBeenCalledWith(
      "No measurements",
      expect.any(Number),
      expect.any(Number),
    );

    const setupCallsBeforeUnavailableBackingStore =
      mockSetupCanvas.mock.calls.length;
    mockEnsureCanvasBackingStore.mockReturnValue(false);
    renderChart();

    expect(mockSetupCanvas.mock.calls.length).toBe(
      setupCallsBeforeUnavailableBackingStore,
    );
  });
});
