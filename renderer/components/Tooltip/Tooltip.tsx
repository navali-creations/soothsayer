import clsx from "clsx";
import {
  type CSSProperties,
  cloneElement,
  type FocusEvent,
  type HTMLAttributes,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type TooltipElement = "button" | "div" | "li" | "span";
type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipOwnProps {
  as?: TooltipElement;
  children: ReactNode;
  content: ReactNode;
  describeChild?: boolean;
  disabled?: boolean;
  disableTooltip?: boolean;
  open?: boolean;
  placement?: TooltipPlacement;
  type?: "button" | "reset" | "submit";
}

type TooltipProps = TooltipOwnProps &
  Omit<HTMLAttributes<HTMLElement>, "children" | "content">;

const Tooltip = ({
  as: Component = "span",
  children,
  className,
  content,
  describeChild = false,
  disableTooltip = false,
  onBlur,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  open = false,
  placement = "bottom",
  style,
  ...props
}: TooltipProps) => {
  const id = useId();
  const popoverRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const anchorName = `--tooltip-${id.replace(/:/g, "")}`;
  const isOpen = !disableTooltip && (open || isHovered || isFocused);

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    if (isOpen) {
      popover.showPopover();
    } else {
      popover.hidePopover();
    }
  }, [isOpen]);

  const handleMouseEnter = (event: MouseEvent<HTMLElement>) => {
    if (!disableTooltip) {
      setIsHovered(true);
    }
    onMouseEnter?.(event);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLElement>) => {
    setIsHovered(false);
    onMouseLeave?.(event);
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    if (!disableTooltip) {
      setIsFocused(true);
    }
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  const anchorStyle = { ...style, anchorName } as CSSProperties;
  const tooltipStyle = { positionAnchor: anchorName } as CSSProperties;
  const caretStyle = { positionAnchor: anchorName } as CSSProperties;
  const tooltipId = `tooltip-${id}`;
  const describedBy = disableTooltip ? undefined : tooltipId;
  const describedChildren =
    describeChild && isValidElement<{ "aria-describedby"?: string }>(children)
      ? cloneElement(children, {
          "aria-describedby":
            [children.props["aria-describedby"], describedBy]
              .filter(Boolean)
              .join(" ") || undefined,
        })
      : children;

  return (
    <Component
      {...props}
      aria-describedby={describeChild ? undefined : describedBy}
      className={clsx("app-tooltip-trigger", "no-drag", className)}
      data-tip={
        !disableTooltip && typeof content === "string" ? content : undefined
      }
      onBlur={handleBlur}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={anchorStyle}
    >
      {describedChildren}
      <span
        ref={popoverRef}
        id={tooltipId}
        role="tooltip"
        aria-label={typeof content === "string" ? content : undefined}
        popover="manual"
        className={clsx("app-tooltip", `app-tooltip-${placement}`)}
        data-placement={placement}
        style={tooltipStyle}
      >
        {content}
        <span
          aria-hidden="true"
          className="app-tooltip-caret"
          style={caretStyle}
        />
      </span>
    </Component>
  );
};

export default Tooltip;
