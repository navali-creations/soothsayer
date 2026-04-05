// ─── Canvas drawing utilities for Session Profit Timeline ───────────────────
//
// All domain computation, layout, and canvas-rendering logic for the
// session profit timeline chart. The chart shows cumulative profit (Y) vs
// cumulative deck count (X) with a monotone cubic spline profit line and
// vertical bars at notable drop positions.
//
// Performance: hot-path drawing functions accept pre-computed pixel points
// and tangents so that the expensive O(n) work (mapping + Fritsch-Carlson)
// happens exactly once per frame, not 3–4 times.

import {
  clamp,
  drawMonotoneCurve,
  evaluateMonotoneCurveY,
  evenTicks,
  monotoneTangents,
  type SplinePoint,
} from "~/renderer/lib/canvas-core";

import type { LinePoint, ProfitChartPoint } from "../types/types";

// ─── Layout & Drawing Types ─────────────────────────────────────────────────

export interface TimelineLayout {
  chartLeft: number;
  chartRight: number;
  chartTop: number;
  chartBottom: number;
  chartWidth: number;
  chartHeight: number;
}

interface TimelineDomains {
  x: { min: number; max: number };
  y: { min: number; max: number };
}

interface TimelineDrawContext {
  ctx: CanvasRenderingContext2D;
  layout: TimelineLayout;
  domains: TimelineDomains;
  mapX: (value: number) => number;
  mapY: (value: number) => number;
}

/**
 * Pre-computed spline data for the profit line.
 *
 * Built once per draw frame via `buildPixelSpline` and threaded through
 * every function that needs the profit curve, eliminating redundant
 * `.map()` allocations and `monotoneTangents` recomputations.
 */
