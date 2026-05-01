import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useChartColors } from "~/renderer/hooks";
import {
  nearestPointHitTest,
  useCanvasResize,
} from "~/renderer/lib/canvas-core";
import { useProfitForecast } from "~/renderer/store";

import { formatDivine } from "../../ProfitForecast.utils/ProfitForecast.utils";
import {
  computeDomains,
  computeLayout,
  computeTooltipStyle,
  drawPFBreakevenChartCanvas,
  HOVER_THRESHOLD,
  mapCategoryX,
  type PnLCurvePoint,
  TOOLTIP_HEIGHT,
  TOOLTIP_WIDTH,
  type TooltipState,
} from "./PFBreakevenChart.utils";

function PFBreakevenTooltip({
  dataPoint,
  chaosToDivineRatio,
  optimisticColor,
  estimatedColor,
  dotBorderColor,
}: {
  dataPoint: PnLCurvePoint;
  chaosToDivineRatio: number;
  optimisticColor: string;
  estimatedColor: string;
  dotBorderColor: string;
}) {
  return (
    <div className="bg-base-300 border border-base-content/10 rounded-lg p-2.5 shadow-lg text-xs space-y-1">
      <p className="font-medium text-base-content">
        {dataPoint.deckCount.toLocaleString("en-US")} decks
      </p>
      <p className="text-primary flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block shrink-0 rounded-full"
          style={{
            width: 8,
            height: 8,
            backgroundColor: optimisticColor,
            border: `1.5px solid ${dotBorderColor}`,
          }}
        />
        <span>
          Optimistic: {formatDivine(dataPoint.optimistic, chaosToDivineRatio)}
        </span>
      </p>
      <p className="text-secondary flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block shrink-0 rounded-full"
          style={{
            width: 8,
            height: 8,
            backgroundColor: estimatedColor,
            border: `1.5px solid ${dotBorderColor}`,
          }}
        />
        <span>
          Estimated: {formatDivine(dataPoint.estimated, chaosToDivineRatio)}
        </span>
      </p>
    </div>
  );
}

/**
 * Breakeven / P&L chart for the Profit Forecast page.
 *
 * Shows estimated and optimistic P&L curves with a break-even reference line.
 */
const PFBreakevenChart = () => {
  const c = useChartColors();
  const hoverIndexRef = useRef<number | null>(null);

  const { chaosToDivineRatio, isLoading, hasData, cachedPnLCurve } =
    useProfitForecast();

  const dataAvailable = hasData() && !isLoading;
  const curveData = dataAvailable ? cachedPnLCurve : [];

  const { containerRef, containerElRef, canvasRef, canvasSize } =
    useCanvasResize();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState({
    width: TOOLTIP_WIDTH,
    height: TOOLTIP_HEIGHT,
  });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    dataPoint: null,
  });

  const domains = useMemo(
    () => (curveData.length > 0 ? computeDomains(curveData) : null),
    [curveData],
  );
  const layout = useMemo(
    () => computeLayout(canvasSize.width, canvasSize.height),
    [canvasSize.width, canvasSize.height],
  );

  const tooltipStyle = useMemo(
    () => computeTooltipStyle({ tooltip, tooltipSize, canvasSize }),
    [tooltip, tooltipSize, canvasSize],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !domains || curveData.length === 0) return;
    drawPFBreakevenChartCanvas({
      canvas,
      sourceElement: containerElRef.current,
      domains,
      curveData,
      layout,
      canvasSize,
      chaosToDivineRatio,
      hoverIndex: hoverIndexRef.current,
      c,
    });
  }, [
    canvasRef,
    canvasSize,
    chaosToDivineRatio,
    containerElRef,
    curveData,
    domains,
    layout,
    c,
  ]);

  useEffect(() => {
    const hadHoverPoint =
      hoverIndexRef.current !== null &&
      curveData[hoverIndexRef.current] !== undefined;

    hoverIndexRef.current = null;
    setTooltip((current) =>
      current.visible || hadHoverPoint
        ? { visible: false, x: 0, y: 0, dataPoint: null }
        : current,
    );
  }, [curveData]);

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
      if (!canvas || !domains || curveData.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const hit = nearestPointHitTest(
        x,
        curveData,
        (_point, index) => mapCategoryX(index, curveData.length, layout),
        HOVER_THRESHOLD,
      );

      if (hit.index < 0) {
        hoverIndexRef.current = null;
        setTooltip((current) =>
          current.visible
            ? { visible: false, x: 0, y: 0, dataPoint: null }
            : current,
        );
        draw();
        return;
      }

      hoverIndexRef.current = hit.index;
      setTooltip({
        visible: true,
        x,
        y,
        dataPoint: curveData[hit.index],
      });
      draw();
    },
    [canvasRef, curveData, domains, draw, layout],
  );

  const handlePointerLeave = useCallback(() => {
    hoverIndexRef.current = null;
    setTooltip({ visible: false, x: 0, y: 0, dataPoint: null });
    draw();
  }, [draw]);

  if (!dataAvailable || curveData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-base-content/50 text-sm h-full"
        data-testid="pf-breakeven-empty"
      >
        No data available for breakeven chart.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      data-testid="pf-breakeven-chart"
    >
      <canvas
        ref={canvasRef}
        data-testid="pf-breakeven-canvas"
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
          <PFBreakevenTooltip
            dataPoint={tooltip.dataPoint}
            chaosToDivineRatio={chaosToDivineRatio}
            optimisticColor={c.primary60}
            estimatedColor={c.primary}
            dotBorderColor="rgba(255, 255, 255, 0.9)"
          />
        </div>
      )}
    </div>
  );
};

export default PFBreakevenChart;
