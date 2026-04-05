import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useCallback, useEffect, useRef } from "react";

import { nearestPointHitTest } from "~/renderer/lib/canvas-core";
import { cardNameToSlug } from "~/renderer/utils";

import type { TimelineLayout } from "../canvas-utils/canvas-utils";
import type { ProfitChartPoint } from "../types/types";

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  point: ProfitChartPoint | null;
}

interface UseTimelineInteractionsParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hoverIndexRef: React.MutableRefObject<number | null>;
  layout: TimelineLayout;
  chartData: ProfitChartPoint[];
  mapX: (value: number) => number;
  setTooltip: React.Dispatch<React.SetStateAction<TooltipState>>;
  draw: () => void;
}

export function useTimelineInteractions({
  canvasRef,
  hoverIndexRef,
  layout,
  chartData,
  mapX,
  setTooltip,
  draw,
}: UseTimelineInteractionsParams) {
  const animFrameRef = useRef<number>(0);
  const pendingMoveRef = useRef<MouseEvent | null>(null);
  const moveRafRef = useRef<number>(0);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const navigate = useNavigate();

  const getCanvasCoords = useCallback(
    (e: MouseEvent): { cx: number; cy: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { cx: 0, cy: 0 };
      if (!canvasRectRef.current) {
        canvasRectRef.current = canvas.getBoundingClientRect();
      }
      const rect = canvasRectRef.current;
      return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
    },
    [canvasRef],
  );

  const isInChartArea = useCallback(
    (cx: number, cy: number): boolean => {
      return (
        cx >= layout.chartLeft &&
        cx <= layout.chartRight &&
        cy >= layout.chartTop &&
        cy <= layout.chartBottom
      );
    },
    [layout],
  );

  // Hit-test: find the nearest bar (only notable drops have bars)
  const hitTestBar = useCallback(
    (cx: number, cy: number): number | null => {
      if (!isInChartArea(cx, cy)) return null;

      const result = nearestPointHitTest(
        cx,
        chartData,
        (pt) => mapX(pt.x),
        20,
        (pt) => pt.barValue != null,
      );

      return result.index >= 0 ? result.index : null;
    },
    [chartData, mapX, isInChartArea],
  );

  const requestDraw = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);

      const barIdx = hitTestBar(cx, cy);
      if (barIdx !== null && barIdx !== hoverIndexRef.current) {
        hoverIndexRef.current = barIdx;
        const pt = chartData[barIdx];
        const px = mapX(pt.x);
        setTooltip({ visible: true, x: px, y: cy, point: pt });
        requestDraw();
      } else if (barIdx === null && hoverIndexRef.current !== null) {
        hoverIndexRef.current = null;
        setTooltip((prev) => ({ ...prev, visible: false, point: null }));
        requestDraw();
      } else if (barIdx !== null) {
        // Update y position for tooltip following
        setTooltip((prev) => ({ ...prev, y: cy }));
      }

      // Update cursor
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = barIdx !== null ? "pointer" : "default";
      }
    },
    [
      getCanvasCoords,
      hitTestBar,
      chartData,
      mapX,
      hoverIndexRef,
      setTooltip,
      requestDraw,
      canvasRef,
    ],
  );

  const throttledMouseMove = useCallback(
    (e: MouseEvent) => {
      pendingMoveRef.current = e;
      if (moveRafRef.current) return;
      moveRafRef.current = requestAnimationFrame(() => {
        moveRafRef.current = 0;
        const evt = pendingMoveRef.current;
        if (!evt) return;
        pendingMoveRef.current = null;
        handleMouseMove(evt);
      });
    },
    [handleMouseMove],
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);
      const barIdx = hitTestBar(cx, cy);
      if (barIdx === null) return;

      const pt = chartData[barIdx];
      if (!pt.cardName) return;

      navigate({
        to: "/cards/$cardSlug",
        params: { cardSlug: cardNameToSlug(pt.cardName) },
      });
    },
    [getCanvasCoords, hitTestBar, chartData, navigate],
  );

  const handleMouseLeave = useCallback(() => {
    hoverIndexRef.current = null;
    setTooltip((prev) => ({ ...prev, visible: false, point: null }));
    requestDraw();
  }, [hoverIndexRef, requestDraw, setTooltip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Invalidate cached rect when the effect re-runs (layout/chartData changed)
    canvasRectRef.current = null;

    canvas.addEventListener("mousemove", throttledMouseMove, { passive: true });
    canvas.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    canvas.addEventListener("click", handleClick, { passive: true });

    return () => {
      if (moveRafRef.current) {
        cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = 0;
      }
      pendingMoveRef.current = null;
      canvasRectRef.current = null;
      canvas.removeEventListener("mousemove", throttledMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [canvasRef, throttledMouseMove, handleMouseLeave, handleClick]);
}
