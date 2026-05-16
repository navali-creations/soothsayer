import type { LinearMapper } from "./canvas-primitives";
import { clamp } from "./canvas-primitives";

export interface IndexBrushRange {
  startIndex: number;
  endIndex: number;
}

export interface NumericBrushRange {
  start: number;
  end: number;
}

export interface NumericBrushDomain {
  min: number;
  max: number;
}

export interface BrushAreaLayout {
  brushTop: number;
  brushBottom: number;
}

export type BrushHitTarget =
  | "left-traveller"
  | "right-traveller"
  | "brush-body"
  | null;

export function indexFromBrushPixel(
  mapBrushX: LinearMapper,
  x: number,
  itemCount: number,
): number {
  return Math.round(clamp(mapBrushX.inverse(x), 0, Math.max(0, itemCount - 1)));
}

export function valueFromBrushPixel({
  x,
  brushLeft,
  brushRight,
  domain,
}: {
  x: number;
  brushLeft: number;
  brushRight: number;
  domain: NumericBrushDomain;
}): number {
  const clampedX = clamp(x, brushLeft, brushRight);
  const fraction =
    brushRight === brushLeft
      ? 0
      : (clampedX - brushLeft) / (brushRight - brushLeft);
  return domain.min + fraction * (domain.max - domain.min);
}

export function hitTestIndexBrush({
  x,
  y,
  layout,
  range,
  mapBrushX,
  travellerWidth,
  travellerHitSlop = 4,
}: {
  x: number;
  y: number;
  layout: BrushAreaLayout;
  range: IndexBrushRange;
  mapBrushX: (index: number) => number;
  travellerWidth: number;
  travellerHitSlop?: number;
}): BrushHitTarget {
  if (y < layout.brushTop || y > layout.brushBottom) return null;

  const startX = mapBrushX(range.startIndex);
  const endX = mapBrushX(range.endIndex);
  const hitDistance = travellerWidth + travellerHitSlop;
  const startDistance = Math.abs(x - startX);
  const endDistance = Math.abs(x - endX);

  if (startDistance <= hitDistance || endDistance <= hitDistance) {
    return startDistance <= endDistance ? "left-traveller" : "right-traveller";
  }

  if (x >= startX && x <= endX) return "brush-body";
  return null;
}

export function hitTestNumericBrush({
  x,
  y,
  layout,
  range,
  mapBrushX,
  travellerWidth,
  travellerHitSlop = 4,
}: {
  x: number;
  y: number;
  layout: BrushAreaLayout & { brushLeft: number; brushRight: number };
  range: NumericBrushRange;
  mapBrushX: (value: number) => number;
  travellerWidth: number;
  travellerHitSlop?: number;
}): BrushHitTarget {
  if (y < layout.brushTop || y > layout.brushBottom) return null;

  const startX = mapBrushX(range.start);
  const endX = mapBrushX(range.end);
  const hitDistance = travellerWidth + travellerHitSlop;
  const startDistance = Math.abs(x - startX);
  const endDistance = Math.abs(x - endX);

  if (startDistance <= hitDistance || endDistance <= hitDistance) {
    return startDistance <= endDistance ? "left-traveller" : "right-traveller";
  }

  if (x >= startX && x <= endX) return "brush-body";
  return null;
}

export function resizeIndexBrush({
  range,
  pointerIndex,
  edge,
  itemCount,
  minSpan,
}: {
  range: IndexBrushRange;
  pointerIndex: number;
  edge: "start" | "end";
  itemCount: number;
  minSpan: number;
}): IndexBrushRange {
  const maxIndex = Math.max(0, itemCount - 1);

  if (edge === "start") {
    return {
      startIndex: clamp(pointerIndex, 0, range.endIndex - minSpan),
      endIndex: range.endIndex,
    };
  }

  return {
    startIndex: range.startIndex,
    endIndex: clamp(pointerIndex, range.startIndex + minSpan, maxIndex),
  };
}

export function normalizeNumericBrushRange({
  range,
  domain,
  minSpan,
}: {
  range: NumericBrushRange | null | undefined;
  domain: NumericBrushDomain;
  minSpan: number;
}): NumericBrushRange | null {
  if (!range) return null;
  const fullSpan = domain.max - domain.min;
  const minimumSpan = Math.min(minSpan, fullSpan);
  const start = clamp(Math.min(range.start, range.end), domain.min, domain.max);
  const end = clamp(Math.max(range.start, range.end), domain.min, domain.max);
  if (end - start < minimumSpan) return null;
  return { start, end };
}

export function collapseFullNumericBrushRange({
  range,
  domain,
}: {
  range: NumericBrushRange;
  domain: NumericBrushDomain;
}): NumericBrushRange | null {
  if (range.start <= domain.min && range.end >= domain.max) {
    return null;
  }
  return range;
}

