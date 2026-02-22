import { memo } from "react";

import { getRarityStyles, RARITY_LABELS } from "~/renderer/utils";
import type { Rarity } from "~/types/data-stores";

interface ProhibitedLibraryRarityCellProps {
  rarity: Rarity | null;
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
 */
const ProhibitedLibraryRarityCell = memo(
  ({ rarity }: ProhibitedLibraryRarityCellProps) => {
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
    );
  },
  (prev, next) => prev.rarity === next.rarity,
);

ProhibitedLibraryRarityCell.displayName = "ProhibitedLibraryRarityCell";

export default ProhibitedLibraryRarityCell;
