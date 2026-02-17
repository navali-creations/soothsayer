import { memo, useCallback } from "react";

import { getRarityStyles } from "~/renderer/utils";
import type { Rarity } from "~/types/data-stores";

const RARITY_LEVELS: Rarity[] = [1, 2, 3, 4];

const SHORT_LABELS: Record<Rarity, string> = {
  0: "?",
  1: "R1",
  2: "R2",
  3: "R3",
  4: "R4",
};

interface PoeNinjaColumnHeaderProps {
  /** The currently selected rarity for priority sorting, or null if default */
  activeRarity: Rarity | null;
  /** Called when a rarity badge is clicked */
  onRarityClick: (rarity: Rarity) => void;
}

/**
 * Custom header for the poe.ninja column that shows clickable rarity badges.
 *
 * Clicking a badge sorts the table to prioritize that rarity level (cards
 * matching the selected rarity appear first). Clicking the same badge again
 * clears the selection and returns to default sorting.
 *
 * The click handler calls `e.stopPropagation()` to prevent TanStack table's
 * default sort-toggle behavior on the `<th>`.
 */
const PoeNinjaColumnHeader = memo(
  ({ activeRarity, onRarityClick }: PoeNinjaColumnHeaderProps) => {
    const handleBadgeClick = useCallback(
      (e: React.MouseEvent, rarity: Rarity) => {
        e.stopPropagation();
        onRarityClick(rarity);
      },
      [onRarityClick],
    );

    return (
      <div
        className="flex flex-col items-center gap-1"
        data-onboarding="rarity-model-poe-ninja"
      >
        <span className="text-xs font-semibold">poe.ninja</span>
        <div className="flex items-center gap-0.5">
          {RARITY_LEVELS.map((rarity) => {
            const styles = getRarityStyles(rarity);
            const isActive = activeRarity === rarity;

            return (
              <button
                key={rarity}
                type="button"
                className="badge badge-xs cursor-pointer transition-opacity"
                style={{
                  backgroundColor: styles.badgeBg,
                  color: styles.badgeText,
                  borderColor: styles.badgeBorder,
                  borderWidth: "1px",
                  borderStyle: "solid",
                  opacity: isActive ? 1 : 0.5,
                }}
                onClick={(e) => handleBadgeClick(e, rarity)}
                title={`Sort by ${SHORT_LABELS[rarity]}`}
              >
                {SHORT_LABELS[rarity]}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

PoeNinjaColumnHeader.displayName = "PoeNinjaColumnHeader";

export default PoeNinjaColumnHeader;
