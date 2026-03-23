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

  // ─── 11. Placement and positioning ────────────────────────────────────────

  describe("placement and positioning", () => {
    let rafSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      rafSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((cb) => {
          cb(0);
          return 0;
        });
    });

    afterEach(() => {
      rafSpy.mockRestore();
    });

    function mockRects(
      trigger: HTMLElement,
      popover: HTMLElement,
      triggerRect: Partial<DOMRect> = {},
      popoverRect: Partial<DOMRect> = {},
    ) {
      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 100,
            bottom: 130,
            left: 50,
            right: 120,
            width: 70,
            height: 30,
            x: 50,
            y: 100,
            toJSON: vi.fn(),
            ...triggerRect,
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 80,
            width: 80,
            height: 40,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
            ...popoverRect,
          }) as DOMRect,
      );
    }

    it("positions popover to the right of the trigger (default placement)", () => {
      const { trigger, popover, showSpy } = renderWithMocks({
        placement: "right",
        offset: 8,
      });
      mockRects(trigger, popover);

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(showSpy).toHaveBeenCalledTimes(1);
      expect(popover.style.position).toBe("fixed");
      // right placement: left = triggerRect.right + offset = 120 + 8 = 128
      expect(popover.style.left).toBe("128px");
      // right placement: top = triggerRect.top + (triggerHeight - popoverHeight) / 2 = 100 + (30 - 40) / 2 = 95
      expect(popover.style.top).toBe("95px");
    });

    it("positions popover to the left of the trigger", () => {
      const { trigger, popover, showSpy } = renderWithMocks({
        placement: "left",
        offset: 8,
      });
      mockRects(trigger, popover);

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(showSpy).toHaveBeenCalledTimes(1);
      expect(popover.style.position).toBe("fixed");
      // left placement: left = triggerRect.left - popoverWidth - offset = 50 - 80 - 8 = -38 → clamped to 8
      expect(popover.style.left).toBe("8px");
      // left placement: top = triggerRect.top + (triggerHeight - popoverHeight) / 2 = 100 + (30 - 40) / 2 = 95
      expect(popover.style.top).toBe("95px");
    });

    it("positions popover above the trigger", () => {
      const { trigger, popover, showSpy } = renderWithMocks({
        placement: "top",
        offset: 8,
      });
      mockRects(trigger, popover);

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(showSpy).toHaveBeenCalledTimes(1);
      expect(popover.style.position).toBe("fixed");
      // top placement: top = triggerRect.top - popoverHeight - offset = 100 - 40 - 8 = 52
      expect(popover.style.top).toBe("52px");
      // top placement: left = triggerRect.left + (triggerWidth - popoverWidth) / 2 = 50 + (70 - 80) / 2 = 45
      expect(popover.style.left).toBe("45px");
    });

    it("positions popover below the trigger", () => {
      const { trigger, popover, showSpy } = renderWithMocks({
        placement: "bottom",
        offset: 8,
      });
      mockRects(trigger, popover);

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(showSpy).toHaveBeenCalledTimes(1);
      expect(popover.style.position).toBe("fixed");
      // bottom placement: top = triggerRect.bottom + offset = 130 + 8 = 138
      expect(popover.style.top).toBe("138px");
      // bottom placement: left = triggerRect.left + (triggerWidth - popoverWidth) / 2 = 50 + (70 - 80) / 2 = 45
      expect(popover.style.left).toBe("45px");
    });

    it("sets margin to 0 on positioned popover", () => {
      const { trigger, popover } = renderWithMocks();
      mockRects(trigger, popover);

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(popover.style.margin).toBe("0px");
    });
  });

  // ─── 12. Scale transform ──────────────────────────────────────────────────

  describe("scale transform", () => {
    let rafSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      rafSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((cb) => {
          cb(0);
          return 0;
        });
    });

    afterEach(() => {
      rafSpy.mockRestore();
    });

    it("applies CSS scale transform when scale is not 1", () => {
      const { trigger, popover } = renderWithMocks({
        placement: "right",
        scale: 0.5,
      });

      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 100,
            bottom: 130,
            left: 50,
            right: 120,
            width: 70,
            height: 30,
            x: 50,
            y: 100,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 20,
            left: 0,
            right: 40,
            width: 40,
            height: 20,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(popover.style.transform).toBe("scale(0.5)");
    });

    it('sets transformOrigin to "center left" for right placement', () => {
      const { trigger, popover } = renderWithMocks({
        placement: "right",
        scale: 0.5,
      });

      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 100,
            bottom: 130,
            left: 50,
            right: 120,
            width: 70,
            height: 30,
            x: 50,
            y: 100,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 20,
            left: 0,
            right: 40,
            width: 40,
            height: 20,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(popover.style.transformOrigin).toBe("center left");
    });

    it('sets transformOrigin to "center right" for left placement', () => {
      const { trigger, popover } = renderWithMocks({
        placement: "left",
        scale: 0.75,
      });

      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 200,
            bottom: 230,
            left: 300,
            right: 370,
            width: 70,
            height: 30,
            x: 300,
            y: 200,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 30,
            left: 0,
            right: 60,
            width: 60,
            height: 30,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(popover.style.transform).toBe("scale(0.75)");
      expect(popover.style.transformOrigin).toBe("center right");
    });

    it('sets transformOrigin to "bottom center" for top placement', () => {
      const { trigger, popover } = renderWithMocks({
        placement: "top",
        scale: 0.5,
      });

      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 200,
            bottom: 230,
            left: 300,
            right: 370,
            width: 70,
            height: 30,
            x: 300,
            y: 200,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 20,
            left: 0,
            right: 40,
            width: 40,
            height: 20,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(popover.style.transformOrigin).toBe("bottom center");
    });

    it('sets transformOrigin to "top center" for bottom placement', () => {
      const { trigger, popover } = renderWithMocks({
        placement: "bottom",
        scale: 0.5,
      });

      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 200,
            bottom: 230,
            left: 300,
            right: 370,
            width: 70,
            height: 30,
            x: 300,
            y: 200,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 20,
            left: 0,
            right: 40,
            width: 40,
            height: 20,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(popover.style.transformOrigin).toBe("top center");
    });

    it("does not set transform when scale is 1 (default)", () => {
      const { trigger, popover } = renderWithMocks({
        placement: "right",
      });

      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 100,
            bottom: 130,
            left: 50,
            right: 120,
            width: 70,
            height: 30,
            x: 50,
            y: 100,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 80,
            width: 80,
            height: 40,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(popover.style.transform).toBe("");
    });

    it("accounts for scale when calculating unscaled dimensions", () => {
      const { trigger, popover } = renderWithMocks({
        placement: "right",
        offset: 8,
        scale: 0.5,
      });

      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 100,
            bottom: 130,
            left: 50,
            right: 120,
            width: 70,
            height: 30,
            x: 50,
            y: 100,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      // At scale 0.5, the reported rect is half the unscaled size
      // unscaledWidth = 40 / 0.5 = 80, unscaledHeight = 20 / 0.5 = 40
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 20,
            left: 0,
            right: 40,
            width: 40,
            height: 20,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // right: left = triggerRect.right + offset = 120 + 8 = 128
      expect(popover.style.left).toBe("128px");
      // right: top = triggerRect.top + (triggerHeight - unscaledHeight) / 2 = 100 + (30 - 40) / 2 = 95
      expect(popover.style.top).toBe("95px");
    });
  });

  // ─── 13. Viewport clamping ────────────────────────────────────────────────

  describe("viewport clamping", () => {
    let rafSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      rafSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((cb) => {
          cb(0);
          return 0;
        });
    });

    afterEach(() => {
      rafSpy.mockRestore();
    });

    it("clamps top to padding (8px) when positioning would go above viewport", () => {
      const { trigger, popover } = renderWithMocks({
        placement: "top",
        offset: 8,
      });

      // Trigger near the top of the viewport — popover would be positioned at negative top
      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 10,
            bottom: 40,
            left: 200,
            right: 270,
            width: 70,
            height: 30,
            x: 200,
            y: 10,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 80,
            width: 80,
            height: 40,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // top placement: top = 10 - 40 - 8 = -38 → clamped to 8
      expect(popover.style.top).toBe("8px");
    });

    it("clamps left to padding (8px) when positioning would go left of viewport", () => {
      const { trigger, popover } = renderWithMocks({
        placement: "left",
        offset: 8,
      });

      // Trigger near the left edge — popover would be positioned at negative left
      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 200,
            bottom: 230,
            left: 20,
            right: 90,
            width: 70,
            height: 30,
            x: 20,
            y: 200,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 80,
            width: 80,
            height: 40,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // left placement: left = 20 - 80 - 8 = -68 → clamped to 8
      expect(popover.style.left).toBe("8px");
    });

    it("clamps bottom to viewport height minus padding", () => {
      const { trigger, popover } = renderWithMocks({
        placement: "bottom",
        offset: 8,
      });

      // Trigger near the bottom of the viewport
      // window.innerHeight defaults to 768 in jsdom
      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 740,
            bottom: 770,
            left: 200,
            right: 270,
            width: 70,
            height: 30,
            x: 200,
            y: 740,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 80,
            width: 80,
            height: 40,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // bottom placement: top = 770 + 8 = 778 → clamped to innerHeight - popoverHeight - 8 = 768 - 40 - 8 = 720
      const maxTop = window.innerHeight - 40 - 8;
      expect(popover.style.top).toBe(`${maxTop}px`);
    });

    it("clamps right to viewport width minus padding", () => {
      const { trigger, popover } = renderWithMocks({
        placement: "right",
        offset: 8,
      });

      // Trigger near the right edge of the viewport
      // window.innerWidth defaults to 1024 in jsdom
      trigger.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 200,
            bottom: 230,
            left: 960,
            right: 1030,
            width: 70,
            height: 30,
            x: 960,
            y: 200,
            toJSON: vi.fn(),
          }) as DOMRect,
      );
      popover.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 80,
            width: 80,
            height: 40,
            x: 0,
            y: 0,
            toJSON: vi.fn(),
          }) as DOMRect,
      );

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // right placement: left = 1030 + 8 = 1038 → clamped to innerWidth - popoverWidth - 8 = 1024 - 80 - 8 = 936
      const maxLeft = window.innerWidth - 80 - 8;
      expect(popover.style.left).toBe(`${maxLeft}px`);
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
