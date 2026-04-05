import { memo, useCallback, useEffect, useRef } from "react";

import {
  clamp,
  drawMonotoneCurve,
  setupCanvas,
  useCanvasResize,
} from "~/renderer/lib/canvas-core";
import type { LinePoint } from "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/types/types";

// ─── Default sparkline colors ───────────────────────────────────────────────
const DEFAULT_LINE_COLOR = "rgba(0, 210, 211, 0.5)";

// ─── Reusable pixel-coordinate buffer (grows as needed, never shrinks) ──────
const _pixelBuf: Array<{ x: number; y: number }> = [];

// ─── Subscription source (for live buffer mode) ────────────────────────────

/**
 * An object that provides line-point data and a subscribe method.
 * This matches the `timelineBuffer` singleton interface.
 */
export interface SparklineDataSource {
  readonly linePoints: LinePoint[];
  subscribe(cb: () => void): () => void;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ProfitSparklineProps {
  /**
   * Static mode: pass an array of line points directly.
   * When provided, the sparkline renders from this data and redraws
   * whenever the array reference changes.
   */
  linePoints?: LinePoint[];

  /**
   * Live mode: pass a data source with a subscribe method.
   * The sparkline will subscribe imperatively (no React state updates)
   * and coalesce redraws via requestAnimationFrame.
   * Takes precedence over `linePoints` if both are provided.
   */
  dataSource?: SparklineDataSource;

  /** Explicit height in pixels. When omitted the component fills its parent. */
  height?: number;
  className?: string;
  /** Line stroke color. Defaults to cyan. */
  lineColor?: string;
  /** data-testid for the canvas element. */
  testId?: string;
}

// ─── Shared draw logic ──────────────────────────────────────────────────────

function drawSparkline(
  canvas: HTMLCanvasElement,
  points: LinePoint[],
  lineColor: string,
): void {
  const result = setupCanvas(canvas);
  if (!result) return;
  const { ctx, width: w, height: h } = result;

  if (points.length < 2) return;

  // Zero-padding layout — chart fills entire canvas
  const chartLeft = 0;
  const chartRight = w;
  const chartTop = 2;
  const chartBottom = h - 2;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  if (chartWidth <= 0 || chartHeight <= 0) return;

  // X domain: 0 → max x (at least 1)
  let xMax = 1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].x > xMax) xMax = points[i].x;
  }
  const xMin = 0;

  // Y domain — symmetric around zero so the break-even line stays centered
  let yMinRaw = 0;
  let yMaxRaw = 0;
  for (let i = 0; i < points.length; i++) {
    const v = points[i].profit;
    if (v < yMinRaw) yMinRaw = v;
    if (v > yMaxRaw) yMaxRaw = v;
  }
  const absMax = Math.max(Math.abs(yMinRaw), Math.abs(yMaxRaw));
  const paddedAbsMax = absMax > 0 ? absMax * 1.05 : 1;
  const yMin = -paddedAbsMax;
  const yMax = paddedAbsMax;

  // Map data → pixel coords
  const mapX = (value: number): number => {
    const range = xMax - xMin || 1;
    const frac = (value - xMin) / range;
    return chartLeft + frac * chartWidth;
  };

  const mapY = (value: number): number => {
    const range = yMax - yMin || 1;
    const frac = (value - yMin) / range;
    return chartBottom - frac * chartHeight;
  };

  // Reuse / grow the module-level pixel buffer instead of allocating per draw
  const len = points.length;
  for (let i = 0; i < len; i++) {
    const px = clamp(mapX(points[i].x), chartLeft, chartRight);
    const py = clamp(mapY(points[i].profit), chartTop, chartBottom);
    if (i < _pixelBuf.length) {
      _pixelBuf[i].x = px;
      _pixelBuf[i].y = py;
    } else {
      _pixelBuf.push({ x: px, y: py });
    }
  }
  // Truncate length so downstream only sees the current frame's points.
  // V8 keeps the backing store, so this doesn't deallocate — the buffer
  // still "never shrinks" in terms of allocated capacity.
  _pixelBuf.length = len;

  // ── Line stroke ─────────────────────────────────────────────────────
  ctx.beginPath();
  drawMonotoneCurve(ctx, _pixelBuf);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ─── Component ──────────────────────────────────────────────────────────────

const ProfitSparkline = memo(
  ({
    linePoints,
    dataSource,
    height,
    className,
    lineColor = DEFAULT_LINE_COLOR,
    testId,
  }: ProfitSparklineProps) => {
    const { containerRef, canvasRef, canvasSize } = useCanvasResize();

    // Track pending RAF to coalesce rapid updates (live mode only).
    const rafId = useRef<number>(0);

    // ── Drawing (reads data from whichever source is provided) ──────
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const points = dataSource ? dataSource.linePoints : linePoints;
      if (!points) return;

      drawSparkline(canvas, points, lineColor);
    }, [canvasRef, dataSource, linePoints, lineColor]);

    // ── Live mode: subscribe to data source → schedule redraw ───────
    useEffect(() => {
      if (!dataSource) return;

      const scheduleDraw = () => {
        if (rafId.current) return;
        rafId.current = requestAnimationFrame(() => {
          rafId.current = 0;
          draw();
        });
      };

      const unsub = dataSource.subscribe(scheduleDraw);
      // Initial draw in case data already exists
      draw();

      return () => {
        unsub();
        if (rafId.current) {
          cancelAnimationFrame(rafId.current);
          rafId.current = 0;
        }
      };
    }, [dataSource, draw]);

    // ── Redraw on canvas resize or static data change ───────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — redraw on canvas resize
    useEffect(() => {
      draw();
    }, [canvasSize, draw]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: "relative",
          overflow: "hidden",
          height: height != null ? `${height}px` : "100%",
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid={testId}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  },
);

ProfitSparkline.displayName = "ProfitSparkline";

export { ProfitSparkline };
export default ProfitSparkline;
