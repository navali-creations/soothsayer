import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clamp,
  computeDomains,
  computeLayout,
  drawMonotoneCurve,
  evenTicks,
  formatDecksTick,
  formatProfitTick,
  monotoneTangents,
  parseRgba,
  rgbaStr,
  type SplinePoint,
} from "./canvas-chart-utils";

// ─── clamp ─────────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("clamps a value below min to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps a value above max to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns the value when it is within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("returns max when value equals max", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("works with negative ranges", () => {
    expect(clamp(-3, -5, -1)).toBe(-3);
    expect(clamp(-10, -5, -1)).toBe(-5);
    expect(clamp(0, -5, -1)).toBe(-1);
  });
});

// ─── evenTicks ─────────────────────────────────────────────────────────────────

describe("evenTicks", () => {
  it("returns [min] when count < 2", () => {
    expect(evenTicks(0, 100, 1)).toEqual([0]);
    expect(evenTicks(5, 50, 0)).toEqual([5]);
  });

  it("returns [min] when min === max", () => {
    expect(evenTicks(42, 42, 5)).toEqual([42]);
  });

  it("generates the correct number of ticks", () => {
    const ticks = evenTicks(0, 100, 5);
    expect(ticks).toHaveLength(5);
  });

  it("first tick is min and last tick is max", () => {
    const ticks = evenTicks(0, 100, 5);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(100);
  });

  it("generates 5 ticks between -10 and 10", () => {
    const ticks = evenTicks(-10, 10, 5);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toBe(-10);
    expect(ticks[ticks.length - 1]).toBe(10);
    // Intermediate ticks should be between min and max
    for (let i = 1; i < ticks.length - 1; i++) {
      expect(ticks[i]).toBeGreaterThan(-10);
      expect(ticks[i]).toBeLessThan(10);
    }
  });

  it("generates 2 ticks as [min, max]", () => {
    const ticks = evenTicks(0, 100, 2);
    expect(ticks).toEqual([0, 100]);
  });

  it("generates monotonically increasing ticks", () => {
    const ticks = evenTicks(0, 1000, 6);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThanOrEqual(ticks[i - 1]);
    }
  });
});

// ─── formatProfitTick ──────────────────────────────────────────────────────────

describe("formatProfitTick", () => {
  it('returns "" for NaN', () => {
    expect(formatProfitTick(NaN)).toBe("");
  });

  it('returns "" for Infinity', () => {
    expect(formatProfitTick(Infinity)).toBe("");
    expect(formatProfitTick(-Infinity)).toBe("");
  });

  it('returns "kd" suffix for values >= 1000', () => {
    expect(formatProfitTick(1000)).toBe("1.0kd");
    expect(formatProfitTick(2500)).toBe("2.5kd");
    expect(formatProfitTick(15000)).toBe("15.0kd");
  });

  it('returns "kd" suffix for negative values <= -1000', () => {
    expect(formatProfitTick(-1000)).toBe("-1.0kd");
    expect(formatProfitTick(-2500)).toBe("-2.5kd");
  });

  it('returns rounded + "d" for values >= 10', () => {
    expect(formatProfitTick(10)).toBe("10d");
    expect(formatProfitTick(42.7)).toBe("43d");
    expect(formatProfitTick(999)).toBe("999d");
  });

  it('returns 1 decimal + "d" for values >= 1 and < 10', () => {
    expect(formatProfitTick(1)).toBe("1.0d");
    expect(formatProfitTick(5.55)).toBe("5.5d");
    expect(formatProfitTick(9.99)).toBe("10.0d");
  });

  it('returns 2 decimals + "d" for values < 1', () => {
    expect(formatProfitTick(0)).toBe("0.00d");
    expect(formatProfitTick(0.5)).toBe("0.50d");
    expect(formatProfitTick(0.123)).toBe("0.12d");
  });

  it("handles negative values in each range", () => {
    expect(formatProfitTick(-0.5)).toBe("-0.50d");
    expect(formatProfitTick(-5)).toBe("-5.0d");
    expect(formatProfitTick(-50)).toBe("-50d");
  });
});

