import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollZoom } from "./useScrollZoom";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("../../canvas-chart-utils/canvas-chart-utils", () => ({
  MIN_ZOOM_WINDOW: 5,
  ZOOM_STEP: 3,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createRefs(overrides?: {
  container?: HTMLDivElement | null;
  dataLength?: number;
  brushStart?: number;
  brushEnd?: number;
  onBrushChange?: (range: { startIndex: number; endIndex: number }) => void;
}) {
  const container = overrides?.container ?? document.createElement("div");
  const dataLength = overrides?.dataLength ?? 50;
  const brushStart = overrides?.brushStart ?? 10;
  const brushEnd = overrides?.brushEnd ?? 30;
  const onBrushChange = overrides?.onBrushChange ?? vi.fn();

  const containerRef = { current: container };
  const chartDataRef = { current: { length: dataLength } };
  const brushRangeRef = {
    current: { startIndex: brushStart, endIndex: brushEnd },
  };
  const onBrushChangeRef = { current: onBrushChange };

  return {
    containerRef,
    chartDataRef,
    brushRangeRef,
    onBrushChangeRef,
    onBrushChange,
  };
}

function fireWheel(el: HTMLDivElement, deltaY: number) {
  const event = new WheelEvent("wheel", {
    deltaY,
    bubbles: true,
    cancelable: true,
  });
  vi.spyOn(event, "preventDefault");
  el.dispatchEvent(event);
  return event;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("useScrollZoom", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when containerRef is null", () => {
    const { chartDataRef, brushRangeRef, onBrushChangeRef } = createRefs();
    const containerRef = { current: null };

    expect(() => {
      renderHook(() =>
        useScrollZoom(
          containerRef,
          chartDataRef,
          brushRangeRef,
          onBrushChangeRef,
        ),
      );
    }).not.toThrow();
  });

  it("attaches a wheel listener to the container element", () => {
    const container = document.createElement("div");
    const addSpy = vi.spyOn(container, "addEventListener");
    const refs = createRefs({ container });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    expect(addSpy).toHaveBeenCalledWith("wheel", expect.any(Function), {
      passive: false,
    });
  });

  it("zooms out (expands range) on scroll down (deltaY > 0)", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // dataLength=50 → maxEnd=49, start=10, end=30, window=20
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 30,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, 100);
    });

    // ZOOM_STEP=3 → newStart = max(0, 10-3) = 7, newEnd = min(49, 30+3) = 33
    expect(onBrushChange).toHaveBeenCalledWith({ startIndex: 7, endIndex: 33 });
  });

  it("zooms in (shrinks range) on scroll up (deltaY < 0)", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // dataLength=50 → maxEnd=49, start=10, end=30, window=20
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 30,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, -100);
    });

    // window=20 > MIN_ZOOM_WINDOW=5
    // shrink = min(ZOOM_STEP=3, floor((20-5)/2)=7) = 3
    // newStart = min(10+3, 49) = 13, newEnd = max(30-3, 0) = 27
    expect(onBrushChange).toHaveBeenCalledWith({
      startIndex: 13,
      endIndex: 27,
    });
  });

  it("does not zoom in when current window is already at MIN_ZOOM_WINDOW", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // window = 15 - 10 = 5 = MIN_ZOOM_WINDOW
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 15,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, -100);
    });

    expect(onBrushChange).not.toHaveBeenCalled();
  });

  it("does not zoom out when already at the full data range", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // Already spans the entire range: start=0, end=49 (maxEnd=49)
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 0,
      brushEnd: 49,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, 100);
    });

    // newStart = max(0, 0-3) = 0, newEnd = min(49, 49+3) = 49
    // Both unchanged → early return
    expect(onBrushChange).not.toHaveBeenCalled();
  });

  it("calls preventDefault on wheel events that trigger zoom", () => {
    const container = document.createElement("div");
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 30,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    let event: WheelEvent;
    act(() => {
      event = fireWheel(container, 100);
    });

    expect(event!.preventDefault).toHaveBeenCalled();
  });

  it("does nothing when deltaY is nearly zero (|deltaY| < 1)", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 30,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, 0.5);
    });

    expect(onBrushChange).not.toHaveBeenCalled();
  });

  it("does nothing when deltaY is exactly zero", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 30,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, 0);
    });

    expect(onBrushChange).not.toHaveBeenCalled();
  });

  it("does nothing when data length is less than or equal to MIN_ZOOM_WINDOW", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // dataLength=5 = MIN_ZOOM_WINDOW → early return
    const refs = createRefs({
      container,
      dataLength: 5,
      brushStart: 0,
      brushEnd: 4,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, 100);
    });

    expect(onBrushChange).not.toHaveBeenCalled();
  });

  it("cleans up the wheel listener on unmount", () => {
    const container = document.createElement("div");
    const removeSpy = vi.spyOn(container, "removeEventListener");
    const refs = createRefs({ container });

    const { unmount } = renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("wheel", expect.any(Function));
  });

  it("clamps zoom-out start to 0 when near the beginning of the data", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // start=1, end=30 → newStart = max(0, 1-3) = 0, newEnd = min(49, 30+3) = 33
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 1,
      brushEnd: 30,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, 100);
    });

    expect(onBrushChange).toHaveBeenCalledWith({ startIndex: 0, endIndex: 33 });
  });

  it("clamps zoom-out end to maxEnd when near the end of the data", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // dataLength=50 → maxEnd=49, start=10, end=48 → newEnd = min(49, 48+3) = 49
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 48,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, 100);
    });

    expect(onBrushChange).toHaveBeenCalledWith({ startIndex: 7, endIndex: 49 });
  });

  it("limits zoom-in shrink to avoid going below MIN_ZOOM_WINDOW", () => {
    const container = document.createElement("div");
    const onBrushChange = vi.fn();
    // window = 17-10 = 7, shrink = min(3, floor((7-5)/2)=1) = 1
    const refs = createRefs({
      container,
      dataLength: 50,
      brushStart: 10,
      brushEnd: 17,
      onBrushChange,
    });

    renderHook(() =>
      useScrollZoom(
        refs.containerRef,
        refs.chartDataRef,
        refs.brushRangeRef,
        refs.onBrushChangeRef,
      ),
    );

    act(() => {
      fireWheel(container, -100);
    });

    expect(onBrushChange).toHaveBeenCalledWith({
      startIndex: 11,
      endIndex: 16,
    });
  });
});
