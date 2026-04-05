// ─── Timeline Buffer ────────────────────────────────────────────────────────
//
// A mutable data buffer for the Session Profit Timeline chart.
// Sits outside React — the IPC delta listener writes directly to it,
// and the canvas chart reads from it via requestAnimationFrame.
//
// This avoids Immer structural cloning, useMemo cascades, and GC pressure
// that come from routing continuous timeline data through Zustand/React.

import type {
  AggregatedTimeline,
  NotableDrop,
  TimelineBucket,
  TimelineDelta,
} from "~/types/data-stores";

import type { LinePoint, ProfitChartPoint } from "../types/types";

type Listener = () => void;

/**
 * Mutable timeline data buffer for real-time chart rendering.
 *
 * Data flows:
 *   IPC delta → applyDelta() → scheduleNotify() → RAF → canvas draw
 *
 * The buffer owns two pre-computed arrays (chartData, linePoints) that
 * are ready for the canvas draw functions to consume directly.
 * When a delta arrives, we update these arrays incrementally (O(1) amortised)
 * rather than rebuilding from scratch.
 */
class TimelineBuffer {
  // ── Raw timeline data (mutable, never cloned) ─────────────────────────
  buckets: TimelineBucket[] = [];
  notableDrops: NotableDrop[] = [];

  // ── Pre-computed chart-ready arrays ───────────────────────────────────
  /** Chart data points: origin + notable drops + trailing endpoint */
  chartData: ProfitChartPoint[] = [];
  /** Line points: bucket boundaries + notable drop spikes, sorted by X */
  linePoints: LinePoint[] = [];

  // ── Scalars ───────────────────────────────────────────────────────────
  totalDrops = 0;
  totalChaosValue = 0;
  totalDivineValue = 0;

  // ── Config ────────────────────────────────────────────────────────────
  private _deckCost = 0;
  private _version = 0;
  private _hasBars = false;

  // ── Subscriptions ─────────────────────────────────────────────────────
  private _listeners = new Set<Listener>();
  private _rafId: number | null = null;

  // ── Saved state (for save/restore across historical views) ────────────
  private _savedState: {
    buckets: TimelineBucket[];
    notableDrops: NotableDrop[];
    totalDrops: number;
    totalChaosValue: number;
    totalDivineValue: number;
    deckCost: number;
  } | null = null;

  // ── Cumulative drop tracking (for incremental line point updates) ─────
  private _cumDropsByBucket: number[] = []; // cumDrops at end of each bucket

  // ═══════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════

  get deckCost(): number {
    return this._deckCost;
  }

  get version(): number {
    return this._version;
  }

  get hasBars(): boolean {
    return this._hasBars;
  }

  /** Set deck cost. Triggers a full rebuild of chart data if changed. */
  setDeckCost(cost: number): void {
    if (this._deckCost === cost) return;
    this._deckCost = cost;
    this._rebuildAll();
    this._scheduleNotify();
  }

  /**
   * Seed the buffer from a full AggregatedTimeline (e.g. on hydrate / session load).
   * This replaces all existing data and triggers a full rebuild.
   */
  seedFromTimeline(timeline: AggregatedTimeline): void {
    this.buckets = [...timeline.buckets];
    this.notableDrops = [...timeline.notableDrops];
    this.totalDrops = timeline.totalDrops;
    this.totalChaosValue = timeline.totalChaosValue;
    this.totalDivineValue = timeline.totalDivineValue;
    this._rebuildAll();
    this._hasBars = this.chartData.some((p) => p.barValue != null);
    this._scheduleNotify();
  }

  /**
   * Apply a single delta from the main process. This is the hot path —
   * called once per card drop. O(1) amortised.
   */
  applyDelta(delta: TimelineDelta): void {
    // 1. Update or append bucket
    this._upsertBucket(delta.bucket);

    // 2. Update totals
    this.totalDrops = delta.totalDrops;
    this.totalChaosValue = delta.totalChaosValue;
    this.totalDivineValue = delta.totalDivineValue;

    // 3. Append notable drop if present
    if (delta.notableDrop) {
      this.notableDrops.push(delta.notableDrop);
      this._appendNotableToChartData(delta.notableDrop);
    }

    // 4. Update trailing line/chart endpoint
    this._updateTrailingPoints();

    // 5. Schedule canvas redraw via RAF
    this._scheduleNotify();
  }

  /** Reset all data (on session end). */
  reset(): void {
    this.buckets.length = 0;
    this.notableDrops.length = 0;
    this.chartData.length = 0;
    this.linePoints.length = 0;
    this._cumDropsByBucket.length = 0;
    this.totalDrops = 0;
    this.totalChaosValue = 0;
    this.totalDivineValue = 0;
    this._hasBars = false;
    this._version = 0;
    this._savedState = null;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._scheduleNotify();
  }

