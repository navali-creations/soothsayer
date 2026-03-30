import { type RefObject, useEffect } from "react";

import { MIN_ZOOM_WINDOW, ZOOM_STEP } from "../canvas-chart-utils";
import type { BrushRange } from "../chart-types";

/**
 * Attaches a non-passive wheel listener to the container element that
 * zooms the brush range in/out by shrinking/expanding it symmetrically.
 */
export function useScrollZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  chartDataRef: RefObject<{ length: number }>,
  brushRangeRef: RefObject<BrushRange>,
  onBrushChangeRef: RefObject<(range: BrushRange) => void>,
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      const dataLen = chartDataRef.current.length;
      if (dataLen <= MIN_ZOOM_WINDOW) return;

      const dy = e.deltaY;
      if (Math.abs(dy) < 1) return;

      e.preventDefault();

      const { startIndex, endIndex } = brushRangeRef.current;
      const currentWindow = endIndex - startIndex;
      const maxEnd = dataLen - 1;
      const zoomingIn = dy < 0;

      if (zoomingIn) {
        if (currentWindow <= MIN_ZOOM_WINDOW) return;
        const shrink = Math.min(
          ZOOM_STEP,
          Math.floor((currentWindow - MIN_ZOOM_WINDOW) / 2),
        );
        if (shrink <= 0) return;
        onBrushChangeRef.current({
          startIndex: Math.min(startIndex + shrink, maxEnd),
          endIndex: Math.max(endIndex - shrink, 0),
        });
      } else {
        const newStart = Math.max(0, startIndex - ZOOM_STEP);
        const newEnd = Math.min(maxEnd, endIndex + ZOOM_STEP);
        if (newStart === startIndex && newEnd === endIndex) return;
        onBrushChangeRef.current({
          startIndex: newStart,
          endIndex: newEnd,
        });
      }
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [containerRef, chartDataRef, brushRangeRef, onBrushChangeRef]);
}
