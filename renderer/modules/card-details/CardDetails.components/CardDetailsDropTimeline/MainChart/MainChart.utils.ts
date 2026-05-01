import type { ChartColors } from "~/renderer/hooks";
import {
  clamp,
  drawDonutIndicator,
  drawMonotoneCurve,
  type SplinePoint,
} from "~/renderer/lib/canvas-core";

import { BAR_WIDTH } from "../constants";
import { formatAxisDate } from "../helpers";
import type {
  ChartDataPoint,
  DropTimelineMetricKey,
  DropTimelinePointMetrics,
  InactivityGapRange,
  LeagueMarker,
} from "../types";

export interface Layout {
  chartLeft: number;
  chartRight: number;
  chartTop: number;
  chartBottom: number;
  chartWidth: number;
  chartHeight: number;
}

export interface AnticipatedSeriesBuildResult {
  metricsByKey: Map<string, DropTimelinePointMetrics>;
}

export interface XAxisLabel {
  time: number;
  marker?: boolean;
}

interface TooltipStyleParams {
  tooltip: { visible: boolean; x: number; y: number; dataPoint: unknown };
  tooltipSize: { width: number; height: number };
  canvasSize: { width: number; height: number };
}

const AXIS_LEFT = 44;
const AXIS_RIGHT = 44;
const AXIS_TOP = 8;
const AXIS_BOTTOM = 24;
const MARKER_LABEL_OFFSET_X = 15;
const MARKER_LABEL_OFFSET_Y = 6;
const MARKER_LABEL_LETTER_SPACING_EM = 0.2;
const EXPECTED_BAR_WIDTH = BAR_WIDTH;
const EXPECTED_BAR_STRIPE_SPACING = 6;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT = 220;
const TOOLTIP_OFFSET = 12;
const TOOLTIP_MARGIN = 4;

export const MAIN_CHART_TICK_COUNT = 5;
export const MAIN_CHART_HOVER_THRESHOLD = 24;
export const MAIN_CHART_COMPRESSED_GAP_WIDTH_PX = 20;
export const MAIN_CHART_TOOLTIP_SIZE = {
  width: TOOLTIP_WIDTH,
  height: TOOLTIP_HEIGHT,
};

export function getChartPointKey(
  point: Pick<ChartDataPoint, "time" | "sessionId">,
) {
  return `${Math.round(point.time)}:${point.sessionId}`;
}

export function isRealPoint(point: ChartDataPoint) {
  return !point.isGap && !point.isBoundary;
}

export function computeTooltipStyle({
  tooltip,
  tooltipSize,
  canvasSize,
}: TooltipStyleParams) {
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

function formatMetricTick(value: number): string {
  const normalized = Math.max(0, Math.round(value));
  return normalized.toLocaleString();
}

function formatDeckTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const normalized = Math.max(0, Math.round(value));
  if (normalized < 1000) return normalized.toLocaleString();

  const thousands = normalized / 1000;
  const fractionDigits = thousands < 10 && !Number.isInteger(thousands) ? 1 : 0;
  return `${thousands.toFixed(fractionDigits)}k`;
}

