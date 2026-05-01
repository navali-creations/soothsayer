import { describe, expect, it, vi } from "vitest";

import {
  clamp,
  createLinearMapper,
  DPR,
  drawDonutIndicator,
  drawMonotoneCurve,
  evaluateMonotoneCurveY,
  evenTicks,
  monotoneTangents,
  nearestPointHitTest,
  parseRgba,
  rgbaStr,
  type SplinePoint,
  setupCanvas,
} from "./canvas-primitives";

// ─── Mock canvas context ────────────────────────────────────────────────────

function mockCtx(): CanvasRenderingContext2D {
  return {
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

// ─── DPR ────────────────────────────────────────────────────────────────────

describe("DPR", () => {
  const originalDPR = window.devicePixelRatio;

  it("returns window.devicePixelRatio when set", () => {
    Object.defineProperty(window, "devicePixelRatio", {
      value: 2,
      configurable: true,
    });
    expect(DPR()).toBe(2);
    Object.defineProperty(window, "devicePixelRatio", {
      value: originalDPR,
      configurable: true,
    });
  });

  it("returns 1 when devicePixelRatio is 0", () => {
    Object.defineProperty(window, "devicePixelRatio", {
      value: 0,
      configurable: true,
    });
    expect(DPR()).toBe(1);
    Object.defineProperty(window, "devicePixelRatio", {
      value: originalDPR,
      configurable: true,
    });
  });
});

// ─── clamp ──────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns value when in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("handles equal min and max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it("handles negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  it("handles floating point values", () => {
    expect(clamp(0.5, 0.1, 0.9)).toBeCloseTo(0.5);
    expect(clamp(0.05, 0.1, 0.9)).toBeCloseTo(0.1);
  });
});

// ─── evenTicks ──────────────────────────────────────────────────────────────

describe("evenTicks", () => {
  it("returns [min] when count < 2", () => {
    expect(evenTicks(0, 100, 1)).toEqual([0]);
  });

  it("returns [min] when min === max", () => {
    expect(evenTicks(5, 5, 5)).toEqual([5]);
  });

  it("returns correct number of ticks", () => {
    const ticks = evenTicks(0, 100, 5);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(100);
  });

  it("first and last ticks equal min and max", () => {
    const ticks = evenTicks(-50, 50, 4);
    expect(ticks[0]).toBe(-50);
    expect(ticks[ticks.length - 1]).toBe(50);
  });

  it("produces monotonically increasing values", () => {
    const ticks = evenTicks(0, 1000, 6);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });

  it("handles negative range", () => {
    const ticks = evenTicks(-100, -10, 3);
    expect(ticks[0]).toBe(-100);
    expect(ticks[ticks.length - 1]).toBe(-10);
    expect(ticks).toHaveLength(3);
  });
});

// ─── parseRgba / rgbaStr ────────────────────────────────────────────────────

describe("parseRgba", () => {
  it("parses rgba string", () => {
    expect(parseRgba("rgba(255, 128, 0, 0.5)")).toEqual({
      r: 255,
      g: 128,
      b: 0,
      a: 0.5,
    });
  });

  it("parses rgb string (defaults alpha to 1)", () => {
    expect(parseRgba("rgb(100, 200, 50)")).toEqual({
      r: 100,
      g: 200,
      b: 50,
      a: 1,
    });
  });

  it("returns fallback for invalid string", () => {
    expect(parseRgba("not-a-color")).toEqual({ r: 128, g: 128, b: 128, a: 1 });
  });
});

describe("rgbaStr", () => {
  it("produces correct rgba string", () => {
    expect(rgbaStr(255, 0, 128, 0.7)).toBe("rgba(255, 0, 128, 0.7)");
  });

  it("handles full opacity", () => {
    expect(rgbaStr(0, 0, 0, 1)).toBe("rgba(0, 0, 0, 1)");
  });
});

