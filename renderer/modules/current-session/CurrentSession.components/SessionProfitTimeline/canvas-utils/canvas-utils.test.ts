// ─── Tests for canvas-utils.ts ──────────────────────────────────────────────

import type { LinePoint, ProfitChartPoint } from "../types/types";
import {
  BAR_COLOR,
  buildPixelSpline,
  computeTimelineDomains,
  computeTimelineLayout,
  drawBars,
  drawHoverHighlight,
  drawProfitLine,
  drawTimelineGrid,
} from "./canvas-utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockContext(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 30 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    // properties
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "left",
    textBaseline: "top",
    globalCompositeOperation: "source-over",
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Build a minimal `TimelineDrawContext` from the given layout and domains.
 * mapX/mapY perform simple linear interpolation from domain to pixel coords.
 */
function createDrawContext(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof computeTimelineLayout>,
  domains: ReturnType<typeof computeTimelineDomains>,
) {
  const mapX = (value: number): number => {
    const range = domains.x.max - domains.x.min;
    if (range === 0) return layout.chartLeft;
    return (
      layout.chartLeft + ((value - domains.x.min) / range) * layout.chartWidth
    );
  };
  const mapY = (value: number): number => {
    const range = domains.y.max - domains.y.min;
    if (range === 0) return layout.chartTop;
    return (
      layout.chartBottom -
      ((value - domains.y.min) / range) * layout.chartHeight
    );
  };
  return { ctx, layout, domains, mapX, mapY };
}

function makeLinePoint(x: number, profit: number): LinePoint {
  return { x, profit };
}

