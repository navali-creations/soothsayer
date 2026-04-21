import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatTickingTimer, useTickingTimer } from "./useTickingTimer";

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

  describe("formatTickingTimer", () => {
    it("formats timers with hours", () => {
      expect(formatTickingTimer({ hours: 5, minutes: 9, seconds: 4 })).toBe(
        "5h 09m 04s",
      );
    });

    it("formats timers without hours", () => {
      expect(formatTickingTimer({ hours: 0, minutes: 12, seconds: 5 })).toBe(
        "12m 05s",
      );
    });
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

  it("clears interval when enabled changes from true to false", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const now = Date.now();
    const referenceTime = new Date(now - 10_000).toISOString();

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useTickingTimer({ referenceTime, direction: "up", enabled }),
      { initialProps: { enabled: true } },
    );

    // An interval should be running now
    clearIntervalSpy.mockClear();

    rerender({ enabled: false });

    // The effect cleanup should have called clearInterval and set intervalRef to undefined
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

  it("cleans up old interval when referenceTime changes while enabled", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const now = Date.now();
    const ref1 = new Date(now - 10_000).toISOString();
    const ref2 = new Date(now - 20_000).toISOString();

    const { result, rerender } = renderHook(
      ({ referenceTime }: { referenceTime: string }) =>
        useTickingTimer({ referenceTime, direction: "up", enabled: true }),
      { initialProps: { referenceTime: ref1 } },
    );

    expect(result.current.seconds).toBe(10);

    clearIntervalSpy.mockClear();

    // Change referenceTime while still enabled — should clear old interval
    rerender({ referenceTime: ref2 });

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(result.current.seconds).toBe(20);

    clearIntervalSpy.mockRestore();
  });

  it("cleans up old interval and creates new one when referenceTime changes (verifies ticking)", () => {
    const now = Date.now();
    const ref1 = new Date(now - 10_000).toISOString();
    const ref2 = new Date(now - 20_000).toISOString();

    const { result, rerender } = renderHook(
      ({ referenceTime }: { referenceTime: string }) =>
        useTickingTimer({ referenceTime, direction: "up", enabled: true }),
      { initialProps: { referenceTime: ref1 } },
    );

    expect(result.current.seconds).toBe(10);

    // Change referenceTime — triggers effect cleanup (lines 124-125) then re-setup
    rerender({ referenceTime: ref2 });

    expect(result.current.seconds).toBe(20);

    // Verify the NEW interval is ticking correctly (old one was cleaned up)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.seconds).toBe(21);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.seconds).toBe(22);
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
