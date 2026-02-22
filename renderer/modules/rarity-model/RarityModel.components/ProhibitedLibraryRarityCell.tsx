import { memo } from "react";
import { GiCrownedSkull } from "react-icons/gi";

import { getRarityStyles, RARITY_LABELS } from "~/renderer/utils";
import type { Rarity } from "~/types/data-stores";

interface ProhibitedLibraryRarityCellProps {
  rarity: Rarity | null;
  fromBoss: boolean;
}

/**
 * Memoized cell renderer for the Prohibited Library rarity column.
 *
 * Renders a read-only rarity badge (no dropdown — PL rarities are not
 * user-editable). Handles three cases:
 *
 *   - `rarity` is `null` — card is absent from the PL dataset entirely.
 *   - `rarity` is `0` — card has no drop data yet (weight 0).
 *     Rendered as an "Unknown" badge.
 *   - `rarity` is `1–4` — card has a computed rarity from weight data.
 *
 * When `fromBoss` is true, a small skull-crown icon is always shown
 * alongside the rarity badge to indicate the card is boss-exclusive
 * in the stacked-deck context.
 */
const ProhibitedLibraryRarityCell = memo(
  ({ rarity, fromBoss }: ProhibitedLibraryRarityCellProps) => {
    // Card is absent from the PL dataset entirely (LEFT JOIN miss)
    if (rarity == null) {
      return (
        <div
          className="tooltip tooltip-bottom"
          data-tip="Card not found in Prohibited Library dataset"
        >
          <span className="text-base-content/30">—</span>
        </div>
      );
    }

    const styles = getRarityStyles(rarity);
    const label = RARITY_LABELS[rarity] ?? `R${rarity}`;

    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="badge badge-sm whitespace-nowrap"
          style={{
            backgroundColor: styles.badgeBg,
            color: styles.badgeText,
            borderColor: styles.badgeBorder,
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          {label}
        </span>
        {fromBoss && (
          <div
            className="tooltip tooltip-bottom"
            data-tip="Boss-exclusive drop — this card does not drop from Stacked Decks"
          >
            <GiCrownedSkull className="w-3.5 h-3.5 text-warning/70" />
          </div>
        )}
      </span>
    );
  },
  (prev, next) =>
    prev.rarity === next.rarity && prev.fromBoss === next.fromBoss,
);

ProhibitedLibraryRarityCell.displayName = "ProhibitedLibraryRarityCell";

export default ProhibitedLibraryRarityCell;
