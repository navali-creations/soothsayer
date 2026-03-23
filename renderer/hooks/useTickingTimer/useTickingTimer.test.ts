import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTickingTimer } from "./useTickingTimer";

const ZERO = {
  hours: 0,
  minutes: 0,
  seconds: 0,
  totalMs: 0,
  isComplete: false,
};

describe("useTickingTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ZERO when enabled is false", () => {
    const referenceTime = new Date(Date.now() - 60_000).toISOString();
    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "up", enabled: false }),
    );
    expect(result.current).toEqual(ZERO);
  });

  it("returns ZERO when referenceTime is null", () => {
    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime: null, direction: "up", enabled: true }),
    );
    expect(result.current).toEqual(ZERO);
  });

  it("count-up: shows elapsed time since reference (65 seconds ago)", () => {
    const now = Date.now();
    const referenceTime = new Date(now - 65_000).toISOString();

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "up" }),
    );

    expect(result.current.hours).toBe(0);
    expect(result.current.minutes).toBe(1);
    expect(result.current.seconds).toBe(5);
    expect(result.current.totalMs).toBe(65_000);
    expect(result.current.isComplete).toBe(false);
  });

  it("count-up: increments every second when timer advances", () => {
    const now = Date.now();
    const referenceTime = new Date(now - 10_000).toISOString();

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "up" }),
    );

    expect(result.current.seconds).toBe(10);
    expect(result.current.minutes).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.seconds).toBe(11);
    expect(result.current.totalMs).toBe(11_000);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.seconds).toBe(12);
    expect(result.current.totalMs).toBe(12_000);
  });

  it("count-down: shows remaining time until reference (120 seconds in the future)", () => {
    const now = Date.now();
    const referenceTime = new Date(now + 120_000).toISOString();

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "down" }),
    );

    expect(result.current.hours).toBe(0);
    expect(result.current.minutes).toBe(2);
    expect(result.current.seconds).toBe(0);
    expect(result.current.totalMs).toBe(120_000);
    expect(result.current.isComplete).toBe(false);
  });

  it("count-down: isComplete becomes true when countdown reaches zero", () => {
    const now = Date.now();
    const referenceTime = new Date(now + 2_000).toISOString();

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "down" }),
    );

    expect(result.current.isComplete).toBe(false);
    expect(result.current.seconds).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isComplete).toBe(false);
    expect(result.current.seconds).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.totalMs).toBe(0);
    expect(result.current.hours).toBe(0);
    expect(result.current.minutes).toBe(0);
    expect(result.current.seconds).toBe(0);
  });

  it("count-down: stops ticking after reaching zero (interval is cleared)", () => {
    const now = Date.now();
    const referenceTime = new Date(now + 1_000).toISOString();

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "down" }),
    );

    expect(result.current.isComplete).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isComplete).toBe(true);

    const snapshotAfterComplete = { ...result.current };

    // Advance several more seconds — result should NOT change since the interval was cleared
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toEqual(snapshotAfterComplete);
  });

  it("cleans up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const now = Date.now();
    const referenceTime = new Date(now - 10_000).toISOString();

    const { unmount } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "up" }),
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("resets to ZERO when enabled changes from true to false", () => {
    const now = Date.now();
    const referenceTime = new Date(now - 30_000).toISOString();

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTickingTimer({ referenceTime, direction: "up", enabled }),
      { initialProps: { enabled: true } },
    );

    expect(result.current.seconds).toBe(30);
    expect(result.current.totalMs).toBe(30_000);

    rerender({ enabled: false });

    expect(result.current).toEqual(ZERO);
  });

  it("handles Date objects as referenceTime (not just strings)", () => {
    const now = Date.now();
    const referenceTime = new Date(now - 90_000);

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "up" }),
    );

    expect(result.current.hours).toBe(0);
    expect(result.current.minutes).toBe(1);
    expect(result.current.seconds).toBe(30);
    expect(result.current.totalMs).toBe(90_000);
    expect(result.current.isComplete).toBe(false);
  });

  it("count-up: handles referenceTime in the future (should show 0)", () => {
    const now = Date.now();
    const referenceTime = new Date(now + 60_000).toISOString();

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "up" }),
    );

    expect(result.current).toEqual(ZERO);
  });

  it("count-down: uses Math.ceil for seconds so sub-second remaining time shows 1s not 0s", () => {
    const now = Date.now();
    // Set reference 1500ms in the future — diffMs will be 1500,
    // Math.ceil(1500 / 1000) = 2 total seconds
    const referenceTime = new Date(now + 1500).toISOString();

    const { result } = renderHook(() =>
      useTickingTimer({ referenceTime, direction: "down" }),
    );

    // 1500ms remaining → ceil(1.5) = 2 seconds
    expect(result.current.seconds).toBe(2);
    expect(result.current.totalMs).toBe(1500);
    expect(result.current.isComplete).toBe(false);

    // Advance 1000ms → 500ms remaining → ceil(0.5) = 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.seconds).toBe(1);
    expect(result.current.totalMs).toBe(500);
    expect(result.current.isComplete).toBe(false);

    // Advance 500ms → 0ms remaining → complete
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // The interval fires every 1000ms, so we need to get to the next tick
    // At this point the fake clock has advanced 1500ms total from the start,
    // meaning we are exactly at the reference time. The interval tick at 2000ms
    // will catch this.
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.seconds).toBe(0);
    expect(result.current.totalMs).toBe(0);
  });
});
