import {
  clamp,
  createLinearMapper,
  drawDonutIndicator,
  drawMonotoneCurve,
  evenTicks,
  hitTestIndexBrush,
  indexFromBrushPixel,
  type LinearMapper,
  nearestPointHitTest,
  type SplinePoint,
} from "~/renderer/lib/canvas-core";

import { BRUSH_HEIGHT } from "./constants";
import { formatAxisDate, formatRate, formatVolume } from "./helpers";
import type { ChartDataPoint } from "./types";

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

export interface BrushRange {
  startIndex: number;
  endIndex: number;
}

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  dataPoint: ChartDataPoint | null;
}

export interface ChartDomains {
  time: { min: number; max: number };
  rate: { min: number; max: number };
  volume: { min: number; max: number };
}

export interface PriceChartColors {
  primary: string;
  primary02: string;
  primary30: string;
  b2: string;
  bc06: string;
  bc15: string;
  bc35: string;
}

export interface VolumeBarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PriceChartGeometry {
  mapX: LinearMapper;
  mapRateY: LinearMapper;
  mapVolumeY: LinearMapper;
  mapBrushX: LinearMapper | null;
  rateTicks: number[];
  volumeTicks: number[];
  timeTicks: number[];
  ratePoints: SplinePoint[];
  volumeBars: VolumeBarRect[];
  brushPoints: SplinePoint[];
  brushLineY: ((index: number) => number) | null;
}

export type DragMode = "start" | "end" | "range" | null;

const AXIS_LEFT = 50;
const AXIS_RIGHT = 50;
const AXIS_TOP = 8;
const AXIS_BOTTOM = 24;
const BRUSH_GAP = 8;
const TICK_COUNT = 5;

export const MIN_VISIBLE_POINTS = 5;
export const MIN_BRUSH_SPAN = MIN_VISIBLE_POINTS - 1;
export const BRUSH_ZOOM_STEP = 3;
export const HOVER_THRESHOLD = 24;
export const TRAVELLER_WIDTH = 8;
export const TOOLTIP_WIDTH = 220;
export const TOOLTIP_HEIGHT = 90;
export const TOOLTIP_OFFSET = 12;
export const TOOLTIP_MARGIN = 4;

export function computeLayout(
  width: number,
  height: number,
  showBrush: boolean,
): ChartLayout {
  const brushBlock = showBrush ? BRUSH_HEIGHT + BRUSH_GAP : 0;
  const chartLeft = AXIS_LEFT;
  const chartRight = Math.max(chartLeft, width - AXIS_RIGHT);
  const chartTop = AXIS_TOP;
  const chartBottom = Math.max(chartTop, height - AXIS_BOTTOM - brushBlock);
  const brushTop = height - BRUSH_HEIGHT - 4;
  const brushBottom = brushTop + BRUSH_HEIGHT;

  return {
    chartLeft,
    chartRight,
    chartTop,
    chartBottom,
    chartWidth: Math.max(0, chartRight - chartLeft),
    chartHeight: Math.max(0, chartBottom - chartTop),
    brushTop,
    brushBottom,
    brushLeft: chartLeft,
    brushRight: chartRight,
    brushHeight: BRUSH_HEIGHT,
  };
}

export function computeDomains(chartData: ChartDataPoint[]): ChartDomains {
  if (chartData.length === 0) {
    return {
      time: { min: 0, max: 1 },
      rate: { min: 0, max: 1 },
      volume: { min: 0, max: 1 },
    };
  }

  let minRate = Infinity;
  let maxRate = -Infinity;
  let maxVolume = 0;
  let timeMin = Infinity;
  let timeMax = -Infinity;

  for (const point of chartData) {
    minRate = Math.min(minRate, point.rate);
    maxRate = Math.max(maxRate, point.rate);
    maxVolume = Math.max(maxVolume, point.volume);
    timeMin = Math.min(timeMin, point.time);
    timeMax = Math.max(timeMax, point.time);
  }

  const ratePadding = (maxRate - minRate) * 0.1 || maxRate * 0.1 || 1;
  if (timeMin === timeMax) {
    timeMin -= 1;
    timeMax += 1;
  }

  return {
    time: { min: timeMin, max: timeMax },
    rate: {
      min: Math.max(0, minRate - ratePadding),
      max: maxRate + ratePadding,
    },
    volume: { min: 0, max: maxVolume * 1.2 || 1 },
  };
}

