import { memo, useCallback, useRef, useState } from "react";
import { FiEdit2 } from "react-icons/fi";

import { getRarityStyles, RARITY_LABELS } from "~/renderer/utils";
import type { Rarity } from "~/types/data-stores";

interface RarityBadgeDropdownProps {
  rarity: Rarity;
  onRarityChange: (newRarity: Rarity) => void;
  disabled?: boolean;
  /** Whether to show an outline style (e.g. when it differs from another column) */
  outline?: boolean;
}

/**
 * An inline-editable rarity badge that shows a dropdown on click,
 * allowing the user to change the rarity of a divination card.
 *
 * Shows an edit icon on row hover (via CSS group) at 50% opacity,
 * which becomes fully opaque when the specific cell is hovered.
 * The icon always occupies layout space (opacity-based visibility)
 * to prevent layout shifts.
 */
const RarityBadgeDropdown = memo(
  ({
    rarity,
    onRarityChange,
    disabled = false,
    outline = false,
  }: RarityBadgeDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleToggle = useCallback(() => {
      if (disabled) return;
      setIsOpen((prev) => !prev);
    }, [disabled]);

    const handleSelect = useCallback(
      (newRarity: Rarity) => {
        if (newRarity !== rarity) {
          onRarityChange(newRarity);
        }
        setIsOpen(false);
      },
      [rarity, onRarityChange],
    );

    const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
      // Close dropdown if focus moves outside the component
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsOpen(false);
      }
    }, []);

    const styles = getRarityStyles(rarity);
    const label = RARITY_LABELS[rarity] ?? `R${rarity}`;

    const badgeStyle: React.CSSProperties = {
      backgroundColor: styles.badgeBg,
      color: styles.badgeText,
      borderColor: outline ? styles.badgeBorder : "transparent",
      borderWidth: "1px",
      borderStyle: "solid",
    };

    return (
      <div
        ref={dropdownRef}
        className="relative inline-flex items-center gap-1.5 group/cell"
        onBlur={handleBlur}
      >
        <div
          className={`tooltip tooltip-bottom ${
            disabled ? "tooltip-error" : "tooltip-primary"
          }`}
          data-tip={disabled ? "Cannot edit rarity" : "Click to change rarity"}
        >
          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            className={`badge badge-sm whitespace-nowrap transition-colors ${
              disabled
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:brightness-125 active:scale-95"
            }`}
            style={badgeStyle}
          >
            {label}
          </button>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={handleToggle}
            className="inline-flex opacity-0 group-hover:opacity-50 group-hover/cell:opacity-100 transition-opacity text-base-content/70 hover:text-base-content cursor-pointer"
            title="Edit rarity"
          >
            <FiEdit2 className="w-3 h-3" />
          </button>
        )}

        {isOpen && (
          <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-base-200 border border-base-300 rounded-lg shadow-lg py-1 min-w-35">
            {([0, 1, 2, 3, 4] as Rarity[]).map((r) => {
              const isSelected = r === rarity;
              const itemStyles = getRarityStyles(r);
              const itemLabel = RARITY_LABELS[r] ?? `R${r}`;

              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-base-300 transition-colors ${
                    isSelected ? "bg-base-300/50" : ""
                  }`}
                >
                  <span
                    className="badge badge-xs whitespace-nowrap"
                    style={{
                      backgroundColor: itemStyles.badgeBg,
                      color: itemStyles.badgeText,
                      borderColor: itemStyles.badgeBorder,
                      borderWidth: "1px",
                      borderStyle: "solid",
                    }}
                  >
                    {itemLabel}
                  </span>
                  {isSelected && (
                    <span className="ml-auto text-primary text-[10px]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.rarity === next.rarity &&
    prev.outline === next.outline &&
    prev.disabled === next.disabled,
);

RarityBadgeDropdown.displayName = "RarityBadgeDropdown";

export default RarityBadgeDropdown;
