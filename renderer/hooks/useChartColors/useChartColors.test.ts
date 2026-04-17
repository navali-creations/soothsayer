import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChartColors } from "./useChartColors";
import { useChartColors } from "./useChartColors";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Creates a fake CanvasRenderingContext2D that resolves any CSS color string
 * to the given [r, g, b] pixel values via `getImageData`.
 */
function createFakeCanvasContext(r: number, g: number, b: number) {
  return {
    clearRect: vi.fn(),
    fillStyle: "",
    fillRect: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray([r, g, b, 255]),
    }),
  };
}

/**
 * Installs a `getComputedStyle` mock on `document.documentElement` that
 * returns the given map of CSS variable names → values. All other properties
 * return an empty string.
 */
function mockComputedStyle(vars: Record<string, string>) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (name: string) => vars[name] ?? "",
  } as unknown as CSSStyleDeclaration);
}

/** All expected keys on the ChartColors interface. */
const ALL_CHART_COLOR_KEYS: (keyof ChartColors)[] = [
  // Base content
  "bc100",
  "bc50",
  "bc40",
  "bc35",
  "bc30",
  "bc20",
  "bc15",
  "bc12",
  "bc10",
  "bc08",
  "bc07",
  "bc06",
  "bc05",
  // Primary
  "primary",
  "primary60",
  "primary30",
  "primary15",
  "primary08",
  "primary02",
  // Backgrounds
  "b1",
  "b2",
  "b3",
  // Semantic
  "success",
  "success50",
  "success30",
  "success05",
  "info",
  "info80",
  "info30",
  "warning",
  "warning50",
  // Secondary
  "secondary",
  "secondary60",
  "secondary30",
];

// ─── Test suite ────────────────────────────────────────────────────────────