export function computeTooltipStyle({
  tooltip,
  canvasSize,
}: {
  tooltip: TooltipState;
  canvasSize: { width: number; height: number };
}) {
  if (!tooltip.visible || !tooltip.dataPoint) {
    return { display: "none" as const };
  }

  let left = tooltip.x + TOOLTIP_OFFSET;
  if (left + TOOLTIP_WIDTH > canvasSize.width - TOOLTIP_MARGIN) {
    left = tooltip.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
  }
  left = clamp(
    left,
    TOOLTIP_MARGIN,
    Math.max(TOOLTIP_MARGIN, canvasSize.width - TOOLTIP_WIDTH),
  );

  let top = tooltip.y + TOOLTIP_OFFSET;
  if (top + TOOLTIP_HEIGHT > canvasSize.height - TOOLTIP_MARGIN) {
    top = tooltip.y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET;
  }
  top = clamp(
    top,
    TOOLTIP_MARGIN,
    Math.max(TOOLTIP_MARGIN, canvasSize.height - TOOLTIP_HEIGHT),
  );

  return {
    position: "absolute" as const,
    left: `${left}px`,
    top: `${top}px`,
    pointerEvents: "none" as const,
    zIndex: 10,
  };
}

export function getEffectiveLayout({
  canvasSize,
  fallbackWidth,
  fallbackHeight,
  layout,
  showBrush,
}: {
  canvasSize: { width: number; height: number };
  fallbackWidth: number;
  fallbackHeight: number;
  layout: ChartLayout;
  showBrush: boolean;
}) {
  return canvasSize.width > 0 && canvasSize.height > 0
    ? layout
    : computeLayout(fallbackWidth, fallbackHeight, showBrush);
}

export function getHoverHitIndex({
  x,
  visibleData,
  geometry,
}: {
  x: number;
  visibleData: ChartDataPoint[];
  geometry: PriceChartGeometry;
}) {
  return nearestPointHitTest(
    x,
    visibleData,
    (point) => geometry.mapX(point.time),
    HOVER_THRESHOLD,
  ).index;
}

export function getBrushPointerIndex({
  x,
  dataLength,
  layout,
}: {
  x: number;
  dataLength: number;
  layout: ChartLayout;
}) {
  const mapBrushX = createLinearMapper(
    0,
    dataLength - 1,
    layout.brushLeft,
    layout.brushRight,
  );
  return indexFromBrushPixel(mapBrushX, x, dataLength);
}

export function hitTestBrushAtPoint({
  x,
  y,
  layout,
  range,
  dataLength,
}: {
  x: number;
  y: number;
  layout: ChartLayout;
  range: BrushRange;
  dataLength: number;
}) {
  const mapBrushX = createLinearMapper(
    0,
    dataLength - 1,
    layout.brushLeft,
    layout.brushRight,
  );

  return hitTestIndexBrush({
    x,
    y,
    layout,
    range,
    mapBrushX,
    travellerWidth: TRAVELLER_WIDTH,
  });
}

export function buildPriceChartGeometry({
  data,
  visibleData,
  layout,
  domains,
  showBrush,
}: {
  data: ChartDataPoint[];
  visibleData: ChartDataPoint[];
  layout: ChartLayout;
  domains: ChartDomains;
  showBrush: boolean;
}): PriceChartGeometry {
  const mapX = createLinearMapper(
    domains.time.min,
    domains.time.max,
    layout.chartLeft,
    layout.chartRight,
  );
  const mapRateY = createLinearMapper(
    domains.rate.min,
    domains.rate.max,
    layout.chartBottom,
    layout.chartTop,
  );
  const mapVolumeY = createLinearMapper(
    domains.volume.min,
    domains.volume.max,
    layout.chartBottom,
    layout.chartTop,
  );
  const mapBrushX =
    showBrush && data.length > 1
      ? createLinearMapper(
          0,
          data.length - 1,
          layout.brushLeft,
          layout.brushRight,
        )
      : null;
  const rateTicks = evenTicks(domains.rate.min, domains.rate.max, TICK_COUNT);
  const volumeTicks = evenTicks(
    domains.volume.min,
    domains.volume.max,
    TICK_COUNT,
  );
  const timeTicks = buildTimeTicks(visibleData, domains.time);
  const ratePoints = buildRatePoints(visibleData, mapX, mapRateY);
  const volumeBars = buildVolumeBars(visibleData, layout, mapX, mapVolumeY);
  const { brushPoints, brushLineY } = buildBrushGeometry({
    data,
    layout,
    mapBrushX,
  });

  return {
    mapX,
    mapRateY,
    mapVolumeY,
    mapBrushX,
    rateTicks,
    volumeTicks,
    timeTicks,
    ratePoints,
    volumeBars,
    brushPoints,
    brushLineY,
  };
}