  /**
   * Subscribe to buffer changes. The callback fires on the next
   * requestAnimationFrame after data changes — already batched if
   * multiple deltas arrive in the same frame.
   */
  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** Save current buffer state before it gets overwritten by historical data. */
  save(): void {
    this._savedState = {
      buckets: this.buckets.map((b) => ({ ...b })),
      notableDrops: this.notableDrops.map((d) => ({ ...d })),
      totalDrops: this.totalDrops,
      totalChaosValue: this.totalChaosValue,
      totalDivineValue: this.totalDivineValue,
      deckCost: this._deckCost,
    };
  }

  /** Restore previously saved buffer state. */
  restore(): void {
    if (!this._savedState) {
      this.reset();
      return;
    }
    this.buckets = this._savedState.buckets;
    this.notableDrops = this._savedState.notableDrops;
    this.totalDrops = this._savedState.totalDrops;
    this.totalChaosValue = this._savedState.totalChaosValue;
    this.totalDivineValue = this._savedState.totalDivineValue;
    this._deckCost = this._savedState.deckCost;
    this._savedState = null;
    this._rebuildAll();
    this._scheduleNotify();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private — incremental updates
  // ═══════════════════════════════════════════════════════════════════════

  private _net(chaos: number, drops: number): number {
    return this._deckCost > 0 ? chaos - drops * this._deckCost : chaos;
  }

  /** Upsert a bucket: update last if same timestamp, otherwise append. */
  private _upsertBucket(bucket: TimelineBucket): void {
    const last =
      this.buckets.length > 0 ? this.buckets[this.buckets.length - 1] : null;

    if (last && last.timestamp === bucket.timestamp) {
      // Update existing bucket in-place
      last.dropCount = bucket.dropCount;
      last.cumulativeChaosValue = bucket.cumulativeChaosValue;
      last.cumulativeDivineValue = bucket.cumulativeDivineValue;
      last.topCard = bucket.topCard;
      last.topCardChaosValue = bucket.topCardChaosValue;

      // Recompute cumDrops for the last entry
      const prevCum =
        this._cumDropsByBucket.length >= 2
          ? this._cumDropsByBucket[this._cumDropsByBucket.length - 2]
          : 0;

      // Track old cumDrops before update
      const oldCumDrops =
        this._cumDropsByBucket[this._cumDropsByBucket.length - 1];
      const newCumDrops = prevCum + bucket.dropCount;
      this._cumDropsByBucket[this._cumDropsByBucket.length - 1] = newCumDrops;

      // Remove stale line point at old X if it changed
      if (oldCumDrops !== newCumDrops) {
        this._removeLinePoint(oldCumDrops);
      }

      // Update the line point for this bucket boundary
      this._upsertLinePoint(
        newCumDrops,
        this._net(bucket.cumulativeChaosValue, newCumDrops),
      );
    } else {
      // New bucket
      this.buckets.push(bucket);
      const prevCum =
        this._cumDropsByBucket.length > 0
          ? this._cumDropsByBucket[this._cumDropsByBucket.length - 1]
          : 0;
      const cumDrops = prevCum + bucket.dropCount;
      this._cumDropsByBucket.push(cumDrops);

      // Add line point for this bucket boundary
      this._insertLinePointSorted(
        cumDrops,
        this._net(bucket.cumulativeChaosValue, cumDrops),
      );
    }
  }

  /** Append a notable drop to chartData (maintains order by x). */
  private _appendNotableToChartData(drop: NotableDrop): void {
    this._hasBars = true;
    const x = drop.cumulativeDropIndex;
    const chaos = this._interpolateChaos(x);
    const profit = this._net(chaos, x);

    const point: ProfitChartPoint = {
      x,
      profit,
      barValue: drop.chaosValue,
      cardName: drop.cardName,
      rarity: drop.rarity,
    };

    // Insert before the trailing endpoint (last point if it has no bar)
    const last =
      this.chartData.length > 0
        ? this.chartData[this.chartData.length - 1]
        : null;
    if (last && last.barValue === null && last.x >= x) {
      // Insert before trailing endpoint
      this.chartData.splice(this.chartData.length - 1, 0, point);
    } else {
      this.chartData.push(point);
    }
  }

  /** Update or replace the trailing endpoint in both chartData and linePoints. */
  private _updateTrailingPoints(): void {
    const total = this.totalDrops;
    const chaos = this.totalChaosValue;
    const profit = this._net(chaos, total);

    // ── chartData trailing endpoint ─────────────────────────────────────
    const lastChart =
      this.chartData.length > 0
        ? this.chartData[this.chartData.length - 1]
        : null;
    if (lastChart && lastChart.barValue === null) {
      // Update trailing endpoint in-place
      lastChart.x = total;
      lastChart.profit = profit;
    } else {
      // Append new trailing endpoint
      this.chartData.push({
        x: total,
        profit,
        barValue: null,
        cardName: null,
        rarity: null,
      });
    }

    // ── linePoints trailing endpoint ────────────────────────────────────
    // The trailing line point is handled by _upsertLinePoint from _upsertBucket.
    // But we may need one at totalDrops if it differs from the last bucket boundary.
    const lastLine =
      this.linePoints.length > 0
        ? this.linePoints[this.linePoints.length - 1]
        : null;
    if (lastLine && lastLine.x === total) {
      lastLine.profit = profit;
    } else if (!lastLine || total > lastLine.x) {
      this.linePoints.push({ x: total, profit });
    }
  }

  /** Upsert a line point at the given X. If X exists, update in-place. */
  private _upsertLinePoint(x: number, profit: number): void {
    // Line points are sorted by X. Check last few entries (most common case).
    for (
      let i = this.linePoints.length - 1;
      i >= 0 && i >= this.linePoints.length - 5;
      i--
    ) {
      if (this.linePoints[i].x === x) {
        this.linePoints[i].profit = profit;
        return;
      }
    }
    // Not found in tail, insert sorted
    this._insertLinePointSorted(x, profit);
  }

  /** Remove a line point at the given X value (if it exists). */
  private _removeLinePoint(x: number): void {
    // Search from the end since removals are typically near the tail
    for (let i = this.linePoints.length - 1; i >= 0; i--) {
      if (this.linePoints[i].x === x) {
        this.linePoints.splice(i, 1);
        return;
      }
      // Since linePoints are sorted by X, stop early if we've gone past
      if (this.linePoints[i].x < x) return;
    }
  }

  /** Insert a line point maintaining sorted order by X. */
  private _insertLinePointSorted(x: number, profit: number): void {
    // Most inserts are at or near the end
    let i = this.linePoints.length;
    while (i > 0 && this.linePoints[i - 1].x > x) {
      i--;
    }
    // Check for duplicate
    if (i > 0 && this.linePoints[i - 1].x === x) {
      this.linePoints[i - 1].profit = profit;
      return;
    }
    this.linePoints.splice(i, 0, { x, profit });
  }

  /** Interpolate cumulative chaos at a given drop count using bucket data. */
  private _interpolateChaos(x: number): number {
    if (this.buckets.length === 0) return 0;

    let prevDrops = 0;
    let prevChaos = 0;

    for (let i = 0; i < this.buckets.length; i++) {
      const cumDrops = this._cumDropsByBucket[i];
      const cumChaos = this.buckets[i].cumulativeChaosValue;

      if (x <= cumDrops) {
        const range = cumDrops - prevDrops;
        if (range === 0) return cumChaos;
        const t = (x - prevDrops) / range;
        return prevChaos + t * (cumChaos - prevChaos);
      }

      prevDrops = cumDrops;
      prevChaos = cumChaos;
    }

    return this.buckets[this.buckets.length - 1].cumulativeChaosValue;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private — full rebuild (only on session start / deck cost change)
  // ═══════════════════════════════════════════════════════════════════════

  private _rebuildAll(): void {
    // Rebuild cumulative drops tracking
    this._cumDropsByBucket.length = 0;
    let cumDrops = 0;
    for (const b of this.buckets) {
      cumDrops += b.dropCount;
      this._cumDropsByBucket.push(cumDrops);
    }

    // Rebuild chartData
    this.chartData.length = 0;

    // Origin
    this.chartData.push({
      x: 0,
      profit: this._net(0, 0),
      barValue: null,
      cardName: null,
      rarity: null,
    });

    // Notable drops
    for (const drop of this.notableDrops) {
      const chaos = this._interpolateChaos(drop.cumulativeDropIndex);
      this.chartData.push({
        x: drop.cumulativeDropIndex,
        profit: this._net(chaos, drop.cumulativeDropIndex),
        barValue: drop.chaosValue,
        cardName: drop.cardName,
        rarity: drop.rarity,
      });
    }

    // Trailing endpoint
    if (this.totalDrops > 0) {
      const lastX =
        this.chartData.length > 0
          ? this.chartData[this.chartData.length - 1].x
          : 0;
      if (this.totalDrops > lastX) {
        this.chartData.push({
          x: this.totalDrops,
          profit: this._net(this.totalChaosValue, this.totalDrops),
          barValue: null,
          cardName: null,
          rarity: null,
        });
      }
    }

    // Rebuild linePoints
    this.linePoints.length = 0;

    // Origin
    this.linePoints.push({ x: 0, profit: this._net(0, 0) });

    // Bucket boundaries
    for (let i = 0; i < this.buckets.length; i++) {
      const cd = this._cumDropsByBucket[i];
      this.linePoints.push({
        x: cd,
        profit: this._net(this.buckets[i].cumulativeChaosValue, cd),
      });
    }

    this.linePoints.sort((a, b) => a.x - b.x);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private — notification
  // ═══════════════════════════════════════════════════════════════════════

  private _scheduleNotify(): void {
    this._version++;
    if (this._rafId !== null) return; // Already scheduled for this frame
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      for (const fn of this._listeners) {
        fn();
      }
    });
  }
}

// ── Module singleton — lives outside React's lifecycle ──────────────────────
export const timelineBuffer = new TimelineBuffer();
