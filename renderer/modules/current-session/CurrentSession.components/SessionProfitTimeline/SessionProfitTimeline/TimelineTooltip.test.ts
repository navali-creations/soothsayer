// ─── Tests for computePortalTooltipStyle ────────────────────────────────────

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock transitive dependencies that TimelineTooltip.tsx imports
vi.mock("~/renderer/components/DivinationCard", () => ({
  default: () => null,
}));
vi.mock("~/renderer/store", () => ({
  useBoundStore: () => ({
    currentSession: { getSession: () => null },
    sessionDetails: { getSession: () => null },
  }),
}));
vi.mock("~/renderer/utils", () => ({
  formatCurrency: (v: number) => String(v),
}));

import type { ProfitChartPoint } from "../types/types";
import type { TooltipState } from "../useTimelineInteractions/useTimelineInteractions";
import {
  computePortalTooltipStyle,
  TOOLTIP_CARD_HEIGHT,
  TOOLTIP_CARD_STATS_GAP,
  TOOLTIP_MARGIN,
  TOOLTIP_OFFSET_X,
  TOOLTIP_STATS_HEIGHT,
  TOOLTIP_VERTICAL_NUDGE,
  TOOLTIP_WIDTH,
} from "./TimelineTooltip";

// ─── Helpers ────────────────────────────────────────────────────────────────

const TOTAL_HEIGHT =
  TOOLTIP_CARD_HEIGHT + TOOLTIP_CARD_STATS_GAP + TOOLTIP_STATS_HEIGHT;

function makePoint(overrides?: Partial<ProfitChartPoint>): ProfitChartPoint {
  return {
    x: 1,
    profit: 100,
    barValue: 50,
    cardName: "The Doctor",
    rarity: 3,
    ...overrides,
  };
}

function makeTooltip(overrides?: Partial<TooltipState>): TooltipState {
  return {
    visible: true,
    x: 100,
    y: 50,
    point: makePoint(),
    ...overrides,
  };
}

function makeContainerRect(overrides?: Partial<DOMRect>): DOMRect {
  return {
    x: 50,
    y: 200,
    width: 600,
    height: 400,
    top: 200,
    right: 650,
    bottom: 600,
    left: 50,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("computePortalTooltipStyle", () => {
  beforeEach(() => {
    // Default to a large viewport so nothing overflows by default
    setViewport(1920, 1080);
  });

  // ── Hidden states ───────────────────────────────────────────────────────

  it("returns display:none when tooltip is not visible", () => {
    const tooltip = makeTooltip({ visible: false });
    const result = computePortalTooltipStyle(tooltip, makeContainerRect());
    expect(result).toEqual({ display: "none" });
  });

  it("returns display:none when point is null", () => {
    const tooltip = makeTooltip({ point: null });
    const result = computePortalTooltipStyle(tooltip, makeContainerRect());
    expect(result).toEqual({ display: "none" });
  });

  it("returns display:none when containerRect is null", () => {
    const tooltip = makeTooltip();
    const result = computePortalTooltipStyle(tooltip, null);
    expect(result).toEqual({ display: "none" });
  });

  // ── Horizontal positioning ──────────────────────────────────────────────

  it("positions tooltip to the right of cursor when there is space", () => {
    const containerRect = makeContainerRect({ left: 50 });
    const tooltip = makeTooltip({ x: 100 });
    // cursorViewportX = 50 + 100 = 150
    // left = 150 + TOOLTIP_OFFSET_X = 162
    const result = computePortalTooltipStyle(tooltip, containerRect);

    const expectedLeft = 150 + TOOLTIP_OFFSET_X;
    expect(result.left).toBe(`${expectedLeft}px`);
  });

  it("flips tooltip to the left of cursor when it would overflow the right edge", () => {
    // Viewport 500px wide so right placement overflows but left placement fits
    setViewport(500, 1080);

    // cursorViewportX = 50 + 300 = 350
    // initial left = 350 + 12 = 362
    // 362 + 200 = 562 > 500 - 8 = 492 => overflow, flip
    // flipped = 350 - 200 - 12 = 138 >= 8 => no clamp
    const tooltip = makeTooltip({ x: 300 });
    const containerRect = makeContainerRect({ left: 50 });
    const result = computePortalTooltipStyle(tooltip, containerRect);

    const cursorViewportX = 50 + 300; // 350
    const expectedLeft = cursorViewportX - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X; // 138
    expect(result.left).toBe(`${expectedLeft}px`);
  });

  it("clamps left to TOOLTIP_MARGIN when it would go off-screen left", () => {
    // Make viewport narrow so the flipped position goes negative
    setViewport(250, 1080);

    const containerRect = makeContainerRect({ left: 0 });
    const tooltip = makeTooltip({ x: 100 });
    // cursorViewportX = 0 + 100 = 100
    // initial left = 100 + 12 = 112
    // 112 + 200 = 312 > 250 - 8 = 242 => flip
    // flipped = 100 - 200 - 12 = -112
    // -112 < 8 => clamp to 8
    const result = computePortalTooltipStyle(tooltip, containerRect);

    expect(result.left).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── Vertical positioning ────────────────────────────────────────────────

  it("positions tooltip with vertical nudge above the container", () => {
    const containerRect = makeContainerRect({ top: 500 });
    const tooltip = makeTooltip();

    const result = computePortalTooltipStyle(tooltip, containerRect);

    const expectedTop = 500 - TOOLTIP_VERTICAL_NUDGE; // 400
    expect(result.top).toBe(`${expectedTop}px`);
  });

  it("clamps top when tooltip would overflow bottom of viewport", () => {
    setViewport(1920, 600);

    // containerRect.top high enough that top + totalHeight overflows
    const containerRect = makeContainerRect({ top: 500 });
    const tooltip = makeTooltip();
    // top = 500 - 100 = 400
    // 400 + TOTAL_HEIGHT > 600 - 8 = 592? => 400 + 380 = 780 > 592 => yes
    // clamped = 600 - 380 - 8 = 212
    const result = computePortalTooltipStyle(tooltip, containerRect);

    const expectedTop = 600 - TOTAL_HEIGHT - TOOLTIP_MARGIN;
    expect(result.top).toBe(`${expectedTop}px`);
  });

  it("clamps top to TOOLTIP_MARGIN when it would go off-screen top", () => {
    // Very small viewport so even the clamped value goes negative
    setViewport(1920, 200);

    const containerRect = makeContainerRect({ top: 50 });
    const tooltip = makeTooltip();
    // top = 50 - 100 = -50
    // -50 + TOTAL_HEIGHT = -50 + 380 = 330 > 200 - 8 = 192 => clamp
    // clamped = 200 - 380 - 8 = -188
    // -188 < 8 => clamp to 8
    const result = computePortalTooltipStyle(tooltip, containerRect);

    expect(result.top).toBe(`${TOOLTIP_MARGIN}px`);
  });

  // ── CSS properties ──────────────────────────────────────────────────────

  it("returns correct CSS properties (position, pointerEvents, zIndex)", () => {
    const tooltip = makeTooltip();
    const containerRect = makeContainerRect();

    const result = computePortalTooltipStyle(tooltip, containerRect);

    expect(result.position).toBe("fixed");
    expect(result.pointerEvents).toBe("none");
    expect(result.zIndex).toBe(9999);
    expect(result.display).toBeUndefined();
    expect(result.left).toMatch(/^\d+(\.\d+)?px$/);
    expect(result.top).toMatch(/^\d+(\.\d+)?px$/);
  });
});
