import { useEffect, useRef, useSyncExternalStore } from "react";

import type { AggregatedTimeline } from "~/types/data-stores";

import { timelineBuffer } from "../timeline-buffer/timeline-buffer";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UseTimelineBufferParams {
  /** Timeline data for historical sessions. Seeds the buffer on mount. */
  timeline?: AggregatedTimeline | null;
  /** Stacked deck cost in chaos — synced to the buffer. */
  deckCost: number;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages the timeline buffer lifecycle:
 *
 * 1. **Historical seeding** — when a `timeline` prop is provided (e.g. from
 *    SessionDetailsPage), saves the current live buffer, seeds the buffer
 *    with historical data, and restores on unmount.
 * 2. **Deck cost sync** — keeps `timelineBuffer.deckCost` in sync with the
 *    current session or prop value.
 * 3. **Buffer version** — exposes a reactive counter via `useSyncExternalStore`
 *    so React re-renders when the buffer data changes.
 *
 * @returns `bufferVersion` — a number that changes whenever the buffer is
 *   updated. Use this as a dependency or guard for rendering.
 */
export function useTimelineBuffer({
  timeline: timelineProp,
  deckCost,
}: UseTimelineBufferParams): number {
  // ── Seed buffer from timeline prop (historical sessions) ──────────────
  const seededTimelineRef = useRef<AggregatedTimeline | null>(null);
  useEffect(() => {
    if (timelineProp && timelineProp !== seededTimelineRef.current) {
      // Save the live session buffer before overwriting with historical data
      timelineBuffer.save();
      seededTimelineRef.current = timelineProp;
      timelineBuffer.seedFromTimeline(timelineProp);
    }
    return () => {
      if (seededTimelineRef.current) {
        // Restore the live session buffer instead of resetting
        timelineBuffer.restore();
        seededTimelineRef.current = null;
      }
    };
  }, [timelineProp]);

  // ── Sync deck cost to buffer ──────────────────────────────────────────
  useEffect(() => {
    timelineBuffer.setDeckCost(deckCost);
  }, [deckCost]);

  // ── Track buffer version so React re-renders when data arrives ────────
  const bufferVersion = useSyncExternalStore(
    (cb) => timelineBuffer.subscribe(cb),
    () => timelineBuffer.totalDrops + timelineBuffer.chartData.length,
  );

  return bufferVersion;
}
