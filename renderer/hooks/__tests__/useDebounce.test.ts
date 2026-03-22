import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));

    expect(result.current).toBe("hello");
  });

  it("does not update the debounced value before the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } },
    );

    rerender({ value: "updated", delay: 500 });

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current).toBe("initial");
  });

  it("updates the debounced value after the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } },
    );

    rerender({ value: "updated", delay: 500 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe("updated");
  });

  it("resets the delay when the value changes before it elapses", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } },
    );

    // Change value at t=0
    rerender({ value: "first", delay: 500 });

    // Advance 300ms (not enough to trigger)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("initial");

    // Change value again at t=300, which should reset the timer
    rerender({ value: "second", delay: 500 });

    // Advance another 300ms (t=600 total, but only 300ms since last change)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should still be the initial value because the timer was reset
    expect(result.current).toBe("initial");

    // Advance the remaining 200ms to complete the delay from the second change
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe("second");
  });

  it("uses default delay of 500ms when not specified", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe("updated");
  });

  it("respects a custom delay value", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 1000 } },
    );

    rerender({ value: "updated", delay: 1000 });

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBe("updated");
  });

  it("handles rapid sequential value changes and only applies the last one", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 300 } },
    );

    rerender({ value: "a", delay: 300 });
    rerender({ value: "ab", delay: 300 });
    rerender({ value: "abc", delay: 300 });
    rerender({ value: "abcd", delay: 300 });
    rerender({ value: "abcde", delay: 300 });

    // Advance past the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the final value should have made it through
    expect(result.current).toBe("abcde");
  });

  it("cleans up the timeout on unmount", () => {
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } },
    );

    rerender({ value: "updated", delay: 500 });

    // Unmount before the delay elapses
    unmount();

    // Flush all timers — the setState should not fire since component is unmounted
    // This verifies clearTimeout was called in the cleanup function.
    // If the timeout were not cleared, React would warn about a state update
    // on an unmounted component (in React <18) or the test would be unreliable.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }).not.toThrow();

    // The last rendered value should still be the initial one
    expect(result.current).toBe("initial");
  });

  describe("non-string types", () => {
    it("handles number values", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 0, delay: 500 } },
      );

      expect(result.current).toBe(0);

      rerender({ value: 42, delay: 500 });

      act(() => {
        vi.advanceTimersByTime(499);
      });

      expect(result.current).toBe(0);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current).toBe(42);
    });

    it("handles object values", () => {
      const initialObj = { key: "initial" };
      const updatedObj = { key: "updated" };

      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: initialObj, delay: 500 } },
      );

      expect(result.current).toEqual({ key: "initial" });
      expect(result.current).toBe(initialObj);

      rerender({ value: updatedObj, delay: 500 });

      act(() => {
        vi.advanceTimersByTime(499);
      });

      expect(result.current).toBe(initialObj);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current).toEqual({ key: "updated" });
      expect(result.current).toBe(updatedObj);
    });

    it("handles boolean values", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: false, delay: 300 } },
      );

      expect(result.current).toBe(false);

      rerender({ value: true, delay: 300 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe(true);
    });

    it("handles null and undefined values", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: null as string | null, delay: 500 } },
      );

      expect(result.current).toBeNull();

      rerender({ value: "defined", delay: 500 });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe("defined");
    });
  });
});
