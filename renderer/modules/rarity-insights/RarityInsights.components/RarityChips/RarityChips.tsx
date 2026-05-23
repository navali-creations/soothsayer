import { memo, useCallback } from "react";

import { type FilterTheme, getRarityStyles } from "~/renderer/utils";
import type { KnownRarity, Rarity } from "~/types/data-stores";

const KNOWN_RARITIES: KnownRarity[] = [1, 2, 3, 4];

const SHORT_LABELS: Record<KnownRarity, string> = {
  1: "R1",
  2: "R2",
  3: "R3",
  4: "R4",
};

interface RarityChipsProps {
  activeRarity: Rarity | null;
  onRarityClick?: (
    event: React.MouseEvent<HTMLButtonElement>,
    rarity: KnownRarity,
  ) => void;
  disabled?: boolean;
  filterTheme?: FilterTheme | null;
}

const RarityChips = memo(
  ({
    activeRarity,
    onRarityClick,
    disabled = false,
    filterTheme = null,
  }: RarityChipsProps) => {
    const handleRarityClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        const rarity = Number(event.currentTarget.dataset.rarity);
        if (!isKnownRarity(rarity)) {
          return;
        }

        event.stopPropagation();
        onRarityClick?.(event, rarity);
      },
      [onRarityClick],
    );

    return (
      <div className="flex items-center gap-0.5">
        {KNOWN_RARITIES.map((rarity) => {
          const styles = getRarityStyles(rarity, undefined, filterTheme);
          const isActive = activeRarity === rarity;

          return (
            <button
              key={rarity}
              type="button"
              className="badge badge-xs transition-opacity"
              style={{
                backgroundColor: styles.badgeBg,
                color: styles.badgeText,
                borderColor: styles.badgeBorder,
                borderWidth: "1px",
                borderStyle: "solid",
                opacity: isActive ? 1 : 0.5,
                filter: disabled ? "sepia(1)" : undefined,
                cursor: disabled ? "default" : "pointer",
              }}
              data-rarity={rarity}
              disabled={disabled}
              onClick={disabled ? undefined : handleRarityClick}
              title={disabled ? undefined : `Sort by ${SHORT_LABELS[rarity]}`}
            >
              {SHORT_LABELS[rarity]}
            </button>
          );
        })}
      </div>
    );
  },
);

RarityChips.displayName = "RarityChips";

function isKnownRarity(rarity: number): rarity is KnownRarity {
  return rarity === 1 || rarity === 2 || rarity === 3 || rarity === 4;
}

export default RarityChips;
