import clsx from "clsx";
import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useChartColors } from "~/renderer/hooks";
import {
  brushDeltaValueFromPixels,
  collapseFullNumericBrushRange,
  createLinearMapper,
  hitTestNumericBrush,
  nearestPointHitTest,
  panNumericBrush,
  resizeNumericBrush,
  useCanvasResize,
  valueFromBrushPixel,
  zoomNumericBrush,
} from "~/renderer/lib/canvas-core";

import {
  BRUSH_TRAVELLER_WIDTH,
  BRUSH_ZOOM_FRACTION,
  MAX_BRUSH_CHART_SAMPLES,
  MAX_VISIBLE_CHART_SAMPLES,
  MIN_BRUSH_RANGE_MS,
} from "./PerformanceLineChartCanvas.constants";
import type {
  BrushDragState,
  ChartDomains,
  FullXDomain,
  HoverState,
  PerformanceLineChartCanvasProps,
} from "./PerformanceLineChartCanvas.types";
import {
  drawPerformanceLineChart,
  formatElapsed,
  getBrushDomain,
  getBrushLayout,
  getChartLayout,
  normalizeTimeRange,
  numericRangeToTimeRange,
  selectSamplesForTimeRange,
  selectSpanSamples,
  timeRangeToNumericRange,
} from "./PerformanceLineChartCanvas.utils";

