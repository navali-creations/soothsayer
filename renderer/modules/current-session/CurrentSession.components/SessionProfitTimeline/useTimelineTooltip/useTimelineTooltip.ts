import { type RefObject, useMemo, useState } from "react";

import { computePortalTooltipStyle } from "../TimelineTooltip/TimelineTooltip";
import type { TooltipState } from "../useTimelineInteractions/useTimelineInteractions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UseTimelineTooltipReturn {
  tooltip: TooltipState;
  setTooltip: React.Dispatch<React.SetStateAction<TooltipState>>;
  tooltipStyle: React.CSSProperties;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages tooltip state for the session profit timeline:
 *
 * - Maintains `TooltipState` (visible, x, y, point)
 * - Computes viewport-relative portal positioning style via
 *   `computePortalTooltipStyle`
 *
 * @param containerElRef — ref to the chart container element, used to
 *   convert canvas-local coordinates to viewport-relative positioning.
 */
export function useTimelineTooltip(
  containerElRef: RefObject<HTMLDivElement | null>,
): UseTimelineTooltipReturn {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    point: null,
  });

  const containerRect =
    tooltip.visible && containerElRef.current
      ? containerElRef.current.getBoundingClientRect()
      : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally decomposed into primitives to avoid unstable object references
  const tooltipStyle = useMemo(
    () => computePortalTooltipStyle(tooltip, containerRect),
    [
      tooltip.visible,
      tooltip.x,
      tooltip.y,
      tooltip.point,
      containerRect?.left,
      containerRect?.top,
      containerRect?.width,
      containerRect?.height,
    ],
  );

  return { tooltip, setTooltip, tooltipStyle };
}
