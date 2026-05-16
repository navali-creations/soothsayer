import type { useChartColors } from "~/renderer/hooks";
import {
  type BrushBounds,
  buildPointSegments,
  buildSegmentGapConnectors,
  clipToBrushBounds,
  colorWithAlpha,
  createLinearMapper,
  drawBrushTraveller,
  drawDonutIndicator,
  drawMonotoneCurve,
  ensureCanvasBackingStore,
  evenTicks,
  fillBrushBounds,
  insetBrushBounds,
  type NumericBrushRange,
  normalizeNumericBrushRange,
  resolveVisibleTicks,
  setupCanvas,
  strokeBrushBounds,
} from "~/renderer/lib/canvas-core";

import type {
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../../AppPerformance.types";
import { formatAppPerformanceRouteLabel } from "../../AppPerformance.utils/AppPerformance.utils";
import {
  BRUSH_BOTTOM,
  BRUSH_HEIGHT,
  BRUSH_INSET_X,
  BRUSH_INSET_Y,
  BRUSH_TOP_GAP,
  BRUSH_TRAVELLER_WIDTH,
  MARGIN,
  MIN_BRUSH_RANGE_MS,
  SECONDARY_AXIS_RIGHT_MARGIN,
} from "./PerformanceLineChartCanvas.constants";
import type {
  ChartDomains,
  FullXDomain,
  HoverState,
  PerformanceLine,
  TimeRange,
} from "./PerformanceLineChartCanvas.types";

const ROUTE_MARKER_STROKE_STYLE = "rgba(255, 255, 255, 0.28)";
const ROUTE_MARKER_LABEL_FILL_STYLE = "rgba(255, 255, 255, 0.5)";
const OVERLAY_MARKER_STROKE_STYLE = "rgba(251, 191, 36, 0.68)";
const OVERLAY_MARKER_LABEL_FILL_STYLE = "rgba(253, 230, 138, 0.86)";
const OVERLAY_MARKER_ROUTES = new Set(["/overlay/opened", "/overlay/closed"]);

interface DrawPerformanceLineChartOptions {
  canvas: HTMLCanvasElement | null;
  container: HTMLElement | null;
  canvasSize: { width: number; height: number };
  colors: ReturnType<typeof useChartColors>;
  domains: ChartDomains;
  fullXDomain: FullXDomain;
  samples: AppPerformanceSampleDTO[];
  brushSamples?: AppPerformanceSampleDTO[];
  routeMarkers: AppPerformanceRouteMarkerDTO[];
  lines: PerformanceLine[];
  xRange: TimeRange | null;
  showBrush: boolean;
  valueFormatter: (value: number | null) => string;
  secondaryValueFormatter?: (value: number | null) => string;
  xValueFormatter: (value: number) => string;
  xTicks?: readonly number[];
  emptyLabel: string;
  hover: HoverState | null;
}

export function drawPerformanceLineChart({
  canvas,
  container,
  canvasSize,
  colors,
  domains,
  fullXDomain,
  samples,
  brushSamples = samples,
  routeMarkers,
  lines,
  xRange,
  showBrush,
  valueFormatter,
  secondaryValueFormatter,
  xValueFormatter,
  xTicks,
  emptyLabel,
  hover,
}: DrawPerformanceLineChartOptions): void {
  if (!canvas) return;
  if (!ensureCanvasBackingStore(canvas, container)) return;

  const result = setupCanvas(canvas);
  if (!result) return;

  const { ctx } = result;
  const width = canvasSize.width > 0 ? canvasSize.width : result.width;
  const height = canvasSize.height > 0 ? canvasSize.height : result.height;
  if (width <= 0 || height <= 0) return;

  const hasSecondaryAxis = Boolean(secondaryValueFormatter);
  const chartLayout = getChartLayout(width, hasSecondaryAxis);
  const chartLeft = chartLayout.left;
  const chartRight = chartLayout.right;
  const brushLayout = getBrushLayout(width, height, hasSecondaryAxis);
  const chartTop = MARGIN.top;
  const chartBottom = Math.max(
    chartTop + 1,
    height -
      (showBrush ? BRUSH_BOTTOM + BRUSH_HEIGHT + BRUSH_TOP_GAP : MARGIN.bottom),
  );
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const mapX = createLinearMapper(
    domains.xMin,
    domains.xMax,
    chartLeft,
    chartRight,
  );
  const mapY = createLinearMapper(
    domains.yMin,
    domains.yMax,
    chartBottom,
    chartTop,
  );
  const mapSecondaryY = createLinearMapper(
    domains.secondaryYMin,
    domains.secondaryYMax,
    chartBottom,
    chartTop,
  );
  const mapBrushX = createLinearMapper(
    fullXDomain.xMin,
    fullXDomain.xMax,
    brushLayout.plot.left,
    brushLayout.plot.right,
  );

  ctx.save();
  ctx.fillStyle = colors.b2;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = colors.bc06;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.font = "10px sans-serif";
  ctx.fillStyle = colors.bc40;

  for (const tick of evenTicks(domains.yMin, domains.yMax, 4)) {
    const y = mapY(tick);
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
    ctx.fillText(valueFormatter(tick), 4, y + 3);
  }

  if (secondaryValueFormatter) {
    ctx.textAlign = "right";
    for (const tick of evenTicks(
      domains.secondaryYMin,
      domains.secondaryYMax,
      4,
    )) {
      const y = mapSecondaryY(tick);
      ctx.fillText(secondaryValueFormatter(tick), width - 4, y + 3);
    }
    ctx.textAlign = "left";
  }

  for (const tick of resolveVisibleTicks({
    ticks: xTicks,
    min: domains.xMin,
    max: domains.xMax,
  })) {
    const x = mapX(tick);
    ctx.beginPath();
    ctx.moveTo(x, chartTop);
    ctx.lineTo(x, chartBottom);
    ctx.stroke();
    ctx.fillText(xValueFormatter(tick), x - 16, chartBottom + 18);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(chartLeft, chartTop, chartWidth, chartHeight);
  ctx.clip();

  const markerLabelLaneRights: number[] = [];
  const markerLabelLineHeight = 12;
  const maxMarkerLabelLanes = Math.max(
    1,
    Math.floor((chartHeight - 8) / markerLabelLineHeight),
  );
  for (const marker of routeMarkers) {
    if (marker.elapsedMs < domains.xMin || marker.elapsedMs > domains.xMax) {
      continue;
    }

    const x = mapX(marker.elapsedMs);
    ctx.save();
    ctx.strokeStyle = getRouteMarkerStrokeStyle(marker);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartTop);
    ctx.lineTo(x, chartBottom);
    ctx.stroke();
    ctx.restore();

    const markerLabel = formatRouteLabel(marker);
    const labelWidth = ctx.measureText(markerLabel).width;
    const labelX = Math.min(
      Math.max(x + 4, chartLeft + 2),
      chartRight - labelWidth - 2,
    );
    const lane = findMarkerLabelLane(
      markerLabelLaneRights,
      labelX,
      maxMarkerLabelLanes,
    );
    const labelY = chartTop + 10 + lane * markerLabelLineHeight;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.56)";
    ctx.fillRect(labelX - 4, labelY - 9, labelWidth + 8, 13);
    ctx.fillStyle = getRouteMarkerLabelFillStyle(marker);
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillText(markerLabel, labelX, labelY);
    ctx.restore();
    markerLabelLaneRights[lane] = labelX + labelWidth;
  }

  for (const line of lines) {
    const lineMapY = line.axis === "secondary" ? mapSecondaryY : mapY;
    const segments = buildLineSegments(samples, line, mapX, lineMapY);
    if (line.connectNullGaps) {
      drawGapConnectors(
        ctx,
        buildLineGapConnectors(segments),
        resolveLineGapColor(line.color),
        1,
      );
    }
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2;
    ctx.setLineDash(line.dashed ? [5, 5] : []);

    for (const segment of segments) {
      if (segment.length === 1) {
        drawDonutIndicator(ctx, segment[0].x, segment[0].y, {
          fillStyle: line.color,
          strokeStyle: colors.b3,
          radius: 3,
          strokeWidth: 1,
        });
        continue;
      }
      ctx.beginPath();
      drawMonotoneCurve(ctx, segment);
      ctx.stroke();
    }
  }

  drawHoverGuide({
    ctx,
    hover,
    mapX,
    chartTop,
    chartBottom,
    colors,
    xMin: domains.xMin,
    xMax: domains.xMax,
  });

  ctx.restore();

  if (samples.length === 0) {
    ctx.fillStyle = colors.bc50;
    ctx.font = "12px sans-serif";
    ctx.fillText(emptyLabel, chartLeft + 8, chartTop + 22);
  }

  if (showBrush) {
    drawBrush({
      ctx,
      samples: brushSamples,
      lines,
      mapBrushX,
      outerBounds: brushLayout.outer,
      plotBounds: brushLayout.plot,
      colors,
      selectedRange: normalizeTimeRange(xRange, fullXDomain) ?? {
        startMs: fullXDomain.xMin,
        endMs: fullXDomain.xMax,
      },
    });
  }

  ctx.restore();
}

