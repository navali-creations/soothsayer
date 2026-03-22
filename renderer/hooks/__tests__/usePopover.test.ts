import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePopover } from "../usePopover";

/**
 * Simple test component that renders a trigger and popover element,
 * wiring up the refs returned by usePopover.
 */
function TestComponent(props: {
  showDelay?: number;
  hideDelay?: number;
  trigger?: "hover" | "click";
  placement?: "top" | "bottom" | "left" | "right";
  offset?: number;
  scale?: number;
}) {
  const { triggerRef, popoverRef } = usePopover(props);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "button",
      {
        ref: triggerRef as React.RefObject<HTMLButtonElement>,
        "data-testid": "trigger",
      },
      "Trigger",
    ),
    React.createElement(
      "div",
      {
        ref: popoverRef,
        popover: "manual",
        "data-testid": "popover",
      },
      "Content",
    ),
  );
}

/**
 * Helper: renders the TestComponent, grabs the trigger/popover elements,
 * and installs fresh `showPopover` / `hidePopover` mocks directly on
 * those elements so call counts are isolated per test.
 */
function renderWithMocks(props: Parameters<typeof TestComponent>[0] = {}) {
  const result = render(React.createElement(TestComponent, props));
  const trigger = screen.getByTestId("trigger");
  const popover = screen.getByTestId("popover");

  // Install fresh mock functions directly on the element instances so
  // they shadow the shared prototype stubs and each test starts at 0 calls.
  const showSpy = vi.fn();
  const hideSpy = vi.fn();
  popover.showPopover = showSpy;
  popover.hidePopover = hideSpy;

  return { ...result, trigger, popover, showSpy, hideSpy };
}