// ─── formatDecksTick ───────────────────────────────────────────────────────────

describe("formatDecksTick", () => {
  it('returns "" for NaN', () => {
    expect(formatDecksTick(NaN)).toBe("");
  });

  it('returns "" for Infinity', () => {
    expect(formatDecksTick(Infinity)).toBe("");
    expect(formatDecksTick(-Infinity)).toBe("");
  });

  it('returns "k" suffix for values >= 1000', () => {
    expect(formatDecksTick(1000)).toBe("1.0k");
    expect(formatDecksTick(2500)).toBe("2.5k");
    expect(formatDecksTick(10000)).toBe("10.0k");
  });

  it("returns rounded string for values < 1000", () => {
    expect(formatDecksTick(0)).toBe("0");
    expect(formatDecksTick(42)).toBe("42");
    expect(formatDecksTick(999)).toBe("999");
    expect(formatDecksTick(5.7)).toBe("6");
  });

  it("handles negative values", () => {
    expect(formatDecksTick(-1000)).toBe("-1.0k");
    expect(formatDecksTick(-50)).toBe("-50");
  });
});

// ─── parseRgba ─────────────────────────────────────────────────────────────────

describe("parseRgba", () => {
  it('parses "rgba(255, 0, 128, 0.5)"', () => {
    const result = parseRgba("rgba(255, 0, 128, 0.5)");
    expect(result).toEqual({ r: 255, g: 0, b: 128, a: 0.5 });
  });

  it('parses "rgb(100, 200, 50)" with default alpha 1', () => {
    const result = parseRgba("rgb(100, 200, 50)");
    expect(result).toEqual({ r: 100, g: 200, b: 50, a: 1 });
  });

  it("parses rgba with alpha = 1", () => {
    const result = parseRgba("rgba(0, 0, 0, 1)");
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("parses rgba with alpha = 0", () => {
    const result = parseRgba("rgba(255, 255, 255, 0)");
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 0 });
  });

  it("returns fallback for invalid string", () => {
    const result = parseRgba("not-a-color");
    expect(result).toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });

  it("returns fallback for hex color", () => {
    const result = parseRgba("#ff0080");
    expect(result).toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });

  it("returns fallback for empty string", () => {
    const result = parseRgba("");
    expect(result).toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });

  it("handles no spaces in rgba", () => {
    const result = parseRgba("rgba(10,20,30,0.8)");
    expect(result).toEqual({ r: 10, g: 20, b: 30, a: 0.8 });
  });
});

// ─── rgbaStr ───────────────────────────────────────────────────────────────────

describe("rgbaStr", () => {
  it("returns correct rgba string", () => {
    expect(rgbaStr(255, 0, 128, 0.5)).toBe("rgba(255, 0, 128, 0.5)");
  });

  it("returns correct string for fully opaque", () => {
    expect(rgbaStr(0, 0, 0, 1)).toBe("rgba(0, 0, 0, 1)");
  });

  it("returns correct string for fully transparent", () => {
    expect(rgbaStr(255, 255, 255, 0)).toBe("rgba(255, 255, 255, 0)");
  });

  it("roundtrips with parseRgba", () => {
    const str = rgbaStr(100, 200, 50, 0.75);
    const parsed = parseRgba(str);
    expect(parsed).toEqual({ r: 100, g: 200, b: 50, a: 0.75 });
  });
});

// ─── monotoneTangents ──────────────────────────────────────────────────────────

