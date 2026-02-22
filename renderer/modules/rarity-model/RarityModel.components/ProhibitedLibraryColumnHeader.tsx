import { memo, useCallback } from "react";

import { getRarityStyles } from "~/renderer/utils";
import type { KnownRarity } from "~/types/data-stores";

const KNOWN_RARITY_LEVELS: KnownRarity[] = [1, 2, 3, 4];

const SHORT_LABELS: Record<KnownRarity, string> = {
  1: "R1",
  2: "R2",
  3: "R3",
  4: "R4",
};

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
      (e: React.MouseEvent, rarity: KnownRarity) => {
        e.stopPropagation();
        onRarityClick(rarity);
      },
      [onRarityClick],
    );

    return (
      <div
        className="flex flex-col items-center gap-1"
        data-onboarding="rarity-model-prohibited-library"
      >
        <span className="text-xs font-semibold">Prohibited Library</span>
        <div className="flex items-center gap-0.5">
          {KNOWN_RARITY_LEVELS.map((rarity) => {
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

ProhibitedLibraryColumnHeader.displayName = "ProhibitedLibraryColumnHeader";

export default ProhibitedLibraryColumnHeader;
