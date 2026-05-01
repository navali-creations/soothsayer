import type { ChartColors } from "~/renderer/hooks";
import {
  clamp,
  createLinearMapper,
  drawDonutIndicator,
  drawMonotoneCurve,
  ensureCanvasBackingStore,
  evenTicks,
  type SplinePoint,
  setupCanvas,
} from "~/renderer/lib/canvas-core";

export interface PnLCurvePoint {
  deckCount: number;
  estimated: number;
  optimistic: number;
}

export interface ChartLayout {
  chartLeft: number;
  chartRight: number;
  chartTop: number;
  chartBottom: number;
  chartWidth: number;
  chartHeight: number;
}

interface XTick {
  x: number;
  value: number;
}

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  dataPoint: PnLCurvePoint | null;
}

interface TooltipSize {
  width: number;
  height: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface ChartDomains {
  x: { min: number; max: number };
  y: { min: number; max: number };
}

export const HOVER_THRESHOLD = 28;
export const TOOLTIP_WIDTH = 220;
export const TOOLTIP_HEIGHT = 96;

const AXIS_LEFT = 62;
const AXIS_RIGHT = 34;
const AXIS_TOP = 10;
const AXIS_BOTTOM = 38;
const Y_TICK_COUNT = 5;
const CLIP_BLEED = 8;
const TOOLTIP_OFFSET = 12;
const TOOLTIP_MARGIN = 4;

export function computeLayout(width: number, height: number): ChartLayout {
  const chartLeft = AXIS_LEFT;
  const chartRight = Math.max(chartLeft, width - AXIS_RIGHT);
  const chartTop = AXIS_TOP;
  const chartBottom = Math.max(chartTop, height - AXIS_BOTTOM);

  return {
    chartLeft,
    chartRight,
    chartTop,
    chartBottom,
    chartWidth: Math.max(0, chartRight - chartLeft),
    chartHeight: Math.max(0, chartBottom - chartTop),
  };
}

function formatDeckTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(Math.round(value));
}

function formatYAxisTick(value: number, chaosToDivineRatio: number): string {
  if (chaosToDivineRatio <= 0) return `${value}c`;

  const divineValue = value / chaosToDivineRatio;
  if (Math.abs(divineValue) >= 1000) {
    return `${(divineValue / 1000).toFixed(0)}k d`;
  }
  if (Math.abs(divineValue) >= 100) {
    return `${divineValue.toFixed(0)} d`;
  }
  return `${divineValue.toFixed(1)} d`;
}

export function computeDomains(curveData: PnLCurvePoint[]): ChartDomains {
  const xValues = curveData.map((point) => point.deckCount);
  const yValues = curveData.flatMap((point) => [
    point.estimated,
    point.optimistic,
    0,
  ]);

  let xMin = Math.min(...xValues);
  let xMax = Math.max(...xValues);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);

  if (xMin === xMax) {
    xMin = Math.max(0, xMin - 1);
    xMax += 1;
  }

  if (yMin === yMax) {
    const pad = Math.abs(yMin) * 0.2 || 1;
    yMin -= pad;
    yMax += pad;
  } else {
    const pad = (yMax - yMin) * 0.08;
    yMin -= pad;
    yMax += pad;
  }

  return { x: { min: xMin, max: xMax }, y: { min: yMin, max: yMax } };
}

export function mapCategoryX(
  index: number,
  count: number,
  layout: ChartLayout,
) {
  if (count <= 1) return layout.chartLeft + layout.chartWidth / 2;
  return layout.chartLeft + (index / (count - 1)) * layout.chartWidth;
}

function buildCategoryTicks(
  curveData: PnLCurvePoint[],
  layout: ChartLayout,
): XTick[] {
  return curveData.map((point, index) => ({
    x: mapCategoryX(index, curveData.length, layout),
    value: point.deckCount,
  }));
}

