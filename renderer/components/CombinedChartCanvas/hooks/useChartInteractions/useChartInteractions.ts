import type React from "react";
import { type RefObject, useCallback, useEffect, useRef } from "react";

import {
  brushDeltaIndexFromPixels,
  chartDeltaIndexFromPixels,
  hitTestIndexBrush,
  indexFromBrushPixel,
  type LinearMapper,
  nearestPointHitTest,
  panIndexBrush,
  resizeIndexBrush,
} from "~/renderer/lib/canvas-core";

import type { ChartLayout } from "../../canvas-chart-utils/canvas-chart-utils";
import {
  BRUSH_TRAVELLER_WIDTH,
  MIN_ZOOM_WINDOW,
} from "../../canvas-chart-utils/canvas-chart-utils";
import type { BrushRange, ChartDataPoint } from "../../chart-types/chart-types";
import type { TooltipState } from "../useTooltipPosition/useTooltipPosition";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DragMode =
  | { type: "none" }
  | { type: "brush-left" }
  | { type: "brush-right" }
  | { type: "brush-pan"; startMouseX: number; startRange: BrushRange }
  | { type: "chart-pan"; startMouseX: number; startRange: BrushRange };

export interface UseChartInteractionsParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hoverIndexRef: React.MutableRefObject<number | null>;
  layout: ChartLayout;
  showBrush: boolean;
  visibleData: ChartDataPoint[];
  mapX: LinearMapper;
  mapBrushX: LinearMapper;
  chartDataRef: RefObject<ChartDataPoint[]>;
  brushRangeRef: RefObject<BrushRange>;
  onBrushChangeRef: RefObject<(range: BrushRange) => void>;
  setTooltip: React.Dispatch<React.SetStateAction<TooltipState>>;
  draw: () => void;
}

/**
 * Encapsulates all chart interaction logic: drag refs, hit-testing,
 * mouse handlers (move, down, up, leave), and listener attachment.
 *
 * Returns `hoverIndexRef` so the draw loop can read the current hover.
 */
