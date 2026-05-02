import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiClock } from "react-icons/fi";

import { useChartColors } from "~/renderer/hooks";
import {
  brushDeltaIndexFromPixels,
  ensureCanvasBackingStore,
  panIndexBrush,
  resizeIndexBrush,
  setupCanvas,
  useCanvasResize,
  zoomIndexBrush,
} from "~/renderer/lib/canvas-core";
import { useCardDetails } from "~/renderer/store";

import {
  BRUSH_ZOOM_STEP,
  type BrushRange,
  buildPriceChartGeometry,
  computeDomains,
  computeLayout,
  computeTooltipStyle,
  type DragMode,
  drawPriceChartCanvas,
  getBrushPointerIndex,
  getEffectiveLayout,
  getHoverHitIndex,
  hitTestBrushAtPoint,
  MIN_BRUSH_SPAN,
  MIN_VISIBLE_POINTS,
  type TooltipState,
} from "./CardDetailsPriceChart.utils";
import ChartTooltip from "./ChartTooltip/ChartTooltip";
import { CHART_HEIGHT } from "./constants";
import { mapHistoryToChartData } from "./helpers";
import PriceChartEmpty from "./PriceChartEmpty/PriceChartEmpty";
import PriceChartError from "./PriceChartError/PriceChartError";
import type { ChartDataPoint } from "./types";

