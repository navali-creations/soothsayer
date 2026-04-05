import { beforeEach, describe, expect, it, vi } from "vitest";

import { observeResize, unobserveResize } from "./shared-resize-observer";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
let observerCallback: ResizeObserverCallback;
let constructorCallCount: number;

beforeEach(() => {
  constructorCallCount = 0;
  mockObserve.mockClear();
  mockUnobserve.mockClear();
  mockDisconnect.mockClear();

  globalThis.ResizeObserver = class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      observerCallback = callback;
      constructorCallCount++;
    }
    observe = mockObserve;
    unobserve = mockUnobserve;
    disconnect = mockDisconnect;
  } as any;
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function createElement(tag = "div"): Element {
  return document.createElement(tag);
}

function fireObserverEntries(entries: Partial<ResizeObserverEntry>[]) {
  observerCallback(entries as ResizeObserverEntry[], {} as ResizeObserver);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("shared-resize-observer", () => {
  describe("observeResize", () => {
    it("lazily creates the ResizeObserver on first call", () => {
      expect(constructorCallCount).toBe(0);

      const el = createElement();
      const cleanup = observeResize(el, vi.fn());

      expect(constructorCallCount).toBe(1);

      cleanup();
    });

    it("reuses the same ResizeObserver for subsequent calls", () => {
      const el1 = createElement();
      const el2 = createElement();
      const cleanup1 = observeResize(el1, vi.fn());
      const cleanup2 = observeResize(el2, vi.fn());

      expect(constructorCallCount).toBe(1);

      cleanup1();
      cleanup2();
    });

    it("calls observer.observe() for a new element", () => {
      const el = createElement();
      const cleanup = observeResize(el, vi.fn());

      expect(mockObserve).toHaveBeenCalledTimes(1);
      expect(mockObserve).toHaveBeenCalledWith(el);

      cleanup();
    });

    it("does not call observer.observe() again when adding a second callback to the same element", () => {
      const el = createElement();
      const cleanup1 = observeResize(el, vi.fn());
      const cleanup2 = observeResize(el, vi.fn());

      expect(mockObserve).toHaveBeenCalledTimes(1);

      cleanup1();
      cleanup2();
    });

    it("returns a cleanup function", () => {
      const el = createElement();
      const cleanup = observeResize(el, vi.fn());

      expect(typeof cleanup).toBe("function");

      cleanup();
    });
  });

  describe("callback dispatch", () => {
    it("dispatches entries to the correct element callback", () => {
      const el1 = createElement();
      const el2 = createElement();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const cleanup1 = observeResize(el1, cb1);
      const cleanup2 = observeResize(el2, cb2);

      const entry1 = {
        target: el1,
        contentRect: { width: 100, height: 50 } as DOMRectReadOnly,
      };
      fireObserverEntries([entry1]);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb1).toHaveBeenCalledWith(entry1);
      expect(cb2).not.toHaveBeenCalled();

      cleanup1();
      cleanup2();
    });

    it("dispatches to multiple callbacks on the same element", () => {
      const el = createElement();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const cleanup1 = observeResize(el, cb1);
      const cleanup2 = observeResize(el, cb2);

      const entry = {
        target: el,
        contentRect: { width: 200, height: 100 } as DOMRectReadOnly,
      };
      fireObserverEntries([entry]);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb1).toHaveBeenCalledWith(entry);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledWith(entry);

      cleanup1();
      cleanup2();
    });

    it("handles entries for elements with no registered callbacks gracefully", () => {
      const el = createElement();
      const observedEl = createElement();
      const cb = vi.fn();

      const cleanup = observeResize(observedEl, cb);

      // Fire an entry for an element we never subscribed to
      expect(() => {
        fireObserverEntries([
          {
            target: el,
            contentRect: { width: 50, height: 50 } as DOMRectReadOnly,
          },
        ]);
      }).not.toThrow();

      expect(cb).not.toHaveBeenCalled();

      cleanup();
    });

    it("handles multiple entries in a single batch", () => {
      const el1 = createElement();
      const el2 = createElement();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const cleanup1 = observeResize(el1, cb1);
      const cleanup2 = observeResize(el2, cb2);

      const entry1 = {
        target: el1,
        contentRect: { width: 100, height: 50 } as DOMRectReadOnly,
      };
      const entry2 = {
        target: el2,
        contentRect: { width: 200, height: 100 } as DOMRectReadOnly,
      };

      fireObserverEntries([entry1, entry2]);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb1).toHaveBeenCalledWith(entry1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledWith(entry2);

      cleanup1();
      cleanup2();
    });
  });

  describe("unobserveResize", () => {
    it("removes a specific callback", () => {
      const el = createElement();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const cleanup1 = observeResize(el, cb1);
      const cleanup2 = observeResize(el, cb2);

      cleanup1(); // remove cb1

      const entry = {
        target: el,
        contentRect: { width: 100, height: 50 } as DOMRectReadOnly,
      };
      fireObserverEntries([entry]);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);

      cleanup2();
    });

    it("calls observer.unobserve() when the last callback for an element is removed", () => {
      const el = createElement();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const cleanup1 = observeResize(el, cb1);
      const cleanup2 = observeResize(el, cb2);

      cleanup1();
      expect(mockUnobserve).not.toHaveBeenCalled();

      cleanup2();
      expect(mockUnobserve).toHaveBeenCalledTimes(1);
      expect(mockUnobserve).toHaveBeenCalledWith(el);
    });

    it("disconnects and releases observer when map is fully empty", () => {
      const el1 = createElement();
      const el2 = createElement();

      const cleanup1 = observeResize(el1, vi.fn());
      const cleanup2 = observeResize(el2, vi.fn());

      cleanup1();
      expect(mockDisconnect).not.toHaveBeenCalled();

      cleanup2();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("creates a new observer after previous one was disconnected", () => {
      const el = createElement();

      const cleanup1 = observeResize(el, vi.fn());
      cleanup1(); // observer disconnects

      expect(constructorCallCount).toBe(1);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);

      const cleanup2 = observeResize(el, vi.fn());
      expect(constructorCallCount).toBe(2);

      cleanup2();
    });

    it("is idempotent — calling cleanup twice does not throw", () => {
      const el = createElement();
      const cb = vi.fn();
      const cleanup = observeResize(el, cb);

      expect(() => {
        cleanup();
        cleanup();
      }).not.toThrow();

      expect(mockUnobserve).toHaveBeenCalledTimes(1);
    });

    it("handles unobserveResize for unknown element gracefully", () => {
      const el = createElement();
      const cb = vi.fn();

      expect(() => {
        unobserveResize(el, cb);
      }).not.toThrow();
    });
  });

  describe("cleanup function returned by observeResize", () => {
    it("is equivalent to calling unobserveResize(element, callback)", () => {
      const el = createElement();
      const cb = vi.fn();

      observeResize(el, cb);

      unobserveResize(el, cb);

      const entry = {
        target: el,
        contentRect: { width: 100, height: 50 } as DOMRectReadOnly,
      };
      fireObserverEntries([entry]);

      expect(cb).not.toHaveBeenCalled();
      expect(mockUnobserve).toHaveBeenCalledWith(el);
    });
  });
});
