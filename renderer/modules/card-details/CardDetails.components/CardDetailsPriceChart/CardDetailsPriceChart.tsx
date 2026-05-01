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
  clamp,
  createLinearMapper,
  drawDonutIndicator,
  drawMonotoneCurve,
  ensureCanvasBackingStore,
  evenTicks,
  hitTestIndexBrush,
  indexFromBrushPixel,
  nearestPointHitTest,
  panIndexBrush,
  resizeIndexBrush,
  type SplinePoint,
  setupCanvas,
  useCanvasResize,
  zoomIndexBrush,
} from "~/renderer/lib/canvas-core";
import { useCardDetails } from "~/renderer/store";

import ChartTooltip from "./ChartTooltip/ChartTooltip";
import { BRUSH_HEIGHT, CHART_HEIGHT } from "./constants";
import {
  formatAxisDate,
  formatRate,
  formatVolume,
  mapHistoryToChartData,
} from "./helpers";
import PriceChartEmpty from "./PriceChartEmpty/PriceChartEmpty";
import PriceChartError from "./PriceChartError/PriceChartError";
import type { ChartDataPoint } from "./types";

interface ChartLayout {
  chartLeft: number;
  chartRight: number;
  chartTop: number;
  chartBottom: number;
  chartWidth: number;
  chartHeight: number;
  brushTop: number;
  brushBottom: number;
  brushLeft: number;
  brushRight: number;
  brushHeight: number;
}

interface BrushRange {
  startIndex: number;
  endIndex: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  dataPoint: ChartDataPoint | null;
}

type DragMode = "start" | "end" | "range" | null;

const AXIS_LEFT = 50;
const AXIS_RIGHT = 50;
const AXIS_TOP = 8;
const AXIS_BOTTOM = 24;
const BRUSH_GAP = 8;
const TICK_COUNT = 5;
const MIN_VISIBLE_POINTS = 5;
const MIN_BRUSH_SPAN = MIN_VISIBLE_POINTS - 1;
const BRUSH_ZOOM_STEP = 3;
const HOVER_THRESHOLD = 24;
const TRAVELLER_WIDTH = 8;
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 90;
const TOOLTIP_OFFSET = 12;
const TOOLTIP_MARGIN = 4;

function computeLayout(
  width: number,
  height: number,
  showBrush: boolean,
): ChartLayout {
  const brushBlock = showBrush ? BRUSH_HEIGHT + BRUSH_GAP : 0;
  const chartLeft = AXIS_LEFT;
  const chartRight = Math.max(chartLeft, width - AXIS_RIGHT);
  const chartTop = AXIS_TOP;
  const chartBottom = Math.max(chartTop, height - AXIS_BOTTOM - brushBlock);
  const brushTop = height - BRUSH_HEIGHT - 4;
  const brushBottom = brushTop + BRUSH_HEIGHT;

  return {
    chartLeft,
    chartRight,
    chartTop,
    chartBottom,
    chartWidth: Math.max(0, chartRight - chartLeft),
    chartHeight: Math.max(0, chartBottom - chartTop),
    brushTop,
    brushBottom,
    brushLeft: chartLeft,
    brushRight: chartRight,
    brushHeight: BRUSH_HEIGHT,
  };
}

function computeDomains(chartData: ChartDataPoint[]) {
  if (chartData.length === 0) {
    return {
      time: { min: 0, max: 1 },
      rate: { min: 0, max: 1 },
      volume: { min: 0, max: 1 },
    };
  }

  const rates = chartData.map((point) => point.rate);
  const volumes = chartData.map((point) => point.volume);
  const times = chartData.map((point) => point.time);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const maxVolume = Math.max(...volumes);
  const ratePadding = (maxRate - minRate) * 0.1 || maxRate * 0.1 || 1;

  let timeMin = Math.min(...times);
  let timeMax = Math.max(...times);
  if (timeMin === timeMax) {
    timeMin -= 1;
    timeMax += 1;
  }

  return {
    time: { min: timeMin, max: timeMax },
    rate: {
      min: Math.max(0, minRate - ratePadding),
      max: maxRate + ratePadding,
    },
    volume: { min: 0, max: maxVolume * 1.2 || 1 },
  };
}

