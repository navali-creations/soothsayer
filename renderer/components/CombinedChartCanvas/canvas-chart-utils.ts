import type { BrushRange } from "./chart-types";

// ─── Constants ─────────────────────────────────────────────────────────────────

export const MIN_ZOOM_WINDOW = 5;
export const ZOOM_STEP = 3;
export const BRUSH_HEIGHT = 26;
export const BRUSH_TRAVELLER_WIDTH = 8;
export const AXIS_PADDING_LEFT = 45;
export const AXIS_PADDING_RIGHT = 50;
export const AXIS_PADDING_TOP = 12;
export const AXIS_PADDING_BOTTOM = 20;
export const BRUSH_GAP = 4;
export const TICK_COUNT = 5;
/** Extra pixels to extend clip rect so dots at min/max aren't cut */
export const CLIP_BLEED = 6;
export const DOT_RADIUS = 3;
export const ACTIVE_DOT_RADIUS = 3;
export const TOOLTIP_OFFSET_X = 12;
export const TOOLTIP_OFFSET_Y = 12;
export const TOOLTIP_WIDTH = 220;
export const TOOLTIP_HEIGHT = 80;
export const TOOLTIP_MARGIN = 4;
export const DPR = () => window.devicePixelRatio || 1;

// ─── Types & Interfaces ───────────────────────────────────────────────────────

export interface SplinePoint {
  x: number;
  y: number;
}

export type DragMode =
  | { type: "none" }
  | { type: "brush-left" }
  | { type: "brush-right" }
  | { type: "brush-pan"; startMouseX: number; startRange: BrushRange }
  | { type: "chart-pan"; startMouseX: number; startRange: BrushRange };

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function evenTicks(min: number, max: number, count: number): number[] {
  if (count < 2) return [min];
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  // Round to 1–2 significant digits based on step size
  const magnitude = 10 ** Math.floor(Math.log10(Math.abs(step)));
  const roundTo = magnitude > 0 ? magnitude / 2 : 0.1;
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      ticks.push(min);
    } else if (i === count - 1) {
      ticks.push(max);
    } else {
      // Round intermediate ticks to nearest nice value
      const raw = min + step * i;
      const rounded = Math.round(raw / roundTo) * roundTo;
      // Determine display precision from roundTo
      const decimals = Math.max(
        0,
        -Math.floor(Math.log10(Math.abs(roundTo)) + 0.0001),
      );
      ticks.push(parseFloat(rounded.toFixed(decimals)));
    }
  }
  return ticks;
}

