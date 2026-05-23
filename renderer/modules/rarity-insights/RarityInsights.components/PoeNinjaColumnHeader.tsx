import { memo, useCallback } from "react";

import type { KnownRarity, Rarity } from "~/types/data-stores";

import RarityChips from "./RarityChips/RarityChips";

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
      (_event: React.MouseEvent<HTMLButtonElement>, rarity: KnownRarity) => {
        onRarityClick(rarity);
      },
      [onRarityClick],
    );

    return (
      <div
        className="flex flex-col items-center gap-1"
        data-onboarding="rarity-insights-poe-ninja"
      >
        <span className="text-xs font-semibold">poe.ninja</span>
        <RarityChips
          activeRarity={activeRarity}
          onRarityClick={handleBadgeClick}
        />
      </div>
    );
  },
);

PoeNinjaColumnHeader.displayName = "PoeNinjaColumnHeader";

export default PoeNinjaColumnHeader;