export function computeLayout(width: number, height: number): Layout {
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

export function computeTimeDomain(data: ChartDataPoint[]) {
  if (data.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...data.map((point) => point.time));
  let max = Math.max(...data.map((point) => point.time));
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return { min, max };
}

export function buildAnticipatedSeries(
  data: ChartDataPoint[],
): AnticipatedSeriesBuildResult {
  const realPoints = data.filter(isRealPoint).sort((a, b) => a.time - b.time);
  if (realPoints.length === 0) {
    return {
      metricsByKey: new Map<string, DropTimelinePointMetrics>(),
    };
  }

  const totalDrops = realPoints.reduce((sum, point) => sum + point.count, 0);
  const totalDecksOpened = realPoints.reduce(
    (sum, point) => sum + Math.max(0, point.totalDecksOpened),
    0,
  );
  const baselineDropRate =
    totalDecksOpened > 0 ? totalDrops / totalDecksOpened : 0;

  const metricsByKey = new Map<string, DropTimelinePointMetrics>();

  for (const point of realPoints) {
    const decksOpened = Math.max(0, point.totalDecksOpened);
    const anticipatedDrops = decksOpened * baselineDropRate;

    metricsByKey.set(getChartPointKey(point), {
      anticipatedDrops,
    });
  }

  return {
    metricsByKey,
  };
}

export function buildXAxisLabels(
  visibleData: ChartDataPoint[],
  markerLabels: LeagueMarker[],
): XAxisLabel[] {
  const labels: XAxisLabel[] = [];
  const sorted = [...visibleData].sort((a, b) => a.time - b.time);

  let segment: ChartDataPoint[] = [];
  const flush = () => {
    if (segment.length === 0) return;
    const midPoint = segment[Math.floor((segment.length - 1) / 2)];
    labels.push({ time: midPoint.time });
    segment = [];
  };

  for (const point of sorted) {
    if (point.isGap) {
      flush();
      continue;
    }
    if (point.isBoundary) continue;
    segment.push(point);
  }
  flush();

  for (const marker of markerLabels) {
    if (marker.type !== "start" || !Number.isFinite(marker.time)) continue;
    labels.push({ time: marker.time, marker: true });
  }

  const deduped = new Map<number, XAxisLabel>();
  for (const label of labels) {
    const key = Math.round(label.time);
    const previous = deduped.get(key);
    if (!previous || label.marker) {
      deduped.set(key, label);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.time - b.time);
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  metricTicks: number[],
  timeTicks: number[],
  mapMetricY: (value: number) => number,
  _mapX: (value: number) => number,
  color: string,
  zeroLineColor?: string,
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

  for (let i = 1; i < metricTicks.length - 1; i++) {
    const y = mapMetricY(metricTicks[i]);
    ctx.beginPath();
    ctx.moveTo(layout.chartLeft, y);
    ctx.lineTo(layout.chartRight, y);
    ctx.stroke();
  }

  for (let i = 1; i < timeTicks.length - 1; i++) {
    const x =
      layout.chartLeft + (layout.chartWidth * i) / (timeTicks.length - 1);
    ctx.beginPath();
    ctx.moveTo(x, layout.chartTop);
    ctx.lineTo(x, layout.chartBottom);
    ctx.stroke();
  }

  if (zeroLineColor) {
    const zeroY = mapMetricY(0);
    if (
      Number.isFinite(zeroY) &&
      zeroY >= layout.chartTop &&
      zeroY <= layout.chartBottom
    ) {
      ctx.strokeStyle = zeroLineColor;
      ctx.setLineDash([]);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(layout.chartLeft, zeroY);
      ctx.lineTo(layout.chartRight, zeroY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  metricTicks: number[],
  deckTicks: number[],
  xAxisLabels: XAxisLabel[],
  mapMetricY: (value: number) => number,
  mapDeckY: (value: number) => number,
  mapX: (value: number) => number,
  hiddenMetrics: ReadonlySet<DropTimelineMetricKey>,
  c: ChartColors,
) {
  ctx.save();
  ctx.font = "10px system-ui, sans-serif";

  const showDropAxis =
    !hiddenMetrics.has("drops-per-day") || !hiddenMetrics.has("anticipated");

  if (showDropAxis) {
    ctx.fillStyle = c.primary;
    ctx.textAlign = "right";
    for (let i = 0; i < metricTicks.length; i++) {
      const y = mapMetricY(metricTicks[i]);
      ctx.textBaseline =
        i === 0 ? "bottom" : i === metricTicks.length - 1 ? "top" : "middle";
      ctx.fillText(formatMetricTick(metricTicks[i]), layout.chartLeft - 6, y);
    }
  }

  if (!hiddenMetrics.has("decks-opened")) {
    ctx.fillStyle = c.bc30;
    ctx.textAlign = "left";
    for (let i = 0; i < deckTicks.length; i++) {
      const y = mapDeckY(deckTicks[i]);
      ctx.textBaseline =
        i === 0 ? "bottom" : i === deckTicks.length - 1 ? "top" : "middle";
      ctx.fillText(formatDeckTick(deckTicks[i]), layout.chartRight + 6, y);
    }
  }

  const minLabelSpacingPx = 42;
  const placedLabels: Array<{ x: number; label: XAxisLabel }> = [];
  const candidates = xAxisLabels
    .map((label) => ({ x: mapX(label.time), label }))
    .filter(
      ({ x }) =>
        Number.isFinite(x) &&
        x >= layout.chartLeft - 2 &&
        x <= layout.chartRight + 2,
    )
    .sort((a, b) => a.x - b.x);

  const canPlace = (x: number) =>
    placedLabels.every((placed) => Math.abs(placed.x - x) >= minLabelSpacingPx);

  for (const candidate of candidates) {
    if (!candidate.label.marker) continue;
    if (canPlace(candidate.x)) {
      placedLabels.push(candidate);
    }
  }
  for (const candidate of candidates) {
    if (candidate.label.marker) continue;
    if (canPlace(candidate.x)) {
      placedLabels.push(candidate);
    }
  }

  placedLabels.sort((a, b) => a.x - b.x);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const { x, label } of placedLabels) {
    ctx.fillStyle = label.marker ? c.success50 : c.bc35;
    ctx.fillText(formatAxisDate(label.time), x, layout.chartBottom + 7);
  }
  ctx.restore();
}

export function drawReferenceLines(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  markers: LeagueMarker[],
  mapX: (value: number) => number,
  c: ChartColors,
) {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const marker of markers) {
    if (!Number.isFinite(marker.time)) continue;
    const x = mapX(marker.time);
    if (!Number.isFinite(x)) continue;
    if (x < layout.chartLeft || x > layout.chartRight) continue;
    const isStart = marker.type === "start";
    const isMuted = marker.emphasis === "muted";
    ctx.font = isMuted ? "600 10px system-ui" : "700 12px system-ui";
    ctx.strokeStyle = isMuted ? c.bc20 : isStart ? c.success50 : c.bc15;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, layout.chartTop);
    ctx.lineTo(x, layout.chartBottom);
    ctx.stroke();

    ctx.fillStyle = isMuted ? c.bc35 : isStart ? c.success50 : c.bc30;
    ctx.save();
    const labelX = Math.round(x + MARKER_LABEL_OFFSET_X);
    const labelY = Math.round(layout.chartTop + MARKER_LABEL_OFFSET_Y);
    ctx.translate(labelX, labelY);
    ctx.rotate(Math.PI / 2);
    const textCtx = ctx as CanvasRenderingContext2D & {
      letterSpacing?: string;
    };
    const previousLetterSpacing = textCtx.letterSpacing;
    if ("letterSpacing" in textCtx) {
      textCtx.letterSpacing = `${MARKER_LABEL_LETTER_SPACING_EM}em`;
    }
    ctx.fillText(marker.label.toUpperCase(), 0, 0);
    if ("letterSpacing" in textCtx) {
      textCtx.letterSpacing = previousLetterSpacing ?? "0px";
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawDecksOpenedLine(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  layout: Layout,
  mapX: (value: number) => number,
  mapDeckY: (value: number) => number,
  c: ChartColors,
) {
  const points: SplinePoint[] = data
    .filter((point) => isRealPoint(point) && point.totalDecksOpened > 0)
    .map((point) => ({
      x: mapX(point.time),
      y: mapDeckY(point.totalDecksOpened),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= layout.chartLeft - 8 &&
        point.x <= layout.chartRight + 8,
    )
    .sort((a, b) => a.x - b.x);

  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = c.bc30;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([]);
  ctx.beginPath();
  if (points.length === 1) {
    const point = points[0];
    ctx.moveTo(point.x - 4, point.y);
    ctx.lineTo(point.x + 4, point.y);
  } else {
    drawMonotoneCurve(ctx, points);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawBars(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  layout: Layout,
  mapX: (value: number) => number,
  mapPerSessionY: (value: number) => number,
  c: ChartColors,
) {
  ctx.save();
  ctx.fillStyle = c.primary;
  ctx.strokeStyle = c.b2;
  ctx.lineWidth = 1;
  for (const point of data) {
    if (point.count <= 0 || point.isGap || point.isBoundary) continue;
    const x = mapX(point.time) - BAR_WIDTH / 2;
    const y = mapPerSessionY(point.count);
    const height = Math.max(1, layout.chartBottom - y);
    ctx.fillRect(x, y, BAR_WIDTH, height);
    ctx.strokeRect(x, y, BAR_WIDTH, height);
  }
  ctx.restore();
}

export function drawBarLabels(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  metricsByKey: ReadonlyMap<string, DropTimelinePointMetrics> | null,
  layout: Layout,
  mapX: (value: number) => number,
  mapPerSessionY: (value: number) => number,
  c: ChartColors,
) {
  ctx.save();
  ctx.fillStyle = c.bc50;
  ctx.font = "8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    if (point.count <= 0 || point.isGap || point.isBoundary) continue;
    const x = mapX(point.time);

    let suppress = false;
    for (let j = 0; j < data.length; j++) {
      if (i === j) continue;
      const neighbor = data[j];
      if (neighbor.count <= 0 || neighbor.isGap || neighbor.isBoundary) {
        continue;
      }
      if (
        Math.abs(mapX(neighbor.time) - x) < 14 &&
        neighbor.count > point.count
      ) {
        suppress = true;
        break;
      }
    }
    if (suppress) continue;

    const expectedDrops = metricsByKey
      ? (metricsByKey.get(getChartPointKey(point))?.anticipatedDrops ?? 0)
      : 0;
    const labelAnchor = Math.max(point.count, expectedDrops);
    const y = Math.max(layout.chartTop + 10, mapPerSessionY(labelAnchor) - 4);
    ctx.fillText(String(point.count), x, y);
  }
  ctx.restore();
}

export function drawExpectedBars(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  metricsByKey: ReadonlyMap<string, DropTimelinePointMetrics>,
  layout: Layout,
  mapX: (value: number) => number,
  mapPerSessionY: (value: number) => number,
  c: ChartColors,
) {
  ctx.save();
  for (const point of data) {
    if (point.isGap || point.isBoundary) continue;
    const metrics = metricsByKey.get(getChartPointKey(point));
    const expectedDrops = Math.max(0, metrics?.anticipatedDrops ?? 0);
    if (expectedDrops <= 0 || expectedDrops <= point.count) continue;

    const x = mapX(point.time) - EXPECTED_BAR_WIDTH / 2;
    const y = mapPerSessionY(expectedDrops);
    const height = Math.max(1, layout.chartBottom - y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, EXPECTED_BAR_WIDTH, height);
    ctx.clip();

    ctx.fillStyle = c.bc05;
    ctx.fillRect(x, y, EXPECTED_BAR_WIDTH, height);

    ctx.strokeStyle = c.bc30;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (
      let offset = -height;
      offset < EXPECTED_BAR_WIDTH + height;
      offset += EXPECTED_BAR_STRIPE_SPACING
    ) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + height);
      ctx.lineTo(x + offset + height, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = c.bc20;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, EXPECTED_BAR_WIDTH, height);
  }
  ctx.restore();
}

export function drawInactivityGap(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  gap: InactivityGapRange | null,
  mapX: (value: number) => number,
  c: ChartColors,
) {
  if (!gap) return;

  const xStart = mapX(gap.startTime);
  const xEnd = mapX(gap.endTime);
  if (!Number.isFinite(xStart) || !Number.isFinite(xEnd) || xEnd <= xStart) {
    return;
  }

  const startX = Math.max(
    layout.chartLeft,
    Math.min(layout.chartRight, xStart),
  );
  const endX = Math.max(layout.chartLeft, Math.min(layout.chartRight, xEnd));
  if (endX <= startX + 1) return;

  const top = layout.chartTop;
  const bottom = layout.chartBottom;
  const height = Math.max(0, bottom - top);
  if (height <= 0) return;

  const width = Math.max(1, endX - startX);
  const centerX = startX + width / 2;
  const zigzagAmplitude = Math.max(0.8, Math.min(1.8, width * 0.12));
  const zigzagStep = 8;

  ctx.save();
  const veil = ctx.createLinearGradient(startX, top, endX, top);
  veil.addColorStop(0, "rgba(0, 0, 0, 0)");
  veil.addColorStop(0.25, "rgba(0, 0, 0, 0.04)");
  veil.addColorStop(0.5, "rgba(0, 0, 0, 0.12)");
  veil.addColorStop(0.75, "rgba(0, 0, 0, 0.04)");
  veil.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = veil;
  ctx.fillRect(startX, top, width, height);

  const coreLaneWidth = Math.max(0.75, Math.min(1.5, width * 0.08));
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(centerX - coreLaneWidth / 2, top, coreLaneWidth, height);

  ctx.strokeStyle = c.bc20;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(centerX, top);
  let y = top;
  let toRight = true;
  while (y < bottom) {
    const nextY = Math.min(bottom, y + zigzagStep);
    const nextX = centerX + (toRight ? zigzagAmplitude : -zigzagAmplitude);
    ctx.lineTo(nextX, nextY);
    y = nextY;
    toRight = !toRight;
  }
  ctx.stroke();
  ctx.restore();
}

export function drawHover(
  ctx: CanvasRenderingContext2D,
  point: ChartDataPoint | null,
  layout: Layout,
  mapX: (value: number) => number,
  indicatorY: number | null,
  indicatorColor: string,
  c: ChartColors,
) {
  if (!point) return;
  const x = mapX(point.time);

  ctx.save();
  ctx.strokeStyle = c.bc15;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, layout.chartTop);
  ctx.lineTo(x, layout.chartBottom);
  ctx.stroke();

  if (indicatorY !== null && Number.isFinite(indicatorY)) {
    drawDonutIndicator(ctx, x, indicatorY, {
      fillStyle: indicatorColor,
      strokeStyle: "rgba(255, 255, 255, 0.9)",
    });
  }
  ctx.restore();
}