function buildPoints(
  curveData: PnLCurvePoint[],
  layout: ChartLayout,
  mapY: (value: number) => number,
  key: "estimated" | "optimistic",
): SplinePoint[] {
  return curveData.map((point, index) => ({
    x: mapCategoryX(index, curveData.length, layout),
    y: mapY(point[key]),
  }));
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  yTicks: number[],
  xTicks: XTick[],
  mapY: (value: number) => number,
  gridColor: string,
) {
  const { chartLeft, chartRight, chartTop, chartBottom, chartWidth } = layout;

  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(chartLeft, chartTop, chartWidth, layout.chartHeight);

  for (let i = 1; i < yTicks.length - 1; i++) {
    const y = mapY(yTicks[i]);
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
  }

  for (let i = 1; i < xTicks.length - 1; i++) {
    const x = xTicks[i].x;
    ctx.beginPath();
    ctx.moveTo(x, chartTop);
    ctx.lineTo(x, chartBottom);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  yTicks: number[],
  xTicks: XTick[],
  mapY: (value: number) => number,
  chaosToDivineRatio: number,
  axisColor: string,
) {
  ctx.save();
  ctx.fillStyle = axisColor;
  ctx.font = "11px system-ui, sans-serif";

  ctx.textAlign = "right";
  for (let i = 0; i < yTicks.length; i++) {
    const y = mapY(yTicks[i]);
    if (i === 0) {
      ctx.textBaseline = "bottom";
    } else if (i === yTicks.length - 1) {
      ctx.textBaseline = "top";
    } else {
      ctx.textBaseline = "middle";
    }
    ctx.fillText(
      formatYAxisTick(yTicks[i], chaosToDivineRatio),
      layout.chartLeft - 8,
      y,
    );
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const tick of xTicks) {
    ctx.fillText(formatDeckTick(tick.value), tick.x, layout.chartBottom + 7);
  }

  ctx.restore();
}

function drawReferenceLine(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  y: number,
  lineColor: string,
  labelColor: string,
) {
  if (y < layout.chartTop || y > layout.chartBottom) return;

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(layout.chartLeft, y);
  ctx.lineTo(layout.chartRight, y);
  ctx.stroke();

  ctx.fillStyle = labelColor;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("Break-even", layout.chartRight - 4, y + 4);
  ctx.restore();
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  points: SplinePoint[],
  strokeStyle: string,
  lineWidth: number,
  baselineY?: number,
  fillStyle?: string | CanvasGradient,
) {
  if (points.length === 0) return;

  ctx.save();

  if (baselineY !== undefined && fillStyle !== undefined) {
    ctx.beginPath();
    drawMonotoneCurve(ctx, points, baselineY);
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  ctx.beginPath();
  drawMonotoneCurve(ctx, points);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

export function computeTooltipStyle({
  tooltip,
  tooltipSize,
  canvasSize,
}: {
  tooltip: TooltipState;
  tooltipSize: TooltipSize;
  canvasSize: CanvasSize;
}) {
  if (!tooltip.visible || !tooltip.dataPoint) {
    return { display: "none" as const };
  }

  const tooltipWidth = tooltipSize.width || TOOLTIP_WIDTH;
  const tooltipHeight = tooltipSize.height || TOOLTIP_HEIGHT;

  let left = tooltip.x + TOOLTIP_OFFSET;
  if (left + tooltipWidth > canvasSize.width - TOOLTIP_MARGIN) {
    left = tooltip.x - tooltipWidth - TOOLTIP_OFFSET;
  }
  left = clamp(
    left,
    TOOLTIP_MARGIN,
    Math.max(TOOLTIP_MARGIN, canvasSize.width - tooltipWidth),
  );

  let top = tooltip.y + TOOLTIP_OFFSET;
  if (top + tooltipHeight > canvasSize.height - TOOLTIP_MARGIN) {
    top = tooltip.y - tooltipHeight - TOOLTIP_OFFSET;
  }
  top = clamp(
    top,
    TOOLTIP_MARGIN,
    Math.max(TOOLTIP_MARGIN, canvasSize.height - tooltipHeight),
  );

  return {
    position: "absolute" as const,
    left: `${left}px`,
    top: `${top}px`,
    pointerEvents: "none" as const,
    zIndex: 10,
  };
}

export function drawPFBreakevenChartCanvas({
  canvas,
  sourceElement,
  domains,
  curveData,
  layout,
  canvasSize,
  chaosToDivineRatio,
  hoverIndex,
  c,
}: {
  canvas: HTMLCanvasElement;
  sourceElement: HTMLElement | null;
  domains: ChartDomains;
  curveData: PnLCurvePoint[];
  layout: ChartLayout;
  canvasSize: CanvasSize;
  chaosToDivineRatio: number;
  hoverIndex: number | null;
  c: ChartColors;
}) {
  if (!ensureCanvasBackingStore(canvas, sourceElement)) return;

  const result = setupCanvas(canvas);
  if (!result) return;

  const { ctx, width, height } = result;
  const effectiveLayout =
    canvasSize.width > 0 && canvasSize.height > 0
      ? layout
      : computeLayout(width, height);
  if (effectiveLayout.chartWidth <= 0 || effectiveLayout.chartHeight <= 0) {
    return;
  }

  const mapY = createLinearMapper(
    domains.y.min,
    domains.y.max,
    effectiveLayout.chartBottom,
    effectiveLayout.chartTop,
  );

  const xTicks = buildCategoryTicks(curveData, effectiveLayout);
  const yTicks = evenTicks(domains.y.min, domains.y.max, Y_TICK_COUNT);
  const optimisticPoints = buildPoints(
    curveData,
    effectiveLayout,
    mapY,
    "optimistic",
  );
  const estimatedPoints = buildPoints(
    curveData,
    effectiveLayout,
    mapY,
    "estimated",
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    effectiveLayout.chartLeft - CLIP_BLEED,
    effectiveLayout.chartTop - CLIP_BLEED,
    effectiveLayout.chartWidth + CLIP_BLEED * 2,
    effectiveLayout.chartHeight + CLIP_BLEED * 2,
  );
  ctx.clip();

  const estimatedGradient = ctx.createLinearGradient(
    0,
    effectiveLayout.chartTop,
    0,
    effectiveLayout.chartBottom,
  );
  estimatedGradient.addColorStop(0, c.primary30);
  estimatedGradient.addColorStop(1, c.primary02);

  const optimisticGradient = ctx.createLinearGradient(
    0,
    effectiveLayout.chartTop,
    0,
    effectiveLayout.chartBottom,
  );
  optimisticGradient.addColorStop(0, c.primary15);
  optimisticGradient.addColorStop(1, c.primary02);

  drawCurve(
    ctx,
    optimisticPoints,
    c.primary60,
    1,
    effectiveLayout.chartBottom,
    optimisticGradient,
  );
  drawCurve(
    ctx,
    estimatedPoints,
    c.primary,
    2,
    effectiveLayout.chartBottom,
    estimatedGradient,
  );

  drawGrid(ctx, effectiveLayout, yTicks, xTicks, mapY, c.bc10);
  drawReferenceLine(ctx, effectiveLayout, mapY(0), c.bc30, c.bc50);

  if (hoverIndex !== null && estimatedPoints[hoverIndex]) {
    const point = estimatedPoints[hoverIndex];
    ctx.save();
    ctx.strokeStyle = c.bc20;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(point.x, effectiveLayout.chartTop);
    ctx.lineTo(point.x, effectiveLayout.chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    drawDonutIndicator(ctx, point.x, point.y, {
      fillStyle: c.primary,
      strokeStyle: "rgba(255, 255, 255, 0.9)",
    });
    ctx.restore();
  }

  ctx.restore();

  drawAxes(
    ctx,
    effectiveLayout,
    yTicks,
    xTicks,
    mapY,
    chaosToDivineRatio,
    c.bc40,
  );
}
