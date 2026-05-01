import { useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  TOOLTIP_HEIGHT,
  TOOLTIP_MARGIN,
  TOOLTIP_OFFSET_X,
  TOOLTIP_OFFSET_Y,
  TOOLTIP_WIDTH,
} from "../../canvas-chart-utils/canvas-chart-utils";
import type { ChartDataPoint } from "../../chart-types/chart-types";

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  dataPoint: ChartDataPoint | null;
}

/**
 * Manages tooltip visibility/position state and computes the absolute
 * CSS style needed to keep the tooltip within the canvas bounds.
 */
export function useTooltipPosition(canvasSize: {
  width: number;
  height: number;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
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

  const tooltipStyle = useMemo(() => {
    if (!tooltip.visible || !tooltip.dataPoint) {
      return { display: "none" as const };
    }

    const cw = canvasSize.width;
    const ch = canvasSize.height;
    const tooltipWidth = tooltipSize.width || TOOLTIP_WIDTH;
    const tooltipHeight = tooltipSize.height || TOOLTIP_HEIGHT;

    // Try placing to the right of the point
    let left = tooltip.x + TOOLTIP_OFFSET_X;
    if (left + tooltipWidth > cw - TOOLTIP_MARGIN) {
      // Flip to the left
      left = tooltip.x - tooltipWidth - TOOLTIP_OFFSET_X;
    }
    // Still overflowing left? Clamp to left edge
    if (left < TOOLTIP_MARGIN) {
      left = TOOLTIP_MARGIN;
    }

    // Try placing below the cursor
    let top = tooltip.y + TOOLTIP_OFFSET_Y;
    if (top + tooltipHeight > ch - TOOLTIP_MARGIN) {
      // Flip above the cursor
      top = tooltip.y - tooltipHeight - TOOLTIP_OFFSET_Y;
    }
    // Still overflowing top? Clamp to top edge
    if (top < TOOLTIP_MARGIN) {
      top = TOOLTIP_MARGIN;
    }

    return {
      position: "absolute" as const,
      left: `${left}px`,
      top: `${top}px`,
      pointerEvents: "none" as const,
      zIndex: 10,
    };
  }, [
    tooltip,
    tooltipSize.height,
    tooltipSize.width,
    canvasSize.width,
    canvasSize.height,
  ]);

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

  return { tooltipRef, tooltip, setTooltip, tooltipStyle };
}
