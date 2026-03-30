import { useMemo, useRef, useState } from "react";

import {
  TOOLTIP_HEIGHT,
  TOOLTIP_MARGIN,
  TOOLTIP_OFFSET_X,
  TOOLTIP_OFFSET_Y,
  TOOLTIP_WIDTH,
} from "../canvas-chart-utils";
import type { ChartDataPoint } from "../chart-types";

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

    // Try placing to the right of the point
    let left = tooltip.x + TOOLTIP_OFFSET_X;
    if (left + TOOLTIP_WIDTH > cw - TOOLTIP_MARGIN) {
      // Flip to the left
      left = tooltip.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X;
    }
    // Still overflowing left? Clamp to left edge
    if (left < TOOLTIP_MARGIN) {
      left = TOOLTIP_MARGIN;
    }

    // Try placing below the cursor
    let top = tooltip.y + TOOLTIP_OFFSET_Y;
    if (top + TOOLTIP_HEIGHT > ch - TOOLTIP_MARGIN) {
      // Flip above the cursor
      top = tooltip.y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET_Y;
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
  }, [tooltip, canvasSize.width, canvasSize.height]);

  return { tooltipRef, tooltip, setTooltip, tooltipStyle };
}