describe("useChartColors", () => {
  let observeCallbacks: Array<MutationCallback>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let mockObserve: ReturnType<typeof vi.fn>;
  let originalRAF: typeof requestAnimationFrame;
  let OriginalMutationObserver: typeof MutationObserver;

  beforeEach(() => {
    // Track all MutationObserver instances so we can trigger callbacks later
    observeCallbacks = [];
    mockDisconnect = vi.fn();
    mockObserve = vi.fn();

    OriginalMutationObserver = globalThis.MutationObserver;

    // Use a real class so `new MutationObserver(cb)` works as a constructor
    class MockMutationObserver {
      constructor(cb: MutationCallback) {
        observeCallbacks.push(cb);
      }
      observe = mockObserve;
      disconnect = mockDisconnect;
      takeRecords = vi.fn().mockReturnValue([]);
    }

    vi.stubGlobal("MutationObserver", MockMutationObserver);

    // Replace requestAnimationFrame with synchronous execution for tests
    originalRAF = globalThis.requestAnimationFrame;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.MutationObserver = OriginalMutationObserver;
    globalThis.requestAnimationFrame = originalRAF;
  });

  // ─── 1. Returns ChartColors shape ─────────────────────────────────────

  describe("shape", () => {
    it("returns an object with all expected ChartColors keys", () => {
      // With null canvas context (from global setup) everything falls back to white
      mockComputedStyle({});

      const { result } = renderHook(() => useChartColors());

      for (const key of ALL_CHART_COLOR_KEYS) {
        expect(result.current).toHaveProperty(key);
        expect(typeof result.current[key]).toBe("string");
      }
    });

    it("does not contain unexpected keys", () => {
      mockComputedStyle({});

      const { result } = renderHook(() => useChartColors());
      const actualKeys = Object.keys(result.current);

      expect(actualKeys.sort()).toEqual([...ALL_CHART_COLOR_KEYS].sort());
    });
  });

  // ─── 2. Canvas-based color parsing ────────────────────────────────────

  describe("canvas-based color parsing", () => {
    it("resolves CSS variables to correct rgb/rgba strings via canvas", () => {
      // Mock getComputedStyle to return known CSS variable values
      mockComputedStyle({
        "--color-base-content": "#1a2b3c",
        "--color-primary": "#ff6600",
        "--color-base-100": "#ffffff",
        "--color-base-200": "#f0f0f0",
        "--color-base-300": "#e0e0e0",
      });

      // Track fillStyle values to return different pixel data per color
      const colorMap: Record<string, [number, number, number]> = {
        "#1a2b3c": [26, 43, 60],
        "#ff6600": [255, 102, 0],
        "#ffffff": [255, 255, 255],
        "#f0f0f0": [240, 240, 240],
        "#e0e0e0": [224, 224, 224],
      };

      const fakeCtx = {
        clearRect: vi.fn(),
        fillStyle: "",
        fillRect: vi.fn(),
        getImageData: vi.fn().mockImplementation(() => {
          const rgb = colorMap[fakeCtx.fillStyle] ?? [0, 0, 0];
          return {
            data: new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255]),
          };
        }),
      };

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtx as unknown as CanvasRenderingContext2D,
      );

      const { result } = renderHook(() => useChartColors());

      // Base content full opacity → rgb(26, 43, 60)
      expect(result.current.bc100).toBe("rgb(26, 43, 60)");

      // Base content at 50% → rgba(26, 43, 60, 0.5)
      expect(result.current.bc50).toBe("rgba(26, 43, 60, 0.5)");

      // Base content at 40% → rgba(26, 43, 60, 0.4)
      expect(result.current.bc40).toBe("rgba(26, 43, 60, 0.4)");

      // Primary full opacity → rgb(255, 102, 0)
      expect(result.current.primary).toBe("rgb(255, 102, 0)");

      // Primary at 60% → rgba(255, 102, 0, 0.6)
      expect(result.current.primary60).toBe("rgba(255, 102, 0, 0.6)");

      // Backgrounds → full opacity rgb
      expect(result.current.b1).toBe("rgb(255, 255, 255)");
      expect(result.current.b2).toBe("rgb(240, 240, 240)");
      expect(result.current.b3).toBe("rgb(224, 224, 224)");
    });

    it("calls clearRect before fillRect for each color", () => {
      mockComputedStyle({
        "--color-base-content": "#000000",
        "--color-primary": "#111111",
        "--color-base-100": "#222222",
        "--color-base-200": "#333333",
        "--color-base-300": "#444444",
      });

      const fakeCtx = createFakeCanvasContext(0, 0, 0);

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtx as unknown as CanvasRenderingContext2D,
      );

      renderHook(() => useChartColors());

      // 5 CSS variables = 5 calls each to clearRect and fillRect
      expect(fakeCtx.clearRect).toHaveBeenCalledTimes(5);
      expect(fakeCtx.fillRect).toHaveBeenCalledTimes(5);

      // Every call should target the 1×1 pixel canvas
      for (const call of fakeCtx.clearRect.mock.calls) {
        expect(call).toEqual([0, 0, 1, 1]);
      }
      for (const call of fakeCtx.fillRect.mock.calls) {
        expect(call).toEqual([0, 0, 1, 1]);
      }
    });
  });

  // ─── 3. Fallback when canvas context is null ──────────────────────────

  describe("fallback when canvas context is null", () => {
    it("falls back to white rgb(255, 255, 255) when getContext returns null", () => {
      mockComputedStyle({
        "--color-base-content": "#1a2b3c",
        "--color-primary": "#ff6600",
        "--color-base-100": "#ffffff",
        "--color-base-200": "#f0f0f0",
        "--color-base-300": "#e0e0e0",
      });

      // Ensure getContext returns null (simulating no canvas support)
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

      const { result } = renderHook(() => useChartColors());

      // Full-opacity variants should be white
      expect(result.current.bc100).toBe("rgb(255, 255, 255)");
      expect(result.current.primary).toBe("rgb(255, 255, 255)");
      expect(result.current.b1).toBe("rgb(255, 255, 255)");
      expect(result.current.b2).toBe("rgb(255, 255, 255)");
      expect(result.current.b3).toBe("rgb(255, 255, 255)");

      // Partial opacity variants should use rgba with white
      expect(result.current.bc50).toBe("rgba(255, 255, 255, 0.5)");
      expect(result.current.primary60).toBe("rgba(255, 255, 255, 0.6)");
    });
  });

  // ─── 4. Fallback for empty CSS variable ───────────────────────────────

  describe("fallback for empty CSS variables", () => {
    it("falls back to white when getPropertyValue returns empty strings", () => {
      // Return empty strings for all CSS variables
      mockComputedStyle({
        "--color-base-content": "",
        "--color-primary": "",
        "--color-base-100": "",
        "--color-base-200": "",
        "--color-base-300": "",
      });

      // Even with a working canvas, empty string input falls back to white
      // because parseColor returns [255, 255, 255] for trimmed empty strings
      const fakeCtx = createFakeCanvasContext(0, 0, 0);
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtx as unknown as CanvasRenderingContext2D,
      );

      const { result } = renderHook(() => useChartColors());

      expect(result.current.bc100).toBe("rgb(255, 255, 255)");
      expect(result.current.primary).toBe("rgb(255, 255, 255)");
      expect(result.current.b1).toBe("rgb(255, 255, 255)");

      // Canvas methods should NOT be called for empty strings (early return)
      expect(fakeCtx.clearRect).not.toHaveBeenCalled();
      expect(fakeCtx.fillRect).not.toHaveBeenCalled();
    });

    it("falls back to white when getPropertyValue returns whitespace-only strings", () => {
      mockComputedStyle({
        "--color-base-content": "   ",
        "--color-primary": "  \t  ",
        "--color-base-100": " ",
        "--color-base-200": "  ",
        "--color-base-300": "\t",
      });

      const fakeCtx = createFakeCanvasContext(0, 0, 0);
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtx as unknown as CanvasRenderingContext2D,
      );

      const { result } = renderHook(() => useChartColors());

      expect(result.current.bc100).toBe("rgb(255, 255, 255)");
      expect(result.current.primary).toBe("rgb(255, 255, 255)");
    });

    it("falls back to white when CSS variables are missing entirely", () => {
      // Return empty object — getPropertyValue will return "" for all variables
      mockComputedStyle({});

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

      const { result } = renderHook(() => useChartColors());

      // Every key should be a white-based color
      for (const key of ALL_CHART_COLOR_KEYS) {
        expect(result.current[key]).toMatch(/^rgba?\(255, 255, 255/);
      }
    });
  });

  // ─── 5. RGBA formatting ───────────────────────────────────────────────

  describe("rgba formatting", () => {
    /**
     * Helper to render the hook with a canvas that always returns the given
     * RGB value, so we can inspect the formatted strings.
     */
    function renderWithColor(r: number, g: number, b: number) {
      mockComputedStyle({
        "--color-base-content": "#aabbcc",
        "--color-primary": "#aabbcc",
        "--color-base-100": "#aabbcc",
        "--color-base-200": "#aabbcc",
        "--color-base-300": "#aabbcc",
      });

      const fakeCtx = createFakeCanvasContext(r, g, b);
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtx as unknown as CanvasRenderingContext2D,
      );

      return renderHook(() => useChartColors());
    }

    it("uses rgb() format for full-opacity colors", () => {
      const { result } = renderWithColor(100, 150, 200);

      expect(result.current.bc100).toBe("rgb(100, 150, 200)");
      expect(result.current.primary).toBe("rgb(100, 150, 200)");
      expect(result.current.b1).toBe("rgb(100, 150, 200)");
      expect(result.current.b2).toBe("rgb(100, 150, 200)");
      expect(result.current.b3).toBe("rgb(100, 150, 200)");
    });

    it("uses rgba() format for partial-opacity colors", () => {
      const { result } = renderWithColor(100, 150, 200);

      // Spot-check a few opacity levels
      expect(result.current.bc50).toBe("rgba(100, 150, 200, 0.5)");
      expect(result.current.bc40).toBe("rgba(100, 150, 200, 0.4)");
      expect(result.current.bc35).toBe("rgba(100, 150, 200, 0.35)");
      expect(result.current.bc30).toBe("rgba(100, 150, 200, 0.3)");
      expect(result.current.bc20).toBe("rgba(100, 150, 200, 0.2)");
      expect(result.current.bc15).toBe("rgba(100, 150, 200, 0.15)");
      expect(result.current.bc12).toBe("rgba(100, 150, 200, 0.12)");
      expect(result.current.bc10).toBe("rgba(100, 150, 200, 0.1)");
      expect(result.current.bc08).toBe("rgba(100, 150, 200, 0.08)");
      expect(result.current.bc07).toBe("rgba(100, 150, 200, 0.07)");
      expect(result.current.bc06).toBe("rgba(100, 150, 200, 0.06)");
      expect(result.current.bc05).toBe("rgba(100, 150, 200, 0.05)");
    });

    it("uses rgba() for primary opacity variants", () => {
      const { result } = renderWithColor(255, 0, 128);

      expect(result.current.primary).toBe("rgb(255, 0, 128)");
      expect(result.current.primary60).toBe("rgba(255, 0, 128, 0.6)");
      expect(result.current.primary30).toBe("rgba(255, 0, 128, 0.3)");
      expect(result.current.primary15).toBe("rgba(255, 0, 128, 0.15)");
      expect(result.current.primary08).toBe("rgba(255, 0, 128, 0.08)");
      expect(result.current.primary02).toBe("rgba(255, 0, 128, 0.02)");
    });

    it("handles zero-value RGB components", () => {
      const { result } = renderWithColor(0, 0, 0);

      expect(result.current.bc100).toBe("rgb(0, 0, 0)");
      expect(result.current.bc50).toBe("rgba(0, 0, 0, 0.5)");
    });

    it("handles max-value RGB components", () => {
      const { result } = renderWithColor(255, 255, 255);

      expect(result.current.bc100).toBe("rgb(255, 255, 255)");
      expect(result.current.bc50).toBe("rgba(255, 255, 255, 0.5)");
    });
  });

  // ─── 6. MutationObserver theme change ─────────────────────────────────

  describe("MutationObserver theme change", () => {
    it("sets up a MutationObserver on document.documentElement", () => {
      mockComputedStyle({});
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

      renderHook(() => useChartColors());

      expect(observeCallbacks).toHaveLength(1);
      expect(mockObserve).toHaveBeenCalledTimes(1);
      expect(mockObserve).toHaveBeenCalledWith(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    });

    it("refreshes colors when MutationObserver fires", () => {
      // Start with one set of colors
      const fakeCtxInitial = createFakeCanvasContext(10, 20, 30);
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtxInitial as unknown as CanvasRenderingContext2D,
      );

      mockComputedStyle({
        "--color-base-content": "#aaa",
        "--color-primary": "#bbb",
        "--color-base-100": "#ccc",
        "--color-base-200": "#ddd",
        "--color-base-300": "#eee",
      });

      const { result } = renderHook(() => useChartColors());

      // Initial colors
      expect(result.current.bc100).toBe("rgb(10, 20, 30)");
      expect(result.current.primary).toBe("rgb(10, 20, 30)");

      // Now switch the "theme" — update mock to return different pixel data
      const fakeCtxUpdated = createFakeCanvasContext(200, 100, 50);
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtxUpdated as unknown as CanvasRenderingContext2D,
      );

      mockComputedStyle({
        "--color-base-content": "#fff",
        "--color-primary": "#eee",
        "--color-base-100": "#ddd",
        "--color-base-200": "#ccc",
        "--color-base-300": "#bbb",
      });

      // Trigger the MutationObserver callback
      act(() => {
        for (const cb of observeCallbacks) {
          cb([], {} as MutationObserver);
        }
      });

      // Colors should have refreshed
      expect(result.current.bc100).toBe("rgb(200, 100, 50)");
      expect(result.current.primary).toBe("rgb(200, 100, 50)");
      expect(result.current.b1).toBe("rgb(200, 100, 50)");
    });

    it("reflects different base-content and primary after theme change", () => {
      // Initial: base-content resolves to red, primary to green
      const colorMap: Record<string, [number, number, number]> = {
        red: [255, 0, 0],
        green: [0, 128, 0],
      };

      const fakeCtx = {
        clearRect: vi.fn(),
        fillStyle: "",
        fillRect: vi.fn(),
        getImageData: vi.fn().mockImplementation(() => {
          const rgb = colorMap[fakeCtx.fillStyle] ?? [128, 128, 128];
          return {
            data: new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255]),
          };
        }),
      };

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        fakeCtx as unknown as CanvasRenderingContext2D,
      );

      mockComputedStyle({
        "--color-base-content": "red",
        "--color-primary": "green",
        "--color-base-100": "red",
        "--color-base-200": "red",
        "--color-base-300": "green",
      });

      const { result } = renderHook(() => useChartColors());

      expect(result.current.bc100).toBe("rgb(255, 0, 0)");
      expect(result.current.primary).toBe("rgb(0, 128, 0)");

      // After theme change: swap colors
      colorMap.blue = [0, 0, 255];
      colorMap.yellow = [255, 255, 0];

      mockComputedStyle({
        "--color-base-content": "blue",
        "--color-primary": "yellow",
        "--color-base-100": "blue",
        "--color-base-200": "blue",
        "--color-base-300": "yellow",
      });

      act(() => {
        for (const cb of observeCallbacks) {
          cb([], {} as MutationObserver);
        }
      });

      expect(result.current.bc100).toBe("rgb(0, 0, 255)");
      expect(result.current.primary).toBe("rgb(255, 255, 0)");
    });
  });

  // ─── 7. Fallback when canvas throws (catch block) ────────────────────

  describe("fallback when canvas context throws", () => {
    it("falls back to white rgb(255, 255, 255) when getImageData throws", () => {
      mockComputedStyle({
        "--color-base-content": "#1a2b3c",
        "--color-primary": "#ff6600",
        "--color-base-100": "#ffffff",
        "--color-base-200": "#f0f0f0",
        "--color-base-300": "#e0e0e0",
      });

      // Make getContext return a context whose getImageData throws
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        clearRect: vi.fn(),
        fillStyle: "",
        fillRect: vi.fn(),
        getImageData: () => {
          throw new Error("SecurityError");
        },
      } as any);

      const { result } = renderHook(() => useChartColors());

      expect(result.current.bc100).toBe("rgb(255, 255, 255)");
      expect(result.current.primary).toBe("rgb(255, 255, 255)");
      expect(result.current.bc50).toBe("rgba(255, 255, 255, 0.5)");
    });
  });

  // ─── 8. Cleanup on unmount ────────────────────────────────────────────

  describe("cleanup on unmount", () => {
    it("calls MutationObserver.disconnect on unmount", () => {
      mockComputedStyle({});
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

      const { unmount } = renderHook(() => useChartColors());

      expect(mockDisconnect).not.toHaveBeenCalled();

      unmount();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("does not refresh colors after unmount", () => {
      mockComputedStyle({});
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

      const { result, unmount } = renderHook(() => useChartColors());

      const colorsBeforeUnmount = result.current;

      unmount();

      // Even if we trigger the observer callback after unmount, it should
      // not throw or change state (disconnect should prevent it)
      expect(() => {
        act(() => {
          for (const cb of observeCallbacks) {
            cb([], {} as MutationObserver);
          }
        });
      }).not.toThrow();

      // Result should still reflect the last rendered value
      expect(result.current).toBe(colorsBeforeUnmount);
    });
  });
});
