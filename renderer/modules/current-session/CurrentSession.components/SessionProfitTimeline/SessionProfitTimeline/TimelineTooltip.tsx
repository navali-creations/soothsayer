import type React from "react";
import { memo, useMemo } from "react";

import DivinationCard from "~/renderer/components/DivinationCard";
import { useBoundStore } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";
import type { CardEntry } from "~/types/data-stores";

import { BAR_COLOR } from "../canvas-utils/canvas-utils";
import type { ProfitChartPoint } from "../types/types";
import type { TooltipState } from "../useTimelineInteractions/useTimelineInteractions";

// ─── Tooltip constants ──────────────────────────────────────────────────────

export const TOOLTIP_OFFSET_X = 12;
const TOOLTIP_CARD_SCALE = 0.625;
const TOOLTIP_CARD_WIDTH = 320 * TOOLTIP_CARD_SCALE; // 200px
export const TOOLTIP_CARD_HEIGHT = 476 * TOOLTIP_CARD_SCALE; // ~298px
export const TOOLTIP_CARD_STATS_GAP = 6;
export const TOOLTIP_STATS_HEIGHT = 76;
export const TOOLTIP_WIDTH = TOOLTIP_CARD_WIDTH;
export const TOOLTIP_MARGIN = 8;
export const TOOLTIP_VERTICAL_NUDGE = 100;

// ─── Tooltip position helper (viewport-relative for portal) ─────────────────

export function computePortalTooltipStyle(
  tooltip: TooltipState,
  containerRect: DOMRect | null,
): React.CSSProperties {
  if (!tooltip.visible || !tooltip.point || !containerRect) {
    return { display: "none" };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const cursorViewportX = containerRect.left + tooltip.x;

  let left = cursorViewportX + TOOLTIP_OFFSET_X;
  if (left + TOOLTIP_WIDTH > viewportWidth - TOOLTIP_MARGIN) {
    left = cursorViewportX - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X;
  }
  if (left < TOOLTIP_MARGIN) left = TOOLTIP_MARGIN;

  const totalHeight =
    TOOLTIP_CARD_HEIGHT + TOOLTIP_CARD_STATS_GAP + TOOLTIP_STATS_HEIGHT;
  let top = containerRect.top - TOOLTIP_VERTICAL_NUDGE;

  if (top + totalHeight > viewportHeight - TOOLTIP_MARGIN) {
    top = viewportHeight - totalHeight - TOOLTIP_MARGIN;
  }
  if (top < TOOLTIP_MARGIN) top = TOOLTIP_MARGIN;

  return {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    pointerEvents: "none",
    zIndex: 9999,
  };
}

// ─── Inline card for tooltip ────────────────────────────────────────────────

export const TooltipInlineCard = memo(({ cardName }: { cardName: string }) => {
  const {
    currentSession: { getSession: getCurrentSession },
    sessionDetails: { getSession: getDetailsSession },
  } = useBoundStore();

  const cardEntry: CardEntry | null = useMemo(() => {
    const currentCards = getCurrentSession()?.cards;
    const detailsCards = getDetailsSession()?.cards;

    const match =
      currentCards?.find((c) => c.name === cardName) ??
      detailsCards?.find((c) => c.name === cardName) ??
      null;

    return match;
  }, [getCurrentSession, getDetailsSession, cardName]);

  if (!cardEntry?.divinationCard) return null;

  return (
    <div
      style={{
        width: `${TOOLTIP_CARD_WIDTH}px`,
        height: `${TOOLTIP_CARD_HEIGHT}px`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          transform: `scale(${TOOLTIP_CARD_SCALE})`,
          transformOrigin: "top left",
          width: "320px",
          height: "476px",
        }}
      >
        <DivinationCard card={cardEntry} />
      </div>
    </div>
  );
});

// ─── Tooltip content ────────────────────────────────────────────────────────

interface TimelineTooltipContentProps {
  tooltipStyle: React.CSSProperties;
  point: ProfitChartPoint;
  chaosToDivineRatio: number;
}

export const TimelineTooltipContent = memo(
  ({
    tooltipStyle,
    point: tp,
    chaosToDivineRatio,
  }: TimelineTooltipContentProps) => {
    return (
      <div style={tooltipStyle}>
        {/* Divination card — detached, no background */}
        <TooltipInlineCard cardName={tp.cardName!} />

        {/* Stats panel — separate card below */}
        <div
          className="bg-base-300/90 backdrop-blur-sm border border-base-content/10 rounded-lg px-3 py-2.5 shadow-xl"
          style={{
            width: `${TOOLTIP_WIDTH}px`,
            marginTop: `${TOOLTIP_CARD_STATS_GAP}px`,
          }}
        >
          {/* Two-column: card value | net profit */}
          <div className="flex items-start justify-between">
            {/* Card value */}
            <div>
              <div
                className="text-sm font-bold tabular-nums leading-tight"
                style={{ color: BAR_COLOR }}
              >
                {formatCurrency(tp.barValue ?? 0, chaosToDivineRatio)}
              </div>
              <div className="text-[9px] text-base-content/40 mt-0.5 uppercase tracking-widest">
                Card Value
              </div>
            </div>

            {/* Net profit */}
            <div className="text-right">
              <div
                className={`text-sm font-bold tabular-nums leading-tight ${
                  tp.profit >= 0 ? "text-success" : "text-error"
                }`}
              >
                {tp.profit >= 0 ? "+" : ""}
                {formatCurrency(tp.profit, chaosToDivineRatio)}
              </div>
              <div className="text-[9px] text-base-content/40 mt-0.5 uppercase tracking-widest">
                Net Profit
              </div>
            </div>
          </div>

          {/* Card number — bottom right */}
          <div className="flex items-center justify-end gap-1.5 mt-2">
            <span className="text-[9px] text-base-content/30 uppercase tracking-widest mt-px">
              Card
            </span>
            <span className="text-[9px] font-semibold tabular-nums text-base-content/60 bg-base-content/5 border border-base-content/10 rounded px-1.5 py-0.5 leading-none">
              #{tp.x.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  },
);