export function formatProfitTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}kd`;
  if (Math.abs(value) >= 10) return `${Math.round(value)}d`;
  if (Math.abs(value) >= 1) return `${value.toFixed(1)}d`;
  return `${value.toFixed(2)}d`;
}

export function formatDecksTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

// Parse a CSS color string to extract rgba components for canvas usage
export function parseRgba(color: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/,
  );
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    };
  }
  return { r: 128, g: 128, b: 128, a: 1 };
}

export function rgbaStr(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ─── Monotone Cubic Spline ─────────────────────────────────────────────────────

/**
 * Given an array of (x, y) points sorted by x, compute per-point tangents
 * using the Fritsch-Carlson method. Returns an array of tangent slopes (m_k).
 */
export function monotoneTangents(points: SplinePoint[]): number[] {
  const n = points.length;
  if (n < 2) return new Array(n).fill(0);

  // Step 1: compute secants (deltas)
  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    deltas.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }

  // Step 2: initial tangents as average of adjacent secants
  const m: number[] = new Array(n);
  m[0] = deltas[0];
  m[n - 1] = deltas[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      // Sign change or zero — flat tangent to preserve monotonicity
      m[i] = 0;
    } else {
      m[i] = (deltas[i - 1] + deltas[i]) / 2;
    }
  }

  // Step 3: ensure monotonicity (Fritsch-Carlson conditions)
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(deltas[i]) < 1e-12) {
      // Flat segment
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / deltas[i];
      const beta = m[i + 1] / deltas[i];
      // Restrict to circle of radius 3 to prevent overshoot
      const mag = Math.sqrt(alpha * alpha + beta * beta);
      if (mag > 3) {
        const tau = 3 / mag;
        m[i] = tau * alpha * deltas[i];
        m[i + 1] = tau * beta * deltas[i];
      }
    }
  }

  return m;
}

/**
 * Draw a monotone cubic spline path through the given points onto a
 * canvas context. Only adds path segments — caller must call beginPath()
 * before and stroke()/fill() after.
 *
 * If `closeToY` is provided, after drawing the curve it will lineTo that
 * Y coordinate at the right and left edges so the path can be filled as an area.
 * Use this to close toward zero, chartBottom, chartTop, etc.
 */
export function drawMonotoneCurve(
  ctx: CanvasRenderingContext2D,
  points: SplinePoint[],
  closeToY?: number, // y coordinate to close the area path toward
): void {
  const n = points.length;
  if (n === 0) return;

  if (n === 1) {
    ctx.moveTo(points[0].x, points[0].y);
    return;
  }

  const tangents = monotoneTangents(points);

  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;

    // Cubic Bézier control points derived from Hermite tangents
    const cp1x = p0.x + dx;
    const cp1y = p0.y + tangents[i] * dx;
    const cp2x = p1.x - dx;
    const cp2y = p1.y - tangents[i + 1] * dx;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
  }

  if (closeToY !== undefined) {
    ctx.lineTo(points[n - 1].x, closeToY);
    ctx.lineTo(points[0].x, closeToY);
    ctx.closePath();
  }
}

// ─── Domain & Layout Computation ───────────────────────────────────────────────

export interface ChartDomains {
  profit: { min: number; max: number };
  decks: { min: number; max: number };
}

export function computeDomains(
  visibleData: ReadonlyArray<{ profitDivine: number; rawDecks: number | null }>,
  fullData: ReadonlyArray<{ profitDivine: number }>,
  hiddenMetrics: Set<string>,
): ChartDomains {
  let profitMin = Infinity;
  let profitMax = -Infinity;
  let decksMin = Infinity;
  let decksMax = -Infinity;

  for (const pt of visibleData) {
    if (!hiddenMetrics.has("profit")) {
      if (pt.profitDivine < profitMin) profitMin = pt.profitDivine;
      if (pt.profitDivine > profitMax) profitMax = pt.profitDivine;
    }
    if (!hiddenMetrics.has("decks") && pt.rawDecks !== null) {
      if (pt.rawDecks < decksMin) decksMin = pt.rawDecks;
      if (pt.rawDecks > decksMax) decksMax = pt.rawDecks;
    }
  }

  // If no data, provide defaults
  if (profitMin === Infinity) {
    profitMin = 0;
    profitMax = 1;
  }
  if (decksMin === Infinity) {
    decksMin = 0;
    decksMax = 1;
  }

  // For single-value cases, create a meaningful range around the value
  if (profitMin === profitMax) {
    const v = profitMin;
    profitMin = v === 0 ? -1 : v - Math.abs(v) * 0.5;
    profitMax = v === 0 ? 1 : v + Math.abs(v) * 0.5;
  }
  if (decksMin === decksMax) {
    const v = decksMin;
    decksMin = Math.max(0, v === 0 ? 0 : v - Math.abs(v) * 0.5);
    decksMax = v === 0 ? 10 : v + Math.abs(v) * 0.5;
  }

  // Determine overall profit direction from full dataset for stable buffer
  let totalProfitSum = 0;
  for (const pt of fullData) {
    totalProfitSum += pt.profitDivine;
  }

  // Add breathing room so the line doesn't stick to the edge it's pressing against.
  // Positive data → buffer on top (ceiling). Negative data → buffer on bottom (floor).
  // Mixed → buffer on both sides.
  const profitRange = profitMax - profitMin;
  const decksRange = decksMax - decksMin;
  const profitPad = profitRange * 0.08;
  const decksPadTop = decksRange * 0.08;

  const allNegative = profitMax <= 0;
  const allPositive = profitMin >= 0;

  let pMin = profitMin;
  let pMax = profitMax;

  if (allNegative) {
    // Data is all negative — buffer on the bottom so the lowest point breathes
    pMin = profitMin - profitPad;
  } else if (allPositive) {
    // Data is all positive — buffer on the top so the highest point breathes
    pMax = profitMax + profitPad;
  } else if (totalProfitSum < 0) {
    // Mixed but mostly negative — heavier buffer on bottom, light on top
    pMin = profitMin - profitPad;
    pMax = profitMax + profitPad * 0.3;
  } else {
    // Mixed but mostly positive — heavier buffer on top, light on bottom
    pMin = profitMin - profitPad * 0.3;
    pMax = profitMax + profitPad;
  }

  return {
    profit: {
      min: pMin,
      max: pMax,
    },
    decks: {
      min: Math.max(0, decksMin),
      max: decksMax + decksPadTop,
    },
  };
}

export interface ChartLayout {
  chartLeft: number;
  chartRight: number;
  chartTop: number;
  chartBottom: number;
  chartWidth: number;
  chartHeight: number;
  brushTop: number;
  brushBottom: number;
  brushLeft: number;
  brushRight: number;
  brushHeight: number;
}

export function computeLayout(
  canvasWidth: number,
  canvasHeight: number,
  showBrush: boolean,
): ChartLayout {
  const brushH = showBrush ? BRUSH_HEIGHT + BRUSH_GAP : 0;
  const chartLeft = AXIS_PADDING_LEFT;
  const chartRight = canvasWidth - AXIS_PADDING_RIGHT;
  const chartTop = AXIS_PADDING_TOP;
  const chartBottom = canvasHeight - AXIS_PADDING_BOTTOM - brushH;
  const chartWidth = Math.max(0, chartRight - chartLeft);
  const chartHeight = Math.max(0, chartBottom - chartTop);

  const brushTop = canvasHeight - BRUSH_HEIGHT - 4;
  const brushBottom = brushTop + BRUSH_HEIGHT;
  const brushLeft = chartLeft;
  const brushRight = chartRight;

  return {
    chartLeft,
    chartRight,
    chartTop,
    chartBottom,
    chartWidth,
    chartHeight,
    brushTop,
    brushBottom,
    brushLeft,
    brushRight,
    brushHeight: BRUSH_HEIGHT,
  };
}