describe("drawDonutIndicator", () => {
  it("draws a filled circle with a stroked ring", () => {
    const ctx = mockCtx();

    drawDonutIndicator(ctx, 10, 20, {
      fillStyle: "#00ffff",
      strokeStyle: "rgba(255, 255, 255, 0.9)",
    });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, 4, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

// ─── monotoneTangents ───────────────────────────────────────────────────────

describe("monotoneTangents", () => {
  it("returns empty array for empty points", () => {
    expect(monotoneTangents([])).toEqual([]);
  });

  it("returns [0] for single point", () => {
    expect(monotoneTangents([{ x: 0, y: 0 }])).toEqual([0]);
  });

  it("returns correct tangents for two points", () => {
    const tangents = monotoneTangents([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(tangents).toHaveLength(2);
    expect(tangents[0]).toBe(1); // slope = 1
    expect(tangents[1]).toBe(1);
  });

  it("produces flat tangent at sign change", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ];
    const tangents = monotoneTangents(points);
    // Middle point has sign change in secants → tangent = 0
    expect(tangents[1]).toBe(0);
  });

  it("respects Fritsch-Carlson magnitude constraint", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 10 },
      { x: 2, y: 10.1 },
      { x: 3, y: 20 },
    ];
    const tangents = monotoneTangents(points);
    // For each segment, alpha^2 + beta^2 should be <= 9
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const delta = dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx;
      if (Math.abs(delta) > 1e-12) {
        const alpha = tangents[i] / delta;
        const beta = tangents[i + 1] / delta;
        expect(alpha * alpha + beta * beta).toBeLessThanOrEqual(9 + 1e-10);
      }
    }
  });
});

// ─── drawMonotoneCurve ──────────────────────────────────────────────────────

describe("drawMonotoneCurve", () => {
  it("does nothing for empty points", () => {
    const ctx = mockCtx();
    drawMonotoneCurve(ctx, []);
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it("moves to single point", () => {
    const ctx = mockCtx();
    drawMonotoneCurve(ctx, [{ x: 5, y: 10 }]);
    expect(ctx.moveTo).toHaveBeenCalledWith(5, 10);
    expect(ctx.bezierCurveTo).not.toHaveBeenCalled();
  });

  it("draws bezier curves for multiple points", () => {
    const ctx = mockCtx();
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
    ];
    drawMonotoneCurve(ctx, points);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(2);
  });

  it("closes path when closeToY is provided", () => {
    const ctx = mockCtx();
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ];
    drawMonotoneCurve(ctx, points, 200);
    expect(ctx.lineTo).toHaveBeenCalledWith(100, 200);
    expect(ctx.lineTo).toHaveBeenCalledWith(0, 200);
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it("does not close path when closeToY is omitted", () => {
    const ctx = mockCtx();
    drawMonotoneCurve(ctx, [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ]);
    expect(ctx.closePath).not.toHaveBeenCalled();
  });
});

// ─── evaluateMonotoneCurveY ─────────────────────────────────────────────────

describe("evaluateMonotoneCurveY", () => {
  it("returns undefined for empty points", () => {
    expect(evaluateMonotoneCurveY([], 5)).toBeUndefined();
  });

  it("returns the single point's Y for a one-point array", () => {
    expect(evaluateMonotoneCurveY([{ x: 10, y: 42 }], 10)).toBe(42);
    expect(evaluateMonotoneCurveY([{ x: 10, y: 42 }], 999)).toBe(42);
  });

  it("returns exact Y at knot points", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 50 },
    ];
    expect(evaluateMonotoneCurveY(points, 0)).toBe(0);
    expect(evaluateMonotoneCurveY(points, 50)).toBe(100);
    expect(evaluateMonotoneCurveY(points, 100)).toBe(50);
  });

  it("clamps to first point when x is before range", () => {
    const points: SplinePoint[] = [
      { x: 10, y: 20 },
      { x: 50, y: 80 },
    ];
    expect(evaluateMonotoneCurveY(points, -100)).toBe(20);
    expect(evaluateMonotoneCurveY(points, 10)).toBe(20);
  });

  it("clamps to last point when x is after range", () => {
    const points: SplinePoint[] = [
      { x: 10, y: 20 },
      { x: 50, y: 80 },
    ];
    expect(evaluateMonotoneCurveY(points, 50)).toBe(80);
    expect(evaluateMonotoneCurveY(points, 999)).toBe(80);
  });

  it("interpolates between two points (linear segment)", () => {
    // Two points → spline degenerates to a straight line
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const mid = evaluateMonotoneCurveY(points, 50);
    expect(mid).toBeCloseTo(50, 5);
  });

  it("produces monotone values for monotone input", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 25, y: 30 },
      { x: 50, y: 60 },
      { x: 75, y: 80 },
      { x: 100, y: 100 },
    ];
    let prev = evaluateMonotoneCurveY(points, 0)!;
    for (let x = 5; x <= 100; x += 5) {
      const y = evaluateMonotoneCurveY(points, x)!;
      expect(y).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = y;
    }
  });

  it("returns values between neighboring knot Y values", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 40 },
    ];
    // Between x=0 and x=50, Y should be between 0 and 100
    const y25 = evaluateMonotoneCurveY(points, 25)!;
    expect(y25).toBeGreaterThanOrEqual(0);
    expect(y25).toBeLessThanOrEqual(100);

    // Between x=50 and x=100, Y should be between 40 and 100
    const y75 = evaluateMonotoneCurveY(points, 75)!;
    expect(y75).toBeGreaterThanOrEqual(40);
    expect(y75).toBeLessThanOrEqual(100);
  });

  it("handles zero-width segment gracefully", () => {
    const points: SplinePoint[] = [
      { x: 0, y: 10 },
      { x: 0, y: 20 },
      { x: 100, y: 50 },
    ];
    // Should not throw or return NaN
    const y = evaluateMonotoneCurveY(points, 0);
    expect(y).toBeDefined();
    expect(Number.isNaN(y)).toBe(false);
  });

  it("matches drawMonotoneCurve at midpoints (consistency check)", () => {
    // Record what bezierCurveTo receives from drawMonotoneCurve, then
    // verify evaluateMonotoneCurveY produces the same Y at the segment midpoint.
    const points: SplinePoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 200 },
      { x: 200, y: 50 },
    ];

    // For the first segment midpoint x=50, evaluate the Bézier manually
    // using the control points that drawMonotoneCurve would produce.
    const ctx = {
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    drawMonotoneCurve(ctx, points);

    // First bezierCurveTo call: segment [0]->[1]
    const call = (ctx.bezierCurveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const [_cp1x, cp1y, _cp2x, cp2y, _p1x, p1y] = call;
    const _p0x = points[0].x;
    const p0y = points[0].y;

    // Evaluate cubic Bézier at t=0.5 for x=50 (midpoint of segment)
    const t = 0.5;
    const mt = 0.5;
    const expectedY =
      mt * mt * mt * p0y +
      3 * mt * mt * t * cp1y +
      3 * mt * t * t * cp2y +
      t * t * t * p1y;

    const actualY = evaluateMonotoneCurveY(points, 50)!;
    expect(actualY).toBeCloseTo(expectedY, 5);
  });
});