function makeChartPoint(
  x: number,
  profit: number,
  barValue: number | null = null,
  cardName: string | null = null,
  rarity: 1 | 2 | 3 | null = null,
): ProfitChartPoint {
  return { x, profit, barValue, cardName, rarity };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("canvas-utils", () => {
  // ── computeTimelineLayout ───────────────────────────────────────────────

  describe("computeTimelineLayout", () => {
    // The constants from the source are:
    // AXIS_PADDING_LEFT   = 55
    // AXIS_PADDING_RIGHT  = 15
    // AXIS_PADDING_TOP    = 10
    // AXIS_PADDING_BOTTOM = 24

    it("should compute chart area with correct padding", () => {
      const layout = computeTimelineLayout(800, 400);

      expect(layout.chartLeft).toBe(55);
      expect(layout.chartRight).toBe(800 - 15);
      expect(layout.chartTop).toBe(10);
      expect(layout.chartBottom).toBe(400 - 24);
      expect(layout.chartWidth).toBe(800 - 15 - 55);
      expect(layout.chartHeight).toBe(400 - 24 - 10);
    });

    it("should handle zero dimensions", () => {
      const layout = computeTimelineLayout(0, 0);

      expect(layout.chartLeft).toBe(55);
      expect(layout.chartRight).toBe(-15);
      expect(layout.chartTop).toBe(10);
      expect(layout.chartBottom).toBe(-24);
      // chartWidth and chartHeight are clamped to 0 via Math.max(0, ...)
      expect(layout.chartWidth).toBe(0);
      expect(layout.chartHeight).toBe(0);
    });

    it("should handle very small dimensions", () => {
      const layout = computeTimelineLayout(60, 30);

      expect(layout.chartLeft).toBe(55);
      expect(layout.chartRight).toBe(60 - 15);
      expect(layout.chartTop).toBe(10);
      expect(layout.chartBottom).toBe(30 - 24);
      // chartRight(45) - chartLeft(55) = -10 → clamped to 0
      expect(layout.chartWidth).toBe(0);
      // chartBottom(6) - chartTop(10) = -4 → clamped to 0
      expect(layout.chartHeight).toBe(0);
    });

    it("should handle large dimensions", () => {
      const layout = computeTimelineLayout(3840, 2160);

      expect(layout.chartWidth).toBe(3840 - 15 - 55);
      expect(layout.chartHeight).toBe(2160 - 24 - 10);
      expect(layout.chartWidth).toBeGreaterThan(0);
      expect(layout.chartHeight).toBeGreaterThan(0);
    });
  });

  // ── computeTimelineDomains ────────────────────────────────────────────

  describe("computeTimelineDomains", () => {
    it("should return default domains for empty data", () => {
      const domains = computeTimelineDomains([], []);

      expect(domains.x.min).toBe(0);
      expect(domains.x.max).toBe(1); // at least 1
      expect(domains.y.min).toBe(-1);
      expect(domains.y.max).toBe(1);
    });

    it("should compute symmetric Y domain around 0", () => {
      const linePoints = [makeLinePoint(0, 0), makeLinePoint(10, 50)];
      const domains = computeTimelineDomains(linePoints, []);

      // absMax = 50, padded = 55
      expect(domains.y.min).toBe(-domains.y.max);
      expect(domains.y.max).toBeCloseTo(55);
    });

    it("should apply 10% padding to Y domain", () => {
      const linePoints = [makeLinePoint(0, -100), makeLinePoint(10, 100)];
      const domains = computeTimelineDomains(linePoints, []);

      // absMax = 100, padded = 110
      expect(domains.y.max).toBeCloseTo(110);
      expect(domains.y.min).toBeCloseTo(-110);
    });

    it("should handle all-positive profits", () => {
      const linePoints = [
        makeLinePoint(0, 10),
        makeLinePoint(5, 30),
        makeLinePoint(10, 20),
      ];
      const domains = computeTimelineDomains(linePoints, []);

      // absMax = 30, padded = 33
      expect(domains.y.max).toBeCloseTo(33);
      expect(domains.y.min).toBeCloseTo(-33);
      expect(domains.x.max).toBe(10);
    });

    it("should handle all-negative profits", () => {
      const linePoints = [
        makeLinePoint(0, -10),
        makeLinePoint(5, -50),
        makeLinePoint(10, -30),
      ];
      const domains = computeTimelineDomains(linePoints, []);

      // absMax = 50, padded = 55
      expect(domains.y.max).toBeCloseTo(55);
      expect(domains.y.min).toBeCloseTo(-55);
    });

    it("should handle mixed positive/negative profits", () => {
      const linePoints = [
        makeLinePoint(0, -20),
        makeLinePoint(5, 80),
        makeLinePoint(10, -10),
      ];
      const domains = computeTimelineDomains(linePoints, []);

      // absMax = 80, padded = 88
      expect(domains.y.max).toBeCloseTo(88);
      expect(domains.y.min).toBeCloseTo(-88);
    });

    it("should handle single line point", () => {
      const linePoints = [makeLinePoint(5, 42)];
      const domains = computeTimelineDomains(linePoints, []);

      // x.max = max(5, 1) = 5
      expect(domains.x.max).toBe(5);
      // absMax = 42, padded = 46.2
      expect(domains.y.max).toBeCloseTo(46.2);
      expect(domains.y.min).toBeCloseTo(-46.2);
    });

    it("should include chartData bar values in Y domain", () => {
      const linePoints = [makeLinePoint(0, 0), makeLinePoint(10, 20)];
      const chartData = [makeChartPoint(5, 10, 100, "Mirror", 3)];
      const domains = computeTimelineDomains(linePoints, chartData);

      // barValue=100 is larger than profit=20, so absMax=100, padded=110
      expect(domains.y.max).toBeCloseTo(110);
      expect(domains.y.min).toBeCloseTo(-110);
    });

    it("should handle chartData with null barValue", () => {
      const linePoints = [makeLinePoint(0, 0), makeLinePoint(10, 50)];
      const chartData = [makeChartPoint(5, 25, null, null, null)];
      const domains = computeTimelineDomains(linePoints, chartData);

      // null barValues should not affect the domain; absMax = 50, padded = 55
      expect(domains.y.max).toBeCloseTo(55);
      expect(domains.y.min).toBeCloseTo(-55);
    });

    it("should handle zero-range data (all same value)", () => {
      const linePoints = [
        makeLinePoint(0, 0),
        makeLinePoint(5, 0),
        makeLinePoint(10, 0),
      ];
      const domains = computeTimelineDomains(linePoints, []);

      // absMax=0, paddedAbsMax = 100 (fallback)
      expect(domains.y.max).toBe(100);
      expect(domains.y.min).toBe(-100);
    });

    it("should use the larger of last linePoint.x and last chartData.x for xMax", () => {
      const linePoints = [makeLinePoint(0, 0), makeLinePoint(20, 10)];
      const chartData = [makeChartPoint(50, 5, 10, "Card", 1)];
      const domains = computeTimelineDomains(linePoints, chartData);

      expect(domains.x.max).toBe(50);
    });

    it("should use at least 1 for xMax even if all x values are 0", () => {
      const linePoints = [makeLinePoint(0, 10)];
      const chartData = [makeChartPoint(0, 5, 2, "Card", 1)];
      const domains = computeTimelineDomains(linePoints, chartData);

      expect(domains.x.max).toBe(1);
    });

    it("should handle negative bar values", () => {
      const linePoints = [makeLinePoint(0, 0), makeLinePoint(10, 5)];
      const chartData = [makeChartPoint(5, 3, -200, "Bad Drop", 1)];
      const domains = computeTimelineDomains(linePoints, chartData);

      // absMax = 200, padded = 220
      expect(domains.y.max).toBeCloseTo(220);
      expect(domains.y.min).toBeCloseTo(-220);
    });

    it("should use only chartData when linePoints is empty", () => {
      const chartData = [
        makeChartPoint(10, 30, 60, "Card", 2),
        makeChartPoint(20, 50, 80, "Card2", 3),
      ];
      const domains = computeTimelineDomains([], chartData);

      // bar values 60 and 80 → absMax=80, padded=88
      expect(domains.x.max).toBe(20);
      expect(domains.y.max).toBeCloseTo(88);
    });
  });

  // ── drawTimelineGrid ──────────────────────────────────────────────────

  describe("drawTimelineGrid", () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it("should draw grid lines and axis labels", () => {
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, -100), makeLinePoint(1000, 100)],
        [],
      );
      const dc = createDrawContext(ctx, layout, domains);
      const formatYTick = vi.fn((v: number) => `${v}c`);

      drawTimelineGrid(dc, formatYTick);

      // Should have called stroke for grid lines
      expect(ctx.stroke).toHaveBeenCalled();
      // Should have called fillText for axis labels
      expect(ctx.fillText).toHaveBeenCalled();
      // setLineDash called for dashed grid lines
      expect(ctx.setLineDash).toHaveBeenCalled();
      // formatYTick should have been called for each Y-axis tick
      expect(formatYTick).toHaveBeenCalled();
    });

    it("should draw break-even line at y=0", () => {
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, -50), makeLinePoint(100, 50)],
        [],
      );
      const dc = createDrawContext(ctx, layout, domains);
      const formatYTick = vi.fn((v: number) => `${v}`);

      drawTimelineGrid(dc, formatYTick);

      // Should draw "Break-even" text
      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock
        .calls;
      const breakEvenCall = fillTextCalls.find(
        (call: unknown[]) => call[0] === "Break-even",
      );
      expect(breakEvenCall).toBeDefined();
    });

    it("should not draw break-even line when y=0 is outside chart area", () => {
      const layout = computeTimelineLayout(800, 400);
      // Create domains where 0 is well within range — the symmetric domain
      // always includes 0, so we test with a domain that always has 0 visible.
      // Actually, with symmetric domains, zero is always at the center. Let's
      // just verify the break-even IS drawn in normal cases (covered above)
      // and create a scenario where mapY(0) would fall outside the chart.
      const dc = createDrawContext(ctx, layout, {
        x: { min: 0, max: 100 },
        // Both positive — zero maps below chartBottom
        y: { min: 10, max: 100 },
      });
      const formatYTick = vi.fn((v: number) => `${v}`);

      drawTimelineGrid(dc, formatYTick);

      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock
        .calls;
      const breakEvenCall = fillTextCalls.find(
        (call: unknown[]) => call[0] === "Break-even",
      );
      expect(breakEvenCall).toBeUndefined();
    });

    it("should draw X-axis tick labels", () => {
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(5000, 100)],
        [],
      );
      const dc = createDrawContext(ctx, layout, domains);
      const formatYTick = vi.fn((v: number) => `${v}`);

      drawTimelineGrid(dc, formatYTick);

      // X-axis labels should include formatted drop counts
      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock
        .calls;
      // The x-axis ticks range from 0 to 5000 — "5.0k" should appear
      const hasFormattedXLabel = fillTextCalls.some(
        (call: unknown[]) =>
          typeof call[0] === "string" && /\dk/.test(call[0] as string),
      );
      expect(hasFormattedXLabel).toBe(true);
    });
  });

  // ── drawProfitLine ────────────────────────────────────────────────────

  describe("drawProfitLine", () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it("should not draw with fewer than 2 line points", () => {
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains([], []);
      const dc = createDrawContext(ctx, layout, domains);

      const splineEmpty = buildPixelSpline(dc, []);
      drawProfitLine(dc, splineEmpty, "#ff0", "#ff03", "#ff00");
      expect(ctx.beginPath).not.toHaveBeenCalled();

      const splineSingle = buildPixelSpline(dc, [makeLinePoint(0, 10)]);
      drawProfitLine(dc, splineSingle, "#ff0", "#ff03", "#ff00");
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it("should draw line and gradient fill for valid points", () => {
      const linePoints = [
        makeLinePoint(0, 0),
        makeLinePoint(50, 30),
        makeLinePoint(100, -10),
      ];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(linePoints, []);
      const dc = createDrawContext(ctx, layout, domains);
      const spline = buildPixelSpline(dc, linePoints);

      drawProfitLine(dc, spline, "#4CAF50", "#4CAF5030", "#4CAF5002");

      // Should save and restore context
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      // Should create gradient
      expect(ctx.createLinearGradient).toHaveBeenCalled();
      // Should clip to chart area
      expect(ctx.rect).toHaveBeenCalled();
      expect(ctx.clip).toHaveBeenCalled();
      // Should fill (area) and stroke (line)
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it("should set correct stroke style and line width", () => {
      const linePoints = [makeLinePoint(0, 0), makeLinePoint(100, 50)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(linePoints, []);
      const dc = createDrawContext(ctx, layout, domains);
      const spline = buildPixelSpline(dc, linePoints);

      drawProfitLine(dc, spline, "#FF5722", "#FF572230", "#FF572202");

      expect(ctx.strokeStyle).toBe("#FF5722");
      expect(ctx.lineWidth).toBe(2);
    });
  });

  // ── drawBars ──────────────────────────────────────────────────────────

  describe("drawBars", () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it("should draw bars for chart data with non-zero barValues", () => {
      const chartData = [
        makeChartPoint(10, 20, 50, "Mirror of Kalandra", 3),
        makeChartPoint(30, 40, 80, "Mageblood", 3),
      ];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(50, 100)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawBars(dc, chartData);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.clip).toHaveBeenCalled();
      expect(ctx.fillStyle).toBe(BAR_COLOR);
      // Should call fillRect once per bar
      expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    });

    it("should skip data points with null barValue", () => {
      const chartData = [
        makeChartPoint(10, 20, null, null, null),
        makeChartPoint(30, 40, 60, "Card", 2),
        makeChartPoint(50, 60, null, null, null),
      ];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(50, 80)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawBars(dc, chartData);

      // Only 1 bar has a non-null barValue
      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    });

    it("should not draw anything with empty chart data", () => {
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(10, 10)],
        [],
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawBars(dc, []);

      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it("should handle negative barValues (bars going downward)", () => {
      const chartData = [makeChartPoint(10, -20, -50, "Bad card", 1)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(20, -50)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawBars(dc, chartData);

      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
      // Verify the bar height is positive (Math.abs)
      const [, , , h] = (ctx.fillRect as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(h).toBeGreaterThanOrEqual(0);
    });

    it("should draw bars with correct width (BAR_WIDTH = 4)", () => {
      const chartData = [makeChartPoint(20, 30, 60, "Card", 2)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(40, 60)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawBars(dc, chartData);

      // Third argument to fillRect is the width, should be BAR_WIDTH = 4
      const [, , w] = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(w).toBe(4);
    });
  });

  // ── drawHoverHighlight ────────────────────────────────────────────────

  describe("drawHoverHighlight", () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it("should draw hover effects for valid index", () => {
      const chartData = [
        makeChartPoint(10, 20, 50, "Mirror", 3),
        makeChartPoint(30, 40, 80, "Mageblood", 3),
      ];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(50, 100)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawHoverHighlight(dc, chartData, 0, "#4CAF50");

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      // Vertical dashed guideline
      expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);
      expect(ctx.stroke).toHaveBeenCalled();
      // Circle on the profit line
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it("should handle out-of-bounds index gracefully (negative)", () => {
      const chartData = [makeChartPoint(10, 20, 50, "Mirror", 3)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(20, 50)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawHoverHighlight(dc, chartData, -1, "#fff");

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it("should handle out-of-bounds index gracefully (too large)", () => {
      const chartData = [makeChartPoint(10, 20, 50, "Mirror", 3)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(20, 50)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawHoverHighlight(dc, chartData, 5, "#fff");

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it("should handle null hoverIndex", () => {
      const chartData = [makeChartPoint(10, 20, 50, "Mirror", 3)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(20, 50)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawHoverHighlight(dc, chartData, null, "#fff");

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it("should draw circle with correct color", () => {
      const chartData = [makeChartPoint(10, 20, 50, "Mirror", 3)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(20, 50)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawHoverHighlight(dc, chartData, 0, "#E91E63");

      // The fillStyle should be set to the primary color for the circle
      // Note: after arc + fill, fillStyle should be set to the primaryColor
      expect(ctx.fillStyle).toBe("#E91E63");
    });

    it("should draw vertical guideline across full chart height", () => {
      const chartData = [makeChartPoint(50, 30, 60, "Card", 2)];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(100, 60)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawHoverHighlight(dc, chartData, 0, "#fff");

      // moveTo and lineTo should be called for the vertical line
      const moveToArgs = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      const lineToArgs = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;

      // The guideline goes from chartTop to chartBottom
      // Find the call that uses layout.chartTop
      const guidelineMove = moveToArgs.find(
        (call: number[]) => call[1] === layout.chartTop,
      );
      const guidelineLine = lineToArgs.find(
        (call: number[]) => call[1] === layout.chartBottom,
      );

      expect(guidelineMove).toBeDefined();
      expect(guidelineLine).toBeDefined();
    });

    it("should handle hover on last index", () => {
      const chartData = [
        makeChartPoint(10, 20, 50, "Card1", 1),
        makeChartPoint(30, 40, 70, "Card2", 2),
        makeChartPoint(50, 60, 90, "Card3", 3),
      ];
      const layout = computeTimelineLayout(800, 400);
      const domains = computeTimelineDomains(
        [makeLinePoint(0, 0), makeLinePoint(60, 90)],
        chartData,
      );
      const dc = createDrawContext(ctx, layout, domains);

      drawHoverHighlight(dc, chartData, 2, "#fff");

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  // ── BAR_COLOR export ──────────────────────────────────────────────────

  describe("BAR_COLOR", () => {
    it("should be a valid rgba string", () => {
      expect(BAR_COLOR).toBe("rgba(255, 255, 255, 0.85)");
    });
  });
});