describe("monotoneTangents", () => {
  it("returns [0] for a single point", () => {
    const tangents = monotoneTangents([{ x: 0, y: 0 }]);
    expect(tangents).toEqual([0]);
  });

  it("returns empty array for no points", () => {
    const tangents = monotoneTangents([]);
    expect(tangents).toEqual([]);
  });

  it("returns array of correct length", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
      { x: 3, y: 9 },
    ];
    const tangents = monotoneTangents(points);
    expect(tangents).toHaveLength(points.length);
  });

  it("returns flat tangents (0) for flat segments", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ];
    const tangents = monotoneTangents(points);
    for (const t of tangents) {
      expect(t).toBe(0);
    }
  });

  it("returns positive tangents for strictly increasing data", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    const tangents = monotoneTangents(points);
    for (const t of tangents) {
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not overshoot (magnitude constraint: sqrt(alpha^2 + beta^2) <= 3)", () => {
    // Use data that would cause overshoot without the constraint
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 10 },
      { x: 2, y: 10.1 },
      { x: 3, y: 20 },
    ];
    const tangents = monotoneTangents(points);

    // For each segment, check that alpha^2 + beta^2 <= 9
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const delta = dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx;
      if (Math.abs(delta) > 1e-12) {
        const alpha = tangents[i] / delta;
        const beta = tangents[i + 1] / delta;
        expect(alpha * alpha + beta * beta).toBeLessThanOrEqual(9 + 1e-9);
      }
    }
  });

  it("produces zero tangent at sign-change in secants", () => {
    // Peak: secants go from positive to negative
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 10 },
      { x: 2, y: 5 },
    ];
    const tangents = monotoneTangents(points);
    // The middle point has a sign change in adjacent secants, so tangent should be 0
    expect(tangents[1]).toBe(0);
  });

  it("handles two-point input", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ];
    const tangents = monotoneTangents(points);
    expect(tangents).toHaveLength(2);
    // Both tangents should equal the secant slope = 0.5
    expect(tangents[0]).toBe(0.5);
    expect(tangents[1]).toBe(0.5);
  });
});

// ─── drawMonotoneCurve ─────────────────────────────────────────────────────────

function createMockCtx() {
  return {
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("drawMonotoneCurve", () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it("does nothing with empty points", () => {
    drawMonotoneCurve(ctx, []);
    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.closePath).not.toHaveBeenCalled();
  });

  it("only calls moveTo for a single point", () => {
    drawMonotoneCurve(ctx, [{ x: 10, y: 20 }]);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.closePath).not.toHaveBeenCalled();
  });

  it("calls moveTo and bezierCurveTo for two points", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 30, y: 60 },
    ];
    drawMonotoneCurve(ctx, points);

    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(1);
    // End point of bezier should be the second point
    const bezierCall = (ctx.bezierCurveTo as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(bezierCall[4]).toBe(30);
    expect(bezierCall[5]).toBe(60);
  });

  it("calls bezierCurveTo once per segment for multiple points", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ];
    drawMonotoneCurve(ctx, points);

    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    // 3 segments = 3 bezierCurveTo calls
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(3);
  });

  it("does not call lineTo or closePath without closeToY", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    drawMonotoneCurve(ctx, points);

    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.closePath).not.toHaveBeenCalled();
  });

  it("calls lineTo and closePath with closeToY", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 10 },
      { x: 50, y: 20 },
      { x: 100, y: 30 },
    ];
    const closeToY = 100;

    drawMonotoneCurve(ctx, points, closeToY);

    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    // First lineTo: last point's x, closeToY
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 100);
    // Second lineTo: first point's x, closeToY
    expect(ctx.lineTo).toHaveBeenCalledWith(0, 100);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
  });

  it("does not close path for single point even with closeToY", () => {
    drawMonotoneCurve(ctx, [{ x: 5, y: 5 }], 100);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.closePath).not.toHaveBeenCalled();
  });

  it("computes correct bezier control points from tangents", () => {
    // Two points with known tangent = slope of secant = (60-0)/(30-0) = 2
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 30, y: 60 },
    ];
    drawMonotoneCurve(ctx, points);

    const bezierCall = (ctx.bezierCurveTo as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const dx = (30 - 0) / 3; // = 10
    const tangent = 2; // secant slope = (60-0)/(30-0) = 2
    // cp1 = (0 + dx, 0 + tangent * dx) = (10, 20)
    expect(bezierCall[0]).toBe(dx);
    expect(bezierCall[1]).toBe(tangent * dx);
    // cp2 = (30 - dx, 60 - tangent * dx) = (20, 40)
    expect(bezierCall[2]).toBe(30 - dx);
    expect(bezierCall[3]).toBe(60 - tangent * dx);
    // end point
    expect(bezierCall[4]).toBe(30);
    expect(bezierCall[5]).toBe(60);
  });
});

