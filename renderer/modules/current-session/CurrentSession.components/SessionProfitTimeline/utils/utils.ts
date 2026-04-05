import type { AggregatedTimeline } from "~/types/data-stores";

import type { LinePoint } from "../types/types";

/**
 * Build the profit line points from bucket data.
 *
 * These are NOT chart data points — they're used purely to render a
 * custom SVG / canvas path for the profit line shape.
 *
 * The line passes smoothly through bucket boundaries only (origin +
 * one point per bucket at its cumulative drop count / chaos value).
 * Notable drops are shown as bars on the chart but do NOT add extra
 * spike points to the line, keeping the profit curve smooth.
 *
 * @param timeline - The aggregated timeline from the backend
 * @param deckCost - Cost per stacked deck in chaos (0 = show net profit)
 */
export function buildLinePoints(
  timeline: AggregatedTimeline,
  deckCost: number,
): LinePoint[] {
  if (timeline.buckets.length === 0) return [];

  const net = (chaos: number, drops: number) =>
    deckCost > 0 ? chaos - drops * deckCost : chaos;

  // Collect all points keyed by X to deduplicate.
  const pointMap = new Map<number, number>();

  // Origin
  pointMap.set(0, net(0, 0));

  // Bucket boundaries — accurate cumulative values at the end of each
  // 1-minute bucket.
  let cumDrops = 0;
  for (const b of timeline.buckets) {
    cumDrops += b.dropCount;
    pointMap.set(cumDrops, net(b.cumulativeChaosValue, cumDrops));
  }

  // Sort by X and return
  return Array.from(pointMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([x, profit]) => ({ x, profit }));
}
