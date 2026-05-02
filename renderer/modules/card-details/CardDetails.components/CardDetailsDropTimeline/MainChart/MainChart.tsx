import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ChartColors } from "~/renderer/hooks";
import {
  clamp,
  createCompressedLinearMapper,
  createLinearMapper,
  ensureCanvasBackingStore,
  evenTicks,
  nearestPointHitTest,
  normalizeNumericDomain,
  setupCanvas,
  useCanvasResize,
} from "~/renderer/lib/canvas-core";

import { CHART_HEIGHT } from "../constants";
import DropTimelineTooltip from "../DropTimelineTooltip/DropTimelineTooltip";
import type {
  ChartDataPoint,
  DropTimelineMetricKey,
  DropTimelinePointMetrics,
  InactivityGapRange,
  LeagueMarker,
} from "../types";
import {
  buildAnticipatedSeries,
  buildDecksOpenedLineData,
  buildXAxisLabels,
  computeLayout,
  computeTimeDomain,
  computeTooltipStyle,
  drawAxes,
  drawBarLabels,
  drawBars,
  drawDecksOpenedLine,
  drawExpectedBars,
  drawGrid,
  drawHover,
  drawInactivityGap,
  drawReferenceLines,
  getChartPointKey,
  isRealPoint,
  type Layout,
  MAIN_CHART_COMPRESSED_GAP_WIDTH_PX,
  MAIN_CHART_HOVER_THRESHOLD,
  MAIN_CHART_TICK_COUNT,
  MAIN_CHART_TOOLTIP_SIZE,
} from "./MainChart.utils";

interface MainChartProps {
  chartData: ChartDataPoint[];
  visibleData: ChartDataPoint[];
  maxPerSession: number;
  hiddenMetrics: ReadonlySet<DropTimelineMetricKey>;
  compressedGaps: InactivityGapRange[];
  renderedCompressedGaps: InactivityGapRange[];
  inactivityGap: InactivityGapRange | null;
  visibleMarkers: LeagueMarker[];
  visibleTimeMin: number;
  visibleTimeMax: number;
  onHoverTimeChange?: (time: number | null) => void;
  onWheelZoom?: (params: { deltaY: number; focusRatio: number }) => void;
  c: ChartColors;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  dataPoint: ChartDataPoint | null;
  metrics: DropTimelinePointMetrics | null;
}

