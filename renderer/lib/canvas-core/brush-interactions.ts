import type { LinearMapper } from "./canvas-primitives";
import { clamp } from "./canvas-primitives";

export interface IndexBrushRange {
  startIndex: number;
  endIndex: number;
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