function drawHoverGuide({
  ctx,
  hover,
  mapX,
  chartTop,
  chartBottom,
  colors,
  xMin,
  xMax,
}: {
  ctx: CanvasRenderingContext2D;
  hover: HoverState | null;
  mapX: (value: number) => number;
  chartTop: number;
  chartBottom: number;
  colors: ReturnType<typeof useChartColors>;
  xMin: number;
  xMax: number;
}) {
  const elapsedMs = hover?.sample?.captureElapsedMs ?? hover?.marker?.elapsedMs;
  if (elapsedMs === undefined || elapsedMs < xMin || elapsedMs > xMax) return;

  const x = mapX(elapsedMs);
  if (!Number.isFinite(x)) return;

  ctx.save();
  ctx.strokeStyle = colors.bc15;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, chartTop);
  ctx.lineTo(x, chartBottom);
  ctx.stroke();
  ctx.restore();
}

function drawBrush({
  ctx,
  samples,
  lines,
  mapBrushX,
  outerBounds,
  plotBounds,
  colors,
  selectedRange,
}: {
  ctx: CanvasRenderingContext2D;
  samples: AppPerformanceSampleDTO[];
  lines: PerformanceLine[];
  mapBrushX: (value: number) => number;
  outerBounds: BrushBounds;
  plotBounds: BrushBounds;
  colors: ReturnType<typeof useChartColors>;
  selectedRange: TimeRange;
}) {
  const plotHeight = plotBounds.bottom - plotBounds.top;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = colors.b2;
  fillBrushBounds(ctx, outerBounds);

  const values = samples.flatMap((sample) =>
    lines
      .map((line) => line.value(sample))
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      ),
  );
  const maxValue = Math.max(1, ...values);
  const mapBrushY = createLinearMapper(
    0,
    maxValue,
    plotBounds.bottom - 3,
    plotBounds.top + 3,
  );

  ctx.save();
  ctx.beginPath();
  clipToBrushBounds(ctx, plotBounds);

  for (const line of lines) {
    const segments = buildLineSegments(samples, line, mapBrushX, mapBrushY);
    if (line.connectNullGaps) {
      ctx.globalAlpha = 1;
      drawGapConnectors(
        ctx,
        buildLineGapConnectors(segments),
        resolveLineGapColor(line.color),
        1,
      );
    }
    ctx.strokeStyle = line.color;
    ctx.globalAlpha = line.dashed ? 0.45 : 0.8;
    ctx.lineWidth = 1.25;
    ctx.setLineDash(line.dashed ? [4, 4] : []);
    for (const segment of segments) {
      if (segment.length < 2) continue;
      ctx.beginPath();
      drawMonotoneCurve(ctx, segment);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  const selectedLeft = mapBrushX(selectedRange.startMs);
  const selectedRight = mapBrushX(selectedRange.endMs);
  if (selectedLeft > plotBounds.left) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(
      plotBounds.left,
      plotBounds.top,
      selectedLeft - plotBounds.left,
      plotHeight,
    );
  }
  if (selectedRight < plotBounds.right) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(
      selectedRight,
      plotBounds.top,
      plotBounds.right - selectedRight,
      plotHeight,
    );
  }

  ctx.strokeStyle = colors.bc15;
  ctx.lineWidth = 1;
  strokeBrushBounds(ctx, outerBounds);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  strokeBrushBounds(ctx, {
    left: selectedLeft,
    right: selectedRight,
    top: plotBounds.top,
    bottom: plotBounds.bottom,
  });

  const travellerColors = {
    fill: colors.b2,
    stroke: "rgba(255, 255, 255, 0.4)",
    grip: colors.bc30,
  };
  drawBrushTraveller({
    ctx,
    x: selectedLeft,
    bounds: plotBounds,
    width: BRUSH_TRAVELLER_WIDTH,
    colors: travellerColors,
  });
  drawBrushTraveller({
    ctx,
    x: selectedRight,
    bounds: plotBounds,
    width: BRUSH_TRAVELLER_WIDTH,
    colors: travellerColors,
  });

  ctx.fillStyle = colors.bc40;
  ctx.font = "9px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const labelY = plotBounds.top + plotHeight / 2;
  const startLabel = formatElapsed(selectedRange.startMs);
  ctx.textAlign = "right";
  const leftLabelX = selectedLeft - BRUSH_TRAVELLER_WIDTH / 2 - 4;
  if (leftLabelX > outerBounds.left + 2) {
    ctx.fillText(startLabel, leftLabelX, labelY);
  }
  const endLabel = formatElapsed(selectedRange.endMs);
  ctx.textAlign = "left";
  const rightLabelX = selectedRight + BRUSH_TRAVELLER_WIDTH / 2 + 4;
  if (rightLabelX < outerBounds.right - 2) {
    ctx.fillText(endLabel, rightLabelX, labelY);
  }
  ctx.restore();
}

