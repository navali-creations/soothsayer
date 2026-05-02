import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import type { ChartColors } from "~/renderer/hooks";
import { clamp, useCanvasResize } from "~/renderer/lib/canvas-core";

import { OVERVIEW_HEIGHT } from "../constants";
import type { ChartDataPoint, DropTimelineMetricKey } from "../types";
import {
  computeBrushChange,
  computeLayout,
  computeTimeDomain,
  createOverviewTimeMapper,
  drawOverviewChartCanvas,
  EMPTY_OVERVIEW_DRAG_STATE,
  getOverviewDragMode,
  type OverviewDragState,
} from "./OverviewChart.utils";

interface OverviewChartProps {
  chartData: ChartDataPoint[];
  maxPerSession: number;
  hiddenMetrics: ReadonlySet<DropTimelineMetricKey>;
  showExpectedBars: boolean;
  leagueStartTime?: number;
  onWheelZoom?: (params: { deltaY: number; focusRatio: number }) => void;
  brushStartTime: number | undefined;
  brushEndTime: number | undefined;
  handleBrushChange: (newState: {
    startIndex?: number;
    endIndex?: number;
    startTime?: number;
    endTime?: number;
  }) => void;
  c: ChartColors;
}

const OverviewChart = ({
  chartData,
  maxPerSession,
  hiddenMetrics,
  showExpectedBars,
  leagueStartTime,
  onWheelZoom,
  brushStartTime,
  brushEndTime,
  handleBrushChange,
  c,
}: OverviewChartProps) => {
  const dragRef = useRef<OverviewDragState>(EMPTY_OVERVIEW_DRAG_STATE);
  const { containerRef, containerElRef, canvasRef, canvasSize } =
    useCanvasResize();

  const layout = useMemo(
    () => computeLayout(canvasSize.width, canvasSize.height),
    [canvasSize.width, canvasSize.height],
  );
  const timeDomain = useMemo(() => computeTimeDomain(chartData), [chartData]);
  const startTime = brushStartTime ?? timeDomain.min;
  const endTime = brushEndTime ?? timeDomain.max;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;
    drawOverviewChartCanvas({
      canvas,
      sourceElement: containerElRef.current,
      chartData,
      maxPerSession,
      hiddenMetrics,
      showExpectedBars,
      leagueStartTime,
      startTime,
      endTime,
      layout,
      canvasSize,
      timeDomain,
      c,
    });
  }, [
    canvasRef,
    canvasSize,
    c,
    chartData,
    containerElRef,
    endTime,
    hiddenMetrics,
    leagueStartTime,
    layout,
    maxPerSession,
    showExpectedBars,
    startTime,
    timeDomain,
  ]);

  useLayoutEffect(() => {
    draw();
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
  }, [draw]);

  const updateBrush = useCallback(
    (x: number) => {
      if (chartData.length <= 1) return;
      const mapX = createOverviewTimeMapper(timeDomain, layout);
      const pointerTime = clamp(
        mapX.inverse(x),
        timeDomain.min,
        timeDomain.max,
      );
      const brushChange = computeBrushChange({
        chartData,
        timeDomain,
        startTime,
        endTime,
        pointerTime,
        drag: dragRef.current,
      });
      if (brushChange) {
        handleBrushChange(brushChange);
      }
    },
    [endTime, handleBrushChange, layout, startTime, timeDomain, chartData],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (chartData.length === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (y < layout.brushTop || y > layout.brushBottom) return;

      const mapX = createOverviewTimeMapper(timeDomain, layout);
      const startX = mapX(startTime);
      const endX = mapX(endTime);
      const mode = getOverviewDragMode(x, startX, endX);

      dragRef.current = {
        mode,
        originTime: clamp(mapX.inverse(x), timeDomain.min, timeDomain.max),
        originStartTime: startTime,
        originEndTime: endTime,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.cursor = "grabbing";
      updateBrush(x);
    },
    [canvasRef, chartData, endTime, layout, startTime, timeDomain, updateBrush],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current.mode) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      updateBrush(event.clientX - rect.left);
    },
    [canvasRef, updateBrush],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      dragRef.current = EMPTY_OVERVIEW_DRAG_STATE;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      event.currentTarget.style.cursor = "grab";
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onWheelZoom) return;

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const focusRatio =
        rect.width > 0
          ? clamp((event.clientX - rect.left) / rect.width, 0, 1)
          : 0.5;
      onWheelZoom({ deltaY: event.deltaY, focusRatio });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [canvasRef, onWheelZoom]);

  return (
    <div
      ref={containerRef}
      className="w-full px-1 relative"
      data-testid="drop-timeline-overview-chart"
      style={{ height: OVERVIEW_HEIGHT }}
    >
      <canvas
        ref={canvasRef}
        data-brush-enabled="true"
        data-brush-end-time={endTime}
        data-brush-start-time={startTime}
        data-chart-point-count={chartData.length}
        data-testid="drop-timeline-overview-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          cursor: "grab",
        }}
      />
    </div>
  );
};

export default OverviewChart;
