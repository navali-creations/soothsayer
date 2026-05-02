import type {
  ChartDomains,
  ChartLayout,
} from "../canvas-chart-utils/canvas-chart-utils";
import {
  ACTIVE_DOT_RADIUS,
  BRUSH_TRAVELLER_WIDTH,
  clamp,
  DOT_RADIUS,
  drawMonotoneCurve,
  evenTicks,
  formatDecksTick,
  formatProfitTick,
  parseRgba,
  rgbaStr,
  type SplinePoint,
  TICK_COUNT,
} from "../canvas-chart-utils/canvas-chart-utils";
import type {
  BrushRange,
  ChartColors,
  ChartDataPoint,
  MetricKey,
} from "../chart-types/chart-types";

// ─── Module-level gradient cache for drawProfitArea ────────────────────────────

let _profitGradient: CanvasGradient | null = null;
let _profitGradientKey = "";

// ─── Module-level color cache for drawDecksScatter ─────────────────────────────

let _decksFill = "";
let _decksStroke = "";
let _decksColorKey = "";

// ─── Context Interfaces ────────────────────────────────────────────────────────

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  layout: ChartLayout;
  colors: {
    profitColor: string;
    decksColor: string;
    c: ChartColors;
  };
  hiddenMetrics: Set<MetricKey>;
  mapX: (index: number) => number;
  mapProfitY: (value: number) => number;
  mapDecksY: (value: number) => number;
}

export interface BrushDrawContext extends DrawContext {
  mapBrushX: (dataIndex: number) => number;
  brushRange: BrushRange;
  hoverIndex: number | null;
  markerIndex: number | null;
}

// ─── drawGrid ──────────────────────────────────────────────────────────────────

/**
 * Draws the dashed border around the chart area, horizontal grid lines
 * (derived from profit ticks), and vertical grid lines (evenly spaced
 * along the x-axis).
 */