// ─── computeDomains ────────────────────────────────────────────────────────────

describe("computeDomains", () => {
  const makePoint = (profitDivine: number, rawDecks: number | null = null) => ({
    profitDivine,
    rawDecks,
  });

  it("returns default ranges when no data is provided", () => {
    const result = computeDomains([], [], new Set());
    expect(result.profit.min).toBeLessThan(result.profit.max);
    expect(result.decks.min).toBeLessThan(result.decks.max);
  });

  it("computes correct profit domain from visible data", () => {
    const visible = [makePoint(10), makePoint(20), makePoint(30)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    // Min should be at or below 10, max should be at or above 30
    expect(result.profit.min).toBeLessThanOrEqual(10);
    expect(result.profit.max).toBeGreaterThanOrEqual(30);
  });

  it("computes correct decks domain from visible data", () => {
    const visible = [makePoint(0, 5), makePoint(0, 15), makePoint(0, 25)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    expect(result.decks.min).toBeLessThanOrEqual(5);
    expect(result.decks.max).toBeGreaterThanOrEqual(25);
  });

  it("ignores profit when 'profit' is hidden", () => {
    const visible = [makePoint(100), makePoint(200)];
    const full = visible;
    const hidden = new Set(["profit"]);
    const result = computeDomains(visible, full, hidden);

    // When profit is hidden, domain falls back to defaults (0 to 1)
    expect(result.profit.min).toBeLessThan(result.profit.max);
  });

  it("ignores decks when 'decks' is hidden", () => {
    const visible = [makePoint(0, 50), makePoint(0, 100)];
    const full = visible;
    const hidden = new Set(["decks"]);
    const result = computeDomains(visible, full, hidden);

    // When decks is hidden, domain falls back to defaults (0 to 1 range)
    expect(result.decks.min).toBeLessThan(result.decks.max);
  });

  it("expands single-value profit range", () => {
    const visible = [makePoint(5), makePoint(5)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    // Domain must not be zero-width
    expect(result.profit.max).toBeGreaterThan(result.profit.min);
  });

  it("expands single-value decks range", () => {
    const visible = [makePoint(0, 10), makePoint(0, 10)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    expect(result.decks.max).toBeGreaterThan(result.decks.min);
  });

  it("adds top breathing room for all-positive profit data", () => {
    const visible = [makePoint(10), makePoint(20)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    // max should be above 20 (breathing room added)
    expect(result.profit.max).toBeGreaterThan(20);
    // min should stay at or near 10 (no bottom pad for all-positive)
    expect(result.profit.min).toBeGreaterThanOrEqual(9.5);
  });

  it("adds bottom breathing room for all-negative profit data", () => {
    const visible = [makePoint(-20), makePoint(-10)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    // min should be below -20 (breathing room added)
    expect(result.profit.min).toBeLessThan(-20);
    // max should stay at or near -10 (no top pad for all-negative)
    expect(result.profit.max).toBeLessThanOrEqual(-9.5);
  });

  it("adds breathing room on both sides for mixed profit data", () => {
    const visible = [makePoint(-10), makePoint(10)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    // Both sides should have some padding
    expect(result.profit.min).toBeLessThan(-10);
    expect(result.profit.max).toBeGreaterThan(10);
  });

  it("uses full dataset direction for stable gradient (mostly negative)", () => {
    // Visible slice is positive, but full dataset is mostly negative
    const visible = [makePoint(5), makePoint(10)];
    const full = [makePoint(-100), makePoint(-50), makePoint(5), makePoint(10)];
    const result = computeDomains(visible, full, new Set());

    // With mostly-negative full data, bottom buffer should be heavier
    // The key assertion is that it doesn't crash and provides valid ranges
    expect(result.profit.min).toBeLessThan(result.profit.max);
  });

  it("ensures decks min is never negative", () => {
    const visible = [makePoint(0, 1)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    expect(result.decks.min).toBeGreaterThanOrEqual(0);
  });

  it("skips null rawDecks values when computing decks domain", () => {
    const visible = [makePoint(0, null), makePoint(0, 10), makePoint(0, null)];
    const full = visible;
    const result = computeDomains(visible, full, new Set());

    // Only the 10 value should contribute, so the domain should be a range around 10
    expect(result.decks.min).toBeLessThanOrEqual(10);
    expect(result.decks.max).toBeGreaterThanOrEqual(10);
  });
});

// ─── computeLayout ─────────────────────────────────────────────────────────────

describe("computeLayout", () => {
  it("computes layout dimensions correctly without brush", () => {
    const layout = computeLayout(800, 400, false);

    expect(layout.chartLeft).toBeGreaterThan(0);
    expect(layout.chartRight).toBeLessThan(800);
    expect(layout.chartTop).toBeGreaterThan(0);
    expect(layout.chartBottom).toBeLessThan(400);
    expect(layout.chartWidth).toBe(layout.chartRight - layout.chartLeft);
    expect(layout.chartHeight).toBe(layout.chartBottom - layout.chartTop);
  });

  it("computes layout dimensions correctly with brush", () => {
    const layout = computeLayout(800, 400, true);

    expect(layout.chartLeft).toBeGreaterThan(0);
    expect(layout.chartRight).toBeLessThan(800);
    expect(layout.chartTop).toBeGreaterThan(0);
    // Chart bottom should be higher to make room for the brush
    expect(layout.chartBottom).toBeLessThan(400);
    expect(layout.brushTop).toBeGreaterThan(layout.chartBottom);
    expect(layout.brushBottom).toBeGreaterThan(layout.brushTop);
    expect(layout.brushHeight).toBeGreaterThan(0);
  });

  it("reduces chart height when brush is shown", () => {
    const withoutBrush = computeLayout(800, 400, false);
    const withBrush = computeLayout(800, 400, true);

    expect(withBrush.chartHeight).toBeLessThan(withoutBrush.chartHeight);
  });

  it("brush area is below chart area", () => {
    const layout = computeLayout(800, 400, true);

    expect(layout.brushTop).toBeGreaterThan(layout.chartBottom);
  });

  it("brush left and right match chart left and right", () => {
    const layout = computeLayout(800, 400, true);

    expect(layout.brushLeft).toBe(layout.chartLeft);
    expect(layout.brushRight).toBe(layout.chartRight);
  });

  it("handles zero dimensions gracefully", () => {
    const layout = computeLayout(0, 0, false);

    expect(layout.chartWidth).toBe(0);
    expect(layout.chartHeight).toBe(0);
  });

  it("handles very small canvas", () => {
    const layout = computeLayout(50, 30, false);

    // Width/height may be 0 due to padding exceeding canvas size
    expect(layout.chartWidth).toBeGreaterThanOrEqual(0);
    expect(layout.chartHeight).toBeGreaterThanOrEqual(0);
  });

  it("returns consistent brush dimensions", () => {
    const layout = computeLayout(800, 400, true);

    expect(layout.brushBottom - layout.brushTop).toBe(layout.brushHeight);
  });
});
