import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import {
  CLIP_BLEED,
  computeDomains,
  computeLayout,
  DPR,
} from "./canvas-chart-utils";
import type {
  BrushRange,
  ChartColors,
  ChartDataPoint,
  MetricKey,
} from "./chart-types";
import { formatDecks, formatDivine, resolveColor } from "./chart-types";
import type { BrushDrawContext, DrawContext } from "./draw-functions";
import {
  drawBrush,
  drawDecksScatter,
  drawGrid,
  drawHoverHighlight,
  drawProfitArea,
  drawXAxis,
  drawYAxisDecks,
  drawYAxisProfit,
} from "./draw-functions";
import { useCanvasResize } from "./hooks/useCanvasResize";
import { useChartInteractions } from "./hooks/useChartInteractions";
import { useScrollZoom } from "./hooks/useScrollZoom";
import { useTooltipPosition } from "./hooks/useTooltipPosition";
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

    const { containerRef, canvasRef, canvasSize } = useCanvasResize();

    // ── Tooltip ─────────────────────────────────────────────────

    const { tooltipRef, tooltip, setTooltip, tooltipStyle } =
      useTooltipPosition(canvasSize);

    // ── Visible data slice ──────────────────────────────────────

    const visibleData = useMemo(() => {
      const start = brushRange.startIndex;
      const end = brushRange.endIndex;
      return chartData.slice(start, end + 1);
    }, [chartData, brushRange.startIndex, brushRange.endIndex]);

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

    const mapX = useCallback(
      (index: number): number => {
        const count = visibleData.length;
        if (count <= 1) return layout.chartLeft + layout.chartWidth / 2;
        const frac = index / (count - 1);
        return layout.chartLeft + frac * layout.chartWidth;
      },
      [visibleData.length, layout.chartLeft, layout.chartWidth],
    );

    const mapProfitY = useCallback(
      (value: number): number => {
        const { min, max } = domains.profit;
        const range = max - min || 1;
        const frac = (value - min) / range;
        return layout.chartBottom - frac * layout.chartHeight;
      },
      [domains.profit, layout.chartBottom, layout.chartHeight],
    );

    const mapDecksY = useCallback(
      (value: number): number => {
        const { min, max } = domains.decks;
        const range = max - min || 1;
        const frac = (value - min) / range;
        return layout.chartBottom - frac * layout.chartHeight;
      },
      [domains.decks, layout.chartBottom, layout.chartHeight],
    );

    const mapBrushX = useCallback(
      (dataIndex: number): number => {
        const total = chartData.length;
        if (total <= 1)
          return layout.brushLeft + (layout.brushRight - layout.brushLeft) / 2;
        const frac = dataIndex / (total - 1);
        return layout.brushLeft + frac * (layout.brushRight - layout.brushLeft);
      },
      [chartData.length, layout.brushLeft, layout.brushRight],
    );

    // ── Drawing ─────────────────────────────────────────────────

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = DPR();
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

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

      drawProfitArea(dc, visibleData, chartData);
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

    useScrollZoom(containerRef, chartDataRef, brushRangeRef, onBrushChangeRef);

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