export function drawPriceChartCanvas({
  ctx,
  data,
  visibleData,
  layout,
  geometry,
  range,
  showBrush,
  hoverIndex,
  colors,
}: {
  ctx: CanvasRenderingContext2D;
  data: ChartDataPoint[];
  visibleData: ChartDataPoint[];
  layout: ChartLayout;
  geometry: PriceChartGeometry;
  range: BrushRange;
  showBrush: boolean;
  hoverIndex: number | null;
  colors: PriceChartColors;
}) {
  drawGrid(
    ctx,
    layout,
    geometry.rateTicks,
    geometry.timeTicks,
    geometry.mapRateY,
    geometry.mapX,
    colors.bc06,
  );
  drawAxes(
    ctx,
    layout,
    geometry.rateTicks,
    geometry.volumeTicks,
    geometry.timeTicks,
    geometry.mapRateY,
    geometry.mapVolumeY,
    geometry.mapX,
    colors.bc35,
    colors.bc15,
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    layout.chartLeft - 2,
    layout.chartTop - 2,
    layout.chartWidth + 4,
    layout.chartHeight + 4,
  );
  ctx.clip();

  drawVolumeBars(ctx, geometry.volumeBars, colors.bc15);
  drawRateArea(
    ctx,
    geometry.ratePoints,
    layout,
    colors.primary,
    colors.primary30,
    colors.primary02,
  );
  drawHover(
    ctx,
    hoverIndex === null ? null : visibleData[hoverIndex],
    layout,
    geometry.mapX,
    geometry.mapRateY,
    colors.bc15,
    colors.primary,
    "rgba(255, 255, 255, 0.9)",
  );
  ctx.restore();

  if (!showBrush || data.length === 0) return;
  if (!geometry.mapBrushX || !geometry.brushLineY) return;
  drawBrush(
    ctx,
    data,
    layout,
    range,
    geometry,
    colors.primary,
    colors.b2,
    colors.bc15,
    hoverIndex,
  );
}

function buildTimeTicks(
  data: ChartDataPoint[],
  domain: { min: number; max: number },
) {
  if (data.length === 0) return evenTicks(domain.min, domain.max, TICK_COUNT);
  if (data.length <= TICK_COUNT) return data.map((point) => point.time);

  const ticks: number[] = [];
  const lastIndex = data.length - 1;
  for (let i = 0; i < TICK_COUNT; i++) {
    const index = Math.round((lastIndex * i) / (TICK_COUNT - 1));
    const time = data[index].time;
    if (ticks[ticks.length - 1] !== time) ticks.push(time);
  }
  return ticks;
}

function buildRatePoints(
  data: ChartDataPoint[],
  mapX: (value: number) => number,
  mapRateY: (value: number) => number,
) {
  const points: SplinePoint[] = [];
  for (const point of data) {
    points.push({
      x: mapX(point.time),
      y: mapRateY(point.rate),
    });
  }
  return points;
}

function buildVolumeBars(
  data: ChartDataPoint[],
  layout: ChartLayout,
  mapX: (value: number) => number,
  mapVolumeY: (value: number) => number,
) {
  if (data.length === 0) return [];

  const slotWidth =
    data.length > 1
      ? Math.abs(mapX(data[1].time) - mapX(data[0].time))
      : layout.chartWidth / 8;
  const width = clamp(slotWidth * 0.52, 2, 14);
  const bars: VolumeBarRect[] = [];

  for (const point of data) {
    if (point.volume <= 0) continue;
    const x = mapX(point.time) - width / 2;
    const y = mapVolumeY(point.volume);
    bars.push({ x, y, width, height: layout.chartBottom - y });
  }

  return bars;
}

