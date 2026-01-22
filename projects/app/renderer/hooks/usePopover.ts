import { useEffect, useRef, useCallback } from "react";

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
}

/**
 * Hook to manage Popover API for hover or click interactions
 */
export function usePopover(options: UsePopoverOptions = {}) {
  const { showDelay = 0, hideDelay = 0, trigger = "hover" } = options;

  const triggerRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);

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
    }, showDelay);
  }, [showDelay, clearTimeouts]);

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