describe("usePopover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ─── 1. Returns refs ───────────────────────────────────────────────────────

  describe("returns refs", () => {
    it("returns triggerRef and popoverRef", () => {
      const { result } = renderHook(() => usePopover());

      expect(result.current).toHaveProperty("triggerRef");
      expect(result.current).toHaveProperty("popoverRef");
      expect(result.current.triggerRef.current).toBeNull();
      expect(result.current.popoverRef.current).toBeNull();
    });
  });

  // ─── 2. Hover trigger ─────────────────────────────────────────────────────

  describe("hover trigger (default)", () => {
    it("attaches mouseenter and mouseleave listeners to the trigger element", () => {
      const { trigger, showSpy, hideSpy } = renderWithMocks();

      // mouseenter on trigger fires showPopover
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(showSpy).toHaveBeenCalledTimes(1);

      // mouseleave on trigger fires hidePopover
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 3. Click trigger ─────────────────────────────────────────────────────

  describe("click trigger", () => {
    it("attaches click listener to the trigger element", () => {
      const { trigger, showSpy } = renderWithMocks({ trigger: "click" });

      fireEvent.click(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(showSpy).toHaveBeenCalledTimes(1);
    });

    it("does not respond to mouseenter/mouseleave when trigger is click", () => {
      const { trigger, showSpy, hideSpy } = renderWithMocks({
        trigger: "click",
      });

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(showSpy).not.toHaveBeenCalled();

      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(hideSpy).not.toHaveBeenCalled();
    });
  });

  // ─── 4. Hover popover stay-open ───────────────────────────────────────────

  describe("hover popover stay-open", () => {
    it("keeps popover open when hovering over the popover element", () => {
      const { trigger, popover, hideSpy } = renderWithMocks({ hideDelay: 100 });

      // Show the popover
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Leave the trigger (starts hide timer with 100ms delay)
      fireEvent.mouseLeave(trigger);

      // Before the hide delay completes, enter the popover (cancels hide)
      act(() => {
        vi.advanceTimersByTime(50);
      });
      fireEvent.mouseEnter(popover);

      // Wait well past the original hide delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // hidePopover should NOT have been called since we hovered the popover
      expect(hideSpy).not.toHaveBeenCalled();
    });

    it("hides the popover when leaving the popover element", () => {
      const { trigger, popover, hideSpy } = renderWithMocks();

      // Show the popover
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Move from trigger to popover
      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(popover);

      // Now leave the popover
      fireEvent.mouseLeave(popover);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 5. showPopover called on mouseenter ──────────────────────────────────

  describe("showPopover called on mouseenter", () => {
    it("calls showPopover on the popover element when trigger is hovered", () => {
      const { trigger, showSpy } = renderWithMocks();

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(showSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 6. hidePopover called on mouseleave ──────────────────────────────────

  describe("hidePopover called on mouseleave", () => {
    it("calls hidePopover on the popover element when trigger is left", () => {
      const { trigger, hideSpy } = renderWithMocks();

      // First show
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Then leave
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 7. Click toggle ──────────────────────────────────────────────────────

  describe("click toggle", () => {
    it("first click shows, second click hides", () => {
      const { trigger, showSpy, hideSpy } = renderWithMocks({
        trigger: "click",
      });

      // First click — show
      fireEvent.click(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(showSpy).toHaveBeenCalledTimes(1);
      expect(hideSpy).not.toHaveBeenCalled();

      // Second click — hide
      fireEvent.click(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });

    it("third click shows again", () => {
      const { trigger, showSpy, hideSpy } = renderWithMocks({
        trigger: "click",
      });

      // Click 1: show
      fireEvent.click(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(showSpy).toHaveBeenCalledTimes(1);

      // Click 2: hide
      fireEvent.click(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(hideSpy).toHaveBeenCalledTimes(1);

      // Click 3: show again
      fireEvent.click(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(showSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ─── 8. Show delay ────────────────────────────────────────────────────────

  describe("show delay", () => {
    it("does not show the popover until the showDelay has elapsed", () => {
      const { trigger, showSpy } = renderWithMocks({ showDelay: 200 });

      fireEvent.mouseEnter(trigger);

      // Not yet — only 199ms
      act(() => {
        vi.advanceTimersByTime(199);
      });
      expect(showSpy).not.toHaveBeenCalled();

      // Now at 200ms
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(showSpy).toHaveBeenCalledTimes(1);
    });

    it("cancels the show if trigger is left before the delay elapses", () => {
      const { trigger, showSpy } = renderWithMocks({ showDelay: 200 });

      fireEvent.mouseEnter(trigger);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Leave before the show delay completes
      fireEvent.mouseLeave(trigger);

      // Advance well past the original show delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(showSpy).not.toHaveBeenCalled();
    });
  });

  // ─── 9. Hide delay ────────────────────────────────────────────────────────

  describe("hide delay", () => {
    it("does not hide the popover until the hideDelay has elapsed", () => {
      const { trigger, hideSpy } = renderWithMocks({ hideDelay: 100 });

      // Show first
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Start hiding
      fireEvent.mouseLeave(trigger);

      // Not yet — only 99ms
      act(() => {
        vi.advanceTimersByTime(99);
      });
      expect(hideSpy).not.toHaveBeenCalled();

      // Now at 100ms
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });

    it("cancels the hide if trigger is re-entered before the delay elapses", () => {
      const { trigger, hideSpy } = renderWithMocks({ hideDelay: 100 });

      // Show
      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Start hiding
      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Re-enter before hide delay
      fireEvent.mouseEnter(trigger);

      // Advance well past the original hide delay
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(hideSpy).not.toHaveBeenCalled();
    });
  });

  // ─── 10. Cleanup on unmount ───────────────────────────────────────────────

  describe("cleanup on unmount", () => {
    it("removes event listeners when the component unmounts (hover mode)", () => {
      const { unmount } = render(React.createElement(TestComponent));

      const trigger = screen.getByTestId("trigger");
      const popover = screen.getByTestId("popover");

      const triggerRemoveSpy = vi.spyOn(trigger, "removeEventListener");
      const popoverRemoveSpy = vi.spyOn(popover, "removeEventListener");

      unmount();

      // In hover mode, should remove mouseenter + mouseleave from trigger
      const triggerRemovedEvents = triggerRemoveSpy.mock.calls.map(
        (call) => call[0],
      );
      expect(triggerRemovedEvents).toContain("mouseenter");
      expect(triggerRemovedEvents).toContain("mouseleave");

      // And mouseenter + mouseleave from popover
      const popoverRemovedEvents = popoverRemoveSpy.mock.calls.map(
        (call) => call[0],
      );
      expect(popoverRemovedEvents).toContain("mouseenter");
      expect(popoverRemovedEvents).toContain("mouseleave");

      triggerRemoveSpy.mockRestore();
      popoverRemoveSpy.mockRestore();
    });

    it("removes click listener when the component unmounts (click mode)", () => {
      const { unmount } = render(
        React.createElement(TestComponent, { trigger: "click" }),
      );

      const trigger = screen.getByTestId("trigger");
      const triggerRemoveSpy = vi.spyOn(trigger, "removeEventListener");

      unmount();

      const removedEvents = triggerRemoveSpy.mock.calls.map((call) => call[0]);
      expect(removedEvents).toContain("click");

      triggerRemoveSpy.mockRestore();
    });

    it("clears pending timeouts on unmount", () => {
      const { trigger, showSpy, unmount } = renderWithMocks({
        showDelay: 500,
      });

      // Start showing (with delay)
      fireEvent.mouseEnter(trigger);

      // Unmount before the show delay
      unmount();

      // Flush timers — the callback should not fire
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(showSpy).not.toHaveBeenCalled();
    });
  });
});