export function drawGrid(
  dc: DrawContext,
  domains: ChartDomains,
  visibleDataLength: number,
): void {
  const { ctx, layout, colors, hiddenMetrics, mapProfitY, mapX } = dc;
  const {
    chartLeft,
    chartRight,
    chartTop,
    chartBottom,
    chartWidth,
    chartHeight,
  } = layout;
  const { c } = colors;

  ctx.save();
  ctx.strokeStyle = c.bc06;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  // Dashed border around the chart area
  ctx.strokeRect(chartLeft, chartTop, chartWidth, chartHeight);

  // Evenly-spaced horizontal grid lines from profit ticks
  const profitTicks = evenTicks(
    domains.profit.min,
    domains.profit.max,
    TICK_COUNT,
  );

  // Horizontal grid lines (skip first & last since the border covers those)
  if (!hiddenMetrics.has("profit")) {
    for (let i = 1; i < profitTicks.length - 1; i++) {
      const y = mapProfitY(profitTicks[i]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }
  }

  // Vertical grid lines (from x axis ticks)
  const numVisible = visibleDataLength;
  const maxXTicks = Math.min(
    numVisible,
    Math.max(2, Math.floor(chartWidth / 22)),
  );
  const xStep = Math.max(1, Math.ceil(numVisible / maxXTicks));

  for (let i = 0; i < numVisible; i += xStep) {
    const x = mapX(i);
    if (x > chartLeft + 1 && x < chartRight - 1) {
      ctx.beginPath();
      ctx.moveTo(x, chartTop);
      ctx.lineTo(x, chartBottom);
      ctx.stroke();
    }
  }

  // Last tick vertical grid line
  if (numVisible > 1) {
    const x = mapX(numVisible - 1);
    if (x > chartLeft + 1 && x < chartRight - 1) {
      ctx.beginPath();
      ctx.moveTo(x, chartTop);
      ctx.lineTo(x, chartBottom);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ─── drawYAxisDecks ────────────────────────────────────────────────────────────

/**
 * Draws the left Y-axis labels for the decks metric.
 */
export function drawYAxisDecks(dc: DrawContext, domains: ChartDomains): void {
  const { ctx, layout, colors, hiddenMetrics, mapDecksY } = dc;
  const { chartLeft } = layout;
  const { decksColor } = colors;

  if (hiddenMetrics.has("decks")) return;

  const decksTicks = evenTicks(
    domains.decks.min,
    domains.decks.max,
    TICK_COUNT,
  );

  ctx.save();
  ctx.fillStyle = decksColor;
  ctx.font = "9px system-ui, sans-serif";
  ctx.textAlign = "right";

  for (let i = 0; i < decksTicks.length; i++) {
    const y = mapDecksY(decksTicks[i]);
    if (i === 0) {
      ctx.textBaseline = "bottom";
    } else if (i === decksTicks.length - 1) {
      ctx.textBaseline = "top";
    } else {
      ctx.textBaseline = "middle";
    }
    ctx.fillText(formatDecksTick(decksTicks[i]), chartLeft - 6, y);
  }

  ctx.restore();
}

// ─── drawYAxisProfit ───────────────────────────────────────────────────────────

/**
 * Draws the right Y-axis labels for the profit metric.
 */
export function drawYAxisProfit(dc: DrawContext, domains: ChartDomains): void {
  const { ctx, layout, colors, hiddenMetrics, mapProfitY } = dc;
  const { chartRight } = layout;
  const { decksColor } = colors;

  if (hiddenMetrics.has("profit")) return;

  const profitTicks = evenTicks(
    domains.profit.min,
    domains.profit.max,
    TICK_COUNT,
  );

  ctx.save();
  ctx.fillStyle = decksColor;
  ctx.font = "9px system-ui, sans-serif";
  ctx.textAlign = "left";

  for (let i = 0; i < profitTicks.length; i++) {
    const y = mapProfitY(profitTicks[i]);
    if (i === 0) {
      ctx.textBaseline = "bottom";
    } else if (i === profitTicks.length - 1) {
      ctx.textBaseline = "top";
    } else {
      ctx.textBaseline = "middle";
    }
    ctx.fillText(formatProfitTick(profitTicks[i]), chartRight + 6, y);
  }

  ctx.restore();
}

// ─── drawXAxis ─────────────────────────────────────────────────────────────────

/**
 * Draws session index labels along the bottom X-axis.
 * Includes logic to skip overlapping labels at the end.
 */
export function drawXAxis(
  dc: DrawContext,
  visibleData: ReadonlyArray<ChartDataPoint>,
): void {
  const { ctx, layout, colors, mapX } = dc;
  const { chartBottom, chartWidth } = layout;
  const { c } = colors;

  const numVisible = visibleData.length;
  const maxXTicks = Math.min(
    numVisible,
    Math.max(2, Math.floor(chartWidth / 22)),
  );
  const xStep = Math.max(1, Math.ceil(numVisible / maxXTicks));

  ctx.save();
  ctx.fillStyle = c.bc30;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  let lastDrawnX = -Infinity;
  for (let i = 0; i < numVisible; i += xStep) {
    const x = mapX(i);
    ctx.fillText(String(visibleData[i].sessionIndex), x, chartBottom + 6);
    lastDrawnX = x;
  }

  // Draw last label only if it wasn't already drawn and doesn't overlap
  const lastI = numVisible - 1;
  if (numVisible > 1 && lastI % xStep !== 0) {
    const x = mapX(lastI);
    const minGap = 18;
    if (x - lastDrawnX >= minGap) {
      ctx.fillText(String(visibleData[lastI].sessionIndex), x, chartBottom + 6);
    }
  }

  ctx.restore();
}

// ─── drawProfitArea ────────────────────────────────────────────────────────────

/**
 * Draws the profit area fill (gradient) and monotone spline stroke line.
 * Assumes the caller has already set up a clip region for the chart area.
 */
export function drawProfitArea(
  dc: DrawContext,
  visibleData: ReadonlyArray<ChartDataPoint>,
  chartData: ReadonlyArray<ChartDataPoint>,
  fullProfitSum?: number,
): void {
  const { ctx, layout, colors, hiddenMetrics, mapX, mapProfitY } = dc;
  const { chartTop, chartBottom } = layout;
  const { profitColor } = colors;

  if (hiddenMetrics.has("profit")) return;

  const numVisible = visibleData.length;
  if (numVisible === 0) return;

  // Build points array for spline
  const profitPoints: SplinePoint[] = [];
  for (let i = 0; i < numVisible; i++) {
    profitPoints.push({
      x: mapX(i),
      y: mapProfitY(visibleData[i].profitDivine),
    });
  }

  // Determine where zero is on the Y axis, clamped to chart bounds
  const zeroY = clamp(mapProfitY(0), chartTop, chartBottom);

  // Base gradient direction on the FULL dataset average (not visible
  // slice) so it stays stable during drag/zoom and doesn't flicker.
  let profitSum = fullProfitSum;
  if (profitSum === undefined) {
    profitSum = 0;
    for (const pt of chartData) {
      profitSum += pt.profitDivine;
    }
  }
  const mostlyNegative = profitSum < 0;

  // Area fill with gradient oriented based on overall data direction.
  // Positive: opaque near the line (top) → transparent toward zero (bottom).
  // Negative: opaque near the line (bottom) → transparent toward zero (top).
  const gradKey = `${chartTop}:${chartBottom}:${profitColor}:${mostlyNegative}`;
  if (_profitGradientKey !== gradKey || !_profitGradient) {
    const profitRgba = parseRgba(profitColor);
    _profitGradient = mostlyNegative
      ? ctx.createLinearGradient(0, chartBottom, 0, chartTop)
      : ctx.createLinearGradient(0, chartTop, 0, chartBottom);
    _profitGradient.addColorStop(
      0,
      rgbaStr(profitRgba.r, profitRgba.g, profitRgba.b, 0.3),
    );
    _profitGradient.addColorStop(
      1,
      rgbaStr(profitRgba.r, profitRgba.g, profitRgba.b, 0.02),
    );
    _profitGradientKey = gradKey;
  }

  // Close the area path toward the zero line
  ctx.beginPath();
  drawMonotoneCurve(ctx, profitPoints, zeroY);
  ctx.fillStyle = _profitGradient;
  ctx.fill();

  // Smooth line stroke
  ctx.beginPath();
  drawMonotoneCurve(ctx, profitPoints);
  ctx.strokeStyle = profitColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();
}

// ─── drawDecksScatter ──────────────────────────────────────────────────────────

/**
 * Draws scatter dots for each decks data point.
 * Assumes the caller has already set up a clip region for the chart area.
 */
export function drawDecksScatter(
  dc: DrawContext,
  visibleData: ReadonlyArray<ChartDataPoint>,
): void {
  const { ctx, colors, hiddenMetrics, mapX, mapDecksY } = dc;
  const { decksColor } = colors;

  if (hiddenMetrics.has("decks")) return;

  const numVisible = visibleData.length;

  if (_decksColorKey !== decksColor) {
    const decksRgba = parseRgba(decksColor);
    _decksFill = rgbaStr(decksRgba.r, decksRgba.g, decksRgba.b, 0.5);
    _decksStroke = rgbaStr(decksRgba.r, decksRgba.g, decksRgba.b, 0.7);
    _decksColorKey = decksColor;
  }
  ctx.fillStyle = _decksFill;
  ctx.strokeStyle = _decksStroke;
  ctx.lineWidth = 0.5;

  for (let i = 0; i < numVisible; i++) {
    const pt = visibleData[i];
    if (pt.rawDecks === null) continue;
    const x = mapX(i);
    const y = mapDecksY(pt.rawDecks);
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// ─── drawHoverHighlight ────────────────────────────────────────────────────────

/**
 * Draws the dashed vertical cursor line and active dots at the hovered index.
 * Assumes the caller has already set up a clip region for the chart area.
 */
export function drawHoverHighlight(
  dc: DrawContext,
  visibleData: ReadonlyArray<ChartDataPoint>,
  hoverIndex: number | null,
): void {
  const { ctx, layout, colors, hiddenMetrics, mapX, mapProfitY, mapDecksY } =
    dc;
  const { chartTop, chartBottom } = layout;
  const { c } = colors;

  if (hoverIndex === null || hoverIndex < 0 || hoverIndex >= visibleData.length)
    return;

  const hoverPt = visibleData[hoverIndex];
  const hx = mapX(hoverIndex);

  // Dashed vertical cursor line
  ctx.save();
  ctx.strokeStyle = c.bc20;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx, chartTop);
  ctx.lineTo(hx, chartBottom);
  ctx.stroke();
  ctx.restore();

  // Active dot on profit line — background fill with white border
  if (!hiddenMetrics.has("profit")) {
    const py = mapProfitY(hoverPt.profitDivine);
    ctx.beginPath();
    ctx.arc(hx, py, ACTIVE_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = c.b2;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Active dot on decks — same style for consistency
  if (!hiddenMetrics.has("decks") && hoverPt.rawDecks !== null) {
    const dy = mapDecksY(hoverPt.rawDecks);
    ctx.beginPath();
    ctx.arc(hx, dy, ACTIVE_DOT_RADIUS - 1, 0, Math.PI * 2);
    ctx.fillStyle = c.b2;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function drawLeagueStartMarker(
  dc: DrawContext,
  visibleIndex: number,
  {
    label,
    color,
    lineDash = [4, 4],
    showLabel = true,
  }: {
    label: string;
    color: string;
    lineDash?: number[];
    showLabel?: boolean;
  },
): void {
  const { ctx, layout, mapX } = dc;
  const { chartLeft, chartRight, chartTop, chartBottom } = layout;
  const x = mapX(visibleIndex);
  if (!Number.isFinite(x)) return;
  if (x < chartLeft || x > chartRight) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash(lineDash);
  ctx.beginPath();
  ctx.moveTo(x, chartTop);
  ctx.lineTo(x, chartBottom);
  ctx.stroke();

  if (showLabel) {
    ctx.fillStyle = color;
    ctx.font = "700 10px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.save();
    ctx.translate(Math.round(x + 10), Math.round(chartTop + 6));
    ctx.rotate(Math.PI / 2);
    ctx.fillText(label.toUpperCase(), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

// ─── drawBrush ─────────────────────────────────────────────────────────────────

/**
 * Draws everything in the brush region: background, mini profit line,
 * dim overlays outside the selected range, outline, selected range border,
 * travellers (with grip lines), hover indicator, and range labels.
 */
export function drawBrush(
  bdc: BrushDrawContext,
  chartData: ReadonlyArray<ChartDataPoint>,
): void {
  const {
    ctx,
    layout,
    colors,
    hiddenMetrics,
    mapBrushX,
    brushRange,
    hoverIndex,
    markerIndex,
  } = bdc;
  const {
    brushTop,
    brushBottom,
    brushLeft,
    brushRight,
    brushHeight: brushH,
  } = layout;
  const { profitColor, c } = colors;

  if (chartData.length === 0) return;

  const totalPoints = chartData.length;

  // ── Background ──────────────────────────────────────────────
  ctx.fillStyle = c.b2;
  ctx.fillRect(brushLeft, brushTop, brushRight - brushLeft, brushH);

  // ── Mini profit line in brush (smooth) ──────────────────────
  let bMin = Infinity;
  let bMax = -Infinity;
  let bRange = 1;
  let brushLineY: ((dataIndex: number) => number) | null = null;

  if (!hiddenMetrics.has("profit")) {
    for (const pt of chartData) {
      if (pt.profitDivine < bMin) bMin = pt.profitDivine;
      if (pt.profitDivine > bMax) bMax = pt.profitDivine;
    }
    if (bMin === bMax) {
      bMin -= 1;
      bMax += 1;
    }

    bRange = bMax - bMin;
    brushLineY = (idx: number) => {
      const frac = (chartData[idx]?.profitDivine - bMin) / bRange;
      return brushBottom - 3 - frac * (brushH - 6);
    };

    const brushPoints: SplinePoint[] = [];
    for (let i = 0; i < totalPoints; i++) {
      const x = mapBrushX(i);
      const y = brushLineY(i);
      brushPoints.push({ x, y });
    }

    ctx.beginPath();
    drawMonotoneCurve(ctx, brushPoints);
    ctx.strokeStyle = profitColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  if (markerIndex !== null && markerIndex >= 0 && markerIndex < totalPoints) {
    const markerX = mapBrushX(markerIndex);
    if (
      Number.isFinite(markerX) &&
      markerX >= brushLeft &&
      markerX <= brushRight
    ) {
      ctx.save();
      ctx.strokeStyle = c.success50;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(markerX, brushTop);
      ctx.lineTo(markerX, brushBottom);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Dim areas outside brush range ───────────────────────────
  const rangeStart = brushRange.startIndex;
  const rangeEnd = brushRange.endIndex;
  const bxStart = mapBrushX(rangeStart);
  const bxEnd = mapBrushX(rangeEnd);

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  // Left dim
  if (bxStart > brushLeft) {
    ctx.fillRect(brushLeft, brushTop, bxStart - brushLeft, brushH);
  }
  // Right dim
  if (bxEnd < brushRight) {
    ctx.fillRect(bxEnd, brushTop, brushRight - bxEnd, brushH);
  }

  // ── Brush outline ──────────────────────────────────────────
  ctx.strokeStyle = c.bc15;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(brushLeft, brushTop, brushRight - brushLeft, brushH);

  // ── Selected range border ──────────────────────────────────
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(bxStart, brushTop, bxEnd - bxStart, brushH);

  // ── Traveller helper ───────────────────────────────────────
  const drawTraveller = (tx: number) => {
    const tw = BRUSH_TRAVELLER_WIDTH;
    const tx0 = tx - tw / 2;
    // Extend traveller slightly above and below the brush for visual pop
    const tTop = brushTop - 1;
    const tHeight = brushH + 2;
    const radius = 3;

    // Rounded-rect path
    ctx.beginPath();
    ctx.moveTo(tx0 + radius, tTop);
    ctx.lineTo(tx0 + tw - radius, tTop);
    ctx.arcTo(tx0 + tw, tTop, tx0 + tw, tTop + radius, radius);
    ctx.lineTo(tx0 + tw, tTop + tHeight - radius);
    ctx.arcTo(
      tx0 + tw,
      tTop + tHeight,
      tx0 + tw - radius,
      tTop + tHeight,
      radius,
    );
    ctx.lineTo(tx0 + radius, tTop + tHeight);
    ctx.arcTo(tx0, tTop + tHeight, tx0, tTop + tHeight - radius, radius);
    ctx.lineTo(tx0, tTop + radius);
    ctx.arcTo(tx0, tTop, tx0 + radius, tTop, radius);
    ctx.closePath();

    // Fill with chart background so it covers the mini line beneath
    ctx.fillStyle = c.b2;
    ctx.fill();

    // Subtle white border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Grip lines (subtle)
    ctx.strokeStyle = c.bc30;
    ctx.lineWidth = 1;
    const mid = tTop + tHeight / 2;
    ctx.beginPath();
    ctx.moveTo(tx - 1.5, mid - 4);
    ctx.lineTo(tx - 1.5, mid + 4);
    ctx.moveTo(tx + 1.5, mid - 4);
    ctx.lineTo(tx + 1.5, mid + 4);
    ctx.stroke();
  };

  // ── Hover indicator on the brush mini line ─────────────────
  // Drawn BEFORE travellers so the thumbs render on top
  if (brushLineY !== null && hoverIndex !== null) {
    // Convert visible-slice index to full-data index
    const dataIdx = brushRange.startIndex + hoverIndex;
    if (dataIdx >= 0 && dataIdx < chartData.length) {
      const hbx = mapBrushX(dataIdx);
      const hby = brushLineY(dataIdx);

      // Vertical hairline on brush
      ctx.save();
      ctx.strokeStyle = c.bc20;
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hbx, brushTop);
      ctx.lineTo(hbx, brushBottom);
      ctx.stroke();
      ctx.restore();

      // Active dot — white border matching main chart style
      ctx.beginPath();
      ctx.arc(hbx, hby, 3, 0, Math.PI * 2);
      ctx.fillStyle = c.b2;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // ── Draw travellers ────────────────────────────────────────
  drawTraveller(bxStart);
  drawTraveller(bxEnd);

  // ── Brush range labels (outside travellers) ────────────────
  ctx.save();
  ctx.fillStyle = c.bc40;
  ctx.font = "9px system-ui, sans-serif";

  // Left label (to the left of start traveller)
  const startLabel = String(chartData[rangeStart]?.sessionIndex ?? rangeStart);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const labelY = brushTop + brushH / 2;
  const leftLabelX = bxStart - BRUSH_TRAVELLER_WIDTH / 2 - 4;
  if (leftLabelX > brushLeft - 30) {
    ctx.fillText(startLabel, leftLabelX, labelY);
  }

  // Right label (to the right of end traveller)
  const endLabel = String(chartData[rangeEnd]?.sessionIndex ?? rangeEnd);
  ctx.textAlign = "left";
  const rightLabelX = bxEnd + BRUSH_TRAVELLER_WIDTH / 2 + 4;
  if (rightLabelX < brushRight + 30) {
    ctx.fillText(endLabel, rightLabelX, labelY);
  }

  ctx.restore();
}
