import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TooltipState } from "./useTooltipPosition";
import { useTooltipPosition } from "./useTooltipPosition";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../canvas-chart-utils/canvas-chart-utils", () => ({
  TOOLTIP_OFFSET_X: 12,
  TOOLTIP_OFFSET_Y: 12,
  TOOLTIP_WIDTH: 220,
  TOOLTIP_HEIGHT: 80,
  TOOLTIP_MARGIN: 4,
}));

// ─── Constants (mirrored for readability in assertions) ────────────────────────

const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_OFFSET_Y = 12;
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 80;
const TOOLTIP_MARGIN = 4;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const LARGE_CANVAS = { width: 1000, height: 800 };
const SMALL_CANVAS = { width: 260, height: 120 };

function makeFakeDataPoint() {
  return {
    sessionIndex: 1,
    sessionDate: "2024-01-01",
    league: "Settlers",
    profitDivine: 2.5,
    profitChaos: 400,
    rawDecks: 10,
    chaosPerDivine: 160,
  };
}

function makeVisibleTooltip(x: number, y: number): TooltipState {
  return { visible: true, x, y, dataPoint: makeFakeDataPoint() };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("useTooltipPosition", () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  it("returns initial tooltip state as not visible", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));

    expect(result.current.tooltip).toEqual({
      visible: false,
      x: 0,
      y: 0,
      dataPoint: null,
    });
  });

  it("returns display: 'none' for the initial tooltipStyle", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));

    expect(result.current.tooltipStyle).toEqual({ display: "none" });
  });

  // ── tooltipRef ─────────────────────────────────────────────────────────────

  it("returns a tooltipRef that is a React ref object", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));

    expect(result.current.tooltipRef).toBeDefined();
    expect(result.current.tooltipRef).toHaveProperty("current");
    expect(result.current.tooltipRef.current).toBeNull();
  });

  // ── setTooltip ─────────────────────────────────────────────────────────────

  it("updates tooltip state via setTooltip", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(100, 100));
    });

    expect(result.current.tooltip.visible).toBe(true);
    expect(result.current.tooltip.x).toBe(100);
    expect(result.current.tooltip.y).toBe(100);
    expect(result.current.tooltip.dataPoint).not.toBeNull();
  });

  // ── display: "none" edge cases ─────────────────────────────────────────────

  it("returns display: 'none' when visible is true but dataPoint is null", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));

    act(() => {
      result.current.setTooltip({
        visible: true,
        x: 50,
        y: 50,
        dataPoint: null,
      });
    });

    expect(result.current.tooltipStyle).toEqual({ display: "none" });
  });

  it("returns display: 'none' when visible is false even with a dataPoint", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));

    act(() => {
      result.current.setTooltip({
        visible: false,
        x: 50,
        y: 50,
        dataPoint: makeFakeDataPoint(),
      });
    });

    expect(result.current.tooltipStyle).toEqual({ display: "none" });
  });

  // ── Standard positioning (right & below cursor) ───────────────────────────

  it("positions tooltip to the right and below the cursor when space is available", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));
    const x = 100;
    const y = 100;

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(x, y));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    expect(style.position).toBe("absolute");
    expect(style.left).toBe(`${x + TOOLTIP_OFFSET_X}px`);
    expect(style.top).toBe(`${y + TOOLTIP_OFFSET_Y}px`);
    expect(style.pointerEvents).toBe("none");
    expect(style.zIndex).toBe(10);
  });

  // ── Horizontal flip (right edge overflow) ──────────────────────────────────

  it("flips tooltip to the left when right edge would overflow the canvas", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));
    // Place cursor near the right edge so that left + TOOLTIP_WIDTH > cw - MARGIN
    // left = x + 12 = 788; 788 + 220 = 1008 > 1000 - 4 = 996 → flips
    const x = 788;
    const y = 100;

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(x, y));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    const expectedLeft = x - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X; // 788 - 220 - 12 = 556
    expect(style.left).toBe(`${expectedLeft}px`);
  });

  // ── Horizontal clamp (left overflow after flip) ────────────────────────────

  it("clamps tooltip to TOOLTIP_MARGIN when flipping left still overflows", () => {
    const { result } = renderHook(() => useTooltipPosition(SMALL_CANVAS));
    // Canvas width = 260
    // x = 100: left = 100 + 12 = 112; 112 + 220 = 332 > 260 - 4 = 256 → flip
    // flipped: left = 100 - 220 - 12 = -132 → clamp to MARGIN = 4
    const x = 100;
    const y = 10;

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(x, y));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    expect(style.left).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── Vertical flip (bottom edge overflow) ───────────────────────────────────

  it("flips tooltip above the cursor when bottom edge would overflow", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));
    // Canvas height = 800; y = 720
    // top = 720 + 12 = 732; 732 + 80 = 812 > 800 - 4 = 796 → flip
    const x = 100;
    const y = 720;

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(x, y));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    const expectedTop = y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET_Y; // 720 - 80 - 12 = 628
    expect(style.top).toBe(`${expectedTop}px`);
  });

  // ── Vertical clamp (top overflow after flip) ───────────────────────────────

  it("clamps tooltip to TOOLTIP_MARGIN when flipping up still overflows", () => {
    const { result } = renderHook(() => useTooltipPosition(SMALL_CANVAS));
    // Canvas height = 120; y = 50
    // top = 50 + 12 = 62; 62 + 80 = 142 > 120 - 4 = 116 → flip
    // flipped: top = 50 - 80 - 12 = -42 → clamp to MARGIN = 4
    const x = 10;
    const y = 50;

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(x, y));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    expect(style.top).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── Both axes clamp simultaneously ─────────────────────────────────────────

  it("clamps both left and top when canvas is too small on both axes", () => {
    const tinyCanvas = { width: 50, height: 50 };
    const { result } = renderHook(() => useTooltipPosition(tinyCanvas));

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(20, 20));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    expect(style.left).toBe(`${TOOLTIP_MARGIN}px`);
    expect(style.top).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── Recomputes style when canvasSize prop changes ──────────────────────────

  it("recomputes tooltip style when canvasSize changes", () => {
    const { result, rerender } = renderHook(
      ({ size }) => useTooltipPosition(size),
      { initialProps: { size: LARGE_CANVAS } },
    );

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(100, 100));
    });

    const styleBefore = result.current.tooltipStyle as Record<string, unknown>;
    expect(styleBefore.left).toBe(`${100 + TOOLTIP_OFFSET_X}px`);

    // Shrink canvas so the tooltip now needs to flip
    rerender({ size: { width: 200, height: 200 } });

    const styleAfter = result.current.tooltipStyle as Record<string, unknown>;
    // With canvas width=200: left = 112; 112+220 = 332 > 196 → flip → 100-220-12 = -132 → clamp 4
    expect(styleAfter.left).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── Hiding tooltip resets to display: "none" ───────────────────────────────

  it("returns display: 'none' after hiding a previously visible tooltip", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(100, 100));
    });

    expect(result.current.tooltipStyle).toHaveProperty("position", "absolute");

    act(() => {
      result.current.setTooltip({
        visible: false,
        x: 0,
        y: 0,
        dataPoint: null,
      });
    });

    expect(result.current.tooltipStyle).toEqual({ display: "none" });
  });

  // ── Exact boundary: tooltip just fits ──────────────────────────────────────

  it("does not flip when tooltip exactly fits at the right edge", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));
    // We want: left + TOOLTIP_WIDTH <= cw - MARGIN
    // left = x + 12; left + 220 = cw - MARGIN → left = 776 → x = 764
    // 764 + 12 = 776; 776 + 220 = 996 = 1000 - 4 → exactly at boundary, NOT >
    const x = 764;

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(x, 100));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    expect(style.left).toBe(`${x + TOOLTIP_OFFSET_X}px`);
  });

  it("flips when tooltip is one pixel past the right edge boundary", () => {
    const { result } = renderHook(() => useTooltipPosition(LARGE_CANVAS));
    // x = 765 → left = 777; 777 + 220 = 997 > 996 → flip
    const x = 765;

    act(() => {
      result.current.setTooltip(makeVisibleTooltip(x, 100));
    });

    const style = result.current.tooltipStyle as Record<string, unknown>;
    const expectedLeft = x - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X; // 765 - 220 - 12 = 533
    expect(style.left).toBe(`${expectedLeft}px`);
  });
});
