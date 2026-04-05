import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { useChartColors } from "~/renderer/hooks";
import {
  createLinearMapper,
  setupCanvas,
  useCanvasResize,
} from "~/renderer/lib/canvas-core";
import { useCurrentSession } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";

import {
  BAR_COLOR,
  buildPixelSpline,
  computeTimelineDomains,
  computeTimelineLayout,
  drawBars,
  drawHoverHighlight,
  drawProfitLine,
  drawTimelineGrid,
} from "../canvas-utils/canvas-utils";
import { CHART_HEIGHT } from "../constants/constants";
import { TimelineTooltipContent } from "../TimelineTooltip/TimelineTooltip";
import { timelineBuffer } from "../timeline-buffer/timeline-buffer";
import { useTimelineBuffer } from "../useTimelineBuffer/useTimelineBuffer";
import { useTimelineInteractions } from "../useTimelineInteractions/useTimelineInteractions";
import { useTimelineTooltip } from "../useTimelineTooltip/useTimelineTooltip";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionProfitTimelineProps {
  /** Timeline data for historical sessions. If provided, seeds the buffer on mount. */
  timeline?: Parameters<typeof useTimelineBuffer>[0]["timeline"];
  /** Override chart height */
  height?: number;
  /** Override chaos-to-divine ratio (for historical sessions) */
  chaosToDivineRatio?: number;
  /** Override stacked deck cost (for historical sessions) */
  stackedDeckChaosCost?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

const SessionProfitTimeline = memo(
  ({
    timeline: timelineProp,
    height = CHART_HEIGHT,
    chaosToDivineRatio: ratioProp,
    stackedDeckChaosCost: costProp,
  }: SessionProfitTimelineProps) => {
    const c = useChartColors();

    const { getSession, getChaosToDivineRatio } = useCurrentSession();

    const session = getSession();
    const chaosToDivineRatio = ratioProp ?? getChaosToDivineRatio();
    const deckCost = costProp ?? session?.totals?.stackedDeckChaosCost ?? 0;

    // ── Buffer lifecycle (seeding, deck cost, version tracking) ─────────
    const bufferVersion = useTimelineBuffer({
      timeline: timelineProp,
      deckCost,
    });

    // ── Canvas setup ────────────────────────────────────────────────────
    const { containerRef, containerElRef, canvasRef, canvasSize } =
      useCanvasResize();
    const hoverIndexRef = useRef<number | null>(null);

    // ── Tooltip ─────────────────────────────────────────────────────────
    const { tooltip, setTooltip, tooltipStyle } =
      useTimelineTooltip(containerElRef);

    // ── Format Y tick ───────────────────────────────────────────────────
    const formatYTick = useCallback(
      (value: number) => formatCurrency(value, chaosToDivineRatio),
      [chaosToDivineRatio],
    );

    // ── Stable layout & domains for interactions ───────────────────────
    const stableLayout = useMemo(
      () => computeTimelineLayout(canvasSize.width, canvasSize.height),
      [canvasSize.width, canvasSize.height],
    );

    const stableDomainsRef = useRef(
      computeTimelineDomains(
        timelineBuffer.linePoints,
        timelineBuffer.chartData,
      ),
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: buffer fields are mutable refs — we use bufferVersion (from useSyncExternalStore) plus canvasSize as proxies to recompute the mapper whenever data changes or the canvas resizes
    const stableMapX = useMemo(() => {
      const domains = computeTimelineDomains(
        timelineBuffer.linePoints,
        timelineBuffer.chartData,
      );
      stableDomainsRef.current = domains;
      return createLinearMapper(
        domains.x.min,
        domains.x.max,
        stableLayout.chartLeft,
        stableLayout.chartLeft + stableLayout.chartWidth,
      );
    }, [
      canvasSize,
      bufferVersion,
      stableLayout.chartLeft,
      stableLayout.chartWidth,
    ]);

    // ── Drawing ─────────────────────────────────────────────────────────
    // Reads directly from the mutable buffer — zero allocation per frame.
    // Domains & mappers are computed from the live buffer snapshot so that
    // the Y-axis mapping is always in sync with the data being drawn,
    // even when the buffer has been mutated since the last React render.
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const result = setupCanvas(canvas);
      if (!result) return;
      const { ctx } = result;

      // Read directly from buffer — no React state, no Immer
      const { linePoints, chartData } = timelineBuffer;
      if (linePoints.length < 2 && chartData.length === 0) return;

      const layout = stableLayout;
      if (layout.chartWidth <= 0 || layout.chartHeight <= 0) return;

      // Compute domains from the live buffer data so the mappers are
      // always consistent with the points we're about to draw.
      const domains = computeTimelineDomains(linePoints, chartData);

      const mapX = createLinearMapper(
        domains.x.min,
        domains.x.max,
        layout.chartLeft,
        layout.chartLeft + layout.chartWidth,
      );
      const mapY = createLinearMapper(
        domains.y.min,
        domains.y.max,
        layout.chartBottom,
        layout.chartTop,
      );

      const dc = { ctx, layout, domains, mapX, mapY };

      // Grid & axes
      drawTimelineGrid(dc, formatYTick);

      // Clip to chart area
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        layout.chartLeft - 2,
        layout.chartTop - 2,
        layout.chartWidth + 4,
        layout.chartHeight + 4,
      );
      ctx.clip();

      // Bars (drawn first so the profit line renders on top)
      drawBars(dc, chartData);

      // Build pixel spline once — reused by profit line + hover highlight
      const spline = buildPixelSpline(dc, linePoints);

      // Profit line + area fill
      drawProfitLine(dc, spline, c.primary, c.primary30, c.primary02);

      // Hover highlight
      if (hoverIndexRef.current != null) {
        drawHoverHighlight(
          dc,
          chartData,
          hoverIndexRef.current,
          c.primary,
          spline,
        );
      }

      ctx.restore();
    }, [
      canvasRef,
      stableLayout,
      formatYTick,
      c.primary,
      c.primary30,
      c.primary02,
    ]);

    // ── Draw ref — stable reference for subscriptions ───────────────────
    const drawRef = useRef(draw);
    drawRef.current = draw;

    // ── Subscribe to buffer changes → redraw ────────────────────────────
    useEffect(() => {
      const unsub = timelineBuffer.subscribe(() => drawRef.current());
      drawRef.current(); // Initial draw
      return unsub;
    }, []);

    // ── Redraw on canvas resize ─────────────────────────────────────────
    // biome-ignore lint/correctness/useExhaustiveDependencies: canvasSize is an intentional trigger to redraw when the canvas element resizes
    useEffect(() => {
      drawRef.current();
    }, [canvasSize]);

    // ── Interactions ────────────────────────────────────────────────────
    useTimelineInteractions({
      canvasRef,
      hoverIndexRef,
      layout: stableLayout,
      chartData: timelineBuffer.chartData,
      mapX: stableMapX,
      setTooltip,
      draw,
    });

    // ── Tooltip portal ──────────────────────────────────────────────────
    const tp = tooltip.point;

    const tooltipContent =
      tooltip.visible && tp?.rarity && tp.cardName
        ? createPortal(
            <TimelineTooltipContent
              tooltipStyle={tooltipStyle}
              point={tp}
              chaosToDivineRatio={chaosToDivineRatio}
            />,
            document.body,
          )
        : null;

    // ── Render ──────────────────────────────────────────────────────────

    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-base-content/50">
            Profit Timeline
          </h3>
          <span className="text-[10px] text-base-content/30 tabular-nums">
            {timelineBuffer.totalDrops.toLocaleString()} drops ·{" "}
            {formatCurrency(timelineBuffer.totalChaosValue, chaosToDivineRatio)}{" "}
            total
          </span>
        </div>

        {/* Canvas chart */}
        <div
          ref={containerRef}
          className="relative"
          style={{ height: `${height}px` }}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          />
        </div>

        {/* Tooltip (portaled to body) */}
        {tooltipContent}

        {/* Legend */}
        {timelineBuffer.hasBars && (
          <div className="flex items-center gap-1.5 justify-end">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: BAR_COLOR }}
            />
            <span className="text-[10px] text-base-content/40">
              Notable Drops
            </span>
          </div>
        )}
      </div>
    );
  },
);

export default SessionProfitTimeline;
