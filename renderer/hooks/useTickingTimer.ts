import { useEffect, useRef, useState } from "react";

export type TickDirection = "up" | "down";

export interface TickingTimerOptions {
  /**
   * The reference timestamp.
   * - For "up": the start time (timer counts from this time to now).
   * - For "down": the target time (timer counts from now to this time).
   *
   * Pass `null` to disable the timer.
   */
  referenceTime: string | Date | null;

  /** "up" counts elapsed time since referenceTime; "down" counts remaining time until referenceTime. */
  direction: TickDirection;

  /** Whether the timer is active. Defaults to `true`. When `false`, the timer pauses and resets to zero. */
  enabled?: boolean;
}

export interface TickingTimerResult {
  /** Whole hours component of the duration. */
  hours: number;
  /** Whole minutes component (0–59). */
  minutes: number;
  /** Whole seconds component (0–59). */
  seconds: number;
  /** Total duration in milliseconds (always ≥ 0). */
  totalMs: number;
  /**
   * For "down" timers: `true` once the countdown has reached zero.
   * For "up" timers: always `false`.
   */
  isComplete: boolean;
}

const ZERO: TickingTimerResult = {
  hours: 0,
  minutes: 0,
  seconds: 0,
  totalMs: 0,
  isComplete: false,
};

const computeResult = (
  referenceTime: Date,
  direction: TickDirection,
): TickingTimerResult => {
  const now = Date.now();
  const ref = referenceTime.getTime();

  let diffMs: number;
  if (direction === "up") {
    diffMs = Math.max(0, now - ref);
  } else {
    diffMs = Math.max(0, ref - now);
  }

  // For countdown display we ceil to avoid showing "0s" while there's still
  // sub-second time remaining; for count-up we floor for conventional elapsed display.
  const totalSeconds =
    direction === "down" ? Math.ceil(diffMs / 1000) : Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    totalMs: diffMs,
    isComplete: direction === "down" && diffMs <= 0,
  };
};

/**
 * A generic ticking-timer hook that fires every second and returns an
 * `{ hours, minutes, seconds, totalMs, isComplete }` result.
 *
 * Use `direction: "up"` for elapsed-time counters (e.g. session duration)
 * and `direction: "down"` for countdowns (e.g. cooldown timers).
 *
 * The timer automatically stops ticking when the countdown reaches zero
 * or when `enabled` is set to `false`.
 */
export const useTickingTimer = ({
  referenceTime,
  direction,
  enabled = true,
}: TickingTimerOptions): TickingTimerResult => {
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const resolvedRef = referenceTime !== null ? new Date(referenceTime) : null;

  const [result, setResult] = useState<TickingTimerResult>(() => {
    if (!enabled || !resolvedRef) return ZERO;
    return computeResult(resolvedRef, direction);
  });

  useEffect(() => {
    // Clean up any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }

    if (!enabled || !referenceTime) {
      setResult(ZERO);
      return;
    }

    const ref = new Date(referenceTime);

    const tick = () => {
      const next = computeResult(ref, direction);
      setResult(next);

      // Stop ticking once a countdown completes
      if (next.isComplete && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };

    tick(); // run immediately
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [referenceTime, direction, enabled]);

  return result;
};