function buildTimeTicks(
  data: ChartDataPoint[],
  domain: { min: number; max: number },
) {
  if (data.length === 0) return evenTicks(domain.min, domain.max, TICK_COUNT);
  if (data.length <= TICK_COUNT) return data.map((point) => point.time);

  const ticks: number[] = [];
  const lastIndex = data.length - 1;
  for (let i = 0; i < TICK_COUNT; i++) {
    const index = Math.round((lastIndex * i) / (TICK_COUNT - 1));
    const time = data[index].time;
    if (ticks[ticks.length - 1] !== time) ticks.push(time);
  }
  return ticks;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  rateTicks: number[],
  timeTicks: number[],
  mapRateY: (value: number) => number,
  mapX: (value: number) => number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(
    layout.chartLeft,
    layout.chartTop,
    layout.chartWidth,
    layout.chartHeight,
  );

  for (let i = 1; i < rateTicks.length - 1; i++) {
    const y = mapRateY(rateTicks[i]);
    ctx.beginPath();
    ctx.moveTo(layout.chartLeft, y);
    ctx.lineTo(layout.chartRight, y);
    ctx.stroke();
  }

  for (let i = 1; i < timeTicks.length - 1; i++) {
    const x = mapX(timeTicks[i]);
    ctx.beginPath();
    ctx.moveTo(x, layout.chartTop);
    ctx.lineTo(x, layout.chartBottom);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  rateTicks: number[],
  volumeTicks: number[],
  timeTicks: number[],
  mapRateY: (value: number) => number,
  mapVolumeY: (value: number) => number,
  mapX: (value: number) => number,
  leftColor: string,
  rightColor: string,
) {
  ctx.save();
  ctx.font = "10px system-ui, sans-serif";

  ctx.fillStyle = leftColor;
  ctx.textAlign = "right";
  for (let i = 0; i < rateTicks.length; i++) {
    const y = mapRateY(rateTicks[i]);
    ctx.textBaseline =
      i === 0 ? "bottom" : i === rateTicks.length - 1 ? "top" : "middle";
    ctx.fillText(formatRate(rateTicks[i]), layout.chartLeft - 7, y);
  }

  ctx.fillStyle = rightColor;
  ctx.textAlign = "left";
  for (let i = 0; i < volumeTicks.length; i++) {
    const y = mapVolumeY(volumeTicks[i]);
    ctx.textBaseline =
      i === 0 ? "bottom" : i === volumeTicks.length - 1 ? "top" : "middle";
    ctx.fillText(formatVolume(volumeTicks[i]), layout.chartRight + 7, y);
  }

  ctx.fillStyle = leftColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let lastLabelX = -Infinity;
  for (const tick of timeTicks) {
    const x = mapX(tick);
    if (x - lastLabelX < 42 && tick !== timeTicks[timeTicks.length - 1]) {
      continue;
    }
    ctx.fillText(formatAxisDate(tick), x, layout.chartBottom + 7);
    lastLabelX = x;
  }

  ctx.restore();
}

function drawRoundedTopBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (height <= 0 || width <= 0) return;
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;

  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, bottom);
  ctx.closePath();
  ctx.fill();
}

function drawVolumeBars(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  layout: ChartLayout,
  mapX: (value: number) => number,
  mapVolumeY: (value: number) => number,
  color: string,
) {
  if (data.length === 0) return;

  const slotWidth =
    data.length > 1
      ? Math.abs(mapX(data[1].time) - mapX(data[0].time))
      : layout.chartWidth / 8;
  const width = clamp(slotWidth * 0.52, 2, 14);

  ctx.save();
  ctx.fillStyle = color;
  for (const point of data) {
    if (point.volume <= 0) continue;
    const x = mapX(point.time) - width / 2;
    const y = mapVolumeY(point.volume);
    drawRoundedTopBar(ctx, x, y, width, layout.chartBottom - y, 2);
  }
  ctx.restore();
}

