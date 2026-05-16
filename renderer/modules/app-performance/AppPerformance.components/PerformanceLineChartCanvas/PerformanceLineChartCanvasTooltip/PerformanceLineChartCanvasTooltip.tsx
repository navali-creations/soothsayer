import { useLayoutEffect, useRef, useState } from "react";

import { formatAppPerformanceRouteLabel } from "../../../AppPerformance.utils/AppPerformance.utils";
import type {
  HoverState,
  PerformanceLine,
} from "../PerformanceLineChartCanvas.types";
import { formatRouteLabel } from "../PerformanceLineChartCanvas.utils";
import {
  resolveTooltipPosition,
  TOOLTIP_FALLBACK_SIZE,
} from "./PerformanceLineChartCanvasTooltip.utils";

interface PerformanceLineChartCanvasTooltipProps {
  hover: HoverState | null;
  canvasHeight: number;
  canvasWidth: number;
  lines: PerformanceLine[];
  valueFormatter: (value: number | null) => string;
  secondaryValueFormatter?: (value: number | null) => string;
  xValueFormatter: (value: number) => string;
}

export function PerformanceLineChartCanvasTooltip({
  hover,
  canvasHeight,
  canvasWidth,
  lines,
  valueFormatter,
  secondaryValueFormatter,
  xValueFormatter,
}: PerformanceLineChartCanvasTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState(TOOLTIP_FALLBACK_SIZE);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const nextSize = {
      width: tooltip.offsetWidth || TOOLTIP_FALLBACK_SIZE.width,
      height: tooltip.offsetHeight || TOOLTIP_FALLBACK_SIZE.height,
    };
    setTooltipSize((current) =>
      current.width === nextSize.width && current.height === nextSize.height
        ? current
        : nextSize,
    );
  });

  if (!hover) return null;

  const sample = hover.sample;
  const position = resolveTooltipPosition({
    canvasHeight,
    canvasWidth,
    hoverX: hover.x,
    hoverY: hover.y,
    tooltipHeight: tooltipSize.height,
    tooltipWidth: tooltipSize.width,
  });

  return (
    <div
      ref={tooltipRef}
      data-testid="app-performance-line-chart-tooltip"
      className="pointer-events-none absolute z-10 min-w-44 rounded-lg border border-base-content/10 bg-base-100/95 px-3 py-2 text-xs shadow-xl"
      style={{
        left: position.left,
        maxHeight: Math.max(80, canvasHeight - 16),
        top: position.top,
      }}
    >
      {hover.marker && (
        <div className="mb-1 border-b border-base-content/10 pb-1">
          <div className="font-semibold">{formatRouteLabel(hover.marker)}</div>
          <div className="text-base-content/50">
            {xValueFormatter(hover.marker.elapsedMs)}
          </div>
        </div>
      )}
      {sample && (
        <div className="space-y-1">
          <div className="border-b border-base-content/10 pb-1">
            <div className="font-semibold">
              {formatAppPerformanceRouteLabel(sample.route)}
            </div>
            <div className="text-base-content/50">Current route</div>
          </div>
          <div className="font-semibold">
            {xValueFormatter(sample.captureElapsedMs)}
          </div>
          {lines.map((line) => {
            const format =
              line.valueFormatter ??
              (line.axis === "secondary"
                ? secondaryValueFormatter
                : valueFormatter) ??
              valueFormatter;

            return (
              <div
                key={line.id}
                className="flex items-center justify-between gap-4"
              >
                <span className="flex items-center gap-1.5 text-base-content/60">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: line.color }}
                  />
                  {line.label}
                </span>
                <span className="tabular-nums">
                  {format(line.value(sample))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
