import type { ChartColors } from "~/renderer/hooks";
import {
  clamp,
  createLinearMapper,
  ensureCanvasBackingStore,
  setupCanvas,
} from "~/renderer/lib/canvas-core";

import { BAR_WIDTH, BRUSH_HEIGHT } from "../constants";
import { formatAxisDate } from "../helpers";
import type { ChartDataPoint, DropTimelineMetricKey } from "../types";

export interface Layout {
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
}

export type DragMode = "start" | "end" | "range" | null;

export interface OverviewDragState {
  mode: DragMode;
  originTime: number;
  originStartTime: number;
  originEndTime: number;
}

export interface BrushChange {
  startTime: number;
  endTime: number;
}

interface TimeDomain {
  min: number;
  max: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

const PAD_X = 44;
const PAD_TOP = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_VISIBLE_POINTS = 5;
const BRUSH_BAR_TOP_PADDING = 4;
const BRUSH_BAR_BOTTOM_PADDING = 4;

export const OVERVIEW_TRAVELLER_WIDTH = 8;
export const EMPTY_OVERVIEW_DRAG_STATE: OverviewDragState = {
  mode: null,
  originTime: 0,
  originStartTime: 0,
  originEndTime: 0,
};

export function computeLayout(width: number, height: number): Layout {
  const chartLeft = PAD_X;
  const chartRight = Math.max(chartLeft, width - PAD_X);
  const chartTop = PAD_TOP;
  const brushBottom = height - 4;
  const brushTop = Math.max(chartTop, brushBottom - BRUSH_HEIGHT);

  return {
    chartLeft,
    chartRight,
    chartTop,
    chartBottom: brushTop - 4,
    chartWidth: Math.max(0, chartRight - chartLeft),
    chartHeight: Math.max(0, brushTop - 4 - chartTop),
    brushTop,
    brushBottom,
    brushLeft: chartLeft,
    brushRight: chartRight,
  };
}

export function computeTimeDomain(data: ChartDataPoint[]): TimeDomain {
  if (data.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...data.map((point) => point.time));
  let max = Math.max(...data.map((point) => point.time));
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return { min, max };
}

function isRealPoint(point: ChartDataPoint) {
  return !point.isGap && !point.isBoundary;
}

function latestStartTimeForMinVisiblePoints(
  data: ChartDataPoint[],
  endTime: number,
) {
  const points = data.filter(
    (point) => isRealPoint(point) && point.time <= endTime,
  );
  if (points.length < MIN_VISIBLE_POINTS) return data[0]?.time ?? endTime;
  return points[points.length - MIN_VISIBLE_POINTS].time;
}

function earliestEndTimeForMinVisiblePoints(
  data: ChartDataPoint[],
  startTime: number,
) {
  const points = data.filter(
    (point) => isRealPoint(point) && point.time >= startTime,
  );
  if (points.length < MIN_VISIBLE_POINTS) {
    return data[data.length - 1]?.time ?? startTime;
  }
  return points[MIN_VISIBLE_POINTS - 1].time;
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  layout: Layout,
  mapX: (value: number) => number,
  mapCountY: (value: number) => number,
  c: ChartColors,
) {
  ctx.save();
  ctx.fillStyle = c.primary;
  ctx.strokeStyle = c.b2;
  ctx.lineWidth = 1;
  for (const point of data) {
    if (point.count <= 0 || point.isGap || point.isBoundary) continue;
    const x = mapX(point.time) - BAR_WIDTH / 2;
    const y = mapCountY(point.count);
    const h = Math.max(1, layout.chartBottom - y);
    ctx.fillRect(x, y, BAR_WIDTH, h);
    ctx.strokeRect(x, y, BAR_WIDTH, h);
  }
  ctx.restore();
}

function drawBrushBackground(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  c: ChartColors,
) {
  ctx.save();
  ctx.fillStyle = c.b2;
  ctx.fillRect(
    layout.brushLeft,
    layout.brushTop,
    layout.brushRight - layout.brushLeft,
    BRUSH_HEIGHT,
  );
  ctx.restore();
}

function drawTraveller(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  x: number,
  c: ChartColors,
) {
  const x0 = x - OVERVIEW_TRAVELLER_WIDTH / 2;
  const y0 = layout.brushTop - 1;
  const height = BRUSH_HEIGHT + 2;
  const radius = 3;

  ctx.beginPath();
  ctx.moveTo(x0 + radius, y0);
  ctx.lineTo(x0 + OVERVIEW_TRAVELLER_WIDTH - radius, y0);
  ctx.quadraticCurveTo(
    x0 + OVERVIEW_TRAVELLER_WIDTH,
    y0,
    x0 + OVERVIEW_TRAVELLER_WIDTH,
    y0 + radius,
  );
  ctx.lineTo(x0 + OVERVIEW_TRAVELLER_WIDTH, y0 + height - radius);
  ctx.quadraticCurveTo(
    x0 + OVERVIEW_TRAVELLER_WIDTH,
    y0 + height,
    x0 + OVERVIEW_TRAVELLER_WIDTH - radius,
    y0 + height,
  );
  ctx.lineTo(x0 + radius, y0 + height);
  ctx.quadraticCurveTo(x0, y0 + height, x0, y0 + height - radius);
  ctx.lineTo(x0, y0 + radius);
  ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
  ctx.closePath();

  ctx.fillStyle = c.b2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = c.bc30;
  const midY = y0 + height / 2;
  ctx.beginPath();
  ctx.moveTo(x - 1.5, midY - 4);
  ctx.lineTo(x - 1.5, midY + 4);
  ctx.moveTo(x + 1.5, midY - 4);
  ctx.lineTo(x + 1.5, midY + 4);
  ctx.stroke();
}

function drawBrushSelection(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  startTime: number,
  endTime: number,
  mapX: (value: number) => number,
  c: ChartColors,
) {
  const startX = mapX(startTime);
  const endX = mapX(endTime);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  if (startX > layout.brushLeft) {
    ctx.fillRect(
      layout.brushLeft,
      layout.brushTop,
      startX - layout.brushLeft,
      BRUSH_HEIGHT,
    );
  }
  if (endX < layout.brushRight) {
    ctx.fillRect(endX, layout.brushTop, layout.brushRight - endX, BRUSH_HEIGHT);
  }

  ctx.strokeStyle = c.bc15;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(
    layout.brushLeft,
    layout.brushTop,
    layout.brushRight - layout.brushLeft,
    BRUSH_HEIGHT,
  );
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.strokeRect(startX, layout.brushTop, endX - startX, BRUSH_HEIGHT);

  drawTraveller(ctx, layout, startX, c);
  drawTraveller(ctx, layout, endX, c);

  ctx.fillStyle = c.bc40;
  ctx.font = "9px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText(
    formatAxisDate(startTime),
    startX - OVERVIEW_TRAVELLER_WIDTH / 2 - 4,
    layout.brushTop + BRUSH_HEIGHT / 2,
  );
  ctx.textAlign = "left";
  ctx.fillText(
    formatAxisDate(endTime),
    endX + OVERVIEW_TRAVELLER_WIDTH / 2 + 4,
    layout.brushTop + BRUSH_HEIGHT / 2,
  );
  ctx.restore();
}

