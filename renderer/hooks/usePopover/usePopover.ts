import { useCallback, useEffect, useRef } from "react";

type PopoverPlacement = "top" | "bottom" | "left" | "right";

interface UsePopoverOptions {
  /**
   * Delay before showing the popover (in ms)
   * @default 0
   */
  showDelay?: number;

  /**
   * Delay before hiding the popover (in ms)
   * @default 0
   */
  hideDelay?: number;

  /**
   * Trigger mode for the popover
   * @default "hover"
   */
  trigger?: "hover" | "click";

  /**
   * Preferred placement of the popover relative to the trigger
   * @default "right"
   */
  placement?: PopoverPlacement;

  /**
   * Offset from the trigger element (in px)
   * @default 8
   */
  offset?: number;

  /**
   * Scale of the popover content (for CSS transform scale)
   * Used to adjust positioning calculations
   * @default 1
   */
  scale?: number;
}

/**
 * Hook to manage Popover API for hover or click interactions
 */
export function usePopover(options: UsePopoverOptions = {}) {
  const {
    showDelay = 0,
    hideDelay = 0,
    trigger = "hover",
    placement = "right",
    offset = 8,
    scale = 1,
  } = options;

  const triggerRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);

  const positionPopover = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const triggerRect = trigger.getBoundingClientRect();

    // Apply scale and get the appropriate transform-origin based on placement
    if (scale !== 1) {
      popover.style.transform = `scale(${scale})`;
      // Set transform-origin so scaling happens away from the trigger
      switch (placement) {
        case "top":
          popover.style.transformOrigin = "bottom center";
          break;
        case "bottom":
          popover.style.transformOrigin = "top center";
          break;
        case "left":
          popover.style.transformOrigin = "center right";
          break;
        default:
          popover.style.transformOrigin = "center left";
          break;
      }
    }

    // Get dimensions after applying scale transform
    const popoverRect = popover.getBoundingClientRect();

    // Calculate the unscaled dimensions for proper positioning
    const unscaledWidth = popoverRect.width / scale;
    const unscaledHeight = popoverRect.height / scale;

    let top: number;
    let left: number;

    switch (placement) {
      case "top":
        top = triggerRect.top - unscaledHeight - offset;
        left = triggerRect.left + (triggerRect.width - unscaledWidth) / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + offset;
        left = triggerRect.left + (triggerRect.width - unscaledWidth) / 2;
        break;
      case "left":
        top = triggerRect.top + (triggerRect.height - unscaledHeight) / 2;
        left = triggerRect.left - unscaledWidth - offset;
        break;
      default:
        top = triggerRect.top + (triggerRect.height - unscaledHeight) / 2;
        left = triggerRect.right + offset;
        break;
    }

    // Keep within viewport bounds
    const padding = 8;
    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - unscaledHeight - padding),
    );
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - unscaledWidth - padding),
    );

    popover.style.position = "fixed";
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.margin = "0";
  }, [placement, offset, scale]);

  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const showPopover = useCallback(() => {
    clearTimeouts();
    showTimeoutRef.current = window.setTimeout(() => {
      popoverRef.current?.showPopover();
      isOpenRef.current = true;
      // Position after showing so we can measure the popover
      requestAnimationFrame(positionPopover);
    }, showDelay);
  }, [showDelay, clearTimeouts, positionPopover]);

  const hidePopover = useCallback(() => {
    clearTimeouts();
    hideTimeoutRef.current = window.setTimeout(() => {
      popoverRef.current?.hidePopover();
      isOpenRef.current = false;
    }, hideDelay);
  }, [hideDelay, clearTimeouts]);

  const togglePopover = useCallback(() => {
    if (isOpenRef.current) {
      hidePopover();
    } else {
      showPopover();
    }
  }, [showPopover, hidePopover]);

  const handleTriggerEnter = useCallback(() => {
    showPopover();
  }, [showPopover]);

  const handleTriggerLeave = useCallback(() => {
    hidePopover();
  }, [hidePopover]);

  const handleTriggerClick = useCallback(() => {
    togglePopover();
  }, [togglePopover]);

  const handlePopoverEnter = useCallback(() => {
    clearTimeouts();
  }, [clearTimeouts]);

  const handlePopoverLeave = useCallback(() => {
    hidePopover();
  }, [hidePopover]);

  useEffect(() => {
    const triggerElement = triggerRef.current;
    const popover = popoverRef.current;

    if (!triggerElement || !popover) return;

    if (trigger === "hover") {
      // Add hover event listeners to trigger
      triggerElement.addEventListener("mouseenter", handleTriggerEnter);
      triggerElement.addEventListener("mouseleave", handleTriggerLeave);

      // Add event listeners to popover (to keep it open when hovering over it)
      popover.addEventListener("mouseenter", handlePopoverEnter);
      popover.addEventListener("mouseleave", handlePopoverLeave);

      return () => {
        clearTimeouts();
        triggerElement.removeEventListener("mouseenter", handleTriggerEnter);
        triggerElement.removeEventListener("mouseleave", handleTriggerLeave);
        popover.removeEventListener("mouseenter", handlePopoverEnter);
        popover.removeEventListener("mouseleave", handlePopoverLeave);
      };
    } else {
      // Add click event listener to trigger
      triggerElement.addEventListener("click", handleTriggerClick);

      return () => {
        clearTimeouts();
        triggerElement.removeEventListener("click", handleTriggerClick);
      };
    }
  }, [
    handleTriggerEnter,
    handleTriggerLeave,
    handleTriggerClick,
    handlePopoverEnter,
    handlePopoverLeave,
    clearTimeouts,
    trigger,
  ]);

  return {
    triggerRef,
    popoverRef,
  };
}
