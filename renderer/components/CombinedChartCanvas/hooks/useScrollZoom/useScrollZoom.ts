import { type RefObject, useEffect } from "react";

import { zoomIndexBrush } from "~/renderer/lib/canvas-core";

import {
  MIN_ZOOM_WINDOW,
  ZOOM_STEP,
} from "../../canvas-chart-utils/canvas-chart-utils";
import type { BrushRange } from "../../chart-types/chart-types";

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

      const nextRange = zoomIndexBrush({
        range: brushRangeRef.current,
        itemCount: dataLen,
        deltaY: dy,
        minSpan: MIN_ZOOM_WINDOW,
        zoomStep: ZOOM_STEP,
      });
      if (
        nextRange.startIndex === brushRangeRef.current.startIndex &&
        nextRange.endIndex === brushRangeRef.current.endIndex
      ) {
        return;
      }
      onBrushChangeRef.current(nextRange);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [containerRef, chartDataRef, brushRangeRef, onBrushChangeRef]);
}