export function buildLineSegments(
  samples: AppPerformanceSampleDTO[],
  line: PerformanceLine,
  mapX: (value: number) => number,
  mapY: (value: number) => number,
) {
  return buildPointSegments(samples, (sample) => {
    const value = line.value(sample);
    if (value === null || !Number.isFinite(value)) {
      return null;
    }

    return {
      x: mapX(sample.captureElapsedMs),
      y: mapY(value),
    };
  });
}

export function selectSamplesForTimeRange(
  samples: AppPerformanceSampleDTO[],
  xMin: number,
  xMax: number,
): AppPerformanceSampleDTO[] {
  if (samples.length === 0) return [];

  const firstVisibleIndex = findFirstSampleIndexAtOrAfter(samples, xMin);
  const endExclusive = findFirstSampleIndexAfter(samples, xMax);
  if (
    firstVisibleIndex >= samples.length ||
    endExclusive <= firstVisibleIndex
  ) {
    return [];
  }

  const start = Math.max(0, firstVisibleIndex - 1);
  const end = Math.min(samples.length, endExclusive + 1);
  return samples.slice(start, end);
}

function findFirstSampleIndexAtOrAfter(
  samples: AppPerformanceSampleDTO[],
  value: number,
): number {
  let low = 0;
  let high = samples.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (samples[mid].captureElapsedMs < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function findFirstSampleIndexAfter(
  samples: AppPerformanceSampleDTO[],
  value: number,
): number {
  let low = 0;
  let high = samples.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (samples[mid].captureElapsedMs <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function selectSpanSamples(
  samples: AppPerformanceSampleDTO[],
  maxSamples: number,
): AppPerformanceSampleDTO[] {
  if (samples.length <= maxSamples) return samples;
  if (maxSamples <= 0) return [];
  if (maxSamples === 1) return [samples[samples.length - 1]];

  const selected: AppPerformanceSampleDTO[] = [];
  const lastSourceIndex = samples.length - 1;
  for (let index = 0; index < maxSamples; index += 1) {
    const sourceIndex = Math.round(
      (index * lastSourceIndex) / (maxSamples - 1),
    );
    selected.push(samples[sourceIndex]);
  }
  return selected;
}

export function buildLineGapConnectors(
  segments: Array<Array<{ x: number; y: number }>>,
) {
  return buildSegmentGapConnectors(segments);
}

export function resolveLineGapColor(color: string): string {
  return colorWithAlpha(color, 0.45);
}

function drawGapConnectors(
  ctx: CanvasRenderingContext2D,
  connectors: Array<[{ x: number; y: number }, { x: number; y: number }]>,
  strokeStyle: string,
  lineWidth: number,
): void {
  if (connectors.length === 0) return;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([4, 4]);
  for (const [from, to] of connectors) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function findMarkerLabelLane(
  laneRights: number[],
  labelX: number,
  maxLanes: number,
): number {
  for (let lane = 0; lane < laneRights.length; lane += 1) {
    if (labelX > laneRights[lane] + 8) return lane;
  }

  if (laneRights.length < maxLanes) return laneRights.length;

  let bestLane = 0;
  for (let lane = 1; lane < laneRights.length; lane += 1) {
    if (laneRights[lane] < laneRights[bestLane]) {
      bestLane = lane;
    }
  }
  return bestLane;
}

export function normalizeTimeRange(
  range: TimeRange | null | undefined,
  fullXDomain: FullXDomain,
): TimeRange | null {
  const normalized = normalizeNumericBrushRange({
    range: range ? timeRangeToNumericRange(range) : null,
    domain: getBrushDomain(fullXDomain),
    minSpan: MIN_BRUSH_RANGE_MS,
  });
  return normalized ? numericRangeToTimeRange(normalized) : null;
}

export function getChartLayout(
  width: number,
  hasSecondaryAxis = false,
): {
  left: number;
  right: number;
} {
  const left = MARGIN.left;
  const rightMargin = hasSecondaryAxis
    ? SECONDARY_AXIS_RIGHT_MARGIN
    : MARGIN.right;
  return {
    left,
    right: Math.max(left + 1, width - rightMargin),
  };
}

export function getBrushLayout(
  width: number,
  height: number,
  hasSecondaryAxis = false,
): {
  outer: BrushBounds;
  plot: BrushBounds;
} {
  const { left, right } = getChartLayout(width, hasSecondaryAxis);
  const top = height - BRUSH_BOTTOM - BRUSH_HEIGHT;
  const outer = {
    top,
    bottom: top + BRUSH_HEIGHT,
    left,
    right,
  };

  return {
    outer,
    plot: insetBrushBounds(outer, BRUSH_INSET_X, BRUSH_INSET_Y),
  };
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatRouteLabel(marker: AppPerformanceRouteMarkerDTO): string {
  return formatAppPerformanceRouteLabel(marker.route);
}

export function isOverlayRouteMarker(
  marker: AppPerformanceRouteMarkerDTO,
): boolean {
  return OVERLAY_MARKER_ROUTES.has(marker.route);
}

export function getRouteMarkerStrokeStyle(
  marker: AppPerformanceRouteMarkerDTO,
): string {
  return isOverlayRouteMarker(marker)
    ? OVERLAY_MARKER_STROKE_STYLE
    : ROUTE_MARKER_STROKE_STYLE;
}

function getRouteMarkerLabelFillStyle(
  marker: AppPerformanceRouteMarkerDTO,
): string {
  return isOverlayRouteMarker(marker)
    ? OVERLAY_MARKER_LABEL_FILL_STYLE
    : ROUTE_MARKER_LABEL_FILL_STYLE;
}

export function getBrushDomain(fullXDomain: FullXDomain) {
  return {
    min: fullXDomain.xMin,
    max: fullXDomain.xMax,
  };
}

export function timeRangeToNumericRange(range: TimeRange): NumericBrushRange {
  return {
    start: range.startMs,
    end: range.endMs,
  };
}

export function numericRangeToTimeRange(range: NumericBrushRange): TimeRange {
  return {
    startMs: range.start,
    endMs: range.end,
  };
}