// ─── setupCanvas ────────────────────────────────────────────────────────────

describe("setupCanvas", () => {
  it("returns null when getContext returns null", () => {
    const canvas = {
      getContext: vi.fn(() => null),
      width: 200,
      height: 100,
    } as unknown as HTMLCanvasElement;
    expect(setupCanvas(canvas)).toBeNull();
  });

  it("sets transform and clears canvas", () => {
    const ctx = mockCtx();
    const originalDPR = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      value: 2,
      configurable: true,
    });

    const canvas = {
      getContext: vi.fn(() => ctx),
      width: 400,
      height: 200,
    } as unknown as HTMLCanvasElement;

    const result = setupCanvas(canvas);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(200); // 400 / 2
    expect(result!.height).toBe(100); // 200 / 2
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 200, 100);

    Object.defineProperty(window, "devicePixelRatio", {
      value: originalDPR,
      configurable: true,
    });
  });
});

// ─── createLinearMapper ─────────────────────────────────────────────────────

describe("createLinearMapper", () => {
  it("maps domain min to range min", () => {
    const mapper = createLinearMapper(0, 100, 50, 550);
    expect(mapper(0)).toBe(50);
  });

  it("maps domain max to range max", () => {
    const mapper = createLinearMapper(0, 100, 50, 550);
    expect(mapper(100)).toBe(550);
  });

  it("maps domain midpoint to range midpoint", () => {
    const mapper = createLinearMapper(0, 100, 0, 500);
    expect(mapper(50)).toBe(250);
  });

  it("handles inverted range (Y-axis)", () => {
    // Y-axis: data increases upward, pixels increase downward
    const mapper = createLinearMapper(0, 100, 500, 0);
    expect(mapper(0)).toBe(500); // domain min → range min (bottom)
    expect(mapper(100)).toBe(0); // domain max → range max (top)
    expect(mapper(50)).toBe(250); // midpoint
  });

  it("handles negative domain", () => {
    const mapper = createLinearMapper(-50, 50, 0, 1000);
    expect(mapper(-50)).toBe(0);
    expect(mapper(0)).toBe(500);
    expect(mapper(50)).toBe(1000);
  });

  it("handles zero-width domain (defaults to span of 1)", () => {
    const mapper = createLinearMapper(5, 5, 100, 200);
    // domainSpan = 0 → falls back to 1
    expect(mapper(5)).toBe(100);
  });

  describe("inverse", () => {
    it("round-trips forward then inverse", () => {
      const mapper = createLinearMapper(0, 100, 50, 550);
      for (const v of [0, 25, 50, 75, 100]) {
        expect(mapper.inverse(mapper(v))).toBeCloseTo(v, 10);
      }
    });

    it("round-trips inverse then forward", () => {
      const mapper = createLinearMapper(0, 100, 50, 550);
      for (const px of [50, 175, 300, 425, 550]) {
        expect(mapper(mapper.inverse(px))).toBeCloseTo(px, 10);
      }
    });

    it("round-trips with inverted range", () => {
      const mapper = createLinearMapper(-100, 100, 400, 0);
      for (const v of [-100, -50, 0, 50, 100]) {
        expect(mapper.inverse(mapper(v))).toBeCloseTo(v, 10);
      }
    });

    it("round-trips with negative domain", () => {
      const mapper = createLinearMapper(-200, -100, 0, 500);
      for (const v of [-200, -175, -150, -125, -100]) {
        expect(mapper.inverse(mapper(v))).toBeCloseTo(v, 10);
      }
    });

    it("inverse of range min is domain min", () => {
      const mapper = createLinearMapper(10, 90, 100, 900);
      expect(mapper.inverse(100)).toBeCloseTo(10, 10);
    });

    it("inverse of range max is domain max", () => {
      const mapper = createLinearMapper(10, 90, 100, 900);
      expect(mapper.inverse(900)).toBeCloseTo(90, 10);
    });
  });
});