function drawRateArea(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  layout: ChartLayout,
  mapX: (value: number) => number,
  mapRateY: (value: number) => number,
  color: string,
  fillStart: string,
  fillEnd: string,
) {
  if (data.length === 0) return;

  const points: SplinePoint[] = data.map((point) => ({
    x: mapX(point.time),
    y: mapRateY(point.rate),
  }));
  const gradient = ctx.createLinearGradient(
    0,
    layout.chartTop,
    0,
    layout.chartBottom,
  );
  gradient.addColorStop(0, fillStart);
  gradient.addColorStop(1, fillEnd);

  ctx.save();
  ctx.beginPath();
  drawMonotoneCurve(ctx, points, layout.chartBottom);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  drawMonotoneCurve(ctx, points);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

function drawHover(
  ctx: CanvasRenderingContext2D,
  point: ChartDataPoint | null,
  layout: ChartLayout,
  mapX: (value: number) => number,
  mapRateY: (value: number) => number,
  lineColor: string,
  dotFill: string,
  dotStroke: string,
) {
  if (!point) return;
  const x = mapX(point.time);
  const y = mapRateY(point.rate);

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, layout.chartTop);
  ctx.lineTo(x, layout.chartBottom);
  ctx.stroke();

  drawDonutIndicator(ctx, x, y, {
    fillStyle: dotFill,
    strokeStyle: dotStroke,
  });
  ctx.restore();
}