function buildBrushGeometry({
  data,
  layout,
  mapBrushX,
}: {
  data: ChartDataPoint[];
  layout: ChartLayout;
  mapBrushX: LinearMapper | null;
}) {
  if (data.length === 0 || !mapBrushX) {
    return {
      brushPoints: [],
      brushLineY: null,
    };
  }

  let minRate = Infinity;
  let maxRate = -Infinity;
  for (const point of data) {
    minRate = Math.min(minRate, point.rate);
    maxRate = Math.max(maxRate, point.rate);
  }
  if (minRate === maxRate) {
    minRate -= 1;
    maxRate += 1;
  }

  const { brushBottom, brushHeight } = layout;
  const brushLineY = (index: number) => {
    const point = data[index];
    const rateFraction = (point.rate - minRate) / (maxRate - minRate || 1);
    return brushBottom - 3 - rateFraction * (brushHeight - 6);
  };
  const brushPoints: SplinePoint[] = [];
  for (let index = 0; index < data.length; index++) {
    brushPoints.push({
      x: mapBrushX(index),
      y: brushLineY(index),
    });
  }

  return { brushPoints, brushLineY };
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  rateTicks: number[],
  timeTicks: number[],
  mapRateY: (value: number) => number,
  mapX: (value: number) => number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(
    layout.chartLeft,
    layout.chartTop,
    layout.chartWidth,
    layout.chartHeight,
  );

  for (let i = 1; i < rateTicks.length - 1; i++) {
    const y = mapRateY(rateTicks[i]);
    ctx.beginPath();
    ctx.moveTo(layout.chartLeft, y);
    ctx.lineTo(layout.chartRight, y);
    ctx.stroke();
  }

  for (let i = 1; i < timeTicks.length - 1; i++) {
    const x = mapX(timeTicks[i]);
    ctx.beginPath();
    ctx.moveTo(x, layout.chartTop);
    ctx.lineTo(x, layout.chartBottom);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  rateTicks: number[],
  volumeTicks: number[],
  timeTicks: number[],
  mapRateY: (value: number) => number,
  mapVolumeY: (value: number) => number,
  mapX: (value: number) => number,
  leftColor: string,
  rightColor: string,
) {
  ctx.save();
  ctx.font = "10px system-ui, sans-serif";

  ctx.fillStyle = leftColor;
  ctx.textAlign = "right";
  for (let i = 0; i < rateTicks.length; i++) {
    const y = mapRateY(rateTicks[i]);
    ctx.textBaseline =
      i === 0 ? "bottom" : i === rateTicks.length - 1 ? "top" : "middle";
    ctx.fillText(formatRate(rateTicks[i]), layout.chartLeft - 7, y);
  }

  ctx.fillStyle = rightColor;
  ctx.textAlign = "left";
  for (let i = 0; i < volumeTicks.length; i++) {
    const y = mapVolumeY(volumeTicks[i]);
    ctx.textBaseline =
      i === 0 ? "bottom" : i === volumeTicks.length - 1 ? "top" : "middle";
    ctx.fillText(formatVolume(volumeTicks[i]), layout.chartRight + 7, y);
  }

  ctx.fillStyle = leftColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let lastLabelX = -Infinity;
  for (const tick of timeTicks) {
    const x = mapX(tick);
    if (x - lastLabelX < 42 && tick !== timeTicks[timeTicks.length - 1]) {
      continue;
    }
    ctx.fillText(formatAxisDate(tick), x, layout.chartBottom + 7);
    lastLabelX = x;
  }

  ctx.restore();
}

function drawRoundedTopBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (height <= 0 || width <= 0) return;
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;

  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, bottom);
  ctx.closePath();
  ctx.fill();
}

function drawVolumeBars(
  ctx: CanvasRenderingContext2D,
  bars: VolumeBarRect[],
  color: string,
) {
  if (bars.length === 0) return;
  ctx.save();
  ctx.fillStyle = color;
  for (const bar of bars) {
    drawRoundedTopBar(ctx, bar.x, bar.y, bar.width, bar.height, 2);
  }
  ctx.restore();
}

