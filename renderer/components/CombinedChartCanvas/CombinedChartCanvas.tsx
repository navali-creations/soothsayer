import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import type { LinearMapper } from "~/renderer/lib/canvas-core";
import { createLinearMapper, setupCanvas } from "~/renderer/lib/canvas-core";

import {
  CLIP_BLEED,
  computeDomains,
  computeLayout,
  resolveLeagueStartMarkerIndex,
  resolveVisibleLeagueStartMarker,
  sumProfitDivine,
} from "./canvas-chart-utils/canvas-chart-utils";
import type {
  ActiveLeagueStartMarker,
  BrushRange,
  ChartColors,
  ChartDataPoint,
  MetricKey,
} from "./chart-types/chart-types";
import {
  formatDecks,
  formatDivine,
  resolveColor,
} from "./chart-types/chart-types";
import type {
  BrushDrawContext,
  DrawContext,
} from "./draw-functions/draw-functions";
import {
  drawBrush,
  drawDecksScatter,
  drawGrid,
  drawHoverHighlight,
  drawLeagueStartMarker,
  drawProfitArea,
  drawXAxis,
  drawYAxisDecks,
  drawYAxisProfit,
} from "./draw-functions/draw-functions";
import { useCanvasResize } from "./hooks/useCanvasResize/useCanvasResize";
import { useChartInteractions } from "./hooks/useChartInteractions/useChartInteractions";
import { useScrollZoom } from "./hooks/useScrollZoom/useScrollZoom";
import { useTooltipPosition } from "./hooks/useTooltipPosition/useTooltipPosition";
import { LegendIcon } from "./LegendIcon";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CombinedChartCanvasProps {
  chartData: ChartDataPoint[];
  c: ChartColors;
  hiddenMetrics: Set<MetricKey>;
  showBrush: boolean;
  brushRange: BrushRange;
  onBrushChange: (range: BrushRange) => void;
  statScope?: "all-time" | "league";
  leagueStartMarker?: ActiveLeagueStartMarker | null;
}

// ─── Canvas Chart ──────────────────────────────────────────────────────────────

