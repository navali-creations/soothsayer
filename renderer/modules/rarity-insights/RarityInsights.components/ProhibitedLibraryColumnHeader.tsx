import { memo, useCallback } from "react";

import type { KnownRarity } from "~/types/data-stores";

import RarityChips from "./RarityChips/RarityChips";

interface ProhibitedLibraryColumnHeaderProps {
  /** The currently selected rarity for priority sorting, or null if default */
  activeRarity: KnownRarity | null;
  /** Called when a rarity badge is clicked */
  onRarityClick: (rarity: KnownRarity) => void;
}

/**
 * Custom header for the Prohibited Library column that shows clickable rarity badges.
 *
 * Clicking a badge sorts the table to prioritize that rarity level (cards
 * matching the selected rarity appear first). Clicking the same badge again
 * clears the selection and returns to default sorting.
 *
 * Uses `KnownRarity` (1–4) throughout — no R0 badge, since PL data never
 * produces an unknown rarity (absent cards simply have no PL column entry,
 * shown as `—`).
 *
 * The click handler calls `e.stopPropagation()` to prevent TanStack table's
 * default sort-toggle behavior on the `<th>`.
 */
const ProhibitedLibraryColumnHeader = memo(
  ({ activeRarity, onRarityClick }: ProhibitedLibraryColumnHeaderProps) => {
    const handleBadgeClick = useCallback(
      (_event: React.MouseEvent<HTMLButtonElement>, rarity: KnownRarity) => {
        onRarityClick(rarity);
      },
      [onRarityClick],
    );

    return (
      <div
        className="flex flex-col items-center gap-1"
        data-onboarding="rarity-insights-prohibited-library"
      >
        <span className="text-xs font-semibold">Prohibited Library</span>
        <RarityChips
          activeRarity={activeRarity}
          onRarityClick={handleBadgeClick}
        />
      </div>
    );
  },
);

ProhibitedLibraryColumnHeader.displayName = "ProhibitedLibraryColumnHeader";

export default ProhibitedLibraryColumnHeader;