function drawRateArea(
  ctx: CanvasRenderingContext2D,
  points: SplinePoint[],
  layout: ChartLayout,
  color: string,
  fillStart: string,
  fillEnd: string,
) {
  if (points.length === 0) return;

  const gradient = ctx.createLinearGradient(
    0,
    layout.chartTop,
    0,
    layout.chartBottom,
  );
  gradient.addColorStop(0, fillStart);
  gradient.addColorStop(1, fillEnd);

  ctx.save();
  ctx.beginPath();
  drawMonotoneCurve(ctx, points, layout.chartBottom);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  drawMonotoneCurve(ctx, points);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

function drawHover(
  ctx: CanvasRenderingContext2D,
  point: ChartDataPoint | null,
  layout: ChartLayout,
  mapX: (value: number) => number,
  mapRateY: (value: number) => number,
  lineColor: string,
  dotFill: string,
  dotStroke: string,
) {
  if (!point) return;
  const x = mapX(point.time);
  const y = mapRateY(point.rate);

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, layout.chartTop);
  ctx.lineTo(x, layout.chartBottom);
  ctx.stroke();

  drawDonutIndicator(ctx, x, y, {
    fillStyle: dotFill,
    strokeStyle: dotStroke,
  });
  ctx.restore();
}

function drawBrush(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  layout: ChartLayout,
  range: BrushRange,
  geometry: PriceChartGeometry,
  color: string,
  background: string,
  borderColor: string,
  hoverIndex: number | null,
) {
  if (data.length === 0) return;

  const { brushLeft, brushRight, brushTop, brushBottom, brushHeight } = layout;
  const { mapBrushX, brushLineY } = geometry;
  if (!mapBrushX || !brushLineY) return;

  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(brushLeft, brushTop, brushRight - brushLeft, brushHeight);

  ctx.beginPath();
  drawMonotoneCurve(ctx, geometry.brushPoints);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.stroke();

  const startX = mapBrushX(range.startIndex);
  const endX = mapBrushX(range.endIndex);

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  if (startX > brushLeft) {
    ctx.fillRect(brushLeft, brushTop, startX - brushLeft, brushHeight);
  }
  if (endX < brushRight) {
    ctx.fillRect(endX, brushTop, brushRight - endX, brushHeight);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(brushLeft, brushTop, brushRight - brushLeft, brushHeight);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.strokeRect(startX, brushTop, endX - startX, brushHeight);

  if (hoverIndex !== null) {
    const dataIndex = range.startIndex + hoverIndex;
    if (dataIndex >= 0 && dataIndex < data.length) {
      const hoverX = mapBrushX(dataIndex);
      const hoverY = brushLineY(dataIndex);

      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX, brushTop);
      ctx.lineTo(hoverX, brushBottom);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(hoverX, hoverY, 3, 0, Math.PI * 2);
      ctx.fillStyle = background;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const drawTraveller = (x: number) => {
    const x0 = x - TRAVELLER_WIDTH / 2;
    const y0 = brushTop - 1;
    const height = brushHeight + 2;
    const radius = 3;

    ctx.beginPath();
    ctx.moveTo(x0 + radius, y0);
    ctx.lineTo(x0 + TRAVELLER_WIDTH - radius, y0);
    ctx.quadraticCurveTo(
      x0 + TRAVELLER_WIDTH,
      y0,
      x0 + TRAVELLER_WIDTH,
      y0 + radius,
    );
    ctx.lineTo(x0 + TRAVELLER_WIDTH, y0 + height - radius);
    ctx.quadraticCurveTo(
      x0 + TRAVELLER_WIDTH,
      y0 + height,
      x0 + TRAVELLER_WIDTH - radius,
      y0 + height,
    );
    ctx.lineTo(x0 + radius, y0 + height);
    ctx.quadraticCurveTo(x0, y0 + height, x0, y0 + height - radius);
    ctx.lineTo(x0, y0 + radius);
    ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
    ctx.closePath();

    ctx.fillStyle = background;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    const midY = y0 + height / 2;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, midY - 4);
    ctx.lineTo(x - 1.5, midY + 4);
    ctx.moveTo(x + 1.5, midY - 4);
    ctx.lineTo(x + 1.5, midY + 4);
    ctx.stroke();
  };
  drawTraveller(startX);
  drawTraveller(endX);

  const labelY = brushTop + brushHeight / 2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "9px system-ui, sans-serif";
  ctx.textBaseline = "middle";

  ctx.textAlign = "right";
  ctx.fillText(
    data[range.startIndex]?.dateLabel ??
      formatAxisDate(data[range.startIndex]?.time ?? 0),
    startX - TRAVELLER_WIDTH / 2 - 4,
    labelY,
  );

  ctx.textAlign = "left";
  ctx.fillText(
    data[range.endIndex]?.dateLabel ??
      formatAxisDate(data[range.endIndex]?.time ?? 0),
    endX + TRAVELLER_WIDTH / 2 + 4,
    labelY,
  );
  ctx.restore();
}