const MainChart = ({
  chartData,
  visibleData,
  maxPerSession,
  hiddenMetrics,
  compressedGaps = [],
  renderedCompressedGaps = [],
  inactivityGap = null,
  visibleMarkers = [],
  visibleTimeMin,
  visibleTimeMax,
  onHoverTimeChange,
  onWheelZoom,
  c,
}: MainChartProps) => {
  const hoverIndexRef = useRef<number | null>(null);
  const { containerRef, containerElRef, canvasRef, canvasSize } =
    useCanvasResize();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState(MAIN_CHART_TOOLTIP_SIZE);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    dataPoint: null,
    metrics: null,
  });

  const layout = useMemo(
    () => computeLayout(canvasSize.width, canvasSize.height),
    [canvasSize.width, canvasSize.height],
  );
  const timeDomain = useMemo(
    () =>
      Number.isFinite(visibleTimeMin) && Number.isFinite(visibleTimeMax)
        ? normalizeNumericDomain(visibleTimeMin, visibleTimeMax)
        : computeTimeDomain(visibleData),
    [visibleData, visibleTimeMax, visibleTimeMin],
  );
  const anticipatedSeries = useMemo(
    () => buildAnticipatedSeries(chartData),
    [chartData],
  );
  const allCompressionGaps = useMemo(() => {
    if (!inactivityGap) return compressedGaps;
    return [...compressedGaps, inactivityGap];
  }, [compressedGaps, inactivityGap]);
  const countDomainMax = useMemo(() => {
    const values: number[] = [];

    if (!hiddenMetrics.has("drops-per-day")) {
      values.push(maxPerSession);
    }

    if (!hiddenMetrics.has("anticipated")) {
      for (const point of chartData) {
        if (!isRealPoint(point)) continue;
        const metrics = anticipatedSeries.metricsByKey.get(
          getChartPointKey(point),
        );
        if (!metrics) continue;
        values.push(metrics.anticipatedDrops);
      }
    }

    const maxValue = Math.max(1, ...values.filter(Number.isFinite));
    return Math.ceil(maxValue * 1.2) || 1;
  }, [anticipatedSeries.metricsByKey, chartData, hiddenMetrics, maxPerSession]);
  const deckDomainMax = useMemo(() => {
    if (hiddenMetrics.has("decks-opened")) return 1;

    const maxValue = Math.max(
      1,
      ...visibleData
        .filter(isRealPoint)
        .map((point) => Math.max(0, point.totalDecksOpened))
        .filter(Number.isFinite),
    );
    return Math.ceil(maxValue * 1.1) || 1;
  }, [hiddenMetrics, visibleData]);
  const decksOpenedLineData = useMemo(
    () =>
      buildDecksOpenedLineData({
        chartData,
        visibleTimeMin: timeDomain.min,
        visibleTimeMax: timeDomain.max,
      }),
    [chartData, timeDomain.max, timeDomain.min],
  );

  const tooltipStyle = useMemo(
    () => computeTooltipStyle({ tooltip, tooltipSize, canvasSize }),
    [canvasSize, tooltip, tooltipSize],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!ensureCanvasBackingStore(canvas, containerElRef.current)) return;
    const result = setupCanvas(canvas);
    if (!result) return;
    const { ctx, width, height } = result;
    const effectiveLayout: Layout =
      canvasSize.width > 0 && canvasSize.height > 0
        ? layout
        : computeLayout(width, height);
    if (effectiveLayout.chartWidth <= 0 || effectiveLayout.chartHeight <= 0) {
      return;
    }

    const mapX = createCompressedLinearMapper({
      domainMin: timeDomain.min,
      domainMax: timeDomain.max,
      pixelMin: effectiveLayout.chartLeft,
      pixelMax: effectiveLayout.chartRight,
      compressedRanges: allCompressionGaps,
      compressedRangeWidthPx: MAIN_CHART_COMPRESSED_GAP_WIDTH_PX,
    });
    const mapCountY = createLinearMapper(
      0,
      countDomainMax,
      effectiveLayout.chartBottom,
      effectiveLayout.chartTop,
    );
    const mapDeckY = createLinearMapper(
      0,
      deckDomainMax,
      effectiveLayout.chartBottom,
      effectiveLayout.chartTop,
    );
    const countTicks = evenTicks(0, countDomainMax, MAIN_CHART_TICK_COUNT);
    const deckTicks = evenTicks(0, deckDomainMax, MAIN_CHART_TICK_COUNT);
    const timeTicks = evenTicks(
      timeDomain.min,
      timeDomain.max,
      MAIN_CHART_TICK_COUNT,
    );
    const markerLabels = hiddenMetrics.has("league-start")
      ? []
      : visibleMarkers;
    const xAxisLabels = buildXAxisLabels(visibleData, markerLabels);

    drawGrid(
      ctx,
      effectiveLayout,
      countTicks,
      timeTicks,
      mapCountY,
      mapX,
      c.bc06,
    );
    drawAxes(
      ctx,
      effectiveLayout,
      countTicks,
      deckTicks,
      xAxisLabels.length > 0
        ? xAxisLabels
        : timeTicks.map((tick) => ({ time: tick })),
      mapCountY,
      mapDeckY,
      mapX,
      hiddenMetrics,
      c,
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      effectiveLayout.chartLeft - 4,
      effectiveLayout.chartTop - 4,
      effectiveLayout.chartWidth + 8,
      effectiveLayout.chartHeight + 8,
    );
    ctx.clip();
    if (!hiddenMetrics.has("decks-opened")) {
      drawDecksOpenedLine(
        ctx,
        decksOpenedLineData,
        effectiveLayout,
        mapX,
        mapDeckY,
        c,
      );
    }
    if (!hiddenMetrics.has("anticipated")) {
      drawExpectedBars(
        ctx,
        visibleData,
        anticipatedSeries.metricsByKey,
        effectiveLayout,
        mapX,
        mapCountY,
        c,
      );
    }
    if (!hiddenMetrics.has("drops-per-day")) {
      drawBars(ctx, visibleData, effectiveLayout, mapX, mapCountY, c);
      drawBarLabels(
        ctx,
        visibleData,
        hiddenMetrics.has("anticipated")
          ? null
          : anticipatedSeries.metricsByKey,
        effectiveLayout,
        mapX,
        mapCountY,
        c,
      );
    }
    for (const gap of renderedCompressedGaps) {
      drawInactivityGap(ctx, effectiveLayout, gap, mapX, c);
    }
    drawInactivityGap(ctx, effectiveLayout, inactivityGap, mapX, c);
    if (!hiddenMetrics.has("league-start")) {
      drawReferenceLines(ctx, effectiveLayout, visibleMarkers, mapX, c);
    }

    const hoveredPoint =
      hoverIndexRef.current === null
        ? null
        : visibleData[hoverIndexRef.current];
    drawHover(ctx, hoveredPoint, effectiveLayout, mapX, null, c.primary, c);
    ctx.restore();
  }, [
    canvasRef,
    canvasSize.height,
    canvasSize.width,
    c,
    containerElRef,
    hiddenMetrics,
    renderedCompressedGaps,
    allCompressionGaps,
    countDomainMax,
    deckDomainMax,
    decksOpenedLineData,
    inactivityGap,
    layout,
    anticipatedSeries.metricsByKey,
    timeDomain,
    visibleData,
    visibleMarkers,
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

  useLayoutEffect(() => {
    const node = tooltipRef.current;
    if (!node || !tooltip.visible) return;

    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    setTooltipSize((current) =>
      Math.abs(current.width - rect.width) < 0.5 &&
      Math.abs(current.height - rect.height) < 0.5
        ? current
        : { width: rect.width, height: rect.height },
    );
  }, [tooltip.visible]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const mapX = createCompressedLinearMapper({
        domainMin: timeDomain.min,
        domainMax: timeDomain.max,
        pixelMin: layout.chartLeft,
        pixelMax: layout.chartRight,
        compressedRanges: allCompressionGaps,
        compressedRangeWidthPx: MAIN_CHART_COMPRESSED_GAP_WIDTH_PX,
      });
      const mapCountY = createLinearMapper(
        0,
        countDomainMax,
        layout.chartBottom,
        layout.chartTop,
      );
      const hit = nearestPointHitTest(
        x,
        visibleData,
        (point) => mapX(point.time),
        MAIN_CHART_HOVER_THRESHOLD,
        (point) => !point.isGap && !point.isBoundary,
      );

      if (hit.index < 0) {
        hoverIndexRef.current = null;
        onHoverTimeChange?.(null);
        setTooltip({
          visible: false,
          x: 0,
          y: 0,
          dataPoint: null,
          metrics: null,
        });
        draw();
        return;
      }

      hoverIndexRef.current = hit.index;
      const hoveredPoint = visibleData[hit.index];
      const hoveredMetrics = anticipatedSeries.metricsByKey.get(
        getChartPointKey(hoveredPoint),
      );
      const anchorX = mapX(hoveredPoint.time);
      const anchorValue = Math.max(
        hiddenMetrics.has("drops-per-day") ? 0 : hoveredPoint.count,
        hiddenMetrics.has("anticipated")
          ? 0
          : (hoveredMetrics?.anticipatedDrops ?? 0),
      );
      const anchorY = mapCountY(anchorValue);

      onHoverTimeChange?.(hoveredPoint.time);
      setTooltip({
        visible: true,
        x: anchorX,
        y: anchorY,
        dataPoint: hoveredPoint,
        metrics: hoveredMetrics ?? null,
      });
      draw();
    },
    [
      canvasRef,
      draw,
      hiddenMetrics,
      layout,
      countDomainMax,
      onHoverTimeChange,
      allCompressionGaps,
      anticipatedSeries.metricsByKey,
      timeDomain,
      visibleData,
    ],
  );

  const handlePointerLeave = useCallback(() => {
    hoverIndexRef.current = null;
    onHoverTimeChange?.(null);
    setTooltip({ visible: false, x: 0, y: 0, dataPoint: null, metrics: null });
    draw();
  }, [draw, onHoverTimeChange]);

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
      className="w-full relative"
      data-testid="drop-timeline-main-chart"
      style={{ height: CHART_HEIGHT }}
    >
      <canvas
        ref={canvasRef}
        data-testid="drop-timeline-main-canvas"
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
      {tooltip.visible && tooltip.dataPoint && (
        <div ref={tooltipRef} style={tooltipStyle}>
          <DropTimelineTooltip
            dataPoint={tooltip.dataPoint}
            metrics={tooltip.metrics}
          />
        </div>
      )}
    </div>
  );
};

export default MainChart;