export const CombinedChartCanvas = memo(
  ({
    chartData,
    c,
    hiddenMetrics,
    showBrush,
    brushRange,
    onBrushChange,
    statScope = "all-time",
    leagueStartMarker = null,
  }: CombinedChartCanvasProps) => {
    const profitColor = c.secondary30;
    const decksColor = resolveColor(c, "secondary");

    // ── Mutable ref for hover state (shared between draw & interactions) ─

    const hoverIndexRef = useRef<number | null>(null);

    // ── Refs for latest props (used in non-reactive callbacks) ───

    const brushRangeRef = useRef(brushRange);
    brushRangeRef.current = brushRange;
    const onBrushChangeRef = useRef(onBrushChange);
    onBrushChangeRef.current = onBrushChange;
    const chartDataRef = useRef(chartData);
    chartDataRef.current = chartData;

    // ── Canvas sizing ───────────────────────────────────────────

    const { containerRef, containerElRef, canvasRef, canvasSize } =
      useCanvasResize();

    // ── Tooltip ─────────────────────────────────────────────────

    const { tooltipRef, tooltip, setTooltip, tooltipStyle } =
      useTooltipPosition(canvasSize);

    // ── Visible data slice ──────────────────────────────────────

    const visibleData = useMemo(() => {
      const start = brushRange.startIndex;
      const end = brushRange.endIndex;
      return chartData.slice(start, end + 1);
    }, [chartData, brushRange.startIndex, brushRange.endIndex]);
    const totalProfitSum = useMemo(
      () => sumProfitDivine(chartData),
      [chartData],
    );
    const leagueStartMarkerIndex = useMemo(() => {
      return resolveLeagueStartMarkerIndex({ chartData, leagueStartMarker });
    }, [chartData, leagueStartMarker]);
    const visibleLeagueStartMarker = useMemo(() => {
      return resolveVisibleLeagueStartMarker({
        brushRange: {
          startIndex: brushRange.startIndex,
          endIndex: brushRange.endIndex,
        },
        leagueStartMarker,
        leagueStartMarkerIndex,
      });
    }, [
      brushRange.endIndex,
      brushRange.startIndex,
      leagueStartMarker,
      leagueStartMarkerIndex,
    ]);

    // ── Axis domain computation ─────────────────────────────────

    const domains = useMemo(
      () => computeDomains(visibleData, chartData, hiddenMetrics),
      [visibleData, hiddenMetrics, chartData],
    );

    // ── Layout computation ──────────────────────────────────────

    const layout = useMemo(
      () => computeLayout(canvasSize.width, canvasSize.height, showBrush),
      [canvasSize, showBrush],
    );

    // ── Coordinate mappers ──────────────────────────────────────

    const mapX = useMemo(() => {
      const count = visibleData.length;
      if (count <= 1) {
        const mid = layout.chartLeft + layout.chartWidth / 2;
        const fn = ((_: number) => mid) as LinearMapper;
        fn.inverse = () => 0;
        return fn;
      }
      return createLinearMapper(
        0,
        count - 1,
        layout.chartLeft,
        layout.chartLeft + layout.chartWidth,
      );
    }, [visibleData.length, layout.chartLeft, layout.chartWidth]);

    const mapProfitY = useMemo(
      () =>
        createLinearMapper(
          domains.profit.min,
          domains.profit.max,
          layout.chartBottom,
          layout.chartTop,
        ),
      [
        domains.profit.min,
        domains.profit.max,
        layout.chartBottom,
        layout.chartTop,
      ],
    );

    const mapDecksY = useMemo(
      () =>
        createLinearMapper(
          domains.decks.min,
          domains.decks.max,
          layout.chartBottom,
          layout.chartTop,
        ),
      [
        domains.decks.min,
        domains.decks.max,
        layout.chartBottom,
        layout.chartTop,
      ],
    );

    const mapBrushX = useMemo(() => {
      const total = chartData.length;
      if (total <= 1) {
        const mid =
          layout.brushLeft + (layout.brushRight - layout.brushLeft) / 2;
        const fn = ((_: number) => mid) as LinearMapper;
        fn.inverse = () => 0;
        return fn;
      }
      return createLinearMapper(
        0,
        total - 1,
        layout.brushLeft,
        layout.brushRight,
      );
    }, [chartData.length, layout.brushLeft, layout.brushRight]);

    // ── Drawing ─────────────────────────────────────────────────

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const result = setupCanvas(canvas);
      if (!result) return;
      const { ctx } = result;

      if (layout.chartWidth <= 0 || layout.chartHeight <= 0) return;

      const dc: DrawContext = {
        ctx,
        layout,
        colors: { profitColor, decksColor, c },
        hiddenMetrics,
        mapX,
        mapProfitY,
        mapDecksY,
      };

      // Grid, axes
      drawGrid(dc, domains, visibleData.length);
      drawYAxisDecks(dc, domains);
      drawYAxisProfit(dc, domains);
      drawXAxis(dc, visibleData);

      // Clip to chart area for data rendering
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        layout.chartLeft - CLIP_BLEED,
        layout.chartTop - CLIP_BLEED,
        layout.chartWidth + CLIP_BLEED * 2,
        layout.chartHeight + CLIP_BLEED * 2,
      );
      ctx.clip();

      if (visibleLeagueStartMarker) {
        drawLeagueStartMarker(dc, visibleLeagueStartMarker.visibleIndex, {
          label: visibleLeagueStartMarker.label,
          color: c.success50,
          lineDash: [4, 4],
          showLabel: true,
        });
      }

      drawProfitArea(dc, visibleData, chartData, totalProfitSum);
      drawDecksScatter(dc, visibleData);
      drawHoverHighlight(dc, visibleData, hoverIndexRef.current);

      ctx.restore(); // Un-clip

      // Brush
      if (showBrush && chartData.length > 0) {
        const bdc: BrushDrawContext = {
          ...dc,
          mapBrushX,
          brushRange: brushRangeRef.current,
          hoverIndex: hoverIndexRef.current,
          markerIndex: leagueStartMarkerIndex,
        };
        drawBrush(bdc, chartData);
      }
    }, [
      canvasRef,
      layout,
      visibleData,
      chartData,
      c,
      domains,
      hiddenMetrics,
      profitColor,
      decksColor,
      showBrush,
      mapX,
      mapProfitY,
      mapDecksY,
      mapBrushX,
      leagueStartMarkerIndex,
      visibleLeagueStartMarker,
      totalProfitSum,
    ]);

    // ── Draw on every relevant change ───────────────────────────

    useEffect(() => {
      draw();
    }, [draw]);

    // ── Interactions ─────────────────────────────────────────────

    useChartInteractions({
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
    });

    // ── Scroll-to-zoom ──────────────────────────────────────────

    useScrollZoom(
      containerElRef,
      chartDataRef,
      brushRangeRef,
      onBrushChangeRef,
    );

    // ── Render ──────────────────────────────────────────────────

    const tp = tooltip.dataPoint;

    return (
      <div
        ref={containerRef}
        className="flex-1 min-h-50 min-w-0 relative"
        style={{ position: "relative" }}
      >
        <canvas
          ref={canvasRef}
          data-brush-enabled={showBrush ? "true" : "false"}
          data-brush-end-index={brushRange.endIndex}
          data-brush-start-index={brushRange.startIndex}
          data-chart-point-count={chartData.length}
          data-testid="combined-chart-canvas"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            cursor: "grab",
          }}
        />

        {/* Tooltip rendered as DOM for crisp text */}
        {tooltip.visible && tp && (
          <div ref={tooltipRef} style={tooltipStyle}>
            <div className="bg-base-300/95 backdrop-blur-sm border border-base-content/8 rounded-xl px-3.5 py-2.5 shadow-xl text-sm min-w-45">
              {/* Header */}
              <div className="flex items-center justify-between gap-6 mb-2">
                <span className="font-semibold text-base-content text-xs tracking-wide">
                  Session {tp.sessionIndex}
                </span>
                <span className="text-base-content/30 text-[10px]">
                  {new Date(tp.sessionDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="h-px bg-base-content/8 -mx-3.5 mb-2" />

              {/* Metrics */}
              <div className="space-y-1.5">
                {!hiddenMetrics.has("decks") && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <LegendIcon visual="scatter" color={decksColor} />
                      <span className="text-base-content/45">Decks</span>
                    </span>
                    <span className="font-semibold tabular-nums text-[11px] text-base-content">
                      {formatDecks(tp.rawDecks)}
                    </span>
                  </div>
                )}
                {!hiddenMetrics.has("profit") && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <LegendIcon visual="area" color={profitColor} />
                      <span className="text-base-content/45">Profit</span>
                    </span>
                    <span className="font-semibold tabular-nums text-[11px] text-base-content">
                      {formatDivine(tp.profitDivine)}
                    </span>
                  </div>
                )}
              </div>

              {/* Ratio footer */}
              {!hiddenMetrics.has("profit") && tp.chaosPerDivine > 0 && (
                <>
                  <div className="h-px bg-base-content/6 -mx-3.5 mt-2 mb-1.5" />
                  <div className="flex items-center justify-between">
                    {statScope === "all-time" && tp.league ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-base-content/8 text-base-content/40">
                        {tp.league}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-[10px] text-base-content/30 tabular-nums">
                      {Math.round(tp.chaosPerDivine)}c : 1div
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);
