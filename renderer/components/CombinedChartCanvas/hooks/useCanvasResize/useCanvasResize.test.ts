import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCanvasResize } from "./useCanvasResize";

type ResizeCallback = (entry: ResizeObserverEntry) => void;

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/lib/canvas-core/canvas-primitives", () => ({
  DPR: () => 2,
}));

const mockObserveResize =
  vi.fn<(element: Element, callback: ResizeCallback) => () => void>();
const mockUnobserveResize = vi.fn();

vi.mock("~/renderer/lib/canvas-core/shared-resize-observer", () => ({
  observeResize: (...args: Parameters<typeof mockObserveResize>) =>
    mockObserveResize(...args),
  unobserveResize: (...args: unknown[]) => mockUnobserveResize(...args),
}));

// Stores the per-element callback registered via observeResize so tests
// can simulate a resize event.
let capturedCallback: ResizeCallback | null = null;
let capturedCleanup: ReturnType<typeof vi.fn>;

beforeEach(() => {
  capturedCallback = null;
  capturedCleanup = vi.fn();

  mockObserveResize.mockImplementation(((
    _element: Element,
    callback: ResizeCallback,
  ) => {
    capturedCallback = callback;
    return capturedCleanup;
  }) as (element: Element, callback: ResizeCallback) => () => void);
  mockUnobserveResize.mockClear();

  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    cb(performance.now());
    return 1;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockDiv(width = 800, height = 600): HTMLDivElement {
  const div = document.createElement("div");
  vi.spyOn(div, "getBoundingClientRect").mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return div;
}

function fireResize(target: Element, width: number, height: number) {
  if (!capturedCallback) {
    throw new Error("No resize callback captured — was observeResize called?");
  }
  act(() => {
    capturedCallback!({
      contentRect: { width, height } as DOMRectReadOnly,
      target,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } as ResizeObserverEntry);
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("useCanvasResize", () => {
  it("returns initial canvasSize as {0, 0}", () => {
    const { result } = renderHook(() => useCanvasResize());

    expect(result.current.canvasSize).toEqual({ width: 0, height: 0 });
  });

  it("subscribes via shared observer when containerRef is called with a DOM node", () => {
    const { result } = renderHook(() => useCanvasResize());
    const div = createMockDiv();

    act(() => {
      result.current.containerRef(div);
    });

    expect(mockObserveResize).toHaveBeenCalledWith(div, expect.any(Function));
  });

  it("stores element in containerElRef", () => {
    const { result } = renderHook(() => useCanvasResize());
    const div = createMockDiv();

    act(() => {
      result.current.containerRef(div);
    });

    expect(result.current.containerElRef.current).toBe(div);
  });

  it("seeds initial size from getBoundingClientRect", () => {
    const { result } = renderHook(() => useCanvasResize());
    const div = createMockDiv(400, 300);

    act(() => {
      result.current.containerRef(div);
    });

    expect(result.current.canvasSize).toEqual({ width: 400, height: 300 });
  });

  it("updates canvasSize when ResizeObserver fires", () => {
    const { result } = renderHook(() => useCanvasResize());
    const div = createMockDiv(400, 300);

    act(() => {
      result.current.containerRef(div);
    });

    fireResize(div, 1024, 768);

    expect(result.current.canvasSize).toEqual({ width: 1024, height: 768 });
  });

  it("cleans up previous subscription when containerRef is called again", () => {
    const { result } = renderHook(() => useCanvasResize());
    const div1 = createMockDiv();
    const div2 = createMockDiv(500, 400);

    act(() => {
      result.current.containerRef(div1);
    });

    const firstCleanup = capturedCleanup;

    act(() => {
      result.current.containerRef(div2);
    });

    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(result.current.containerElRef.current).toBe(div2);
  });

  it("resets size to {0,0} when containerRef is called with null", () => {
    const { result } = renderHook(() => useCanvasResize());
    const div = createMockDiv(400, 300);

    act(() => {
      result.current.containerRef(div);
    });

    expect(result.current.canvasSize.width).toBe(400);

    act(() => {
      result.current.containerRef(null);
    });

    expect(result.current.canvasSize).toEqual({ width: 0, height: 0 });
    expect(result.current.containerElRef.current).toBeNull();
  });

  it("calls cleanup on unmount (defensive)", () => {
    const { result, unmount } = renderHook(() => useCanvasResize());
    const div = createMockDiv();

    act(() => {
      result.current.containerRef(div);
    });

    const cleanup = capturedCleanup;

    unmount();

    expect(cleanup).toHaveBeenCalled();
  });

  it("returns a canvasRef", () => {
    const { result } = renderHook(() => useCanvasResize());

    expect(result.current.canvasRef).toBeDefined();
    expect(result.current.canvasRef.current).toBeNull();
  });
});
