// ─── Tests for useTimelineInteractions.ts ───────────────────────────────────

import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";

import type { TimelineLayout } from "../canvas-utils/canvas-utils";
import type { ProfitChartPoint } from "../types/types";
import {
  type TooltipState,
  useTimelineInteractions,
} from "./useTimelineInteractions";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("~/renderer/utils", () => ({
  cardNameToSlug: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 240;
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 240,
    width: 800,
    height: 240,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
  document.body.appendChild(canvas);
  return canvas;
}

function createMockCanvasWithOffset(
  left: number,
  top: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 240;
  canvas.getBoundingClientRect = vi.fn(() => ({
    left,
    top,
    right: left + 800,
    bottom: top + 240,
    width: 800,
    height: 240,
    x: left,
    y: top,
    toJSON: () => {},
  }));
  document.body.appendChild(canvas);
  return canvas;
}

const DEFAULT_LAYOUT: TimelineLayout = {
  chartLeft: 55,
  chartRight: 785,
  chartTop: 10,
  chartBottom: 216,
  chartWidth: 730,
  chartHeight: 206,
};

const SAMPLE_CHART_DATA: ProfitChartPoint[] = [
  { x: 1, profit: 10, barValue: 50, cardName: "The Doctor", rarity: 1 },
  { x: 5, profit: 50, barValue: 100, cardName: "Rain of Chaos", rarity: 3 },
  { x: 10, profit: 100, barValue: null, cardName: null, rarity: null }, // trailing point (no bar)
];

/**
 * Linear mapping from data x to pixel x within the chart area.
 * Domain: [0, 10]  →  Range: [55, 785]
 */
function defaultMapX(value: number): number {
  const domainMin = 0;
  const domainMax = 10;
  const rangeMin = DEFAULT_LAYOUT.chartLeft;
  const rangeMax = DEFAULT_LAYOUT.chartRight;
  const t = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + t * (rangeMax - rangeMin);
}

interface SetupOptions {
  canvas?: HTMLCanvasElement | null;
  chartData?: ProfitChartPoint[];
  layout?: TimelineLayout;
  mapX?: (value: number) => number;
}

function setupHook(options: SetupOptions = {}) {
  const canvas = options.canvas ?? createMockCanvas();
  const canvasRef = {
    current: canvas,
  } as MutableRefObject<HTMLCanvasElement | null>;
  const hoverIndexRef = { current: null } as MutableRefObject<number | null>;
  const draw = vi.fn();
  const setTooltip = vi.fn();
  const chartData = options.chartData ?? SAMPLE_CHART_DATA;
  const layout = options.layout ?? DEFAULT_LAYOUT;
  const mapX = options.mapX ?? defaultMapX;

  const result = renderHook(() =>
    useTimelineInteractions({
      canvasRef,
      hoverIndexRef,
      layout,
      chartData,
      mapX,
      setTooltip,
      draw,
    }),
  );

  return { canvasRef, hoverIndexRef, draw, setTooltip, canvas, result };
}

function fireMouseMove(
  target: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): void {
  const event = new MouseEvent("mousemove", {
    clientX,
    clientY,
    bubbles: true,
  });
  target.dispatchEvent(event);
}

function fireMouseLeave(target: HTMLCanvasElement): void {
  const event = new MouseEvent("mouseleave", { bubbles: true });
  target.dispatchEvent(event);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useTimelineInteractions", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mockNavigate.mockReset();
  });

  afterEach(() => {
    // Clean up any canvases left in the DOM
    for (const c of document.body.querySelectorAll("canvas")) {
      c.remove();
    }
    vi.unstubAllGlobals();
  });

  // ── Event listener attachment ───────────────────────────────────────────

  it("should attach event listeners to the canvas", () => {
    canvas = createMockCanvas();
    const addSpy = vi.spyOn(canvas, "addEventListener");

    setupHook({ canvas });

    const eventNames = addSpy.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain("mousemove");
    expect(eventNames).toContain("mouseleave");
  });

  it("should remove event listeners on unmount", () => {
    canvas = createMockCanvas();
    const removeSpy = vi.spyOn(canvas, "removeEventListener");

    const { result } = setupHook({ canvas });
    result.unmount();

    const eventNames = removeSpy.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain("mousemove");
    expect(eventNames).toContain("mouseleave");
  });

  // ── Tooltip visibility on hover ─────────────────────────────────────────

  it("should call setTooltip with visible=true when hovering over a bar", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    // Bar at index 0 has x=1, mapped pixel x ≈ 128
    const barPixelX = defaultMapX(1);
    const cy = 100; // within chart area vertically

    act(() => {
      fireMouseMove(canvas, barPixelX, cy);
    });

    expect(setTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        point: SAMPLE_CHART_DATA[0],
      }),
    );
  });

  it("should call setTooltip with visible=false when mouse leaves canvas", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    // First hover over a bar to set hover state
    const barPixelX = defaultMapX(1);
    act(() => {
      fireMouseMove(canvas, barPixelX, 100);
    });

    // Then leave the canvas
    act(() => {
      fireMouseLeave(canvas);
    });

    // The last call should set visible to false
    const lastCall = setTooltip.mock.calls[setTooltip.mock.calls.length - 1];
    // setTooltip is called with an updater function for mouseleave
    expect(typeof lastCall[0]).toBe("function");
    const prev: TooltipState = {
      visible: true,
      x: 100,
      y: 100,
      point: SAMPLE_CHART_DATA[0],
    };
    const updated = lastCall[0](prev);
    expect(updated.visible).toBe(false);
    expect(updated.point).toBeNull();
  });

  // ── hoverIndexRef updates ───────────────────────────────────────────────

  it("should update hoverIndexRef when hovering over a bar", () => {
    canvas = createMockCanvas();
    const { hoverIndexRef } = setupHook({ canvas });

    expect(hoverIndexRef.current).toBeNull();

    const barPixelX = defaultMapX(1);
    act(() => {
      fireMouseMove(canvas, barPixelX, 100);
    });

    expect(hoverIndexRef.current).toBe(0);
  });

  it("should set hoverIndexRef to null on mouse leave", () => {
    canvas = createMockCanvas();
    const { hoverIndexRef } = setupHook({ canvas });

    // Hover first
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });
    expect(hoverIndexRef.current).toBe(0);

    // Leave
    act(() => {
      fireMouseLeave(canvas);
    });
    expect(hoverIndexRef.current).toBeNull();
  });

  it("should update hoverIndexRef when moving between bars", () => {
    canvas = createMockCanvas();
    const { hoverIndexRef } = setupHook({ canvas });

    // Hover over first bar (x=1)
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });
    expect(hoverIndexRef.current).toBe(0);

    // Move to second bar (x=5)
    act(() => {
      fireMouseMove(canvas, defaultMapX(5), 100);
    });
    expect(hoverIndexRef.current).toBe(1);
  });

  // ── draw callback ──────────────────────────────────────────────────────

  it("should call draw when hover state changes", () => {
    canvas = createMockCanvas();
    const { draw } = setupHook({ canvas });

    // Hover over a bar to trigger draw
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });

    expect(draw).toHaveBeenCalled();
  });

  it("should call draw when leaving a hovered bar", () => {
    canvas = createMockCanvas();
    const { draw } = setupHook({ canvas });

    // Hover first
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });
    draw.mockClear();

    // Leave
    act(() => {
      fireMouseLeave(canvas);
    });

    expect(draw).toHaveBeenCalled();
  });

  it("should call draw when moving from one bar to another", () => {
    canvas = createMockCanvas();
    const { draw } = setupHook({ canvas });

    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });
    draw.mockClear();

    act(() => {
      fireMouseMove(canvas, defaultMapX(5), 100);
    });

    expect(draw).toHaveBeenCalled();
  });

  it("should not call draw when mouse moves but hover state doesn't change", () => {
    canvas = createMockCanvas();
    const { draw } = setupHook({ canvas });

    // Move to an area with no bars
    act(() => {
      fireMouseMove(canvas, defaultMapX(8), 100);
    });

    // hoverIndexRef is still null (was null before), so no draw
    expect(draw).not.toHaveBeenCalled();
  });

  // ── Chart area boundary checks ─────────────────────────────────────────

  it("should not show tooltip when mouse is outside chart area (above)", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    // chartTop is 10, so y=5 is above the chart area
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 5);
    });

    // setTooltip should not have been called with visible=true
    const visibleCalls = setTooltip.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === "object" && arg.visible === true;
    });
    expect(visibleCalls).toHaveLength(0);
  });

  it("should not show tooltip when mouse is outside chart area (left of padding)", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    // chartLeft is 55, so x=20 is in the left padding area
    act(() => {
      fireMouseMove(canvas, 20, 100);
    });

    const visibleCalls = setTooltip.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === "object" && arg.visible === true;
    });
    expect(visibleCalls).toHaveLength(0);
  });

  it("should not show tooltip when mouse is below chart area", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    // chartBottom is 216, so y=230 is below the chart area
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 230);
    });

    const visibleCalls = setTooltip.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === "object" && arg.visible === true;
    });
    expect(visibleCalls).toHaveLength(0);
  });

  // ── Missing canvas ref ─────────────────────────────────────────────────

  it("should handle missing canvas ref gracefully", () => {
    const canvasRef = {
      current: null,
    } as MutableRefObject<HTMLCanvasElement | null>;
    const hoverIndexRef = { current: null } as MutableRefObject<number | null>;
    const draw = vi.fn();
    const setTooltip = vi.fn();

    // Should not throw when canvas ref is null
    expect(() => {
      renderHook(() =>
        useTimelineInteractions({
          canvasRef,
          hoverIndexRef,
          layout: DEFAULT_LAYOUT,
          chartData: SAMPLE_CHART_DATA,
          mapX: defaultMapX,
          setTooltip,
          draw,
        }),
      );
    }).not.toThrow();

    // No listeners should have been attached
    expect(draw).not.toHaveBeenCalled();
    expect(setTooltip).not.toHaveBeenCalled();
  });

  // ── Empty chart data ───────────────────────────────────────────────────

  it("should handle empty chartData", () => {
    canvas = createMockCanvas();
    const { setTooltip, hoverIndexRef } = setupHook({
      canvas,
      chartData: [],
    });

    // Move to where a bar would normally be
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });

    // No bars to hit-test, so no tooltip
    expect(hoverIndexRef.current).toBeNull();
    const visibleCalls = setTooltip.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === "object" && arg.visible === true;
    });
    expect(visibleCalls).toHaveLength(0);
  });

  // ── Hit-test threshold (20px) ──────────────────────────────────────────

  it("should snap to a bar within 20px threshold", () => {
    canvas = createMockCanvas();
    const { hoverIndexRef, setTooltip } = setupHook({ canvas });

    const barPixelX = defaultMapX(1);
    // Move 15px away from the bar (within 20px threshold)
    act(() => {
      fireMouseMove(canvas, barPixelX + 15, 100);
    });

    expect(hoverIndexRef.current).toBe(0);
    expect(setTooltip).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true }),
    );
  });

  it("should not snap to a bar beyond 20px threshold", () => {
    canvas = createMockCanvas();
    const { hoverIndexRef, setTooltip } = setupHook({ canvas });

    const barPixelX = defaultMapX(1);
    // Move 25px away from the bar (beyond 20px threshold)
    act(() => {
      fireMouseMove(canvas, barPixelX + 25, 100);
    });

    expect(hoverIndexRef.current).toBeNull();
    const visibleCalls = setTooltip.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === "object" && arg.visible === true;
    });
    expect(visibleCalls).toHaveLength(0);
  });

  // ── Points with null barValue are skipped ──────────────────────────────

  it("should skip points with null barValue during hit-test", () => {
    canvas = createMockCanvas();
    const { hoverIndexRef } = setupHook({ canvas });

    // The third point (x=10) has barValue: null, so it should not be hit
    const pointPixelX = defaultMapX(10);
    act(() => {
      fireMouseMove(canvas, pointPixelX, 100);
    });

    expect(hoverIndexRef.current).toBeNull();
  });

  // ── Canvas coordinate conversion with offset ──────────────────────────

  it("should correctly convert client coords to canvas coords with offset", () => {
    canvas = createMockCanvasWithOffset(100, 50);
    const { hoverIndexRef } = setupHook({ canvas });

    // Bar at x=1 maps to pixel ~128 in canvas coords
    // With canvas offset at left=100, clientX needs to be 100 + 128 = ~228
    const barCanvasX = defaultMapX(1);
    const clientX = 100 + barCanvasX;
    const clientY = 50 + 100; // top offset + within chart area

    act(() => {
      fireMouseMove(canvas, clientX, clientY);
    });

    expect(hoverIndexRef.current).toBe(0);
  });

  // ── Cursor style ──────────────────────────────────────────────────────

  it("should set cursor to pointer when hovering over a bar", () => {
    canvas = createMockCanvas();
    setupHook({ canvas });

    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });

    expect(canvas.style.cursor).toBe("pointer");
  });

  it("should set cursor to default when not hovering over a bar", () => {
    canvas = createMockCanvas();
    setupHook({ canvas });

    // Move to an area with no nearby bars
    act(() => {
      fireMouseMove(canvas, defaultMapX(8), 100);
    });

    expect(canvas.style.cursor).toBe("default");
  });

  it("should reset cursor from pointer to default when moving away from bar", () => {
    canvas = createMockCanvas();
    setupHook({ canvas });

    // First hover over a bar
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });
    expect(canvas.style.cursor).toBe("pointer");

    // Move away from bar
    act(() => {
      fireMouseMove(canvas, defaultMapX(8), 100);
    });
    expect(canvas.style.cursor).toBe("default");
  });

  // ── Tooltip y position follows mouse ──────────────────────────────────

  it("should update tooltip y position when hovering over same bar at different y", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    const barPixelX = defaultMapX(1);

    // First hover sets tooltip
    act(() => {
      fireMouseMove(canvas, barPixelX, 80);
    });

    expect(setTooltip).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, y: 80 }),
    );

    // Moving to same bar but different y should update y via updater function
    act(() => {
      fireMouseMove(canvas, barPixelX, 120);
    });

    // The second call uses an updater function (prev => ({ ...prev, y: cy }))
    const lastCall = setTooltip.mock.calls[setTooltip.mock.calls.length - 1];
    const updater = lastCall[0];
    if (typeof updater === "function") {
      const prev: TooltipState = {
        visible: true,
        x: barPixelX,
        y: 80,
        point: SAMPLE_CHART_DATA[0],
      };
      const updated = updater(prev);
      expect(updated.y).toBe(120);
    }
  });

  // ── Tooltip receives correct point data ───────────────────────────────

  it("should pass correct point data in tooltip when hovering second bar", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    // Second bar at x=5
    act(() => {
      fireMouseMove(canvas, defaultMapX(5), 100);
    });

    expect(setTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        point: SAMPLE_CHART_DATA[1],
      }),
    );
  });

  it("should pass x as the mapped pixel x of the bar (not cursor x)", () => {
    canvas = createMockCanvas();
    const { setTooltip } = setupHook({ canvas });

    const barPixelX = defaultMapX(1);
    // Hover slightly off-center from the bar (but within threshold)
    act(() => {
      fireMouseMove(canvas, barPixelX + 10, 100);
    });

    expect(setTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        visible: true,
        x: barPixelX, // should be the bar's pixel x, not the cursor x
      }),
    );
  });

  // ── requestAnimationFrame / cancelAnimationFrame ──────────────────────

  it("should use requestAnimationFrame for draw calls", () => {
    const rafSpy = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", rafSpy);

    canvas = createMockCanvas();
    setupHook({ canvas });

    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });

    expect(rafSpy).toHaveBeenCalled();
  });

  it("should cancel previous animation frame before requesting new one", () => {
    // Use deferred RAF so that the throttle layer doesn't coalesce
    // back-to-back synchronous moves into a single callback.
    let frameId = 0;
    const pendingCallbacks: Array<{ id: number; cb: FrameRequestCallback }> =
      [];
    const rafSpy = vi.fn((cb: FrameRequestCallback) => {
      const id = ++frameId;
      pendingCallbacks.push({ id, cb });
      return id;
    });
    const cafSpy = vi.fn((id: number) => {
      const idx = pendingCallbacks.findIndex((p) => p.id === id);
      if (idx >= 0) pendingCallbacks.splice(idx, 1);
    });
    vi.stubGlobal("requestAnimationFrame", rafSpy);
    vi.stubGlobal("cancelAnimationFrame", cafSpy);

    canvas = createMockCanvas();
    setupHook({ canvas });

    // First hover — schedules a throttle RAF
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });

    // Flush the throttle RAF so handleMouseMove runs → requestDraw schedules a draw RAF
    act(() => {
      const batch = [...pendingCallbacks];
      pendingCallbacks.length = 0;
      for (const { cb } of batch) cb(0);
    });

    // At this point animFrameRef holds the draw RAF id.
    // Now move to a second bar — schedules another throttle RAF
    act(() => {
      fireMouseMove(canvas, defaultMapX(5), 100);
    });

    // Flush the second throttle RAF → handleMouseMove → requestDraw
    // requestDraw should cancel the previous draw RAF before scheduling a new one
    act(() => {
      const batch = [...pendingCallbacks];
      pendingCallbacks.length = 0;
      for (const { cb } of batch) cb(0);
    });

    // cancelAnimationFrame should have been called for the previous draw frame
    expect(cafSpy).toHaveBeenCalled();
  });

  // ── Clearing hover when moving to empty area ─────────────────────────

  it("should clear tooltip when moving from bar to empty area", () => {
    canvas = createMockCanvas();
    const { setTooltip, hoverIndexRef } = setupHook({ canvas });

    // Hover over bar first
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });
    expect(hoverIndexRef.current).toBe(0);

    // Move to area with no bars (far from any bar)
    act(() => {
      fireMouseMove(canvas, defaultMapX(8), 100);
    });

    expect(hoverIndexRef.current).toBeNull();
    // Last setTooltip call should use updater that sets visible=false
    const lastCall = setTooltip.mock.calls[setTooltip.mock.calls.length - 1];
    const updater = lastCall[0];
    expect(typeof updater).toBe("function");
    const prev: TooltipState = {
      visible: true,
      x: 100,
      y: 100,
      point: SAMPLE_CHART_DATA[0],
    };
    const updated = updater(prev);
    expect(updated.visible).toBe(false);
    expect(updated.point).toBeNull();
  });

  // ── Nearest bar selection ─────────────────────────────────────────────

  it("should select the nearest bar when two bars are close together", () => {
    const closeBarData: ProfitChartPoint[] = [
      { x: 3, profit: 10, barValue: 50, cardName: "Card A", rarity: 1 },
      { x: 3.5, profit: 20, barValue: 80, cardName: "Card B", rarity: 2 },
    ];

    canvas = createMockCanvas();
    const { hoverIndexRef } = setupHook({
      canvas,
      chartData: closeBarData,
    });

    // Hover closer to the second bar
    const midX = (defaultMapX(3) + defaultMapX(3.5)) / 2;
    act(() => {
      fireMouseMove(canvas, midX + 5, 100); // slightly closer to x=3.5
    });

    expect(hoverIndexRef.current).toBe(1);
  });

  // ── All points have null barValue ─────────────────────────────────────

  it("should never trigger tooltip when all points have null barValue", () => {
    const noBarData: ProfitChartPoint[] = [
      { x: 1, profit: 10, barValue: null, cardName: null, rarity: null },
      { x: 5, profit: 50, barValue: null, cardName: null, rarity: null },
      { x: 10, profit: 100, barValue: null, cardName: null, rarity: null },
    ];

    canvas = createMockCanvas();
    const { setTooltip, hoverIndexRef } = setupHook({
      canvas,
      chartData: noBarData,
    });

    // Move across the chart
    act(() => {
      fireMouseMove(canvas, defaultMapX(1), 100);
    });
    act(() => {
      fireMouseMove(canvas, defaultMapX(5), 100);
    });
    act(() => {
      fireMouseMove(canvas, defaultMapX(10), 100);
    });

    expect(hoverIndexRef.current).toBeNull();
    const visibleCalls = setTooltip.mock.calls.filter((call) => {
      const arg = call[0];
      return typeof arg === "object" && arg.visible === true;
    });
    expect(visibleCalls).toHaveLength(0);
  });

  // ── Mouse leave always resets state ───────────────────────────────────

  it("should call draw on mouse leave even if not hovering", () => {
    canvas = createMockCanvas();
    const { draw } = setupHook({ canvas });

    act(() => {
      fireMouseLeave(canvas);
    });

    expect(draw).toHaveBeenCalled();
  });

  it("should set hoverIndexRef to null on mouse leave even if already null", () => {
    canvas = createMockCanvas();
    const { hoverIndexRef } = setupHook({ canvas });

    expect(hoverIndexRef.current).toBeNull();

    act(() => {
      fireMouseLeave(canvas);
    });

    expect(hoverIndexRef.current).toBeNull();
  });

  // ── Click handler ─────────────────────────────────────────────────────

  it("should navigate to card details when clicking a bar with a cardName", () => {
    canvas = createMockCanvas();
    setupHook({ canvas });

    const barPixelX = defaultMapX(1); // bar index 0 → cardName "The Doctor"
    const cy = 100;

    act(() => {
      const event = new MouseEvent("click", {
        clientX: barPixelX,
        clientY: cy,
        bubbles: true,
      });
      canvas.dispatchEvent(event);
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/cards/$cardSlug",
      params: { cardSlug: "the-doctor" },
    });
  });

  it("should not navigate when clicking empty area (no bar hit)", () => {
    canvas = createMockCanvas();
    setupHook({ canvas });

    // x=8 maps to trailing point with barValue=null
    const emptyPixelX = defaultMapX(8);

    act(() => {
      const event = new MouseEvent("click", {
        clientX: emptyPixelX,
        clientY: 100,
        bubbles: true,
      });
      canvas.dispatchEvent(event);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should not navigate when clicking a bar with no cardName", () => {
    canvas = createMockCanvas();
    const dataWithNullName: ProfitChartPoint[] = [
      { x: 1, profit: 10, barValue: 50, cardName: null, rarity: null },
      { x: 10, profit: 100, barValue: null, cardName: null, rarity: null },
    ];
    setupHook({ canvas, chartData: dataWithNullName });

    const barPixelX = defaultMapX(1);

    act(() => {
      const event = new MouseEvent("click", {
        clientX: barPixelX,
        clientY: 100,
        bubbles: true,
      });
      canvas.dispatchEvent(event);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
