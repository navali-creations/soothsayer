import { clamp } from "~/renderer/lib/canvas-core";

const TOOLTIP_MARGIN = 8;
const TOOLTIP_X_OFFSET = 12;
const TOOLTIP_Y_OFFSET = -18;

export const TOOLTIP_FALLBACK_SIZE = {
  width: 190,
  height: 160,
};

interface ResolveTooltipPositionOptions {
  canvasHeight: number;
  canvasWidth: number;
  hoverX: number;
  hoverY: number;
  tooltipHeight?: number;
  tooltipWidth?: number;
}

export function resolveTooltipPosition({
  canvasHeight,
  canvasWidth,
  hoverX,
  hoverY,
  tooltipHeight = TOOLTIP_FALLBACK_SIZE.height,
  tooltipWidth = TOOLTIP_FALLBACK_SIZE.width,
}: ResolveTooltipPositionOptions): { left: number; top: number } {
  return {
    left: resolveTooltipLeft({ canvasWidth, hoverX, tooltipWidth }),
    top: clamp(
      hoverY + TOOLTIP_Y_OFFSET,
      TOOLTIP_MARGIN,
      Math.max(TOOLTIP_MARGIN, canvasHeight - tooltipHeight - TOOLTIP_MARGIN),
    ),
  };
}

function resolveTooltipLeft({
  canvasWidth,
  hoverX,
  tooltipWidth,
}: {
  canvasWidth: number;
  hoverX: number;
  tooltipWidth: number;
}): number {
  const maxLeft = Math.max(
    TOOLTIP_MARGIN,
    canvasWidth - tooltipWidth - TOOLTIP_MARGIN,
  );
  const rightLeft = hoverX + TOOLTIP_X_OFFSET;
  const leftLeft = hoverX - TOOLTIP_X_OFFSET - tooltipWidth;

  if (rightLeft <= maxLeft) return rightLeft;
  if (leftLeft >= TOOLTIP_MARGIN) return leftLeft;

  const rightSpace = canvasWidth - hoverX - TOOLTIP_X_OFFSET - TOOLTIP_MARGIN;
  const leftSpace = hoverX - TOOLTIP_X_OFFSET - TOOLTIP_MARGIN;
  return rightSpace >= leftSpace
    ? clamp(rightLeft, TOOLTIP_MARGIN, maxLeft)
    : clamp(leftLeft, TOOLTIP_MARGIN, maxLeft);
}
