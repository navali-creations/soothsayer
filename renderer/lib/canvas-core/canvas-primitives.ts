// ─── Types ──────────────────────────────────────────────────────────────────

export interface SplinePoint {
  x: number;
  y: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Device pixel ratio, falling back to 1. */
export const DPR = () => window.devicePixelRatio || 1;

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate evenly-spaced nice tick values between `min` and `max`.
 * Intermediate ticks are rounded to a pleasant sub-step.
 */
export function evenTicks(min: number, max: number, count: number): number[] {
  if (count < 2) return [min];
  if (min === max) return [min];

  const step = (max - min) / (count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(Math.abs(step)));
  const roundTo = magnitude > 0 ? magnitude / 2 : 0.1;

  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      ticks.push(min);
    } else if (i === count - 1) {
      ticks.push(max);
    } else {
      const raw = min + step * i;
      const rounded = Math.round(raw / roundTo) * roundTo;
      const decimals = Math.max(
        0,
        -Math.floor(Math.log10(Math.abs(roundTo)) + 0.0001),
      );
      ticks.push(parseFloat(rounded.toFixed(decimals)));
    }
  }
  return ticks;
}

// ─── Canvas Color Utilities ─────────────────────────────────────────────────

/** Parse a CSS rgba/rgb color string into its components. */
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

/** Build an rgba() CSS color string from components. */
export function rgbaStr(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ─── Monotone Cubic Spline ──────────────────────────────────────────────────

/**
 * Compute per-point tangents using the Fritsch-Carlson method.
 * Ensures the resulting cubic interpolation preserves local monotonicity.
 */
export function monotoneTangents(points: SplinePoint[]): number[] {
  const n = points.length;
  if (n < 2) return new Array(n).fill(0);

  // Step 1: secants
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
      m[i] = 0;
    } else {
      m[i] = (deltas[i - 1] + deltas[i]) / 2;
    }
  }

  // Step 3: Fritsch-Carlson monotonicity conditions
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(deltas[i]) < 1e-12) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / deltas[i];
      const beta = m[i + 1] / deltas[i];
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
 * Evaluate the Y value of a monotone cubic spline at a given X.
 *
 * Uses the same spline construction as `drawMonotoneCurve` so the returned
 * Y sits exactly on the rendered curve. Points must be sorted by ascending X.
 *
 * Returns `undefined` when `points` has fewer than 2 entries or `x` is
 * outside the point range.
 */
export function evaluateMonotoneCurveY(
  points: SplinePoint[],
  x: number,
  precomputedTangents?: number[],
): number | undefined {
  const n = points.length;
  if (n < 2) return points.length === 1 ? points[0].y : undefined;

  // Clamp to endpoints
  if (x <= points[0].x) return points[0].y;
  if (x >= points[n - 1].x) return points[n - 1].y;

  // Find the segment [i, i+1] that contains x
  let seg = 0;
  for (let i = 0; i < n - 1; i++) {
    if (x >= points[i].x && x <= points[i + 1].x) {
      seg = i;
      break;
    }
  }

  const p0 = points[seg];
  const p1 = points[seg + 1];
  const segWidth = p1.x - p0.x;
  if (segWidth === 0) return p0.y;

  // Parameter t ∈ [0, 1] within this segment
  const t = (x - p0.x) / segWidth;

  // Reuse caller-supplied tangents when available to avoid redundant O(n) work
  const tangents = precomputedTangents ?? monotoneTangents(points);
  const dx = segWidth / 3;

  const cp1y = p0.y + tangents[seg] * dx;
  const cp2y = p1.y - tangents[seg + 1] * dx;

  // De Casteljau / cubic Bézier evaluation:  B(t) = (1-t)³·P0 + 3(1-t)²t·CP1 + 3(1-t)t²·CP2 + t³·P1
  const mt = 1 - t;
  return (
    mt * mt * mt * p0.y +
    3 * mt * mt * t * cp1y +
    3 * mt * t * t * cp2y +
    t * t * t * p1.y
  );
}

/**
 * Draw a monotone cubic spline path through the given points.
 *
 * Only adds path segments — the caller must call `beginPath()` before and
 * `stroke()` / `fill()` after.
 *
 * If `closeToY` is provided the path will be closed as a filled area toward
 * that Y coordinate (e.g. the pixel Y of value 0).
 */
