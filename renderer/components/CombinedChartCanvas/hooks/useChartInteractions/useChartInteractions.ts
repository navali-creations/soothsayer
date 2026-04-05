import type React from "react";
import { type RefObject, useCallback, useEffect, useRef } from "react";

import {
  type LinearMapper,
  nearestPointHitTest,
} from "~/renderer/lib/canvas-core";

import type { ChartLayout } from "../../canvas-chart-utils/canvas-chart-utils";
import {
  BRUSH_TRAVELLER_WIDTH,
  clamp,
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
      const bxStart = mapBrushX(rangeStart);
      const bxEnd = mapBrushX(rangeEnd);

      const tHit = BRUSH_TRAVELLER_WIDTH + 4;
      if (Math.abs(cx - bxStart) <= tHit) return "left-traveller";
      if (Math.abs(cx - bxEnd) <= tHit) return "right-traveller";

      if (cx >= bxStart && cx <= bxEnd) return "brush-body";

      return null;
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
        const idx = Math.round(clamp(mapBrushX.inverse(cx), 0, total - 1));
        const maxIdx = Math.max(
          0,
          brushRangeRef.current.endIndex - MIN_ZOOM_WINDOW,
        );
        const newStart = clamp(idx, 0, maxIdx);
        onBrushChangeRef.current({
          startIndex: newStart,
          endIndex: brushRangeRef.current.endIndex,
        });
        return;
      }

      if (drag.type === "brush-right") {
        const idx = Math.round(clamp(mapBrushX.inverse(cx), 0, total - 1));
        const minIdx = Math.min(
          total - 1,
          brushRangeRef.current.startIndex + MIN_ZOOM_WINDOW,
        );
        const newEnd = clamp(idx, minIdx, total - 1);
        onBrushChangeRef.current({
          startIndex: brushRangeRef.current.startIndex,
          endIndex: newEnd,
        });
        return;
      }

      if (drag.type === "brush-pan" || drag.type === "chart-pan") {
        const dx = cx - drag.startMouseX;

        let dIdx: number;
        if (drag.type === "chart-pan") {
          const visibleWindow =
            drag.startRange.endIndex - drag.startRange.startIndex;
          const chartPixelWidth = layout.chartRight - layout.chartLeft;
          const idxPerPixel = visibleWindow / chartPixelWidth;
          dIdx = Math.round(-dx * idxPerPixel);
        } else {
          const brushPixelWidth = layout.brushRight - layout.brushLeft;
          const idxPerPixel = (total - 1) / brushPixelWidth;
          dIdx = Math.round(dx * idxPerPixel);
        }

        const origWindow =
          drag.startRange.endIndex - drag.startRange.startIndex;
        let newStart = drag.startRange.startIndex + dIdx;
        let newEnd = drag.startRange.endIndex + dIdx;

        if (newStart < 0) {
          newStart = 0;
          newEnd = origWindow;
        }
        if (newEnd > total - 1) {
          newEnd = total - 1;
          newStart = newEnd - origWindow;
        }
        onBrushChangeRef.current({
          startIndex: newStart,
          endIndex: newEnd,
        });

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