// ─── nearestPointHitTest ────────────────────────────────────────────────────

describe("nearestPointHitTest", () => {
  const points = [
    { x: 10, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
  ];

  const toPixelX = (pt: { x: number }) => pt.x; // identity mapping

  it("finds the nearest point within threshold", () => {
    const result = nearestPointHitTest(52, points, toPixelX, 20);
    expect(result.index).toBe(1); // closest to x=50
    expect(result.distance).toBe(2);
  });

  it("returns index -1 when nothing is within threshold", () => {
    const result = nearestPointHitTest(160, points, toPixelX, 10);
    expect(result.index).toBe(-1);
    expect(result.distance).toBe(Infinity);
  });

  it("returns index -1 for empty array", () => {
    const result = nearestPointHitTest(50, [], toPixelX, 20);
    expect(result.index).toBe(-1);
  });

  it("snaps to exact position", () => {
    const result = nearestPointHitTest(100, points, toPixelX, 20);
    expect(result.index).toBe(2);
    expect(result.distance).toBe(0);
  });

  it("picks nearest when equidistant (first wins)", () => {
    // Cursor at 30 — equidistant from 10 (dist=20) and 50 (dist=20)
    const result = nearestPointHitTest(30, points, toPixelX, 20);
    expect(result.index).toBe(0); // first one found
  });

  it("respects filter predicate", () => {
    // Filter out points at index 1 (x=50) — nearest should be index 2 (x=100)
    const result = nearestPointHitTest(
      55,
      points,
      toPixelX,
      50,
      (_pt, i) => i !== 1,
    );
    expect(result.index).toBe(0); // x=10 is dist 45, x=100 is dist 45 — first wins
  });

  it("filters all points → returns -1", () => {
    const result = nearestPointHitTest(50, points, toPixelX, 100, () => false);
    expect(result.index).toBe(-1);
  });

  it("uses custom toPixelX mapping", () => {
    const data = [{ value: 0 }, { value: 1 }, { value: 2 }];
    // Map value to pixel: value * 100
    const result = nearestPointHitTest(195, data, (pt) => pt.value * 100, 20);
    expect(result.index).toBe(2); // value=2 → pixel 200, dist=5
    expect(result.distance).toBe(5);
  });

  it("works with default threshold of 20", () => {
    const result = nearestPointHitTest(69, points, toPixelX);
    // Nearest is x=50, dist=19 → within default threshold of 20
    expect(result.index).toBe(1);
  });

  it("rejects at exactly threshold + 1", () => {
    const result = nearestPointHitTest(71, points, toPixelX, 20);
    // Nearest is x=50, dist=21 → outside threshold
    expect(result.index).toBe(-1);
  });

  it("accepts at exactly threshold", () => {
    const result = nearestPointHitTest(70, points, toPixelX, 20);
    // Nearest is x=50, dist=20 → exactly at threshold
    expect(result.index).toBe(1);
  });
});
