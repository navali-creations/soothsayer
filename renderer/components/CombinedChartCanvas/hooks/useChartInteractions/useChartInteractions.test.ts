import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LinearMapper } from "~/renderer/lib/canvas-core";

import type { ChartLayout } from "../../canvas-chart-utils/canvas-chart-utils";
import type { ChartDataPoint } from "../../chart-types/chart-types";
import type { TooltipState } from "../useTooltipPosition/useTooltipPosition";
import {
  type UseChartInteractionsParams,
  useChartInteractions,
} from "./useChartInteractions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("../../canvas-chart-utils/canvas-chart-utils", () => ({
  BRUSH_TRAVELLER_WIDTH: 8,
  clamp: (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v)),
  MIN_ZOOM_WINDOW: 5,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const DEFAULT_LAYOUT: ChartLayout = {
  chartLeft: 50,
  chartRight: 450,
  chartTop: 10,
  chartBottom: 300,
  chartWidth: 400,
  chartHeight: 290,
  brushTop: 320,
  brushBottom: 350,
  brushLeft: 50,
  brushRight: 450,
  brushHeight: 30,
};

function makeDataPoint(index: number): ChartDataPoint {
  return {
    sessionIndex: index,
    sessionDate: `2024-01-${String(index + 1).padStart(2, "0")}`,
    league: "TestLeague",
    profitDivine: index * 1.5,
    rawDecks: index > 0 ? index * 10 : null,
    chaosPerDivine: 200,
  };
}

function createParams(
  overrides?: Partial<UseChartInteractionsParams>,
): UseChartInteractionsParams {
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 400;
  // Stub getBoundingClientRect so getCanvasCoords can compute cx/cy
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 500,
    bottom: 400,
    width: 500,
    height: 400,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  const visibleData = Array.from({ length: 20 }, (_, i) => makeDataPoint(i));

  return {
    canvasRef: { current: canvas },
    hoverIndexRef: { current: null },
    layout: DEFAULT_LAYOUT,
    showBrush: true,
    visibleData,
    // Map each visible index to an evenly spaced x position in the chart area
    mapX: Object.assign(
      (index: number) =>
        DEFAULT_LAYOUT.chartLeft + (index / 19) * DEFAULT_LAYOUT.chartWidth,
      {
        inverse: (px: number) =>
          ((px - DEFAULT_LAYOUT.chartLeft) / DEFAULT_LAYOUT.chartWidth) * 19,
      },
    ) as LinearMapper,
    // Map a data index to a brush x position
    mapBrushX: Object.assign(
      (dataIndex: number) =>
        DEFAULT_LAYOUT.brushLeft +
        (dataIndex / 99) *
          (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft),
      {
        inverse: (px: number) =>
          ((px - DEFAULT_LAYOUT.brushLeft) /
            (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft)) *
          99,
      },
    ) as LinearMapper,
    chartDataRef: {
      current: Array.from({ length: 100 }, (_, i) => makeDataPoint(i)),
    },
    brushRangeRef: { current: { startIndex: 10, endIndex: 30 } },
    onBrushChangeRef: { current: vi.fn() },
    setTooltip: vi.fn(),
    draw: vi.fn(),
    ...overrides,
  };
}