function drawBrushMarkerLine(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  markerTime: number | undefined,
  mapX: (value: number) => number,
  timeDomain: TimeDomain,
  c: ChartColors,
) {
  const marker =
    typeof markerTime === "number" && Number.isFinite(markerTime)
      ? markerTime
      : null;
  if (marker === null) return;
  if (marker < timeDomain.min || marker > timeDomain.max) return;
  const x = mapX(marker);
  if (!Number.isFinite(x)) return;
  if (x < layout.brushLeft || x > layout.brushRight) return;

  ctx.save();
  ctx.strokeStyle = c.success50;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, layout.brushTop);
  ctx.lineTo(x, layout.brushBottom);
  ctx.stroke();
  ctx.restore();
}

export function drawOverviewChartCanvas({
  canvas,
  sourceElement,
  chartData,
  maxPerSession,
  hiddenMetrics,
  leagueStartTime,
  startTime,
  endTime,
  layout,
  canvasSize,
  timeDomain,
  c,
}: {
  canvas: HTMLCanvasElement;
  sourceElement: HTMLElement | null;
  chartData: ChartDataPoint[];
  maxPerSession: number;
  hiddenMetrics: ReadonlySet<DropTimelineMetricKey>;
  leagueStartTime: number | undefined;
  startTime: number;
  endTime: number;
  layout: Layout;
  canvasSize: CanvasSize;
  timeDomain: TimeDomain;
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
  if (effectiveLayout.chartWidth <= 0) return;

  const mapX = createLinearMapper(
    timeDomain.min,
    timeDomain.max,
    effectiveLayout.chartLeft,
    effectiveLayout.chartRight,
  );
  const mapCountY = createLinearMapper(
    0,
    Math.ceil(maxPerSession * 1.4) || 1,
    effectiveLayout.brushBottom - BRUSH_BAR_BOTTOM_PADDING,
    effectiveLayout.brushTop + BRUSH_BAR_TOP_PADDING,
  );
  const brushBarsLayout = {
    ...effectiveLayout,
    chartTop: effectiveLayout.brushTop + BRUSH_BAR_TOP_PADDING,
    chartBottom: effectiveLayout.brushBottom - BRUSH_BAR_BOTTOM_PADDING,
    chartHeight: Math.max(
      0,
      effectiveLayout.brushBottom -
        effectiveLayout.brushTop -
        BRUSH_BAR_TOP_PADDING -
        BRUSH_BAR_BOTTOM_PADDING,
    ),
  };

  drawBrushBackground(ctx, effectiveLayout, c);
  if (!hiddenMetrics.has("drops-per-day")) {
    drawBars(ctx, chartData, brushBarsLayout, mapX, mapCountY, c);
  }
  drawBrushSelection(ctx, effectiveLayout, startTime, endTime, mapX, c);
  if (!hiddenMetrics.has("league-start")) {
    drawBrushMarkerLine(
      ctx,
      effectiveLayout,
      leagueStartTime,
      mapX,
      timeDomain,
      c,
    );
  }
}

export function createOverviewTimeMapper(
  timeDomain: TimeDomain,
  layout: Pick<Layout, "brushLeft" | "brushRight">,
) {
  return createLinearMapper(
    timeDomain.min,
    timeDomain.max,
    layout.brushLeft,
    layout.brushRight,
  );
}

export function getOverviewDragMode(
  x: number,
  startX: number,
  endX: number,
): Exclude<DragMode, null> {
  if (Math.abs(x - startX) <= OVERVIEW_TRAVELLER_WIDTH) return "start";
  if (Math.abs(x - endX) <= OVERVIEW_TRAVELLER_WIDTH) return "end";
  return "range";
}

export function computeBrushChange({
  chartData,
  timeDomain,
  startTime,
  endTime,
  pointerTime,
  drag,
}: {
  chartData: ChartDataPoint[];
  timeDomain: TimeDomain;
  startTime: number;
  endTime: number;
  pointerTime: number;
  drag: OverviewDragState;
}): BrushChange | null {
  const minWindow = Math.min(
    DAY_MS,
    Math.max(1, timeDomain.max - timeDomain.min),
  );

  if (drag.mode === "start") {
    const latestStartTime = Math.max(
      timeDomain.min,
      Math.min(
        endTime - minWindow,
        latestStartTimeForMinVisiblePoints(chartData, endTime),
      ),
    );
    return {
      startTime: clamp(pointerTime, timeDomain.min, latestStartTime),
      endTime,
    };
  }

  if (drag.mode === "end") {
    const earliestEndTime = Math.min(
      timeDomain.max,
      Math.max(
        startTime + minWindow,
        earliestEndTimeForMinVisiblePoints(chartData, startTime),
      ),
    );
    return {
      startTime,
      endTime: clamp(pointerTime, earliestEndTime, timeDomain.max),
    };
  }

  if (drag.mode === "range") {
    const width = drag.originEndTime - drag.originStartTime;
    const delta = pointerTime - drag.originTime;
    const nextStart = clamp(
      drag.originStartTime + delta,
      timeDomain.min,
      timeDomain.max - width,
    );
    return {
      startTime: nextStart,
      endTime: nextStart + width,
    };
  }

  return null;
}
