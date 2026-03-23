import { act, renderHook } from "@testing-library/react";

import { useCardMouseEffects } from "./useCardMouseEffects";

// ─── Helpers ───────────────────────────────────────────────────────────────

const MOCK_RECT: DOMRect = {
  left: 0,
  top: 0,
  width: 200,
  height: 300,
  right: 200,
  bottom: 300,
  x: 0,
  y: 0,
  toJSON: () => {},
};

const MAX_ROTATION = 15;

function createElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => MOCK_RECT;
  document.body.appendChild(element);
  return element;
}

function cleanupElement(element: HTMLDivElement) {
  if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("useCardMouseEffects", () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = createElement();
  });

  afterEach(() => {
    cleanupElement(element);
  });

  // ── Initial state ──────────────────────────────────────────────────────

  describe("initial state", () => {
    it("returns mousePos at center {x:50, y:50}", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      expect(result.current.mousePos).toEqual({ x: 50, y: 50 });
    });

    it("returns isHovered as false", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      expect(result.current.isHovered).toBe(false);
    });

    it("returns rotateX as 0", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      expect(result.current.rotateX).toBe(0);
    });

    it("returns rotateY as 0", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      expect(result.current.rotateY).toBe(0);
    });
  });

  // ── Null ref ───────────────────────────────────────────────────────────

  describe("null ref", () => {
    it("does not throw when cardRef.current is null", () => {
      const ref = { current: null };

      expect(() => {
        renderHook(() => useCardMouseEffects(ref));
      }).not.toThrow();
    });

    it("returns default state when cardRef.current is null", () => {
      const ref = { current: null };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      expect(result.current.mousePos).toEqual({ x: 50, y: 50 });
      expect(result.current.isHovered).toBe(false);
      expect(result.current.rotateX).toBe(0);
      expect(result.current.rotateY).toBe(0);
    });

    it("does not add event listeners when cardRef.current is null", () => {
      const nullElement = document.createElement("div");
      const addSpy = vi.spyOn(nullElement, "addEventListener");
      // We never set the ref to this element – ref stays null
      const ref = { current: null };

      renderHook(() => useCardMouseEffects(ref));

      expect(addSpy).not.toHaveBeenCalled();
      addSpy.mockRestore();
    });
  });

  // ── Mouse enter ────────────────────────────────────────────────────────

  describe("mouse enter", () => {
    it("sets isHovered to true on mouseenter", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      act(() => {
        element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });

      expect(result.current.isHovered).toBe(true);
    });

    it("does not change mousePos on mouseenter", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      act(() => {
        element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });

      expect(result.current.mousePos).toEqual({ x: 50, y: 50 });
    });

    it("does not change rotation on mouseenter", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      act(() => {
        element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });

      expect(result.current.rotateX).toBe(0);
      expect(result.current.rotateY).toBe(0);
    });
  });

  // ── Mouse leave ────────────────────────────────────────────────────────

  describe("mouse leave", () => {
    it("resets isHovered to false on mouseleave", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      act(() => {
        element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });
      expect(result.current.isHovered).toBe(true);

      act(() => {
        element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
      expect(result.current.isHovered).toBe(false);
    });

    it("resets mousePos to center {x:50, y:50} on mouseleave", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // Move the mouse first to change position (use non-center coords)
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 50,
            clientY: 75,
            bubbles: true,
          }),
        );
      });
      expect(result.current.mousePos).toEqual({ x: 25, y: 25 });

      act(() => {
        element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
      expect(result.current.mousePos).toEqual({ x: 50, y: 50 });
    });

    it("resets rotateX and rotateY to 0 on mouseleave", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // Move the mouse first to change rotation
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 50,
            clientY: 75,
            bubbles: true,
          }),
        );
      });

      act(() => {
        element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });

      expect(result.current.rotateX).toBe(0);
      expect(result.current.rotateY).toBe(0);
    });
  });

  // ── Mouse move ─────────────────────────────────────────────────────────

  describe("mouse move", () => {
    it("calculates mousePos as percentage of element dimensions", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // clientX=100, clientY=150 => x = (100-0)/200*100 = 50, y = (150-0)/300*100 = 50
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 100,
            clientY: 150,
            bubbles: true,
          }),
        );
      });

      expect(result.current.mousePos.x).toBe(50);
      expect(result.current.mousePos.y).toBe(50);
    });

    it("calculates mousePos at top-left corner as {x:0, y:0}", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // clientX=0, clientY=0 => x = 0/200*100 = 0, y = 0/300*100 = 0
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 0,
            clientY: 0,
            bubbles: true,
          }),
        );
      });

      expect(result.current.mousePos.x).toBe(0);
      expect(result.current.mousePos.y).toBe(0);
    });

    it("calculates mousePos at bottom-right corner as {x:100, y:100}", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // clientX=200, clientY=300 => x = 200/200*100 = 100, y = 300/300*100 = 100
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 200,
            clientY: 300,
            bubbles: true,
          }),
        );
      });

      expect(result.current.mousePos.x).toBe(100);
      expect(result.current.mousePos.y).toBe(100);
    });

    it("calculates rotateX and rotateY based on distance from center", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // Element rect: left=0, top=0, width=200, height=300
      // centerX = 0 + 200/2 = 100, centerY = 0 + 300/2 = 150
      //
      // clientX=100, clientY=150 (at center):
      //   rotX = ((150-150)/300) * -15 = 0
      //   rotY = ((100-100)/200) * 15 = 0
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 100,
            clientY: 150,
            bubbles: true,
          }),
        );
      });

      expect(result.current.rotateX).toBeCloseTo(0);
      expect(result.current.rotateY).toBeCloseTo(0);
    });

    it("calculates negative rotateX when mouse is below center", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // centerX=100, centerY=150
      // clientX=100, clientY=300 (bottom center):
      //   rotX = ((300-150)/300) * -15 = (150/300) * -15 = 0.5 * -15 = -7.5
      //   rotY = ((100-100)/200) * 15 = 0
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 100,
            clientY: 300,
            bubbles: true,
          }),
        );
      });

      expect(result.current.rotateX).toBe(-7.5);
      expect(result.current.rotateY).toBe(0);
    });

    it("calculates positive rotateX when mouse is above center", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // centerX=100, centerY=150
      // clientX=100, clientY=0 (top center):
      //   rotX = ((0-150)/300) * -15 = (-150/300) * -15 = -0.5 * -15 = 7.5
      //   rotY = ((100-100)/200) * 15 = 0
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 100,
            clientY: 0,
            bubbles: true,
          }),
        );
      });

      expect(result.current.rotateX).toBe(7.5);
      expect(result.current.rotateY).toBe(0);
    });

    it("calculates positive rotateY when mouse is right of center", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // centerX=100, centerY=150
      // clientX=200, clientY=150 (right center):
      //   rotX = ((150-150)/300) * -15 = 0
      //   rotY = ((200-100)/200) * 15 = (100/200) * 15 = 0.5 * 15 = 7.5
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 200,
            clientY: 150,
            bubbles: true,
          }),
        );
      });

      expect(result.current.rotateX).toBeCloseTo(0);
      expect(result.current.rotateY).toBe(7.5);
    });

    it("calculates negative rotateY when mouse is left of center", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // centerX=100, centerY=150
      // clientX=0, clientY=150 (left center):
      //   rotX = ((150-150)/300) * -15 = 0
      //   rotY = ((0-100)/200) * 15 = (-100/200) * 15 = -0.5 * 15 = -7.5
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 0,
            clientY: 150,
            bubbles: true,
          }),
        );
      });

      expect(result.current.rotateX).toBeCloseTo(0);
      expect(result.current.rotateY).toBe(-7.5);
    });

    it("calculates maximum rotation at the corners", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      // centerX=100, centerY=150
      // clientX=200, clientY=0 (top-right corner):
      //   rotX = ((0-150)/300) * -15 = -0.5 * -15 = 7.5
      //   rotY = ((200-100)/200) * 15 = 0.5 * 15 = 7.5
      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 200,
            clientY: 0,
            bubbles: true,
          }),
        );
      });

      expect(result.current.rotateX).toBe(MAX_ROTATION / 2);
      expect(result.current.rotateY).toBe(MAX_ROTATION / 2);
    });

    it("updates state on multiple consecutive mousemove events", () => {
      const ref = { current: element };
      const { result } = renderHook(() => useCardMouseEffects(ref));

      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 50,
            clientY: 75,
            bubbles: true,
          }),
        );
      });

      // x = (50/200)*100 = 25, y = (75/300)*100 = 25
      expect(result.current.mousePos.x).toBe(25);
      expect(result.current.mousePos.y).toBe(25);

      act(() => {
        element.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 150,
            clientY: 225,
            bubbles: true,
          }),
        );
      });

      // x = (150/200)*100 = 75, y = (225/300)*100 = 75
      expect(result.current.mousePos.x).toBe(75);
      expect(result.current.mousePos.y).toBe(75);
    });
  });

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  describe("cleanup on unmount", () => {
    it("removes mousemove listener on unmount", () => {
      const ref = { current: element };
      const removeSpy = vi.spyOn(element, "removeEventListener");

      const { unmount } = renderHook(() => useCardMouseEffects(ref));
      unmount();

      expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
      removeSpy.mockRestore();
    });

    it("removes mouseenter listener on unmount", () => {
      const ref = { current: element };
      const removeSpy = vi.spyOn(element, "removeEventListener");

      const { unmount } = renderHook(() => useCardMouseEffects(ref));
      unmount();

      expect(removeSpy).toHaveBeenCalledWith(
        "mouseenter",
        expect.any(Function),
      );
      removeSpy.mockRestore();
    });

    it("removes mouseleave listener on unmount", () => {
      const ref = { current: element };
      const removeSpy = vi.spyOn(element, "removeEventListener");

      const { unmount } = renderHook(() => useCardMouseEffects(ref));
      unmount();

      expect(removeSpy).toHaveBeenCalledWith(
        "mouseleave",
        expect.any(Function),
      );
      removeSpy.mockRestore();
    });

    it("does not respond to events after unmount", () => {
      const ref = { current: element };
      const { result, unmount } = renderHook(() => useCardMouseEffects(ref));
      unmount();

      // Dispatching events after unmount should not cause errors
      // (listeners should have been removed)
      act(() => {
        element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      });

      // State should remain at initial values since the hook is unmounted
      expect(result.current.isHovered).toBe(false);
    });
  });
});