export function usePerformanceLineChartCanvasNode({
  samples,
  routeMarkers,
  lines,
  xRange = null,
  showBrush = false,
  live = false,
  captureDurationMs = null,
  yMin = 0,
  yMaxFloor = 1,
  secondaryYMin = 0,
  secondaryYMaxFloor = 1,
  valueFormatter,
  secondaryValueFormatter,
  xValueFormatter = formatElapsed,
  xTicks,
  emptyLabel = "Waiting for measurements",
  dense = false,
  onXRangeChange,
}: PerformanceLineChartCanvasProps) {
  const colors = useChartColors();
  const { containerRef, containerElRef, canvasRef, canvasSize } =
    useCanvasResize();
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverRef = useRef<HoverState | null>(null);
  const interactionFrameRef = useRef<number | null>(null);
  const lastCanvasSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );
  const hasSecondaryAxis = secondaryValueFormatter !== undefined;
  const brushDragRef = useRef<BrushDragState>({
    mode: null,
    originX: 0,
    originRange: { start: 0, end: 1 },
  });

  const fullXDomain = useMemo<FullXDomain>(() => {
    const fallbackElapsed = live ? 60_000 : 1;
    const maxElapsed = Math.max(
      samples.at(-1)?.captureElapsedMs ?? fallbackElapsed,
      captureDurationMs ?? 0,
    );
    const xMax = live ? Math.max(60_000, maxElapsed) : Math.max(1, maxElapsed);
    return {
      xMin: 0,
      xMax,
    };
  }, [captureDurationMs, live, samples]);

  const visibleRange = useMemo(
    () => normalizeTimeRange(xRange, fullXDomain),
    [fullXDomain, xRange],
  );

  const visibleSamples = useMemo(
    () =>
      selectSamplesForTimeRange(
        samples,
        visibleRange?.startMs ?? fullXDomain.xMin,
        visibleRange?.endMs ?? fullXDomain.xMax,
      ),
    [fullXDomain, samples, visibleRange],
  );

  const chartSamples = useMemo(
    () => selectSpanSamples(visibleSamples, MAX_VISIBLE_CHART_SAMPLES),
    [visibleSamples],
  );

  const brushSamples = useMemo(
    () => selectSpanSamples(samples, MAX_BRUSH_CHART_SAMPLES),
    [samples],
  );

  const domains = useMemo<ChartDomains>(() => {
    let maxValue = Math.max(yMaxFloor, yMin + 1);
    let secondaryMaxValue = Math.max(secondaryYMaxFloor, secondaryYMin + 1);

    for (const sample of visibleSamples) {
      for (const line of lines) {
        const value = line.value(sample);
        if (typeof value !== "number" || !Number.isFinite(value)) continue;

        if (line.axis === "secondary") {
          secondaryMaxValue = Math.max(secondaryMaxValue, value);
        } else {
          maxValue = Math.max(maxValue, value);
        }
      }
    }

    return {
      xMin: visibleRange?.startMs ?? fullXDomain.xMin,
      xMax: visibleRange?.endMs ?? fullXDomain.xMax,
      yMin,
      yMax: maxValue,
      secondaryYMin,
      secondaryYMax: secondaryMaxValue,
    };
  }, [
    fullXDomain,
    lines,
    secondaryYMaxFloor,
    secondaryYMin,
    visibleRange,
    visibleSamples,
    yMaxFloor,
    yMin,
  ]);

  const draw = useCallback(() => {
    drawPerformanceLineChart({
      canvas: canvasRef.current,
      container: containerElRef.current,
      canvasSize,
      colors,
      domains,
      fullXDomain,
      samples: chartSamples,
      brushSamples,
      routeMarkers,
      lines,
      xRange,
      showBrush,
      valueFormatter,
      secondaryValueFormatter,
      xValueFormatter,
      xTicks,
      emptyLabel,
      hover: hoverRef.current,
    });
  }, [
    canvasRef,
    canvasSize,
    chartSamples,
    brushSamples,
    colors,
    containerElRef,
    domains,
    emptyLabel,
    fullXDomain,
    lines,
    routeMarkers,
    showBrush,
    secondaryValueFormatter,
    valueFormatter,
    xRange,
    xTicks,
    xValueFormatter,
  ]);

  const scheduleInteractionUpdate = useCallback(() => {
    if (interactionFrameRef.current !== null) return;

    interactionFrameRef.current = requestAnimationFrame(() => {
      interactionFrameRef.current = null;
      setHover(hoverRef.current);
      draw();
    });
  }, [draw]);

  useEffect(() => {
    return () => {
      if (interactionFrameRef.current === null) return;

      cancelAnimationFrame(interactionFrameRef.current);
      interactionFrameRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const previousCanvasSize = lastCanvasSizeRef.current;
    const canvasSizeChanged =
      previousCanvasSize === null ||
      previousCanvasSize.width !== canvasSize.width ||
      previousCanvasSize.height !== canvasSize.height;
    lastCanvasSizeRef.current = canvasSize;

    draw();
    if (!canvasSizeChanged) return;

    const frames: number[] = [];
    const schedule = (remaining: number) => {
      if (remaining <= 0) return;
      frames.push(
        requestAnimationFrame(() => {
          draw();
          schedule(remaining - 1);
        }),
      );
    };
    schedule(4);
    return () => {
      for (const frame of frames) cancelAnimationFrame(frame);
    };
  }, [canvasSize, draw]);

  const updateBrushFromPointer = useCallback(
    (x: number, rect: DOMRect) => {
      if (!onXRangeChange) return;
      const brush = getBrushLayout(rect.width, rect.height, hasSecondaryAxis);
      const domain = getBrushDomain(fullXDomain);
      const pointerMs = valueFromBrushPixel({
        x,
        brushLeft: brush.plot.left,
        brushRight: brush.plot.right,
        domain,
      });
      const drag = brushDragRef.current;
      let range = drag.originRange;

      if (drag.mode === "start") {
        range = resizeNumericBrush({
          range: drag.originRange,
          pointerValue: pointerMs,
          edge: "start",
          domain,
          minSpan: MIN_BRUSH_RANGE_MS,
        });
      } else if (drag.mode === "end") {
        range = resizeNumericBrush({
          range: drag.originRange,
          pointerValue: pointerMs,
          edge: "end",
          domain,
          minSpan: MIN_BRUSH_RANGE_MS,
        });
      } else if (drag.mode === "range") {
        const deltaMs = brushDeltaValueFromPixels({
          deltaX: x - drag.originX,
          brushPixelWidth: brush.plot.right - brush.plot.left,
          domain,
        });
        range = panNumericBrush({
          range: drag.originRange,
          delta: deltaMs,
          domain,
        });
      }

      const nextRange = collapseFullNumericBrushRange({ range, domain });
      onXRangeChange(nextRange ? numericRangeToTimeRange(nextRange) : null);
    },
    [fullXDomain, hasSecondaryAxis, onXRangeChange],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const container = containerElRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (brushDragRef.current.mode !== null) {
        updateBrushFromPointer(x, rect);
        hoverRef.current = null;
        scheduleInteractionUpdate();
        return;
      }

      const chartLayout = getChartLayout(rect.width, hasSecondaryAxis);
      const chartLeft = chartLayout.left;
      const chartRight = chartLayout.right;
      const brush = getBrushLayout(rect.width, rect.height, hasSecondaryAxis);
      if (showBrush && y >= brush.outer.top && y <= brush.outer.bottom) {
        const range = normalizeTimeRange(xRange, fullXDomain) ?? {
          startMs: fullXDomain.xMin,
          endMs: fullXDomain.xMax,
        };
        const hit = hitTestNumericBrush({
          x,
          y,
          layout: {
            brushTop: brush.outer.top,
            brushBottom: brush.outer.bottom,
            brushLeft: brush.plot.left,
            brushRight: brush.plot.right,
          },
          range: timeRangeToNumericRange(range),
          mapBrushX: createLinearMapper(
            fullXDomain.xMin,
            fullXDomain.xMax,
            brush.plot.left,
            brush.plot.right,
          ),
          travellerWidth: BRUSH_TRAVELLER_WIDTH,
        });
        event.currentTarget.style.cursor =
          hit === "left-traveller" || hit === "right-traveller"
            ? "ew-resize"
            : hit === "brush-body"
              ? "grab"
              : "default";
        hoverRef.current = null;
        scheduleInteractionUpdate();
        return;
      }

      event.currentTarget.style.cursor = "crosshair";
      const mapX = createLinearMapper(
        domains.xMin,
        domains.xMax,
        chartLeft,
        chartRight,
      );
      const marker =
        routeMarkers.find((m) => Math.abs(mapX(m.elapsedMs) - x) <= 6) ?? null;
      const hit = nearestPointHitTest(
        x,
        chartSamples,
        (sample) => mapX(sample.captureElapsedMs),
        28,
      );
      const sample = hit.index >= 0 ? chartSamples[hit.index] : null;

      if (!sample && !marker) {
        hoverRef.current = null;
        scheduleInteractionUpdate();
        return;
      }

      const nextHover = { x, y, sample, marker };
      hoverRef.current = nextHover;
      scheduleInteractionUpdate();
    },
    [
      containerElRef,
      domains,
      fullXDomain,
      hasSecondaryAxis,
      routeMarkers,
      scheduleInteractionUpdate,
      chartSamples,
      showBrush,
      updateBrushFromPointer,
      xRange,
    ],
  );

  const handlePointerLeave = useCallback(() => {
    if (brushDragRef.current.mode !== null) return;

    hoverRef.current = null;
    scheduleInteractionUpdate();
  }, [scheduleInteractionUpdate]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!showBrush || !onXRangeChange) return;
      const container = containerElRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const brush = getBrushLayout(rect.width, rect.height, hasSecondaryAxis);
      const range = normalizeTimeRange(xRange, fullXDomain) ?? {
        startMs: fullXDomain.xMin,
        endMs: fullXDomain.xMax,
      };
      const hit = hitTestNumericBrush({
        x,
        y,
        layout: {
          brushTop: brush.outer.top,
          brushBottom: brush.outer.bottom,
          brushLeft: brush.plot.left,
          brushRight: brush.plot.right,
        },
        range: timeRangeToNumericRange(range),
        mapBrushX: createLinearMapper(
          fullXDomain.xMin,
          fullXDomain.xMax,
          brush.plot.left,
          brush.plot.right,
        ),
        travellerWidth: BRUSH_TRAVELLER_WIDTH,
      });
      if (hit === null) return;

      brushDragRef.current = {
        mode:
          hit === "left-traveller"
            ? "start"
            : hit === "right-traveller"
              ? "end"
              : "range",
        originX: x,
        originRange: timeRangeToNumericRange(range),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.cursor =
        hit === "brush-body" ? "grabbing" : "ew-resize";
    },
    [
      containerElRef,
      fullXDomain,
      hasSecondaryAxis,
      onXRangeChange,
      showBrush,
      xRange,
    ],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (brushDragRef.current.mode === null) return;
    brushDragRef.current = {
      mode: null,
      originX: 0,
      originRange: { start: 0, end: 1 },
    };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.currentTarget.style.cursor = "default";
  }, []);

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!showBrush || !onXRangeChange) return;
      const container = containerElRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const brush = getBrushLayout(rect.width, rect.height, hasSecondaryAxis);
      if (y < brush.outer.top || y > brush.outer.bottom) return;
      onXRangeChange(null);
    },
    [containerElRef, hasSecondaryAxis, onXRangeChange, showBrush],
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!showBrush || !onXRangeChange || Math.abs(event.deltaY) < 1) return;
      const container = containerElRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const brush = getBrushLayout(rect.width, rect.height, hasSecondaryAxis);
      if (y < brush.outer.top || y > brush.outer.bottom) return;

      event.preventDefault();
      event.stopPropagation();
      const range = normalizeTimeRange(xRange, fullXDomain) ?? {
        startMs: fullXDomain.xMin,
        endMs: fullXDomain.xMax,
      };
      const domain = getBrushDomain(fullXDomain);
      const nextRange = collapseFullNumericBrushRange({
        range: zoomNumericBrush({
          range: timeRangeToNumericRange(range),
          deltaY: event.deltaY,
          domain,
          minSpan: MIN_BRUSH_RANGE_MS,
          zoomFraction: BRUSH_ZOOM_FRACTION,
        }),
        domain,
      });
      onXRangeChange(nextRange ? numericRangeToTimeRange(nextRange) : null);
    },
    [
      containerElRef,
      fullXDomain,
      hasSecondaryAxis,
      onXRangeChange,
      showBrush,
      xRange,
    ],
  );

  useEffect(() => {
    const container = containerElRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [containerElRef, handleWheel]);

  return {
    canvasRef,
    canvasSize,
    containerClassName: clsx("relative h-full min-w-0 flex-1", {
      "min-h-24": dense,
      "min-h-38": !dense,
    }),
    containerRef,
    handleDoubleClick,
    handlePointerDown,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    hover,
    lines,
    valueFormatter,
    secondaryValueFormatter,
    xValueFormatter,
  };
}