export function useChartInteractions({
  canvasRef,
  hoverIndexRef,
  layout,
  showBrush,
  visibleData,
  mapX,
  mapBrushX,
  chartDataRef,
  brushRangeRef,
  onBrushChangeRef,
  setTooltip,
  draw,
}: UseChartInteractionsParams) {
  // ── Mutable interaction refs ──────────────────────────────────

  const dragModeRef = useRef<DragMode>({ type: "none" });
  const animFrameRef = useRef<number>(0);

  // ── Coordinate helpers ────────────────────────────────────────

  const getCanvasCoords = useCallback(
    (e: MouseEvent | React.MouseEvent): { cx: number; cy: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { cx: 0, cy: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        cx: e.clientX - rect.left,
        cy: e.clientY - rect.top,
      };
    },
    [canvasRef],
  );

  // ── Hit-testing ───────────────────────────────────────────────

  const hitTestBrush = useCallback(
    (
      cx: number,
      cy: number,
    ): "left-traveller" | "right-traveller" | "brush-body" | null => {
      if (!showBrush) return null;
      const { brushTop, brushBottom } = layout;
      if (cy < brushTop || cy > brushBottom) return null;

      const rangeStart = brushRangeRef.current.startIndex;
      const rangeEnd = brushRangeRef.current.endIndex;
      return hitTestIndexBrush({
        x: cx,
        y: cy,
        layout,
        range: { startIndex: rangeStart, endIndex: rangeEnd },
        mapBrushX,
        travellerWidth: BRUSH_TRAVELLER_WIDTH,
      });
    },
    [showBrush, layout, mapBrushX, brushRangeRef],
  );

  const isInChartArea = useCallback(
    (cx: number, cy: number): boolean => {
      const { chartLeft, chartRight, chartTop, chartBottom } = layout;
      return (
        cx >= chartLeft &&
        cx <= chartRight &&
        cy >= chartTop &&
        cy <= chartBottom
      );
    },
    [layout],
  );

  const hitTestChart = useCallback(
    (cx: number, cy: number): number | null => {
      if (!isInChartArea(cx, cy)) return null;

      const numVisible = visibleData.length;
      if (numVisible === 0) return null;

      const threshold = Math.max(20, layout.chartWidth / numVisible);
      const result = nearestPointHitTest(
        cx,
        visibleData,
        (_pt, i) => mapX(i),
        threshold,
      );
      return result.index >= 0 ? result.index : null;
    },
    [layout.chartWidth, visibleData, mapX, isInChartArea],
  );

  // ── requestDraw ───────────────────────────────────────────────

  const requestDraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // ── Mouse handlers ────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);
      const drag = dragModeRef.current;
      const total = chartDataRef.current.length;

      if (drag.type === "brush-left") {
        onBrushChangeRef.current({
          ...resizeIndexBrush({
            range: brushRangeRef.current,
            pointerIndex: indexFromBrushPixel(mapBrushX, cx, total),
            edge: "start",
            itemCount: total,
            minSpan: MIN_ZOOM_WINDOW,
          }),
        });
        return;
      }

      if (drag.type === "brush-right") {
        onBrushChangeRef.current({
          ...resizeIndexBrush({
            range: brushRangeRef.current,
            pointerIndex: indexFromBrushPixel(mapBrushX, cx, total),
            edge: "end",
            itemCount: total,
            minSpan: MIN_ZOOM_WINDOW,
          }),
        });
        return;
      }

      if (drag.type === "brush-pan" || drag.type === "chart-pan") {
        const dx = cx - drag.startMouseX;

        let deltaIndex: number;
        if (drag.type === "chart-pan") {
          const visibleWindow =
            drag.startRange.endIndex - drag.startRange.startIndex;
          const chartPixelWidth = layout.chartRight - layout.chartLeft;
          deltaIndex = chartDeltaIndexFromPixels({
            deltaX: dx,
            visibleSpan: visibleWindow,
            chartPixelWidth,
          });
        } else {
          const brushPixelWidth = layout.brushRight - layout.brushLeft;
          deltaIndex = brushDeltaIndexFromPixels({
            deltaX: dx,
            itemCount: total,
            brushPixelWidth,
          });
        }

        onBrushChangeRef.current(
          panIndexBrush({
            range: drag.startRange,
            deltaIndex,
            itemCount: total,
          }),
        );

        if (hoverIndexRef.current !== null) {
          hoverIndexRef.current = null;
          setTooltip((prev) => ({
            ...prev,
            visible: false,
            dataPoint: null,
          }));
        }
        return;
      }

      // No drag — hover detection
      const chartIdx = hitTestChart(cx, cy);
      if (chartIdx !== null && chartIdx !== hoverIndexRef.current) {
        hoverIndexRef.current = chartIdx;
        const pt = visibleData[chartIdx];
        const px = mapX(chartIdx);
        setTooltip({
          visible: true,
          x: px,
          y: cy,
          dataPoint: pt,
        });
        requestDraw();
      } else if (chartIdx === null && hoverIndexRef.current !== null) {
        hoverIndexRef.current = null;
        setTooltip((prev) => ({ ...prev, visible: false, dataPoint: null }));
        requestDraw();
      }

      // Update cursor
      const canvas = canvasRef.current;
      if (canvas) {
        const brushHit = hitTestBrush(cx, cy);
        if (brushHit === "left-traveller" || brushHit === "right-traveller") {
          canvas.style.cursor = "ew-resize";
        } else if (brushHit === "brush-body") {
          canvas.style.cursor = "grab";
        } else if (isInChartArea(cx, cy)) {
          canvas.style.cursor = "grab";
        } else {
          canvas.style.cursor = "default";
        }
      }
    },
    [
      getCanvasCoords,
      mapBrushX,
      hitTestChart,
      hitTestBrush,
      isInChartArea,
      visibleData,
      mapX,
      layout,
      requestDraw,
      canvasRef,
      hoverIndexRef,
      chartDataRef,
      brushRangeRef,
      onBrushChangeRef,
      setTooltip,
    ],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);

      const brushHit = hitTestBrush(cx, cy);
      if (brushHit === "left-traveller") {
        dragModeRef.current = { type: "brush-left" };
        e.preventDefault();
        return;
      }
      if (brushHit === "right-traveller") {
        dragModeRef.current = { type: "brush-right" };
        e.preventDefault();
        return;
      }
      if (brushHit === "brush-body") {
        dragModeRef.current = {
          type: "brush-pan",
          startMouseX: cx,
          startRange: { ...brushRangeRef.current },
        };
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = "grabbing";
        e.preventDefault();
        return;
      }

      if (isInChartArea(cx, cy)) {
        dragModeRef.current = {
          type: "chart-pan",
          startMouseX: cx,
          startRange: { ...brushRangeRef.current },
        };
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = "grabbing";
        e.preventDefault();
        return;
      }
    },
    [getCanvasCoords, hitTestBrush, isInChartArea, canvasRef, brushRangeRef],
  );

  const handleMouseUp = useCallback(() => {
    const wasDragging = dragModeRef.current.type !== "none";
    dragModeRef.current = { type: "none" };
    const canvas = canvasRef.current;
    if (canvas && wasDragging) {
      canvas.style.cursor = "grab";
    }
  }, [canvasRef]);

  const handleMouseLeave = useCallback(() => {
    hoverIndexRef.current = null;
    setTooltip((prev) => ({ ...prev, visible: false, dataPoint: null }));
    requestDraw();
  }, [hoverIndexRef, requestDraw, setTooltip]);

  // ── Attach event listeners ────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    canvasRef,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
  ]);

  return { hoverIndexRef };
}