export interface PixelSpline {
  /** Line points mapped to pixel coordinates (reusable buffer — do NOT hold a reference across frames). */
  points: SplinePoint[];
  /** Fritsch-Carlson tangents for `points`. */
  tangents: number[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AXIS_PADDING_LEFT = 55;
const AXIS_PADDING_RIGHT = 15;
const AXIS_PADDING_TOP = 10;
const AXIS_PADDING_BOTTOM = 24;
const BAR_WIDTH = 4;
const TICK_COUNT = 5;
export const BAR_COLOR = "rgba(255, 255, 255, 0.85)";
const GRID_DASH: number[] = [3, 3];
const ZERO_LINE_DASH: number[] = [4, 4];
const NO_DASH: number[] = [];

// ─── Module-level gradient cache ────────────────────────────────────────────

let _cachedGradient: CanvasGradient | null = null;
let _gradientKey = "";

// ─── Module-level reusable buffer ───────────────────────────────────────────
// Avoids per-frame `.map()` allocations. Resized in-place when the point
// count changes; individual entries are mutated, never replaced.

const _pixelBuf: SplinePoint[] = [];

// ─── Private Helpers ────────────────────────────────────────────────────────

/**
 * Format a drop count for the X-axis tick labels.
 * ≥ 10 000 → "Xk", ≥ 1 000 → "X.Xk", otherwise integer.
 */
function formatDropCountTick(count: number): string {
  if (count >= 10000) return `${(count / 1000).toFixed(0)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toFixed(0);
}

// ─── Layout ─────────────────────────────────────────────────────────────────

/**
 * Compute the chart drawing area given the logical canvas dimensions.
 */
export function computeTimelineLayout(
  width: number,
  height: number,
): TimelineLayout {
  const chartLeft = AXIS_PADDING_LEFT;
  const chartRight = width - AXIS_PADDING_RIGHT;
  const chartTop = AXIS_PADDING_TOP;
  const chartBottom = height - AXIS_PADDING_BOTTOM;
  const chartWidth = Math.max(0, chartRight - chartLeft);
  const chartHeight = Math.max(0, chartBottom - chartTop);

  return {
    chartLeft,
    chartRight,
    chartTop,
    chartBottom,
    chartWidth,
    chartHeight,
  };
}

// ─── Domains ────────────────────────────────────────────────────────────────

/**
 * Compute axis domains from the line-curve points and bar data.
 *
 * X domain: 0 → max(lastLinePoint.x, lastChartData.x), at least 1.
 * Y domain: covers both line values AND bar values, with 10 % padding,
 *           and always includes 0.
 */
export function computeTimelineDomains(
  linePoints: LinePoint[],
  chartData: ProfitChartPoint[],
): TimelineDomains {
  // ── X domain ──────────────────────────────────────────────────────────
  const lastLineX =
    linePoints.length > 0 ? linePoints[linePoints.length - 1].x : 0;
  const lastDataX =
    chartData.length > 0 ? chartData[chartData.length - 1].x : 0;
  const xMax = Math.max(lastLineX, lastDataX, 1);

  // ── Y domain ──────────────────────────────────────────────────────────
  let rawMin = 0;
  let rawMax = 0;
  let hasValues = false;

  for (let i = 0; i < linePoints.length; i++) {
    const v = linePoints[i].profit;
    if (v < rawMin) rawMin = v;
    if (v > rawMax) rawMax = v;
    hasValues = true;
  }

  for (let i = 0; i < chartData.length; i++) {
    const v = chartData[i].barValue;
    if (v != null) {
      if (v < rawMin) rawMin = v;
      if (v > rawMax) rawMax = v;
      hasValues = true;
    }
  }

  if (!hasValues) {
    return {
      x: { min: 0, max: xMax },
      y: { min: -1, max: 1 },
    };
  }

  // Symmetric domain around zero so the break-even line is always centered
  const absMax = Math.max(Math.abs(rawMin), Math.abs(rawMax));
  const paddedAbsMax = absMax > 0 ? absMax * 1.1 : 100;

  return {
    x: { min: 0, max: xMax },
    y: { min: -paddedAbsMax, max: paddedAbsMax },
  };
}

// ─── Pixel Spline Builder ───────────────────────────────────────────────────

/**
 * Map `linePoints` to pixel space and compute spline tangents.
 *
 * Returns a `PixelSpline` whose `.points` array is a **module-level
 * reusable buffer** — callers must NOT hold a reference across frames.
 * This eliminates the per-frame `.map()` allocation that was previously
 * the largest source of GC pressure on the draw path.
 *
 * Tangents are computed exactly once and shared by `drawProfitLine`,
 * `drawHoverHighlight`, and any future consumer.
 */
export function buildPixelSpline(
  dc: TimelineDrawContext,
  linePoints: LinePoint[],
): PixelSpline {
  const n = linePoints.length;

  // Resize the reusable buffer — grow by appending, shrink by truncating.
  // Existing entries are mutated in-place; new entries are created once and
  // then reused on subsequent frames.
  if (_pixelBuf.length < n) {
    for (let i = _pixelBuf.length; i < n; i++) {
      _pixelBuf.push({ x: 0, y: 0 });
    }
  } else if (_pixelBuf.length > n) {
    _pixelBuf.length = n;
  }

  for (let i = 0; i < n; i++) {
    const pt = linePoints[i];
    const entry = _pixelBuf[i];
    entry.x = dc.mapX(pt.x);
    entry.y = dc.mapY(pt.profit);
  }

  const tangents = n >= 2 ? monotoneTangents(_pixelBuf) : [];

  return { points: _pixelBuf, tangents };
}

// ─── Drawing Functions ──────────────────────────────────────────────────────

/**
 * Draw the background grid, axis labels, tick marks, and break-even reference.
 *
 * @param formatYTick - Caller-provided formatter for Y-axis values (e.g.
 *   chaos → divine string).
 */
export function drawTimelineGrid(
  dc: TimelineDrawContext,
  formatYTick: (value: number) => string,
): void {
  const { ctx, layout, domains } = dc;

  const gridColor = "rgba(255, 255, 255, 0.08)";
  const zeroLineColor = "rgba(255, 255, 255, 0.15)";
  const labelColor = "rgba(255, 255, 255, 0.35)";

  ctx.font = "10px system-ui";
  ctx.textBaseline = "middle";

  // ── Y-axis ticks & horizontal grid lines ──────────────────────────────
  const yTicks = evenTicks(domains.y.min, domains.y.max, TICK_COUNT);

  for (const tick of yTicks) {
    const py = dc.mapY(tick);

    // Horizontal dashed grid line
    ctx.beginPath();
    ctx.setLineDash(GRID_DASH);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.moveTo(layout.chartLeft, py);
    ctx.lineTo(layout.chartRight, py);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);

    // Tick label
    ctx.fillStyle = labelColor;
    ctx.textAlign = "right";
    ctx.fillText(formatYTick(tick), layout.chartLeft - 6, py);
  }

  // ── Zero reference line ───────────────────────────────────────────────
  const zeroY = dc.mapY(0);
  if (zeroY >= layout.chartTop && zeroY <= layout.chartBottom) {
    ctx.beginPath();
    ctx.setLineDash(ZERO_LINE_DASH);
    ctx.strokeStyle = zeroLineColor;
    ctx.lineWidth = 1;
    ctx.moveTo(layout.chartLeft, zeroY);
    ctx.lineTo(layout.chartRight, zeroY);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);

    // "Break-even" label on the right side
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "9px system-ui";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("Break-even", layout.chartRight - 4, zeroY - 3);
    // Restore font
    ctx.font = "10px system-ui";
    ctx.textBaseline = "middle";
  }

  // ── X-axis ticks ──────────────────────────────────────────────────────
  const xTicks = evenTicks(domains.x.min, domains.x.max, TICK_COUNT);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = labelColor;

  for (const tick of xTicks) {
    const px = dc.mapX(tick);
    ctx.fillText(formatDropCountTick(tick), px, layout.chartBottom + 6);
  }
}

/**
 * Draw the profit line as a monotone cubic spline with a gradient area fill
 * between the line and the zero baseline.
 *
 * Accepts a pre-built `PixelSpline` so that pixel-mapping and tangent
 * computation happen exactly once per frame (in `buildPixelSpline`).
 */
export function drawProfitLine(
  dc: TimelineDrawContext,
  spline: PixelSpline,
  primaryColor: string,
  primaryColor30: string,
  primaryColor02: string,
): void {
  const { points: pixelPoints, tangents } = spline;
  if (pixelPoints.length < 2) return;

  const { ctx, layout } = dc;

  // The Y pixel where value = 0 sits (clamped to chart area)
  const zeroPixelY = clamp(dc.mapY(0), layout.chartTop, layout.chartBottom);

  // ── Area fill (line → zero baseline) ──────────────────────────────────
  const gradKey = `${layout.chartTop}:${layout.chartBottom}:${primaryColor30}:${primaryColor02}`;
  if (_gradientKey !== gradKey || !_cachedGradient) {
    _cachedGradient = ctx.createLinearGradient(
      0,
      layout.chartTop,
      0,
      layout.chartBottom,
    );
    _cachedGradient.addColorStop(0, primaryColor30);
    _cachedGradient.addColorStop(1, primaryColor02);
    _gradientKey = gradKey;
  }

  ctx.save();
  ctx.beginPath();
  // Clip to chart area
  ctx.rect(
    layout.chartLeft,
    layout.chartTop,
    layout.chartWidth,
    layout.chartHeight,
  );
  ctx.clip();

  ctx.beginPath();
  drawMonotoneCurve(ctx, pixelPoints, zeroPixelY, tangents);
  ctx.fillStyle = _cachedGradient;
  ctx.fill();

  // ── Stroke line ───────────────────────────────────────────────────────
  ctx.beginPath();
  drawMonotoneCurve(ctx, pixelPoints, undefined, tangents);
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw vertical bars at notable drop positions. Each bar extends from y = 0
 * to y = barValue.
 */
export function drawBars(
  dc: TimelineDrawContext,
  chartData: ProfitChartPoint[],
): void {
  const { ctx, layout } = dc;
  const zeroPixelY = clamp(dc.mapY(0), layout.chartTop, layout.chartBottom);
  const halfBar = BAR_WIDTH / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    layout.chartLeft,
    layout.chartTop,
    layout.chartWidth,
    layout.chartHeight,
  );
  ctx.clip();

  ctx.fillStyle = BAR_COLOR;

  for (let i = 0; i < chartData.length; i++) {
    const pt = chartData[i];
    if (pt.barValue == null) continue;

    const px = dc.mapX(pt.x);
    const barTopY = dc.mapY(pt.barValue);

    const x = px - halfBar;
    const y = Math.min(barTopY, zeroPixelY);
    const h = Math.abs(barTopY - zeroPixelY);

    ctx.fillRect(x, y, BAR_WIDTH, h);
  }

  ctx.restore();
}

/**
 * Draw hover highlight on a bar: vertical dashed guideline + circle on the
 * profit line at the hovered X position.
 *
 * The circle's Y position is evaluated on the actual monotone cubic spline
 * (via the pre-built `PixelSpline`) so it sits precisely on the rendered
 * curve. Uses pre-computed tangents — zero redundant work.
 */
export function drawHoverHighlight(
  dc: TimelineDrawContext,
  chartData: ProfitChartPoint[],
  hoverIndex: number | null,
  primaryColor: string,
  spline?: PixelSpline,
): void {
  if (hoverIndex == null || hoverIndex < 0 || hoverIndex >= chartData.length)
    return;

  const { ctx, layout } = dc;
  const pt = chartData[hoverIndex];
  const px = dc.mapX(pt.x);

  // Prefer the true spline Y; fall back to the chartData profit value.
  let profitPy: number;
  if (spline && spline.points.length >= 2) {
    const splineY = evaluateMonotoneCurveY(spline.points, px, spline.tangents);
    profitPy = splineY ?? dc.mapY(pt.profit);
  } else {
    profitPy = dc.mapY(pt.profit);
  }

  ctx.save();

  // ── Vertical dashed guideline ─────────────────────────────────────────
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.moveTo(px, layout.chartTop);
  ctx.lineTo(px, layout.chartBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Circle on the profit line ─────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(px, profitPy, 4, 0, Math.PI * 2);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}
