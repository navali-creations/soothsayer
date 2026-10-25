import clsx from "clsx";
import { type MouseEvent, type ReactNode, useId } from "react";

type DropdownPosition =
  | "dropdown-start"
  | "dropdown-end"
  | "dropdown-center"
  | "dropdown-top"
  | "dropdown-bottom"
  | "dropdown-left"
  | "dropdown-right";

interface DropdownProps {
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
}

const Dropdown = ({
  trigger,
  children,
  position = "dropdown-end",
  className,
  contentClassName,
  width = "w-52",
  padding = "p-2",
  closeOnSelect = false,
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

  return (
    <>
      <button
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
        style={{ positionAnchor: anchorName } as React.CSSProperties}
      >
        {children}
      </div>
    </>
  );
};

export default Dropdown;
