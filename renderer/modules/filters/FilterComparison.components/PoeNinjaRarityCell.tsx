import { memo } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import { getRarityStyles, RARITY_LABELS } from "~/renderer/utils";
import type { Rarity } from "~/types/data-stores";

interface PoeNinjaRarityCellProps {
  rarity: Rarity;
  cardName: string;
}

/**
 * Memoized cell renderer for the poe.ninja rarity column.
 *
 * Each cell renders a styled rarity badge plus a warning icon for
 * low-confidence data. Extracting this into a React.memo component
 * (with a custom comparator) prevents style computations, SVG icons,
 * and DOM elements from being re-created every time the columns memo
 * rebuilds (e.g. when toggling a filter in the sidebar).
 *
 * TODO: Make the badge a clickable link to an internal card detail page
 * once that route exists.
 */
const PoeNinjaRarityCell = memo(
  ({ rarity }: PoeNinjaRarityCellProps) => {
    const styles = getRarityStyles(rarity);
    const label = RARITY_LABELS[rarity] ?? `R${rarity}`;

    return (
      <span className="inline-flex items-center gap-1">
        {rarity === 0 && (
          <div
            className="tooltip tooltip-bottom tooltip-warning"
            data-tip="Low confidence or no pricing data from poe.ninja"
          >
            <FiAlertTriangle className="w-3.5 h-3.5 text-warning" />
          </div>
        )}
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
      </span>
    );
  },
  (prev, next) =>
    prev.rarity === next.rarity && prev.cardName === next.cardName,
);

PoeNinjaRarityCell.displayName = "PoeNinjaRarityCell";

export default PoeNinjaRarityCell;
