import { useId, useMemo } from "react";

import type { RelatedCardDTO } from "~/main/modules/card-details/CardDetails.dto";
import DivinationCard from "~/renderer/components/DivinationCard/DivinationCard";
import Link from "~/renderer/components/Link/Link";
import { useCardImage } from "~/renderer/hooks/useCardImage";
import { usePopover } from "~/renderer/hooks/usePopover/usePopover";
import {
  cardNameToSlug,
  getRarityStyles,
  RARITY_LABELS,
} from "~/renderer/utils";

import { getDisplayRarity, toCardEntry } from "./helpers";

// ─── Card Chip Component with Image ────────────────────────────────────────

function RelatedCardChip({ card }: { card: RelatedCardDTO }) {
  const displayRarity = getDisplayRarity(card);
  const styles = getRarityStyles(displayRarity);
  const rarityLabel = RARITY_LABELS[displayRarity] ?? "Unknown";
  const popoverId = useId();

  const { triggerRef, popoverRef } = usePopover({
    placement: "right",
    offset: 12,
    scale: 0.65,
  });

  const cardEntry = useMemo(() => toCardEntry(card), [card]);
  const imageSrc = useCardImage(card.artSrc);

  // Build a 10% opacity rarity background for hover
  const hoverBg = `rgba(${styles.glowRgb}, 0.10)`;

  return (
    <>
      <Link
        to="/cards/$cardSlug"
        params={{ cardSlug: cardNameToSlug(card.name) }}
        ref={triggerRef as React.RefObject<HTMLAnchorElement>}
        className="group flex items-center gap-2.5 bg-base-300 rounded-lg px-2.5 py-2 min-w-0 cursor-pointer transition-all duration-200 border border-transparent no-underline"
        onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.currentTarget.style.backgroundColor = hoverBg;
          e.currentTarget.style.borderColor = styles.badgeBorder;
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.currentTarget.style.backgroundColor = "";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        {/* Card art thumbnail */}
        {imageSrc && (
          <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-base-100 flex items-center justify-center">
            <img
              src={imageSrc}
              alt={card.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex flex-col gap-0.5">
          {/* Card name — dotted underline */}
          <span className="font-fontin text-sm transition-colors truncate leading-tight underline decoration-dotted decoration-base-content/30 underline-offset-2">
            {card.name}
          </span>

          {/* Rarity badge + boss indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className="badge badge-xs whitespace-nowrap"
              style={{
                backgroundColor: styles.badgeBg,
                color: styles.badgeText,
                borderColor: styles.badgeBorder,
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            >
              {rarityLabel}
            </span>
            {card.fromBoss && (
              <span className="badge badge-xs badge-warning whitespace-nowrap">
                Boss
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* DivinationCard hover preview popover */}
      <div
        id={popoverId}
        ref={popoverRef}
        popover="manual"
        className="p-0 border-0 bg-transparent"
      >
        <DivinationCard card={cardEntry} />
      </div>
    </>
  );
}

export default RelatedCardChip;
