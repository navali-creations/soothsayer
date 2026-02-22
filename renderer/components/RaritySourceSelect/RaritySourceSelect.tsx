import clsx from "clsx";
import { useCallback, useId, useRef } from "react";
import { FiAlertTriangle, FiChevronDown } from "react-icons/fi";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RaritySourceOption {
  value: string;
  /** Clean label shown in the trigger button when this option is selected */
  label: string;
  /** Optional rich label rendered in the dropdown menu. Falls back to `label` if not provided. */
  menuLabel?: React.ReactNode;
  /** When true, renders a warning triangle icon before the label */
  outdated?: boolean;
}

export interface RaritySourceGroup {
  label: string;
  options: RaritySourceOption[];
}

interface RaritySourceSelectProps {
  /** Currently selected value */
  value: string;
  /** Called when the user picks a new option */
  onChange: (value: string) => void;
  /** Grouped options to render in the dropdown menu */
  groups: RaritySourceGroup[];
  /** Disables the trigger button */
  disabled?: boolean;
  /** Extra class names applied to the outermost wrapper */
  className?: string;
  /** Width class for the trigger + dropdown (e.g. "w-48") */
  width?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const RaritySourceSelect = ({
  value,
  onChange,
  groups,
  disabled = false,
  className,
  width = "w-52",
}: RaritySourceSelectProps) => {
  const id = useId();
  const popoverId = `rarity-source-${id}`;
  const anchorName = `--anchor-rarity-source-${id.replace(/:/g, "")}`;
  const popoverRef = useRef<HTMLDivElement>(null);

  // Resolve the currently selected option so we can show its clean label
  const selectedOption = groups
    .flatMap((g) => g.options)
    .find((o) => o.value === value);
  const triggerLabel = selectedOption?.label ?? value;

  const handleSelect = useCallback(
    (optionValue: string) => {
      popoverRef.current?.hidePopover();
      if (optionValue !== value) {
        onChange(optionValue);
      }
    },
    [onChange, value],
  );

  return (
    <div className={clsx("relative inline-flex", className)}>
      {/* ── Trigger ── */}
      <button
        type="button"
        className={clsx(
          "select select-bordered select-sm",
          "flex items-center justify-between gap-1 text-left",
          // Remove the built-in DaisyUI select chevron arrow & its padding — we render our own
          "bg-none! pr-2!",
          width,
          disabled && "select-disabled opacity-50 pointer-events-none",
        )}
        popoverTarget={popoverId}
        style={{ anchorName } as React.CSSProperties}
        disabled={disabled}
      >
        <span className="truncate text-sm">{triggerLabel}</span>
        <FiChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
      </button>

      {/* ── Dropdown menu ── */}
      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        className={clsx(
          "dropdown dropdown-start",
          width,
          "rounded-box bg-base-200 shadow-lg border border-base-300",
          "p-1",
          "max-h-80 overflow-y-auto",
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-thumb]:bg-base-300",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
        )}
        style={{ positionAnchor: anchorName } as React.CSSProperties}
      >
        {groups.map((group, gi) => {
          if (group.options.length === 0) return null;

          return (
            <div key={group.label} className={clsx(gi > 0 && "mt-3")}>
              {/* Group label */}
              <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/40 select-none">
                {group.label}
              </div>

              {/* Options */}
              {group.options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={clsx(
                      "w-full text-left px-2.5 py-1.5 rounded-md text-sm",
                      "transition-colors cursor-pointer",
                      "flex items-center gap-1.5",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-base-300 text-base-content",
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    {/* Fixed-width checkmark column */}
                    <span
                      className={clsx(
                        "w-3.5 shrink-0 text-xs text-primary",
                        !isSelected && "invisible",
                      )}
                    >
                      ✓
                    </span>

                    {/* Outdated warning icon */}
                    {option.outdated && (
                      <FiAlertTriangle
                        className="w-3.5 h-3.5 shrink-0 text-warning"
                        title="Outdated"
                      />
                    )}

                    {/* Label */}
                    <span className="flex-1 truncate">
                      {option.menuLabel ?? option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RaritySourceSelect;