function fireMouseEvent(
  target: EventTarget,
  type: string,
  opts?: { clientX?: number; clientY?: number },
) {
  const event = new MouseEvent(type, {
    clientX: opts?.clientX ?? 0,
    clientY: opts?.clientY ?? 0,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("useChartInteractions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Stub requestAnimationFrame to call the callback synchronously
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  // ── 1. Return value ───────────────────────────────────────────

  it("returns hoverIndexRef", () => {
    const params = createParams();
    const { result } = renderHook(() => useChartInteractions(params));

    expect(result.current).toHaveProperty("hoverIndexRef");
    expect(result.current.hoverIndexRef).toBe(params.hoverIndexRef);
  });

  // ── 2. Listener attachment: canvas ────────────────────────────

  it("attaches mousemove, mousedown, and mouseleave listeners to canvas", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 500,
      bottom: 400,
      width: 500,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const addSpy = vi.spyOn(canvas, "addEventListener");
    const params = createParams({ canvasRef: { current: canvas } });

    renderHook(() => useChartInteractions(params));

    const eventTypes = addSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("mousemove");
    expect(eventTypes).toContain("mousedown");
    expect(eventTypes).toContain("mouseleave");
  });

  // ── 3. Listener attachment: window mouseup ────────────────────

  it("attaches mouseup listener to window", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const params = createParams();

    renderHook(() => useChartInteractions(params));

    const eventTypes = addSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("mouseup");
  });

  // ── 4. Cleanup on unmount ─────────────────────────────────────

  it("cleans up all listeners on unmount", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 500,
      bottom: 400,
      width: 500,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    const canvasRemoveSpy = vi.spyOn(canvas, "removeEventListener");
    const windowRemoveSpy = vi.spyOn(window, "removeEventListener");
    const params = createParams({ canvasRef: { current: canvas } });

    const { unmount } = renderHook(() => useChartInteractions(params));
    unmount();

    const canvasRemoved = canvasRemoveSpy.mock.calls.map((c) => c[0]);
    expect(canvasRemoved).toContain("mousemove");
    expect(canvasRemoved).toContain("mousedown");
    expect(canvasRemoved).toContain("mouseleave");

    const windowRemoved = windowRemoveSpy.mock.calls.map((c) => c[0]);
    expect(windowRemoved).toContain("mouseup");
  });

  // ── 5. Mouse leave clears hover and calls draw ────────────────

  it("clears hoverIndexRef and calls draw on mouseleave", () => {
    const params = createParams();
    params.hoverIndexRef.current = 5;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(params.canvasRef.current!, "mouseleave");
    });

    expect(params.hoverIndexRef.current).toBeNull();
    expect(params.draw).toHaveBeenCalled();

    const updater = (params.setTooltip as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const prev: TooltipState = {
      visible: true,
      x: 100,
      y: 100,
      dataPoint: makeDataPoint(0),
    };
    const result = updater(prev);
    expect(result.visible).toBe(false);
    expect(result.dataPoint).toBeNull();
  });

  // ── 6. Mouse leave sets tooltip to not visible ────────────────

  it("sets tooltip to not visible on mouseleave", () => {
    const params = createParams();

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(params.canvasRef.current!, "mouseleave");
    });

    expect(params.setTooltip).toHaveBeenCalled();
    // setTooltip is called with an updater function; invoke it to verify behaviour
    const updater = (params.setTooltip as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const prev: TooltipState = {
      visible: true,
      x: 100,
      y: 100,
      dataPoint: makeDataPoint(0),
    };
    const result = updater(prev);
    expect(result.visible).toBe(false);
    expect(result.dataPoint).toBeNull();
  });

  // ── 7. Mouse move over chart area sets hover index and tooltip ─

  it("sets hover index and tooltip on mousemove over chart area", () => {
    const params = createParams();

    renderHook(() => useChartInteractions(params));

    // Move to a position inside the chart area, close to the first data point
    // chartLeft=50, chartTop=10, chartBottom=300
    // mapX(0) = 50 (chartLeft)
    const cx = 55; // close to index 0
    const cy = 150; // within chart area vertically

    act(() => {
      fireMouseEvent(params.canvasRef.current!, "mousemove", {
        clientX: cx,
        clientY: cy,
      });
    });

    expect(params.hoverIndexRef.current).toBe(0);
    expect(params.setTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        dataPoint: params.visibleData[0],
      }),
    );
  });

  // ── 8. Mouse move outside chart area clears hover ─────────────

  it("clears hover index on mousemove outside chart area when previously hovering", () => {
    const params = createParams();
    // Pre-set a hover index so we can verify it gets cleared
    params.hoverIndexRef.current = 5;

    renderHook(() => useChartInteractions(params));

    // Move to a position outside the chart area (above chartTop)
    act(() => {
      fireMouseEvent(params.canvasRef.current!, "mousemove", {
        clientX: 200,
        clientY: 5,
      });
    });

    expect(params.hoverIndexRef.current).toBeNull();
    expect(params.draw).toHaveBeenCalled();
  });

  // ── 9. Mouse move outside chart area with no prior hover ──────

  it("does not call draw on mousemove outside chart area when no previous hover", () => {
    const params = createParams();
    // hoverIndexRef starts as null
    expect(params.hoverIndexRef.current).toBeNull();

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(params.canvasRef.current!, "mousemove", {
        clientX: 200,
        clientY: 5,
      });
    });

    // draw should NOT be called because hoverIndexRef was already null
    expect(params.draw).not.toHaveBeenCalled();
  });

  it("returns no hit when chart data is empty", () => {
    const params = createParams({ visibleData: [] });
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 200, clientY: 150 });
    });

    expect(params.hoverIndexRef.current).toBeNull();
    expect(params.setTooltip).not.toHaveBeenCalled();
  });

  it("cancels a pending animation frame before requesting another draw", () => {
    const params = createParams();
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 55, clientY: 150 });
    });
    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 95, clientY: 150 });
    });

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("skips cursor updates when the canvas ref is cleared after coordinates are read", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 500,
      bottom: 400,
      width: 500,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    let reads = 0;
    const canvasRef = {
      get current() {
        reads += 1;
        return reads >= 3 ? null : canvas;
      },
    };
    const params = createParams({ canvasRef });

    renderHook(() => useChartInteractions(params));

    expect(() => {
      act(() => {
        fireMouseEvent(canvas, "mousemove", { clientX: 200, clientY: 150 });
      });
    }).not.toThrow();
  });

  // ── 10. Mouse down on chart area starts chart-pan drag ────────

  it("starts chart-pan drag on mousedown in chart area", () => {
    const params = createParams();
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    // Click inside the chart area
    const cx = 200;
    const cy = 150;

    act(() => {
      fireMouseEvent(canvas, "mousedown", { clientX: cx, clientY: cy });
    });

    // Verify drag started by checking cursor changed to "grabbing"
    expect(canvas.style.cursor).toBe("grabbing");
  });

  // ── 11. Cursor changes to grab in chart area ─────────────────

  it("sets cursor to grab on mousemove over chart area", () => {
    const params = createParams({ showBrush: false });
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    // Move inside chart area
    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 200, clientY: 150 });
    });

    expect(canvas.style.cursor).toBe("grab");
  });

  // ── 12. Cursor changes to ew-resize near brush traveller ─────

  it("sets cursor to ew-resize on mousemove near a brush traveller", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    // The left traveller x position: mapBrushX(startIndex=10)
    // mapBrushX(10) = 50 + (10/99) * 400 ≈ 90.4
    const travellerX = Math.round(
      DEFAULT_LAYOUT.brushLeft +
        (brushRange.startIndex / 99) *
          (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft),
    );
    // y within brush area
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: travellerX,
        clientY: brushMidY,
      });
    });

    expect(canvas.style.cursor).toBe("ew-resize");
  });

  // ── 13. Cursor changes to grab on brush body ─────────────────

  it("sets cursor to grab on mousemove over brush body", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    // Mid-point between left and right travellers
    const leftX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.startIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const rightX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.endIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const midX = (leftX + rightX) / 2;
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: midX,
        clientY: brushMidY,
      });
    });

    expect(canvas.style.cursor).toBe("grab");
  });

  // ── 14. Cursor resets to default outside chart and brush ──────

  it("returns brush-body hit when cursor is well inside brush range (L104)", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    // Compute positions well inside the brush, far from traveller edges
    const leftX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.startIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const rightX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.endIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    // Use 50% between left and right — guaranteed to be far from travellers
    const midX = (leftX + rightX) / 2;
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    // Mousemove to brush body sets cursor to "grab" (brush-body hit)
    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: midX,
        clientY: brushMidY,
      });
    });
    expect(canvas.style.cursor).toBe("grab");

    // Mousedown on brush body should start a brush-pan drag (cursor → grabbing)
    act(() => {
      fireMouseEvent(canvas, "mousedown", {
        clientX: midX,
        clientY: brushMidY,
      });
    });
    expect(canvas.style.cursor).toBe("grabbing");
  });

  it("sets cursor to default on mousemove outside both chart and brush areas", () => {
    const params = createParams();
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    // Move to a position below the brush area
    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 200, clientY: 390 });
    });

    expect(canvas.style.cursor).toBe("default");
  });

  // ── 15. Mouseup after drag resets cursor to grab ──────────────

  it("resets cursor to grab on mouseup after a drag", () => {
    const params = createParams();
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    // Start a chart-pan drag
    act(() => {
      fireMouseEvent(canvas, "mousedown", { clientX: 200, clientY: 150 });
    });
    expect(canvas.style.cursor).toBe("grabbing");

    // Release
    act(() => {
      fireMouseEvent(window, "mouseup");
    });
    expect(canvas.style.cursor).toBe("grab");
  });

  // ── 16. Mousedown on right traveller starts brush-right drag ──

  it("starts brush-right drag on mousedown near right traveller", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    // mapBrushX(endIndex=30) = 50 + (30/99) * 400 ≈ 171.2
    const rightTravellerX = Math.round(
      DEFAULT_LAYOUT.brushLeft +
        (brushRange.endIndex / 99) *
          (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft),
    );
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousedown", {
        clientX: rightTravellerX,
        clientY: brushMidY,
      });
    });

    // Verify drag is active: moving the mouse should call onBrushChangeRef
    // with updated endIndex
    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: rightTravellerX + 50,
        clientY: brushMidY,
      });
    });

    expect(
      params.onBrushChangeRef.current as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        startIndex: brushRange.startIndex,
      }),
    );
  });

  // ── 17. Mousedown on brush body starts brush-pan drag ─────────

  it("starts brush-pan drag on mousedown over brush body", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    // Mid-point between left and right travellers
    const leftX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.startIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const rightX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.endIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const midX = (leftX + rightX) / 2;
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousedown", {
        clientX: midX,
        clientY: brushMidY,
      });
    });

    // Cursor should be set to "grabbing" for brush-pan
    expect(canvas.style.cursor).toBe("grabbing");
  });

  // ── 18. Brush-left drag updates startIndex via onBrushChange ──

  it("updates brush startIndex when dragging left traveller", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    // Hit left traveller
    const leftTravellerX = Math.round(
      DEFAULT_LAYOUT.brushLeft +
        (brushRange.startIndex / 99) *
          (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft),
    );
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    // Mousedown on left traveller
    act(() => {
      fireMouseEvent(canvas, "mousedown", {
        clientX: leftTravellerX,
        clientY: brushMidY,
      });
    });

    // Drag to the right
    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: leftTravellerX + 30,
        clientY: brushMidY,
      });
    });

    const onBrushChange = params.onBrushChangeRef.current as ReturnType<
      typeof vi.fn
    >;
    expect(onBrushChange).toHaveBeenCalledWith(
      expect.objectContaining({
        endIndex: brushRange.endIndex,
      }),
    );
    // startIndex should have increased (moved right)
    const call = onBrushChange.mock.calls[0][0];
    expect(call.startIndex).toBeGreaterThan(brushRange.startIndex);
  });

  // ── 19. Brush-pan drag moves both startIndex and endIndex ─────

  it("moves brush range when dragging brush body", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    const leftX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.startIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const rightX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.endIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const midX = (leftX + rightX) / 2;
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    // Mousedown on brush body
    act(() => {
      fireMouseEvent(canvas, "mousedown", {
        clientX: midX,
        clientY: brushMidY,
      });
    });

    // Drag to the right
    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: midX + 40,
        clientY: brushMidY,
      });
    });

    const onBrushChange = params.onBrushChangeRef.current as ReturnType<
      typeof vi.fn
    >;
    expect(onBrushChange).toHaveBeenCalled();
    // The window size should be preserved
    const call = onBrushChange.mock.calls[0][0];
    expect(call.endIndex - call.startIndex).toBe(
      brushRange.endIndex - brushRange.startIndex,
    );
  });

  // ── 20. Chart-pan drag moves brush range and clears hover ─────

  it("moves brush range and clears hover on chart-pan drag", () => {
    const params = createParams();
    const canvas = params.canvasRef.current!;
    // Set a hover index that should be cleared
    params.hoverIndexRef.current = 5;

    renderHook(() => useChartInteractions(params));

    // Mousedown in chart area
    act(() => {
      fireMouseEvent(canvas, "mousedown", { clientX: 200, clientY: 150 });
    });

    // Drag horizontally
    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 250, clientY: 150 });
    });

    const onBrushChange = params.onBrushChangeRef.current as ReturnType<
      typeof vi.fn
    >;
    expect(onBrushChange).toHaveBeenCalled();
    // Hover should be cleared during pan
    expect(params.hoverIndexRef.current).toBeNull();
    expect(params.setTooltip).toHaveBeenCalled();

    const updater = (params.setTooltip as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const prev: TooltipState = {
      visible: true,
      x: 100,
      y: 100,
      dataPoint: makeDataPoint(0),
    };
    const result = updater(prev);
    expect(result.visible).toBe(false);
    expect(result.dataPoint).toBeNull();
  });

  // ── 21. Mouseup when no drag was happening does not change cursor ─

  it("does not change cursor on mouseup when not dragging", () => {
    const params = createParams();
    const canvas = params.canvasRef.current!;
    canvas.style.cursor = "default";

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(window, "mouseup");
    });

    // Cursor should remain unchanged (no wasDragging)
    expect(canvas.style.cursor).toBe("default");
  });

  // ── 22. Brush-pan clamps to left boundary ─────────────────────

  it("clamps brush-pan to left boundary when dragged past start", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    const leftX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.startIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const rightX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.endIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const midX = (leftX + rightX) / 2;
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    // Mousedown on brush body
    act(() => {
      fireMouseEvent(canvas, "mousedown", {
        clientX: midX,
        clientY: brushMidY,
      });
    });

    // Drag far to the left (past boundary)
    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: midX - 500,
        clientY: brushMidY,
      });
    });

    const onBrushChange = params.onBrushChangeRef.current as ReturnType<
      typeof vi.fn
    >;
    expect(onBrushChange).toHaveBeenCalled();
    const call = onBrushChange.mock.calls[0][0];
    expect(call.startIndex).toBe(0);
  });

  // ── 23. Chart-pan clamps to right boundary ────────────────────

  it("clamps chart-pan to right boundary when dragged past end", () => {
    // Set brush range near the end so dragging left (which moves range right) hits boundary
    const params = createParams({
      showBrush: true,
    });
    params.brushRangeRef.current = { startIndex: 80, endIndex: 99 };
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    // Mousedown in chart area
    act(() => {
      fireMouseEvent(canvas, "mousedown", { clientX: 200, clientY: 150 });
    });

    // Drag far to the left (chart-pan: negative dx moves range right)
    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 50, clientY: 150 });
    });

    const onBrushChange = params.onBrushChangeRef.current as ReturnType<
      typeof vi.fn
    >;
    expect(onBrushChange).toHaveBeenCalled();
    const call = onBrushChange.mock.calls[0][0];
    expect(call.endIndex).toBe(99);
  });

  // ── 24. No canvas → getCanvasCoords returns {0,0} ────────────

  it("handles null canvas ref gracefully", () => {
    const params = createParams({ canvasRef: { current: null } });

    // Should not throw
    const { result } = renderHook(() => useChartInteractions(params));
    expect(result.current.hoverIndexRef).toBe(params.hoverIndexRef);
  });

  it("uses zero coordinates when the canvas ref is cleared before an attached handler runs", () => {
    const canvas = document.createElement("canvas");
    const canvasRef = { current: canvas as HTMLCanvasElement | null };
    const params = createParams({
      canvasRef,
      layout: {
        ...DEFAULT_LAYOUT,
        chartLeft: 0,
        chartRight: 10,
        chartTop: 0,
        chartBottom: 10,
      },
    });

    renderHook(() => useChartInteractions(params));

    canvasRef.current = null;

    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: 200, clientY: 150 });
    });

    expect(params.hoverIndexRef.current).toBeNull();
    expect(params.setTooltip).not.toHaveBeenCalled();
  });

  it("starts brush-pan without setting a cursor when the canvas ref is cleared", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 500,
      bottom: 400,
      width: 500,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    let reads = 0;
    const canvasRef = {
      get current() {
        reads += 1;
        return reads >= 3 ? null : canvas;
      },
    };
    const params = createParams({ canvasRef, showBrush: true });
    const brushRange = params.brushRangeRef.current;
    const leftX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.startIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const rightX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.endIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    const midX = (leftX + rightX) / 2;
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousedown", {
        clientX: midX,
        clientY: brushMidY,
      });
    });

    expect(canvas.style.cursor).toBe("");
  });

  it("starts chart-pan without setting a cursor when the canvas ref is cleared", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 500,
      bottom: 400,
      width: 500,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    let reads = 0;
    const canvasRef = {
      get current() {
        reads += 1;
        return reads >= 3 ? null : canvas;
      },
    };
    const params = createParams({ canvasRef, showBrush: false });

    renderHook(() => useChartInteractions(params));

    act(() => {
      fireMouseEvent(canvas, "mousedown", { clientX: 200, clientY: 150 });
    });

    expect(canvas.style.cursor).toBe("");
  });

  // ── 25. showBrush=false → hitTestBrush returns null ───────────

  it("does not start brush drag when showBrush is false", () => {
    const params = createParams({ showBrush: false });
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    // Click in brush area — should not trigger brush drag since showBrush=false
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;
    act(() => {
      fireMouseEvent(canvas, "mousedown", { clientX: 100, clientY: brushMidY });
    });

    // No cursor change to grabbing (no brush drag started, and brush area is not chart area)
    expect(canvas.style.cursor).not.toBe("grabbing");
  });

  // ── 26. Hover same index doesn't re-set tooltip ───────────────

  it("returns null from hitTestBrush when cursor is in brush Y range but outside brush X range", () => {
    const params = createParams({ showBrush: true });
    const canvas = params.canvasRef.current!;
    const brushRange = params.brushRangeRef.current;

    // Compute the left traveller X position
    const leftX =
      DEFAULT_LAYOUT.brushLeft +
      (brushRange.startIndex / 99) *
        (DEFAULT_LAYOUT.brushRight - DEFAULT_LAYOUT.brushLeft);
    // Place cursor well to the left of the left traveller, beyond tHit (BRUSH_TRAVELLER_WIDTH + 4)
    const outsideX = leftX - (8 + 4) - 10;
    const brushMidY =
      (DEFAULT_LAYOUT.brushTop + DEFAULT_LAYOUT.brushBottom) / 2;

    renderHook(() => useChartInteractions(params));

    // Mousemove to a position within brush Y bounds but outside brush X range
    act(() => {
      fireMouseEvent(canvas, "mousemove", {
        clientX: outsideX,
        clientY: brushMidY,
      });
    });

    // hitTestBrush returns null → cursor should be "default" (not grab/ew-resize)
    expect(canvas.style.cursor).toBe("default");
  });

  it("does not re-set tooltip when hovering same index", () => {
    const params = createParams();
    const canvas = params.canvasRef.current!;

    renderHook(() => useChartInteractions(params));

    // First move to set hover
    const cx = 55;
    const cy = 150;
    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: cx, clientY: cy });
    });

    const callCount = (params.setTooltip as ReturnType<typeof vi.fn>).mock.calls
      .length;

    // Move to same position again (same index)
    act(() => {
      fireMouseEvent(canvas, "mousemove", { clientX: cx, clientY: cy });
    });

    // setTooltip should not have been called again
    expect(
      (params.setTooltip as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callCount);
  });
});