const CardDetailsPriceChart = () => {
  const c = useChartColors();
  const hoverIndexRef = useRef<number | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    originX: number;
    originRange: BrushRange;
  }>({
    mode: null,
    originX: 0,
    originRange: { startIndex: 0, endIndex: 0 },
  });

  const { priceHistory, isLoadingPriceHistory, priceHistoryError } =
    useCardDetails();

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!priceHistory?.priceHistory?.length) return [];
    return mapHistoryToChartData(priceHistory.priceHistory);
  }, [priceHistory]);

  const showBrush = chartData.length > MIN_VISIBLE_POINTS;
  const [brushRange, setBrushRange] = useState<BrushRange>({
    startIndex: 0,
    endIndex: 0,
  });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    dataPoint: null,
  });

  const { containerRef, containerElRef, canvasRef, canvasSize } =
    useCanvasResize();

  useEffect(() => {
    setBrushRange({
      startIndex: 0,
      endIndex: Math.max(0, chartData.length - 1),
    });
  }, [chartData.length]);

  const visibleData = useMemo(() => {
    if (!showBrush) return chartData;
    return chartData.slice(brushRange.startIndex, brushRange.endIndex + 1);
  }, [brushRange.endIndex, brushRange.startIndex, chartData, showBrush]);

  const domains = useMemo(() => computeDomains(visibleData), [visibleData]);
  const layout = useMemo(
    () => computeLayout(canvasSize.width, canvasSize.height, showBrush),
    [canvasSize.width, canvasSize.height, showBrush],
  );
  const geometry = useMemo(
    () =>
      buildPriceChartGeometry({
        data: chartData,
        visibleData,
        layout,
        domains,
        showBrush,
      }),
    [chartData, domains, layout, showBrush, visibleData],
  );
  const priceChartColors = useMemo(
    () => ({
      primary: c.primary,
      primary02: c.primary02,
      primary30: c.primary30,
      b2: c.b2,
      bc06: c.bc06,
      bc15: c.bc15,
      bc35: c.bc35,
    }),
    [c.b2, c.bc06, c.bc15, c.bc35, c.primary, c.primary02, c.primary30],
  );

  const tooltipStyle = useMemo(
    () => computeTooltipStyle({ tooltip, canvasSize }),
    [tooltip, canvasSize],
  );
  const stabilizationKey = `${canvasSize.width}:${canvasSize.height}:${chartData.length}:${showBrush}`;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;
    if (!ensureCanvasBackingStore(canvas, containerElRef.current)) return;
    const result = setupCanvas(canvas);
    if (!result) return;

    const { ctx, width, height } = result;
    const effectiveLayout = getEffectiveLayout({
      canvasSize,
      fallbackWidth: width,
      fallbackHeight: height,
      layout,
      showBrush,
    });
    if (effectiveLayout.chartWidth <= 0 || effectiveLayout.chartHeight <= 0) {
      return;
    }

    const drawGeometry =
      effectiveLayout === layout
        ? geometry
        : buildPriceChartGeometry({
            data: chartData,
            visibleData,
            layout: effectiveLayout,
            domains,
            showBrush,
          });

    drawPriceChartCanvas({
      ctx,
      data: chartData,
      visibleData,
      layout: effectiveLayout,
      geometry: drawGeometry,
      range: brushRange,
      showBrush,
      hoverIndex: hoverIndexRef.current,
      colors: priceChartColors,
    });
  }, [
    brushRange,
    canvasRef,
    canvasSize,
    chartData,
    containerElRef,
    domains,
    geometry,
    layout,
    priceChartColors,
    showBrush,
    visibleData,
  ]);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    draw();
  }, [draw]);

  useLayoutEffect(() => {
    void stabilizationKey;
    const frames: number[] = [];
    const schedule = (remaining: number) => {
      if (remaining <= 0) return;
      frames.push(
        requestAnimationFrame(() => {
          drawRef.current();
          schedule(remaining - 1);
        }),
      );
    };
    schedule(4);
    return () => {
      for (const frame of frames) cancelAnimationFrame(frame);
    };
  }, [stabilizationKey]);

  const updateHover = useCallback(
    (x: number, y: number) => {
      if (visibleData.length === 0) return;

      const hitIndex = getHoverHitIndex({
        x,
        visibleData,
        geometry,
      });

      if (hitIndex < 0) {
        const hadHover = hoverIndexRef.current !== null;
        hoverIndexRef.current = null;
        setTooltip((current) =>
          current.visible
            ? { visible: false, x: 0, y: 0, dataPoint: null }
            : current,
        );
        if (hadHover) draw();
        return;
      }

      const shouldRedraw = hoverIndexRef.current !== hitIndex;
      hoverIndexRef.current = hitIndex;
      setTooltip({ visible: true, x, y, dataPoint: visibleData[hitIndex] });
      if (shouldRedraw) draw();
    },
    [draw, geometry, visibleData],
  );

  const updateBrushFromPointer = useCallback(
    (x: number) => {
      if (!showBrush || chartData.length <= 1) return;
      const pointerIndex = getBrushPointerIndex({
        x,
        dataLength: chartData.length,
        layout,
      });
      const drag = dragRef.current;

      setBrushRange((current) => {
        if (drag.mode === "start") {
          return resizeIndexBrush({
            range: current,
            pointerIndex,
            edge: "start",
            itemCount: chartData.length,
            minSpan: MIN_BRUSH_SPAN,
          });
        }
        if (drag.mode === "end") {
          return resizeIndexBrush({
            range: current,
            pointerIndex,
            edge: "end",
            itemCount: chartData.length,
            minSpan: MIN_BRUSH_SPAN,
          });
        }
        if (drag.mode === "range") {
          const deltaIndex = brushDeltaIndexFromPixels({
            deltaX: x - drag.originX,
            itemCount: chartData.length,
            brushPixelWidth: layout.brushRight - layout.brushLeft,
          });
          return panIndexBrush({
            range: drag.originRange,
            deltaIndex,
            itemCount: chartData.length,
          });
        }
        return current;
      });
    },
    [layout, showBrush, chartData],
  );

  const zoomBrushFromWheel = useCallback(
    (deltaY: number) => {
      if (!showBrush || chartData.length <= MIN_VISIBLE_POINTS) return;

      setBrushRange((current) =>
        zoomIndexBrush({
          range: current,
          itemCount: chartData.length,
          deltaY,
          minSpan: MIN_BRUSH_SPAN,
          zoomStep: BRUSH_ZOOM_STEP,
        }),
      );
    },
    [chartData.length, showBrush],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!showBrush || chartData.length === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const brushHit = hitTestBrushAtPoint({
        x,
        y,
        layout,
        range: brushRange,
        dataLength: chartData.length,
      });
      if (brushHit === null) return;

      dragRef.current = {
        mode:
          brushHit === "left-traveller"
            ? "start"
            : brushHit === "right-traveller"
              ? "end"
              : "range",
        originX: x,
        originRange: brushRange,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.cursor = "grabbing";
    },
    [brushRange, canvasRef, chartData, layout, showBrush],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (dragRef.current.mode) {
        updateBrushFromPointer(x);
        return;
      }

      if (y < layout.chartTop || y > layout.chartBottom) {
        const hadHover = hoverIndexRef.current !== null;
        hoverIndexRef.current = null;
        setTooltip((current) =>
          current.visible
            ? { visible: false, x: 0, y: 0, dataPoint: null }
            : current,
        );
        if (hadHover) draw();
        return;
      }

      updateHover(x, y);
    },
    [canvasRef, draw, layout, updateBrushFromPointer, updateHover],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      dragRef.current = {
        mode: null,
        originX: 0,
        originRange: brushRange,
      };
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      event.currentTarget.style.cursor = showBrush ? "grab" : "crosshair";
    },
    [brushRange, showBrush],
  );

  const handlePointerLeave = useCallback(() => {
    if (dragRef.current.mode) return;
    const hadHover = hoverIndexRef.current !== null;
    hoverIndexRef.current = null;
    setTooltip((current) =>
      current.visible
        ? { visible: false, x: 0, y: 0, dataPoint: null }
        : current,
    );
    if (hadHover) draw();
  }, [draw]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (!showBrush || Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      zoomBrushFromWheel(event.deltaY);
    },
    [showBrush, zoomBrushFromWheel],
  );

  if (isLoadingPriceHistory) {
    return (
      <div className="bg-base-200 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Price History
        </h3>
        <div
          className="flex items-center justify-center bg-base-300/50 rounded-lg animate-pulse"
          style={{ height: CHART_HEIGHT }}
        >
          <div className="flex items-center gap-2 text-base-content/30">
            <span className="loading loading-spinner loading-md" />
            <span className="text-sm">Loading chart data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (priceHistoryError) return <PriceChartError />;
  if (!priceHistory || chartData.length === 0) return <PriceChartEmpty />;

  const firstDate = chartData[0]?.dateLabel ?? "";
  const lastDate = chartData[chartData.length - 1]?.dateLabel ?? "";
  const dataPointCount = chartData.length;

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Price History
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-base-content/30">
            {firstDate} - {lastDate} · {dataPointCount} data points
          </span>
          {priceHistory.isFromCache && priceHistory.fetchedAt && (
            <span className="badge badge-xs badge-ghost gap-1 text-base-content/40">
              <FiClock className="w-2.5 h-2.5" />
              Cached
            </span>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full relative"
        data-testid="price-history-canvas-chart"
        style={{ height: CHART_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          data-brush-enabled={showBrush ? "true" : "false"}
          data-brush-end-index={brushRange.endIndex}
          data-brush-start-index={brushRange.startIndex}
          data-chart-point-count={chartData.length}
          data-testid="price-history-canvas"
          onPointerDown={handlePointerDown}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            cursor: showBrush ? "grab" : "crosshair",
          }}
        />

        {tooltip.visible && tooltip.dataPoint && (
          <div style={tooltipStyle}>
            <ChartTooltip
              active={true}
              payload={[
                {
                  value: tooltip.dataPoint.rate,
                  dataKey: "rate",
                  color: c.primary,
                  payload: tooltip.dataPoint,
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CardDetailsPriceChart;
