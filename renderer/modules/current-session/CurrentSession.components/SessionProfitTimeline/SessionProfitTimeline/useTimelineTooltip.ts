import { type RefObject, useMemo, useState } from "react";

import type { TooltipState } from "../useTimelineInteractions/useTimelineInteractions";
import { computePortalTooltipStyle } from "./TimelineTooltip";

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

  const tooltipStyle = useMemo(
    () => computePortalTooltipStyle(tooltip, containerRect),
    [tooltip, containerRect],
  );

  return { tooltip, setTooltip, tooltipStyle };
}
