import clsx from "clsx";
import {
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useId,
} from "react";

type DropdownPosition =
  | "dropdown-start"
  | "dropdown-end"
  | "dropdown-center"
  | "dropdown-top"
  | "dropdown-bottom"
  | "dropdown-left"
  | "dropdown-right";

interface DropdownProps {
  ariaLabel?: string;
  trigger: ReactNode;
  children: ReactNode;
  position?: DropdownPosition | DropdownPosition[];
  className?: string;
  contentClassName?: string;
  /** Width class for the dropdown content (e.g. "w-52", "w-64") */
  width?: string;
  /** Padding class for the dropdown content (e.g. "p-2", "p-1", "p-0") */
  padding?: string;
  /** Close the popover after any click inside the dropdown content. */
  closeOnSelect?: boolean;
  /** Called when the popover opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

const Dropdown = ({
  ariaLabel,
  trigger,
  children,
  position = "dropdown-end",
  className,
  contentClassName,
  width = "w-52",
  padding = "p-2",
  closeOnSelect = false,
  onOpenChange,
}: DropdownProps) => {
  const id = useId();
  const popoverId = `dropdown-${id}`;
  const anchorName = `--anchor-${id.replace(/:/g, "")}`;

  const positionClasses = Array.isArray(position)
    ? position.join(" ")
    : position;

  const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnSelect) {
      event.currentTarget.hidePopover();
    }
  };

  const handleToggle = (event: SyntheticEvent<HTMLDivElement>) => {
    const toggleEvent = event.nativeEvent as ToggleEvent;
    onOpenChange?.(toggleEvent.newState === "open");
  };

  return (
    <>
      <button
        aria-label={ariaLabel}
        className={clsx("no-drag", className)}
        popoverTarget={popoverId}
        style={{ anchorName } as React.CSSProperties}
        type="button"
      >
        {trigger}
      </button>

      <div
        className={clsx(
          "dropdown",
          positionClasses,
          "no-drag",
          "menu",
          width,
          "rounded-box",
          "bg-base-200",
          "shadow-lg",
          "border border-base-300",
          padding,
          contentClassName,
        )}
        popover="auto"
        id={popoverId}
        onClick={handleContentClick}
        onToggle={handleToggle}
        style={{ positionAnchor: anchorName } as React.CSSProperties}
      >
        {children}
      </div>
    </>
  );
};

export default Dropdown;