export function drawMonotoneCurve(
  ctx: CanvasRenderingContext2D,
  points: SplinePoint[],
  closeToY?: number,
  precomputedTangents?: number[],
): void {
  const n = points.length;
  if (n === 0) return;

  if (n === 1) {
    ctx.moveTo(points[0].x, points[0].y);
    return;
  }

  const tangents = precomputedTangents ?? monotoneTangents(points);

  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;

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

// ─── Canvas Setup Helpers ───────────────────────────────────────────────────

/**
 * Set up a canvas context for high-DPI drawing and clear it.
 * Returns the logical (CSS-pixel) width and height, or null if the context
 * is unavailable.
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
): { ctx: CanvasRenderingContext2D; width: number; height: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = DPR();
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  return { ctx, width: w, height: h };
}

// ─── Linear Mapper Factory ──────────────────────────────────────────────────

/** Forward and inverse linear mapping functions. */
export interface LinearMapper {
  /** Map a value from the domain to the range (e.g., data value → pixel). */
  (value: number): number;
  /** Map a value from the range back to the domain (e.g., pixel → data value). */
  inverse: (pixel: number) => number;
}

/**
 * Create a pair of linear mapping functions between a domain and a range.
 *
 * The forward function maps `domain → range`.
 * The `.inverse` property maps `range → domain`.
 *
 * For Y-axes where the mapping is inverted (data increases upward but pixels
 * increase downward), pass `rangeMin > rangeMax` (e.g., `rangeMin = chartBottom`,
 * `rangeMax = chartTop`).
 *
 * @example
 * ```ts
 * const mapX = createLinearMapper(0, 100, chartLeft, chartRight);
 * mapX(50);          // → pixel midpoint
 * mapX.inverse(px);  // → data value at that pixel
 * ```
 */
export function createLinearMapper(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): LinearMapper {
  const domainSpan = domainMax - domainMin || 1;
  const rangeSpan = rangeMax - rangeMin;

  const forward = ((value: number): number => {
    const frac = (value - domainMin) / domainSpan;
    return rangeMin + frac * rangeSpan;
  }) as LinearMapper;

  forward.inverse = (pixel: number): number => {
    const frac = (pixel - rangeMin) / (rangeSpan || 1);
    return domainMin + frac * domainSpan;
  };

  return forward;
}

// ─── Shared Layout Interface ────────────────────────────────────────────────

/**
 * Base chart area layout — the pixel bounds of the drawable chart region.
 *
 * Both the Combined chart (`ChartLayout`) and the Timeline chart
 * (`TimelineLayout`) are supersets of this interface.
 */
export interface ChartAreaLayout {
  chartLeft: number;
  chartRight: number;
  chartTop: number;
  chartBottom: number;
  chartWidth: number;
  chartHeight: number;
}

// ─── Base Draw Context ──────────────────────────────────────────────────────

/**
 * Minimal draw context shared by all canvas chart components.
 *
 * Specific charts extend this with additional fields (e.g., colors,
 * hidden metrics, extra Y-axis mappers, domains).
 */
export interface BaseDrawContext {
  ctx: CanvasRenderingContext2D;
  layout: ChartAreaLayout;
  mapX: (value: number) => number;
  mapY: (value: number) => number;
}

// ─── Hit-Test Utility ───────────────────────────────────────────────────────

/** Result of a nearest-point hit test. */
export interface HitTestResult {
  /** Index of the nearest point in the input array, or -1 if nothing matched. */
  index: number;
  /** Pixel distance to the nearest point. */
  distance: number;
}

/**
 * Find the nearest data point to a given pixel X coordinate.
 *
 * Performs a linear scan over `points`, calling `toPixelX(point, index)`
 * to obtain the pixel X position for each point. Returns the index of the
 * nearest point whose distance is within `threshold` pixels, or `{ index: -1 }`
 * if nothing is close enough.
 *
 * @param cursorX    - The cursor X position in canvas CSS pixels.
 * @param points     - Array of data points.
 * @param toPixelX   - Function mapping a data point + index to pixel X.
 * @param threshold  - Maximum snap distance in pixels (default: 20).
 * @param filter     - Optional predicate to skip ineligible points (e.g., bars-only).
 *
 * @example
 * ```ts
 * const result = nearestPointHitTest(cx, chartData, (pt) => mapX(pt.x), 20);
 * if (result.index >= 0) { ... }
 * ```
 */
export function nearestPointHitTest<T>(
  cursorX: number,
  points: readonly T[],
  toPixelX: (point: T, index: number) => number,
  threshold = 20,
  filter?: (point: T, index: number) => boolean,
): HitTestResult {
  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < points.length; i++) {
    if (filter && !filter(points[i], i)) continue;

    const px = toPixelX(points[i], i);
    const dist = Math.abs(cursorX - px);

    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0 && bestDist <= threshold) {
    return { index: bestIndex, distance: bestDist };
  }

  return { index: -1, distance: Infinity };
}