export function resizeNumericBrush({
  range,
  pointerValue,
  edge,
  domain,
  minSpan,
}: {
  range: NumericBrushRange;
  pointerValue: number;
  edge: "start" | "end";
  domain: NumericBrushDomain;
  minSpan: number;
}): NumericBrushRange {
  const fullSpan = domain.max - domain.min;
  const minimumSpan = Math.min(minSpan, fullSpan);

  if (edge === "start") {
    return {
      start: clamp(pointerValue, domain.min, range.end - minimumSpan),
      end: range.end,
    };
  }

  return {
    start: range.start,
    end: clamp(pointerValue, range.start + minimumSpan, domain.max),
  };
}

export function panIndexBrush({
  range,
  deltaIndex,
  itemCount,
}: {
  range: IndexBrushRange;
  deltaIndex: number;
  itemCount: number;
}): IndexBrushRange {
  const maxIndex = Math.max(0, itemCount - 1);
  const span = range.endIndex - range.startIndex;
  let startIndex = range.startIndex + deltaIndex;
  let endIndex = range.endIndex + deltaIndex;

  if (startIndex < 0) {
    startIndex = 0;
    endIndex = span;
  }

  if (endIndex > maxIndex) {
    endIndex = maxIndex;
    startIndex = endIndex - span;
  }

  return { startIndex, endIndex };
}

export function panNumericBrush({
  range,
  delta,
  domain,
}: {
  range: NumericBrushRange;
  delta: number;
  domain: NumericBrushDomain;
}): NumericBrushRange {
  const span = range.end - range.start;
  let start = range.start + delta;
  let end = range.end + delta;

  if (start < domain.min) {
    start = domain.min;
    end = start + span;
  }

  if (end > domain.max) {
    end = domain.max;
    start = end - span;
  }

  return { start, end };
}

export function brushDeltaIndexFromPixels({
  deltaX,
  itemCount,
  brushPixelWidth,
}: {
  deltaX: number;
  itemCount: number;
  brushPixelWidth: number;
}): number {
  if (brushPixelWidth <= 0 || itemCount <= 1) return 0;
  return Math.round(deltaX * ((itemCount - 1) / brushPixelWidth));
}

export function brushDeltaValueFromPixels({
  deltaX,
  brushPixelWidth,
  domain,
}: {
  deltaX: number;
  brushPixelWidth: number;
  domain: NumericBrushDomain;
}): number {
  if (brushPixelWidth <= 0) return 0;
  return (deltaX / brushPixelWidth) * (domain.max - domain.min);
}

export function chartDeltaIndexFromPixels({
  deltaX,
  visibleSpan,
  chartPixelWidth,
}: {
  deltaX: number;
  visibleSpan: number;
  chartPixelWidth: number;
}): number {
  if (chartPixelWidth <= 0 || visibleSpan <= 0) return 0;
  return Math.round(-deltaX * (visibleSpan / chartPixelWidth));
}

export function zoomIndexBrush({
  range,
  itemCount,
  deltaY,
  minSpan,
  zoomStep,
}: {
  range: IndexBrushRange;
  itemCount: number;
  deltaY: number;
  minSpan: number;
  zoomStep: number;
}): IndexBrushRange {
  if (itemCount <= minSpan + 1 || Math.abs(deltaY) < 1) return range;

  const currentSpan = range.endIndex - range.startIndex;
  const maxIndex = itemCount - 1;
  const zoomingIn = deltaY < 0;

  if (zoomingIn) {
    if (currentSpan <= minSpan) return range;
    const shrink = Math.min(zoomStep, Math.floor((currentSpan - minSpan) / 2));
    if (shrink <= 0) return range;
    return {
      startIndex: Math.min(range.startIndex + shrink, maxIndex),
      endIndex: Math.max(range.endIndex - shrink, 0),
    };
  }

  const startIndex = Math.max(0, range.startIndex - zoomStep);
  const endIndex = Math.min(maxIndex, range.endIndex + zoomStep);
  if (startIndex === range.startIndex && endIndex === range.endIndex) {
    return range;
  }
  return { startIndex, endIndex };
}

export function zoomNumericBrush({
  range,
  domain,
  deltaY,
  minSpan,
  zoomFraction,
}: {
  range: NumericBrushRange;
  domain: NumericBrushDomain;
  deltaY: number;
  minSpan: number;
  zoomFraction: number;
}): NumericBrushRange {
  const fullSpan = domain.max - domain.min;
  const minimumSpan = Math.min(minSpan, fullSpan);
  if (fullSpan <= minimumSpan || Math.abs(deltaY) < 1) return range;

  const currentSpan = range.end - range.start;
  const center = (range.start + range.end) / 2;
  const zoomingIn = deltaY < 0;
  const nextSpan = zoomingIn
    ? Math.max(minimumSpan, currentSpan * (1 - zoomFraction))
    : Math.min(fullSpan, currentSpan * (1 + zoomFraction));
  let start = center - nextSpan / 2;
  let end = center + nextSpan / 2;

  if (start < domain.min) {
    start = domain.min;
    end = start + nextSpan;
  }

  if (end > domain.max) {
    end = domain.max;
    start = end - nextSpan;
  }

  return { start, end };
}
