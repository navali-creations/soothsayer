import { memo } from "react";
import { GiCrownedSkull } from "react-icons/gi";

import { getRarityStyles, RARITY_LABELS } from "~/renderer/utils";
import type { KnownRarity } from "~/types/data-stores";

interface ProhibitedLibraryRarityCellProps {
  rarity: KnownRarity | null;
  fromBoss: boolean;
  showBossIndicator: boolean;
}

/**
 * Memoized cell renderer for the Prohibited Library rarity column.
 *
 * Renders a read-only rarity badge (no dropdown — PL rarities are not
 * user-editable). When `rarity` is `null` the card is absent from the
 * PL dataset and we show a `—` dash with a tooltip.
 *
 * When `fromBoss` is true and `showBossIndicator` is enabled, a small
 * skull-crown icon is overlaid to indicate the card is boss-exclusive
 * in the stacked-deck context.
 */
const ProhibitedLibraryRarityCell = memo(
  ({
    rarity,
    fromBoss,
    showBossIndicator,
  }: ProhibitedLibraryRarityCellProps) => {
    if (rarity == null) {
      return (
        <div
          className="tooltip tooltip-bottom"
          data-tip="Card not in Prohibited Library dataset"
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
        {fromBoss && showBossIndicator && (
          <div
            className="tooltip tooltip-bottom"
            data-tip="This card drops from specific boss encounters in stacked decks"
          >
            <GiCrownedSkull className="w-3.5 h-3.5 text-warning/70" />
          </div>
        )}
      </span>
    );
  },
  (prev, next) =>
    prev.rarity === next.rarity &&
    prev.fromBoss === next.fromBoss &&
    prev.showBossIndicator === next.showBossIndicator,
);

ProhibitedLibraryRarityCell.displayName = "ProhibitedLibraryRarityCell";

export default ProhibitedLibraryRarityCell;
