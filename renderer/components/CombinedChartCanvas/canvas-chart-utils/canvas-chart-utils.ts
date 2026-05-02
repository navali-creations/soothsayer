import {
  clamp,
  drawMonotoneCurve,
  evenTicks,
  monotoneTangents,
  parseRgba,
  rgbaStr,
  type SplinePoint,
} from "~/renderer/lib/canvas-core";

import type {
  ActiveLeagueStartMarker,
  BrushRange,
  ChartDataPoint,
} from "../chart-types/chart-types";

// Re-export shared primitives so existing consumers are unaffected
export {
  clamp,
  drawMonotoneCurve,
  evenTicks,
  monotoneTangents,
  parseRgba,
  rgbaStr,
  type SplinePoint,
};

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Domain & Layout Computation ───────────────────────────────────────────────

export interface ChartDomains {
  profit: { min: number; max: number };
  decks: { min: number; max: number };
}

export interface VisibleLeagueStartMarker {
  label: string;
  visibleIndex: number;
  fullIndex: number;
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

export function sumProfitDivine(
  chartData: ReadonlyArray<{ profitDivine: number }>,
) {
  let sum = 0;
  for (const point of chartData) {
    sum += point.profitDivine;
  }
  return sum;
}

export function resolveLeagueStartMarkerIndex({
  chartData,
  leagueStartMarker,
}: {
  chartData: ChartDataPoint[];
  leagueStartMarker: ActiveLeagueStartMarker | null;
}) {
  if (!leagueStartMarker || chartData.length < 2) return null;

  const points: Array<{ index: number; time: number }> = [];
  for (let index = 0; index < chartData.length; index++) {
    const time = new Date(chartData[index].sessionDate).getTime();
    if (Number.isFinite(time)) {
      points.push({ index, time });
    }
  }
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  if (
    leagueStartMarker.time < first.time ||
    leagueStartMarker.time > last.time
  ) {
    return null;
  }

  for (let i = 1; i < points.length; i++) {
    if (leagueStartMarker.time > points[i].time) continue;

    const prev = points[i - 1];
    const next = points[i];
    const span = next.time - prev.time;
    if (span <= 0) return next.index;

    const ratio = (leagueStartMarker.time - prev.time) / span;
    return prev.index + ratio * (next.index - prev.index);
  }

  return points[points.length - 1].index;
}

export function resolveVisibleLeagueStartMarker({
  brushRange,
  leagueStartMarker,
  leagueStartMarkerIndex,
}: {
  brushRange: BrushRange;
  leagueStartMarker: ActiveLeagueStartMarker | null;
  leagueStartMarkerIndex: number | null;
}): VisibleLeagueStartMarker | null {
  if (leagueStartMarkerIndex === null || !leagueStartMarker) return null;
  const start = brushRange.startIndex;
  const end = brushRange.endIndex;
  if (leagueStartMarkerIndex < start || leagueStartMarkerIndex > end) {
    return null;
  }

  return {
    label: leagueStartMarker.label,
    visibleIndex: leagueStartMarkerIndex - start,
    fullIndex: leagueStartMarkerIndex,
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