function drawBrush(
  ctx: CanvasRenderingContext2D,
  data: ChartDataPoint[],
  layout: ChartLayout,
  range: BrushRange,
  mapBrushX: (index: number) => number,
  color: string,
  background: string,
  borderColor: string,
  hoverIndex: number | null,
) {
  if (data.length === 0) return;

  const { brushLeft, brushRight, brushTop, brushBottom, brushHeight } = layout;

  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(brushLeft, brushTop, brushRight - brushLeft, brushHeight);

  let minRate = Infinity;
  let maxRate = -Infinity;
  for (const point of data) {
    minRate = Math.min(minRate, point.rate);
    maxRate = Math.max(maxRate, point.rate);
  }
  if (minRate === maxRate) {
    minRate -= 1;
    maxRate += 1;
  }

  const brushLineY = (index: number) => {
    const point = data[index];
    const rateFraction = (point.rate - minRate) / (maxRate - minRate || 1);
    return brushBottom - 3 - rateFraction * (brushHeight - 6);
  };
  const brushPoints: SplinePoint[] = data.map((_point, index) => {
    return {
      x: mapBrushX(index),
      y: brushLineY(index),
    };
  });

  ctx.beginPath();
  drawMonotoneCurve(ctx, brushPoints);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.stroke();

  const startX = mapBrushX(range.startIndex);
  const endX = mapBrushX(range.endIndex);

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  if (startX > brushLeft) {
    ctx.fillRect(brushLeft, brushTop, startX - brushLeft, brushHeight);
  }
  if (endX < brushRight) {
    ctx.fillRect(endX, brushTop, brushRight - endX, brushHeight);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(brushLeft, brushTop, brushRight - brushLeft, brushHeight);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.strokeRect(startX, brushTop, endX - startX, brushHeight);

  if (hoverIndex !== null) {
    const dataIndex = range.startIndex + hoverIndex;
    if (dataIndex >= 0 && dataIndex < data.length) {
      const hoverX = mapBrushX(dataIndex);
      const hoverY = brushLineY(dataIndex);

      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX, brushTop);
      ctx.lineTo(hoverX, brushBottom);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(hoverX, hoverY, 3, 0, Math.PI * 2);
      ctx.fillStyle = background;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  const drawTraveller = (x: number) => {
    const x0 = x - TRAVELLER_WIDTH / 2;
    const y0 = brushTop - 1;
    const height = brushHeight + 2;
    const radius = 3;

    ctx.beginPath();
    ctx.moveTo(x0 + radius, y0);
    ctx.lineTo(x0 + TRAVELLER_WIDTH - radius, y0);
    ctx.quadraticCurveTo(
      x0 + TRAVELLER_WIDTH,
      y0,
      x0 + TRAVELLER_WIDTH,
      y0 + radius,
    );
    ctx.lineTo(x0 + TRAVELLER_WIDTH, y0 + height - radius);
    ctx.quadraticCurveTo(
      x0 + TRAVELLER_WIDTH,
      y0 + height,
      x0 + TRAVELLER_WIDTH - radius,
      y0 + height,
    );
    ctx.lineTo(x0 + radius, y0 + height);
    ctx.quadraticCurveTo(x0, y0 + height, x0, y0 + height - radius);
    ctx.lineTo(x0, y0 + radius);
    ctx.quadraticCurveTo(x0, y0, x0 + radius, y0);
    ctx.closePath();

    ctx.fillStyle = background;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    const midY = y0 + height / 2;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, midY - 4);
    ctx.lineTo(x - 1.5, midY + 4);
    ctx.moveTo(x + 1.5, midY - 4);
    ctx.lineTo(x + 1.5, midY + 4);
    ctx.stroke();
  };
  drawTraveller(startX);
  drawTraveller(endX);

  const labelY = brushTop + brushHeight / 2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "9px system-ui, sans-serif";
  ctx.textBaseline = "middle";

  ctx.textAlign = "right";
  ctx.fillText(
    data[range.startIndex]?.dateLabel ??
      formatAxisDate(data[range.startIndex]?.time ?? 0),
    startX - TRAVELLER_WIDTH / 2 - 4,
    labelY,
  );

  ctx.textAlign = "left";
  ctx.fillText(
    data[range.endIndex]?.dateLabel ??
      formatAxisDate(data[range.endIndex]?.time ?? 0),
    endX + TRAVELLER_WIDTH / 2 + 4,
    labelY,
  );
  ctx.restore();
}

const CardDetailsPriceChart = () => {
  const c = useChartColors();
  const hoverIndexRef = useRef<number | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    originIndex: number;
    originX: number;
    originRange: BrushRange;
  }>({
    mode: null,
    originIndex: 0,
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

  const domains = useMemo(() => {
    const visibleDomains = computeDomains(visibleData);
    return {
      ...visibleDomains,
      time: visibleDomains.time,
    };
  }, [visibleData]);
  const layout = useMemo(
    () => computeLayout(canvasSize.width, canvasSize.height, showBrush),
    [canvasSize.width, canvasSize.height, showBrush],
  );

  const tooltipStyle = useMemo(() => {
    if (!tooltip.visible || !tooltip.dataPoint) {
      return { display: "none" as const };
    }

    let left = tooltip.x + TOOLTIP_OFFSET;
    if (left + TOOLTIP_WIDTH > canvasSize.width - TOOLTIP_MARGIN) {
      left = tooltip.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
    }
    left = clamp(
      left,
      TOOLTIP_MARGIN,
      Math.max(TOOLTIP_MARGIN, canvasSize.width - TOOLTIP_WIDTH),
    );

    let top = tooltip.y + TOOLTIP_OFFSET;
    if (top + TOOLTIP_HEIGHT > canvasSize.height - TOOLTIP_MARGIN) {
      top = tooltip.y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET;
    }
    top = clamp(
      top,
      TOOLTIP_MARGIN,
      Math.max(TOOLTIP_MARGIN, canvasSize.height - TOOLTIP_HEIGHT),
    );

    return {
      position: "absolute" as const,
      left: `${left}px`,
      top: `${top}px`,
      pointerEvents: "none" as const,
      zIndex: 10,
    };
  }, [tooltip, canvasSize.width, canvasSize.height]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;
    if (!ensureCanvasBackingStore(canvas, containerElRef.current)) return;
    const result = setupCanvas(canvas);
    if (!result) return;

    const { ctx, width, height } = result;
    const effectiveLayout =
      canvasSize.width > 0 && canvasSize.height > 0
        ? layout
        : computeLayout(width, height, showBrush);
    if (effectiveLayout.chartWidth <= 0 || effectiveLayout.chartHeight <= 0) {
      return;
    }

    const mapX = createLinearMapper(
      domains.time.min,
      domains.time.max,
      effectiveLayout.chartLeft,
      effectiveLayout.chartRight,
    );
    const mapRateY = createLinearMapper(
      domains.rate.min,
      domains.rate.max,
      effectiveLayout.chartBottom,
      effectiveLayout.chartTop,
    );
    const mapVolumeY = createLinearMapper(
      domains.volume.min,
      domains.volume.max,
      effectiveLayout.chartBottom,
      effectiveLayout.chartTop,
    );
    const rateTicks = evenTicks(domains.rate.min, domains.rate.max, TICK_COUNT);
    const volumeTicks = evenTicks(
      domains.volume.min,
      domains.volume.max,
      TICK_COUNT,
    );
    const timeTicks = buildTimeTicks(visibleData, domains.time);

    drawGrid(
      ctx,
      effectiveLayout,
      rateTicks,
      timeTicks,
      mapRateY,
      mapX,
      c.bc06,
    );
    drawAxes(
      ctx,
      effectiveLayout,
      rateTicks,
      volumeTicks,
      timeTicks,
      mapRateY,
      mapVolumeY,
      mapX,
      c.bc35,
      c.bc15,
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      effectiveLayout.chartLeft - 2,
      effectiveLayout.chartTop - 2,
      effectiveLayout.chartWidth + 4,
      effectiveLayout.chartHeight + 4,
    );
    ctx.clip();

    drawVolumeBars(ctx, visibleData, effectiveLayout, mapX, mapVolumeY, c.bc15);
    drawRateArea(
      ctx,
      visibleData,
      effectiveLayout,
      mapX,
      mapRateY,
      c.primary,
      c.primary30,
      c.primary02,
    );
    drawHover(
      ctx,
      hoverIndexRef.current === null
        ? null
        : visibleData[hoverIndexRef.current],
      effectiveLayout,
      mapX,
      mapRateY,
      c.bc15,
      c.primary,
      "rgba(255, 255, 255, 0.9)",
    );
    ctx.restore();

    if (showBrush && chartData.length > 0) {
      const mapBrushX = createLinearMapper(
        0,
        chartData.length - 1,
        effectiveLayout.brushLeft,
        effectiveLayout.brushRight,
      );
      drawBrush(
        ctx,
        chartData,
        effectiveLayout,
        brushRange,
        mapBrushX,
        c.primary,
        c.b2,
        c.bc15,
        hoverIndexRef.current,
      );
    }
  }, [
    brushRange,
    canvasRef,
    canvasSize.height,
    canvasSize.width,
    chartData,
    c.b2,
    c.bc06,
    c.bc15,
    c.bc35,
    c.primary,
    c.primary02,
    c.primary30,
    containerElRef,
    domains,
    layout,
    showBrush,
    visibleData,
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

  const updateHover = useCallback(
    (x: number, y: number) => {
      if (visibleData.length === 0) return;

      const mapX = createLinearMapper(
        domains.time.min,
        domains.time.max,
        layout.chartLeft,
        layout.chartRight,
      );
      const hit = nearestPointHitTest(
        x,
        visibleData,
        (point) => mapX(point.time),
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
      setTooltip({ visible: true, x, y, dataPoint: visibleData[hit.index] });
      draw();
    },
    [domains.time.max, domains.time.min, draw, layout, visibleData],
  );

  const updateBrushFromPointer = useCallback(
    (x: number) => {
      if (!showBrush || chartData.length <= 1) return;
      const mapBrushX = createLinearMapper(
        0,
        chartData.length - 1,
        layout.brushLeft,
        layout.brushRight,
      );
      const pointerIndex = indexFromBrushPixel(mapBrushX, x, chartData.length);
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
    [layout.brushLeft, layout.brushRight, showBrush, chartData],
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

      const mapBrushX = createLinearMapper(
        0,
        chartData.length - 1,
        layout.brushLeft,
        layout.brushRight,
      );
      const brushHit = hitTestIndexBrush({
        x,
        y,
        layout,
        range: brushRange,
        mapBrushX,
        travellerWidth: TRAVELLER_WIDTH,
      });
      if (brushHit === null) return;

      dragRef.current = {
        mode:
          brushHit === "left-traveller"
            ? "start"
            : brushHit === "right-traveller"
              ? "end"
              : "range",
        originIndex: indexFromBrushPixel(mapBrushX, x, chartData.length),
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
        hoverIndexRef.current = null;
        setTooltip({ visible: false, x: 0, y: 0, dataPoint: null });
        draw();
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
        originIndex: 0,
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
    hoverIndexRef.current = null;
    setTooltip({ visible: false, x: 0, y: 0, dataPoint: null });
    draw();
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
