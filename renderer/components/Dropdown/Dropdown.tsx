import clsx from "clsx";
import { type ReactNode, useId } from "react";

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
}

const Dropdown = ({
  trigger,
  children,
  position = "dropdown-end",
  className,
  contentClassName,
  width = "w-52",
}: DropdownProps) => {
  const id = useId();
  const popoverId = `dropdown-${id}`;
  const anchorName = `--anchor-${id.replace(/:/g, "")}`;

  const positionClasses = Array.isArray(position)
    ? position.join(" ")
    : position;

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
          "menu",
          width,
          "rounded-box",
          "bg-base-200",
          "shadow-lg",
          "border border-base-300",
          "p-2",
          contentClassName,
        )}
        popover="auto"
        id={popoverId}
        style={{ positionAnchor: anchorName } as React.CSSProperties}
      >
        {children}
      </div>
    </>
  );
};

export default Dropdown;
