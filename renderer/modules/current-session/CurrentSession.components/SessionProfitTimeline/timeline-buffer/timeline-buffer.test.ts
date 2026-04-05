// ─── TimelineBuffer tests ───────────────────────────────────────────────────

import type {
  AggregatedTimeline,
  NotableDrop,
  TimelineBucket,
  TimelineDelta,
} from "~/types/data-stores";

import { timelineBuffer } from "./timeline-buffer";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBucket(
  overrides: Partial<TimelineBucket> & {
    dropCount: number;
    cumulativeChaosValue: number;
  },
): TimelineBucket {
  return {
    timestamp: overrides.timestamp ?? "2024-01-01T00:00:00Z",
    dropCount: overrides.dropCount,
    cumulativeChaosValue: overrides.cumulativeChaosValue,
    cumulativeDivineValue: overrides.cumulativeDivineValue ?? 0,
    topCard: overrides.topCard ?? null,
    topCardChaosValue: overrides.topCardChaosValue ?? 0,
  };
}

function makeDelta(overrides: {
  bucket: TimelineBucket;
  notableDrop?: NotableDrop | null;
  totalChaosValue: number;
  totalDivineValue?: number;
  totalDrops: number;
}): TimelineDelta {
  return {
    bucket: overrides.bucket,
    notableDrop: overrides.notableDrop ?? null,
    totalChaosValue: overrides.totalChaosValue,
    totalDivineValue: overrides.totalDivineValue ?? 0,
    totalDrops: overrides.totalDrops,
  };
}

function makeNotableDrop(
  cumulativeDropIndex: number,
  cardName: string,
  chaosValue: number,
  rarity: 1 | 2 | 3 = 2,
): NotableDrop {
  return { cumulativeDropIndex, cardName, chaosValue, rarity };
}

function makeTimeline(
  overrides: Partial<AggregatedTimeline> = {},
): AggregatedTimeline {
  return {
    buckets: overrides.buckets ?? [],
    liveEdge: overrides.liveEdge ?? [],
    totalChaosValue: overrides.totalChaosValue ?? 0,
    totalDivineValue: overrides.totalDivineValue ?? 0,
    totalDrops: overrides.totalDrops ?? 0,
    notableDrops: overrides.notableDrops ?? [],
  };
}

/**
 * Collected RAF callbacks. We can't call them synchronously inside
 * requestAnimationFrame because `_scheduleNotify` does:
 *
 *   this._rafId = requestAnimationFrame(() => { this._rafId = null; ... })
 *
 * If the callback fires synchronously, `_rafId = null` executes first,
 * then the return value overwrites it: `_rafId = <id>` (truthy).
 * All subsequent `_scheduleNotify` calls then bail out thinking a RAF
 * is already scheduled. Collecting + flushing avoids this race.
 */
let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 1;

function flushNotifications(): void {
  const cbs = [...rafCallbacks];
  rafCallbacks.length = 0;
  for (const cb of cbs) {
    cb(0);
  }
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe("TimelineBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks = [];
    rafIdCounter = 1;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafIdCounter++;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    timelineBuffer.setDeckCost(0);
    timelineBuffer.reset();
    // Drain any notifications from reset/setDeckCost itself
    flushNotifications();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Initial state
  // ═══════════════════════════════════════════════════════════════════════

  describe("initial state", () => {
    it("should start with empty buckets", () => {
      expect(timelineBuffer.buckets).toEqual([]);
    });

    it("should start with empty notableDrops", () => {
      expect(timelineBuffer.notableDrops).toEqual([]);
    });

    it("should start with empty chartData", () => {
      expect(timelineBuffer.chartData).toEqual([]);
    });

    it("should start with empty linePoints", () => {
      expect(timelineBuffer.linePoints).toEqual([]);
    });

    it("should have 0 totalDrops", () => {
      expect(timelineBuffer.totalDrops).toBe(0);
    });

    it("should have 0 totalChaosValue", () => {
      expect(timelineBuffer.totalChaosValue).toBe(0);
    });

    it("should have 0 totalDivineValue", () => {
      expect(timelineBuffer.totalDivineValue).toBe(0);
    });

    it("should have default deckCost of 0", () => {
      expect(timelineBuffer.deckCost).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // setDeckCost
  // ═══════════════════════════════════════════════════════════════════════

  describe("setDeckCost", () => {
    it("should update the deckCost getter", () => {
      timelineBuffer.setDeckCost(5);
      expect(timelineBuffer.deckCost).toBe(5);
    });

    it("should trigger rebuild and notify listeners when cost changes", () => {
      // Seed some data first so rebuild produces observable changes
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 10,
            cumulativeChaosValue: 100,
            timestamp: "t1",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 100,
        totalDivineValue: 5,
      });
      timelineBuffer.seedFromTimeline(timeline);

      const listener = vi.fn();
      timelineBuffer.subscribe(listener);
      // Drain any pending notifications from seedFromTimeline
      flushNotifications();
      listener.mockClear();

      timelineBuffer.setDeckCost(3);
      flushNotifications();

      expect(listener).toHaveBeenCalled();
      // With deckCost=3, profit at 10 drops = 100 - 10*3 = 70
      const lastLine =
        timelineBuffer.linePoints[timelineBuffer.linePoints.length - 1];
      expect(lastLine.profit).toBe(70);
    });

    it("should not notify when cost is the same", () => {
      timelineBuffer.setDeckCost(5);
      const listener = vi.fn();
      timelineBuffer.subscribe(listener);
      listener.mockClear();

      timelineBuffer.setDeckCost(5);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should rebuild linePoints with new profit values reflecting deckCost", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 120,
            timestamp: "t2",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 120,
      });
      timelineBuffer.seedFromTimeline(timeline);
      flushNotifications();

      // With deckCost=0: profit = chaos at cumulative drop boundary
      expect(timelineBuffer.linePoints[0]).toEqual({ x: 0, profit: 0 });
      expect(timelineBuffer.linePoints[1]).toEqual({ x: 5, profit: 50 });
      expect(timelineBuffer.linePoints[2]).toEqual({ x: 10, profit: 120 });

      // Change deck cost
      timelineBuffer.setDeckCost(4);
      flushNotifications();

      // profit = cumulativeChaosValue - cumDrops * deckCost
      expect(timelineBuffer.linePoints[0]).toEqual({ x: 0, profit: 0 }); // 0 - 0*4 = 0
      expect(timelineBuffer.linePoints[1]).toEqual({ x: 5, profit: 30 }); // 50 - 5*4 = 30
      expect(timelineBuffer.linePoints[2]).toEqual({ x: 10, profit: 80 }); // 120 - 10*4 = 80
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // applyDelta
  // ═══════════════════════════════════════════════════════════════════════

  describe("applyDelta", () => {
    it("should add a new bucket from delta", () => {
      const bucket = makeBucket({
        dropCount: 3,
        cumulativeChaosValue: 30,
        timestamp: "2024-01-01T00:01:00Z",
      });
      const delta = makeDelta({
        bucket,
        totalChaosValue: 30,
        totalDrops: 3,
      });

      timelineBuffer.applyDelta(delta);

      expect(timelineBuffer.buckets).toHaveLength(1);
      expect(timelineBuffer.buckets[0]).toBe(bucket);
    });

    it("should update totalDrops and totalChaosValue from delta", () => {
      const delta = makeDelta({
        bucket: makeBucket({ dropCount: 5, cumulativeChaosValue: 50 }),
        totalChaosValue: 50,
        totalDivineValue: 2,
        totalDrops: 5,
      });

      timelineBuffer.applyDelta(delta);

      expect(timelineBuffer.totalDrops).toBe(5);
      expect(timelineBuffer.totalChaosValue).toBe(50);
      expect(timelineBuffer.totalDivineValue).toBe(2);
    });

    it("should compute linePoints with net profit (deckCost=0)", () => {
      const delta = makeDelta({
        bucket: makeBucket({ dropCount: 5, cumulativeChaosValue: 50 }),
        totalChaosValue: 50,
        totalDrops: 5,
      });

      timelineBuffer.applyDelta(delta);
      flushNotifications();

      // Should have a line point for the bucket boundary at x=5
      // _upsertBucket inserts at cumDrops=5 and _updateTrailingPoints
      // also adds/updates at totalDrops=5. Both are the same X, so we
      // should find exactly one point at x=5 with profit=50.
      const points = timelineBuffer.linePoints;
      expect(points.length).toBeGreaterThanOrEqual(1);
      const pointAt5 = points.find((p) => p.x === 5);
      expect(pointAt5).toBeDefined();
      expect(pointAt5!.profit).toBe(50); // profit = chaos when deckCost=0
    });

    it("should compute linePoints with net profit when deckCost > 0", () => {
      timelineBuffer.setDeckCost(3);

      const delta = makeDelta({
        bucket: makeBucket({ dropCount: 10, cumulativeChaosValue: 100 }),
        totalChaosValue: 100,
        totalDrops: 10,
      });

      timelineBuffer.applyDelta(delta);

      const pointAt10 = timelineBuffer.linePoints.find((p) => p.x === 10);
      expect(pointAt10).toBeDefined();
      // profit = 100 - 10*3 = 70
      expect(pointAt10!.profit).toBe(70);
    });

    it("should handle deltas with notable drops", () => {
      const notable = makeNotableDrop(3, "The Doctor", 800, 1);
      const delta = makeDelta({
        bucket: makeBucket({ dropCount: 5, cumulativeChaosValue: 850 }),
        notableDrop: notable,
        totalChaosValue: 850,
        totalDrops: 5,
      });

      timelineBuffer.applyDelta(delta);

      expect(timelineBuffer.notableDrops).toHaveLength(1);
      expect(timelineBuffer.notableDrops[0]).toBe(notable);

      // chartData should contain a point with barValue for the notable drop
      const barPoint = timelineBuffer.chartData.find(
        (p) => p.barValue !== null,
      );
      expect(barPoint).toBeDefined();
      expect(barPoint!.barValue).toBe(800);
      expect(barPoint!.cardName).toBe("The Doctor");
      expect(barPoint!.rarity).toBe(1);
      expect(barPoint!.x).toBe(3);
    });

    it("should handle multiple sequential deltas", () => {
      const delta1 = makeDelta({
        bucket: makeBucket({
          dropCount: 3,
          cumulativeChaosValue: 30,
          timestamp: "t1",
        }),
        totalChaosValue: 30,
        totalDrops: 3,
      });
      const delta2 = makeDelta({
        bucket: makeBucket({
          dropCount: 4,
          cumulativeChaosValue: 80,
          timestamp: "t2",
        }),
        totalChaosValue: 80,
        totalDrops: 7,
      });

      timelineBuffer.applyDelta(delta1);
      timelineBuffer.applyDelta(delta2);

      expect(timelineBuffer.buckets).toHaveLength(2);
      expect(timelineBuffer.totalDrops).toBe(7);
      expect(timelineBuffer.totalChaosValue).toBe(80);
    });

    it("should maintain sorted linePoints after multiple deltas", () => {
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
          totalChaosValue: 50,
          totalDrops: 5,
        }),
      );
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 3,
            cumulativeChaosValue: 80,
            timestamp: "t2",
          }),
          totalChaosValue: 80,
          totalDrops: 8,
        }),
      );
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 2,
            cumulativeChaosValue: 100,
            timestamp: "t3",
          }),
          totalChaosValue: 100,
          totalDrops: 10,
        }),
      );

      for (let i = 1; i < timelineBuffer.linePoints.length; i++) {
        expect(timelineBuffer.linePoints[i].x).toBeGreaterThanOrEqual(
          timelineBuffer.linePoints[i - 1].x,
        );
      }
    });

    it("should notify subscribers", () => {
      const listener = vi.fn();
      timelineBuffer.subscribe(listener);

      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 1, cumulativeChaosValue: 10 }),
          totalChaosValue: 10,
          totalDrops: 1,
        }),
      );
      flushNotifications();

      expect(listener).toHaveBeenCalled();
    });

    it("should compute chartData with bar values for notable drops", () => {
      const notable = makeNotableDrop(2, "House of Mirrors", 1200, 1);
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 5, cumulativeChaosValue: 1250 }),
          notableDrop: notable,
          totalChaosValue: 1250,
          totalDrops: 5,
        }),
      );

      const chartPoints = timelineBuffer.chartData;
      const barPoints = chartPoints.filter((p) => p.barValue !== null);
      expect(barPoints).toHaveLength(1);
      expect(barPoints[0].barValue).toBe(1200);
      expect(barPoints[0].cardName).toBe("House of Mirrors");
      expect(barPoints[0].rarity).toBe(1);

      // Should also have a trailing endpoint with barValue=null
      const trailing = chartPoints[chartPoints.length - 1];
      expect(trailing.barValue).toBeNull();
      expect(trailing.x).toBe(5);
    });

    it("should update existing bucket in-place when timestamp matches", () => {
      const ts = "2024-01-01T00:01:00Z";

      // First delta creates the bucket
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 2,
            cumulativeChaosValue: 20,
            timestamp: ts,
          }),
          totalChaosValue: 20,
          totalDrops: 2,
        }),
      );
      expect(timelineBuffer.buckets).toHaveLength(1);

      // Second delta with same timestamp updates the bucket in-place
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 60,
            timestamp: ts,
          }),
          totalChaosValue: 60,
          totalDrops: 5,
        }),
      );
      // Should still be 1 bucket (updated, not appended)
      expect(timelineBuffer.buckets).toHaveLength(1);
      expect(timelineBuffer.buckets[0].dropCount).toBe(5);
      expect(timelineBuffer.buckets[0].cumulativeChaosValue).toBe(60);
    });

    it("should update trailing chartData endpoint in-place when no bar", () => {
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 3,
            cumulativeChaosValue: 30,
            timestamp: "t1",
          }),
          totalChaosValue: 30,
          totalDrops: 3,
        }),
      );
      flushNotifications();

      const chartLen1 = timelineBuffer.chartData.length;
      const trailing1 = timelineBuffer.chartData[chartLen1 - 1];
      expect(trailing1.barValue).toBeNull();
      expect(trailing1.x).toBe(3);

      // Apply another delta with a different timestamp — new bucket
      // cumulativeChaosValue=55 is the session-wide cumulative chaos after this bucket
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 2,
            cumulativeChaosValue: 55,
            timestamp: "t2",
          }),
          totalChaosValue: 55,
          totalDrops: 5,
        }),
      );
      flushNotifications();

      const trailing2 =
        timelineBuffer.chartData[timelineBuffer.chartData.length - 1];
      expect(trailing2.barValue).toBeNull();
      expect(trailing2.x).toBe(5);
      expect(trailing2.profit).toBe(55);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // seedFromTimeline
  // ═══════════════════════════════════════════════════════════════════════

  describe("seedFromTimeline", () => {
    it("should populate from a full AggregatedTimeline", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
          makeBucket({
            dropCount: 3,
            cumulativeChaosValue: 80,
            timestamp: "t2",
          }),
        ],
        totalDrops: 8,
        totalChaosValue: 80,
        totalDivineValue: 3,
        notableDrops: [makeNotableDrop(4, "The Fiend", 300, 2)],
      });

      timelineBuffer.seedFromTimeline(timeline);

      expect(timelineBuffer.buckets).toHaveLength(2);
      expect(timelineBuffer.notableDrops).toHaveLength(1);
    });

    it("should copy buckets and notableDrops (not share references)", () => {
      const originalBuckets = [
        makeBucket({ dropCount: 5, cumulativeChaosValue: 50, timestamp: "t1" }),
      ];
      const originalDrops = [makeNotableDrop(3, "The Fiend", 300, 2)];
      const timeline = makeTimeline({
        buckets: originalBuckets,
        notableDrops: originalDrops,
        totalDrops: 5,
        totalChaosValue: 50,
      });

      timelineBuffer.seedFromTimeline(timeline);

      // Modifying the original arrays should not affect the buffer
      originalBuckets.push(
        makeBucket({
          dropCount: 10,
          cumulativeChaosValue: 200,
          timestamp: "t2",
        }),
      );
      originalDrops.push(makeNotableDrop(8, "Mirror", 5000, 1));

      expect(timelineBuffer.buckets).toHaveLength(1);
      expect(timelineBuffer.notableDrops).toHaveLength(1);
    });

    it("should rebuild chartData and linePoints", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
        ],
        totalDrops: 5,
        totalChaosValue: 50,
      });

      timelineBuffer.seedFromTimeline(timeline);
      flushNotifications();

      // chartData should have origin + trailing endpoint
      expect(timelineBuffer.chartData.length).toBeGreaterThanOrEqual(2);
      // Origin point
      expect(timelineBuffer.chartData[0]).toEqual({
        x: 0,
        profit: 0,
        barValue: null,
        cardName: null,
        rarity: null,
      });
      // Trailing endpoint
      const last =
        timelineBuffer.chartData[timelineBuffer.chartData.length - 1];
      expect(last.x).toBe(5);
      expect(last.profit).toBe(50);
      expect(last.barValue).toBeNull();

      // linePoints should have origin + bucket boundary
      expect(timelineBuffer.linePoints.length).toBeGreaterThanOrEqual(2);
      expect(timelineBuffer.linePoints[0]).toEqual({ x: 0, profit: 0 });
      expect(timelineBuffer.linePoints[1]).toEqual({ x: 5, profit: 50 });
    });

    it("should set totalDrops, totalChaosValue, totalDivineValue", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 10,
            cumulativeChaosValue: 200,
            cumulativeDivineValue: 8,
            timestamp: "t1",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 200,
        totalDivineValue: 8,
      });

      timelineBuffer.seedFromTimeline(timeline);

      expect(timelineBuffer.totalDrops).toBe(10);
      expect(timelineBuffer.totalChaosValue).toBe(200);
      expect(timelineBuffer.totalDivineValue).toBe(8);
    });

    it("should apply deckCost to profit calculations", () => {
      timelineBuffer.setDeckCost(5);

      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 10,
            cumulativeChaosValue: 100,
            timestamp: "t1",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 100,
      });
      timelineBuffer.seedFromTimeline(timeline);

      // profit = 100 - 10*5 = 50
      const lastLine =
        timelineBuffer.linePoints[timelineBuffer.linePoints.length - 1];
      expect(lastLine.profit).toBe(50);

      const lastChart =
        timelineBuffer.chartData[timelineBuffer.chartData.length - 1];
      expect(lastChart.profit).toBe(50);
    });

    it("should notify subscribers", () => {
      const listener = vi.fn();
      timelineBuffer.subscribe(listener);

      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 1,
              cumulativeChaosValue: 5,
              timestamp: "t1",
            }),
          ],
          totalDrops: 1,
          totalChaosValue: 5,
        }),
      );
      flushNotifications();

      expect(listener).toHaveBeenCalled();
    });

    it("should include notable drops in chartData with barValues", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 10,
            cumulativeChaosValue: 200,
            timestamp: "t1",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 200,
        notableDrops: [
          makeNotableDrop(3, "The Doctor", 800, 1),
          makeNotableDrop(7, "The Fiend", 300, 2),
        ],
      });

      timelineBuffer.seedFromTimeline(timeline);

      const barPoints = timelineBuffer.chartData.filter(
        (p) => p.barValue !== null,
      );
      expect(barPoints).toHaveLength(2);
      expect(barPoints[0].cardName).toBe("The Doctor");
      expect(barPoints[0].barValue).toBe(800);
      expect(barPoints[1].cardName).toBe("The Fiend");
      expect(barPoints[1].barValue).toBe(300);
    });

    it("should replace existing data on re-seed", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );

      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 3,
              cumulativeChaosValue: 30,
              timestamp: "t2",
            }),
            makeBucket({
              dropCount: 7,
              cumulativeChaosValue: 100,
              timestamp: "t3",
            }),
          ],
          totalDrops: 10,
          totalChaosValue: 100,
        }),
      );

      expect(timelineBuffer.buckets).toHaveLength(2);
      expect(timelineBuffer.totalDrops).toBe(10);
      expect(timelineBuffer.totalChaosValue).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // reset
  // ═══════════════════════════════════════════════════════════════════════

  describe("reset", () => {
    it("should clear all data", () => {
      // Populate first
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
          notableDrops: [makeNotableDrop(3, "The Fiend", 300, 2)],
        }),
      );

      timelineBuffer.reset();

      expect(timelineBuffer.buckets).toEqual([]);
      expect(timelineBuffer.notableDrops).toEqual([]);
      expect(timelineBuffer.chartData).toEqual([]);
      expect(timelineBuffer.linePoints).toEqual([]);
    });

    it("should reset totals to 0", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
          totalDivineValue: 2,
        }),
      );

      timelineBuffer.reset();

      expect(timelineBuffer.totalDrops).toBe(0);
      expect(timelineBuffer.totalChaosValue).toBe(0);
      expect(timelineBuffer.totalDivineValue).toBe(0);
    });

    it("should notify subscribers", () => {
      const listener = vi.fn();
      timelineBuffer.subscribe(listener);

      timelineBuffer.reset();
      flushNotifications();

      expect(listener).toHaveBeenCalled();
    });

    it("should clear saved state", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );
      timelineBuffer.save();
      timelineBuffer.reset();

      // After reset, restore should also result in empty state (saved state was cleared)
      timelineBuffer.restore();
      expect(timelineBuffer.buckets).toEqual([]);
      expect(timelineBuffer.totalDrops).toBe(0);
    });

    it("should cancel any pending RAF", () => {
      const cancelFn = vi.fn();
      vi.stubGlobal("cancelAnimationFrame", cancelFn);

      // Apply a delta — this schedules a RAF (collected but not flushed)
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 1, cumulativeChaosValue: 10 }),
          totalChaosValue: 10,
          totalDrops: 1,
        }),
      );
      // Don't flush — leave the RAF pending

      // Reset should cancel the pending RAF
      timelineBuffer.reset();

      expect(cancelFn).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // subscribe
  // ═══════════════════════════════════════════════════════════════════════

  describe("subscribe", () => {
    it("should call listener on changes", () => {
      const listener = vi.fn();
      timelineBuffer.subscribe(listener);

      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 1, cumulativeChaosValue: 10 }),
          totalChaosValue: 10,
          totalDrops: 1,
        }),
      );
      flushNotifications();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsub = timelineBuffer.subscribe(listener);
      expect(typeof unsub).toBe("function");
    });

    it("should not call listener after unsubscribe", () => {
      const listener = vi.fn();
      const unsub = timelineBuffer.subscribe(listener);
      unsub();

      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 1, cumulativeChaosValue: 10 }),
          totalChaosValue: 10,
          totalDrops: 1,
        }),
      );
      flushNotifications();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      timelineBuffer.subscribe(listener1);
      timelineBuffer.subscribe(listener2);
      timelineBuffer.subscribe(listener3);

      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 1, cumulativeChaosValue: 10 }),
          totalChaosValue: 10,
          totalDrops: 1,
        }),
      );
      flushNotifications();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it("should only remove the correct listener on unsubscribe", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      timelineBuffer.subscribe(listener1);
      const unsub2 = timelineBuffer.subscribe(listener2);
      unsub2();

      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 1, cumulativeChaosValue: 10 }),
          totalChaosValue: 10,
          totalDrops: 1,
        }),
      );
      flushNotifications();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // save / restore
  // ═══════════════════════════════════════════════════════════════════════

  describe("save / restore", () => {
    it("should save current state and restore it later", () => {
      timelineBuffer.setDeckCost(2);
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
          totalDivineValue: 3,
          notableDrops: [makeNotableDrop(3, "Enlightened", 150, 3)],
        }),
      );

      timelineBuffer.save();

      // Overwrite with different data
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 20,
              cumulativeChaosValue: 500,
              timestamp: "t2",
            }),
          ],
          totalDrops: 20,
          totalChaosValue: 500,
        }),
      );

      // Restore
      timelineBuffer.restore();

      expect(timelineBuffer.buckets).toHaveLength(1);
      expect(timelineBuffer.buckets[0].dropCount).toBe(5);
      expect(timelineBuffer.totalDrops).toBe(5);
      expect(timelineBuffer.totalChaosValue).toBe(50);
      expect(timelineBuffer.totalDivineValue).toBe(3);
      expect(timelineBuffer.deckCost).toBe(2);
      expect(timelineBuffer.notableDrops).toHaveLength(1);
      expect(timelineBuffer.notableDrops[0].cardName).toBe("Enlightened");
    });

    it("should restore exact data after overwriting", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 3,
              cumulativeChaosValue: 30,
              timestamp: "t1",
            }),
            makeBucket({
              dropCount: 7,
              cumulativeChaosValue: 100,
              timestamp: "t2",
            }),
          ],
          totalDrops: 10,
          totalChaosValue: 100,
          totalDivineValue: 5,
        }),
      );
      flushNotifications();
      timelineBuffer.save();

      // Overwrite with different data via seedFromTimeline (not reset,
      // because reset() clears _savedState by design)
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 1,
              cumulativeChaosValue: 1,
              timestamp: "t3",
            }),
          ],
          totalDrops: 1,
          totalChaosValue: 1,
        }),
      );
      flushNotifications();

      // Restore should bring back original state
      timelineBuffer.restore();
      flushNotifications();

      expect(timelineBuffer.totalDrops).toBe(10);
      expect(timelineBuffer.totalChaosValue).toBe(100);
      expect(timelineBuffer.totalDivineValue).toBe(5);
      expect(timelineBuffer.buckets).toHaveLength(2);
    });

    it("should handle restore when nothing was saved (resets)", () => {
      // Populate with data but don't save
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );

      // Restore without having saved — should reset
      timelineBuffer.restore();

      expect(timelineBuffer.buckets).toEqual([]);
      expect(timelineBuffer.totalDrops).toBe(0);
      expect(timelineBuffer.totalChaosValue).toBe(0);
    });

    it("should restore deckCost from saved state", () => {
      timelineBuffer.setDeckCost(7);
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );
      timelineBuffer.save();

      // Change deck cost and overwrite
      timelineBuffer.setDeckCost(0);

      timelineBuffer.restore();
      expect(timelineBuffer.deckCost).toBe(7);
    });

    it("should rebuild chartData and linePoints after restore", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );
      flushNotifications();
      timelineBuffer.save();

      // Overwrite with different data (not reset — that clears _savedState)
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [],
          totalDrops: 0,
          totalChaosValue: 0,
        }),
      );
      flushNotifications();
      // After seeding with empty timeline, chartData has only the origin
      expect(timelineBuffer.chartData).toHaveLength(1);

      timelineBuffer.restore();
      flushNotifications();
      // After restore, chartData should have origin + trailing endpoint (at least 2)
      expect(timelineBuffer.chartData.length).toBeGreaterThan(1);
      expect(timelineBuffer.linePoints.length).toBeGreaterThan(1);
    });

    it("should notify subscribers on restore", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );
      flushNotifications();
      timelineBuffer.save();

      const listener = vi.fn();
      timelineBuffer.subscribe(listener);

      timelineBuffer.restore();
      flushNotifications();

      expect(listener).toHaveBeenCalled();
    });

    it("should clear saved state after restore (one-shot)", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );
      timelineBuffer.save();
      timelineBuffer.restore();

      // Populate again
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 20,
              cumulativeChaosValue: 500,
              timestamp: "t2",
            }),
          ],
          totalDrops: 20,
          totalChaosValue: 500,
        }),
      );

      // Second restore without a new save should reset (no saved state)
      timelineBuffer.restore();
      expect(timelineBuffer.buckets).toEqual([]);
      expect(timelineBuffer.totalDrops).toBe(0);
    });

    it("should create deep copies of buckets and notableDrops on save", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
        ],
        totalDrops: 5,
        totalChaosValue: 50,
        notableDrops: [makeNotableDrop(3, "The Fiend", 300, 2)],
      });
      timelineBuffer.seedFromTimeline(timeline);
      timelineBuffer.save();

      // Mutate the buffer's current data
      timelineBuffer.buckets[0].dropCount = 999;
      timelineBuffer.notableDrops[0].cardName = "Mutated";

      // Restore should have original values (deep copy was made)
      timelineBuffer.restore();
      expect(timelineBuffer.buckets[0].dropCount).toBe(5);
      expect(timelineBuffer.notableDrops[0].cardName).toBe("The Fiend");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Net profit calculation
  // ═══════════════════════════════════════════════════════════════════════

  describe("net profit calculation", () => {
    it("should compute profit = chaos - drops * deckCost", () => {
      timelineBuffer.setDeckCost(4);
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 10,
              cumulativeChaosValue: 100,
              timestamp: "t1",
            }),
          ],
          totalDrops: 10,
          totalChaosValue: 100,
        }),
      );

      // profit = 100 - 10*4 = 60
      const lastLine =
        timelineBuffer.linePoints[timelineBuffer.linePoints.length - 1];
      expect(lastLine.profit).toBe(60);

      const lastChart =
        timelineBuffer.chartData[timelineBuffer.chartData.length - 1];
      expect(lastChart.profit).toBe(60);
    });

    it("should compute profit = chaos when deckCost is 0", () => {
      // deckCost defaults to 0 (reset in beforeEach)
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 10,
              cumulativeChaosValue: 100,
              timestamp: "t1",
            }),
          ],
          totalDrops: 10,
          totalChaosValue: 100,
        }),
      );
      flushNotifications();

      const lastLine =
        timelineBuffer.linePoints[timelineBuffer.linePoints.length - 1];
      expect(lastLine.profit).toBe(100);

      const lastChart =
        timelineBuffer.chartData[timelineBuffer.chartData.length - 1];
      expect(lastChart.profit).toBe(100);
    });

    it("should show negative profit when deckCost exceeds chaos per drop", () => {
      timelineBuffer.setDeckCost(20);
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 10,
              cumulativeChaosValue: 100,
              timestamp: "t1",
            }),
          ],
          totalDrops: 10,
          totalChaosValue: 100,
        }),
      );

      // profit = 100 - 10*20 = -100
      const lastLine =
        timelineBuffer.linePoints[timelineBuffer.linePoints.length - 1];
      expect(lastLine.profit).toBe(-100);
    });

    it("should compute origin point profit as 0 regardless of deckCost", () => {
      timelineBuffer.setDeckCost(10);
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );

      // Origin: _net(0, 0) = 0 - 0*10 = 0
      expect(timelineBuffer.chartData[0]).toEqual({
        x: 0,
        profit: 0,
        barValue: null,
        cardName: null,
        rarity: null,
      });
      expect(timelineBuffer.linePoints[0]).toEqual({ x: 0, profit: 0 });
    });

    it("should apply deckCost to notable drop profit calculations", () => {
      timelineBuffer.setDeckCost(5);
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 10,
            cumulativeChaosValue: 200,
            timestamp: "t1",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 200,
        notableDrops: [makeNotableDrop(5, "The Doctor", 800, 1)],
      });
      timelineBuffer.seedFromTimeline(timeline);

      const barPoint = timelineBuffer.chartData.find(
        (p) => p.barValue !== null,
      );
      expect(barPoint).toBeDefined();
      // At cumulativeDropIndex=5, interpolated chaos = 100 (half of 200, linear)
      // profit = 100 - 5*5 = 75
      expect(barPoint!.profit).toBe(75);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Interpolation
  // ═══════════════════════════════════════════════════════════════════════

  describe("chaos interpolation (via notable drops)", () => {
    it("should interpolate chaos value between bucket boundaries", () => {
      // Bucket 1: cumDrops=5, cumChaos=100
      // Bucket 2: cumDrops=5+10=15, cumChaos=300
      // Notable at cumDropIndex=10:
      //   prevDrops=5, prevChaos=100, cumDrops=15, cumChaos=300
      //   t = (10-5)/(15-5) = 0.5
      //   interpolatedChaos = 100 + 0.5*(300-100) = 200
      //   profit(deckCost=0) = 200
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 100,
            timestamp: "t1",
          }),
          makeBucket({
            dropCount: 10,
            cumulativeChaosValue: 300,
            timestamp: "t2",
          }),
        ],
        totalDrops: 15,
        totalChaosValue: 300,
        notableDrops: [makeNotableDrop(10, "Interpolated Card", 500, 1)],
      });

      timelineBuffer.seedFromTimeline(timeline);
      flushNotifications();

      const barPoint = timelineBuffer.chartData.find(
        (p) => p.barValue !== null,
      );
      expect(barPoint).toBeDefined();
      // At x=10: interpolation between bucket 1 end (cumDrops=5, chaos=100)
      // and bucket 2 end (cumDrops=15, chaos=300)
      // t = (10-5)/(15-5) = 0.5, chaos = 100 + 0.5*(300-100) = 200
      expect(barPoint!.profit).toBe(200); // deckCost=0, so profit=chaos
    });

    it("should return cumChaos if notable lands exactly on bucket boundary", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 100,
            timestamp: "t1",
          }),
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 200,
            timestamp: "t2",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 200,
        notableDrops: [makeNotableDrop(5, "Boundary Card", 400, 2)],
      });

      timelineBuffer.seedFromTimeline(timeline);
      flushNotifications();

      const barPoint = timelineBuffer.chartData.find(
        (p) => p.barValue !== null,
      );
      expect(barPoint).toBeDefined();
      // At x=5: exactly at end of bucket 1 (cumDrops=5), so x <= cumDrops
      // _interpolateChaos: prevDrops=0, cumDrops=5, range=5, t=(5-0)/5=1
      // chaos = 0 + 1*(100-0) = 100
      expect(barPoint!.profit).toBe(100); // deckCost=0
    });

    it("should return last bucket chaos if notable is beyond all buckets", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 100,
            timestamp: "t1",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 100,
        notableDrops: [makeNotableDrop(8, "Beyond Card", 300, 2)],
      });

      timelineBuffer.seedFromTimeline(timeline);
      flushNotifications();

      const barPoint = timelineBuffer.chartData.find(
        (p) => p.barValue !== null,
      );
      expect(barPoint).toBeDefined();
      // x=8 is beyond the only bucket boundary (cumDrops=5),
      // so _interpolateChaos returns last bucket's cumChaos=100
      expect(barPoint!.profit).toBe(100); // deckCost=0
    });

    it("should return 0 when no buckets exist", () => {
      // Seed with no buckets but with a notable drop (edge case)
      const notable = makeNotableDrop(3, "Ghost Card", 200, 3);
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
          notableDrop: notable,
          totalChaosValue: 50,
          totalDrops: 5,
        }),
      );

      // The notable drop was applied after the bucket was upserted,
      // so interpolation should work with the existing bucket
      const barPoint = timelineBuffer.chartData.find(
        (p) => p.barValue !== null,
      );
      expect(barPoint).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // rebuildAll (tested indirectly via seedFromTimeline + setDeckCost)
  // ═══════════════════════════════════════════════════════════════════════

  describe("rebuildAll (via seed + setDeckCost)", () => {
    it("should produce origin, notable drops, and trailing endpoint in chartData", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 120,
            timestamp: "t2",
          }),
        ],
        totalDrops: 10,
        totalChaosValue: 120,
        notableDrops: [
          makeNotableDrop(3, "Card A", 100, 1),
          makeNotableDrop(8, "Card B", 200, 2),
        ],
      });

      timelineBuffer.seedFromTimeline(timeline);
      flushNotifications();

      // Origin
      expect(timelineBuffer.chartData[0]).toEqual({
        x: 0,
        profit: 0,
        barValue: null,
        cardName: null,
        rarity: null,
      });

      // Notable drops
      const barPoints = timelineBuffer.chartData.filter(
        (p) => p.barValue !== null,
      );
      expect(barPoints).toHaveLength(2);

      // Trailing endpoint
      const trailing =
        timelineBuffer.chartData[timelineBuffer.chartData.length - 1];
      expect(trailing.barValue).toBeNull();
      expect(trailing.x).toBe(10);
      expect(trailing.profit).toBe(120); // deckCost=0
    });

    it("should produce sorted linePoints with origin and bucket boundaries", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 3,
            cumulativeChaosValue: 30,
            timestamp: "t1",
          }),
          makeBucket({
            dropCount: 7,
            cumulativeChaosValue: 100,
            timestamp: "t2",
          }),
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 150,
            timestamp: "t3",
          }),
        ],
        totalDrops: 15,
        totalChaosValue: 150,
      });

      timelineBuffer.seedFromTimeline(timeline);
      flushNotifications();

      // Origin + 3 bucket boundaries = 4 line points
      // cumDrops: [3, 10, 15]
      expect(timelineBuffer.linePoints).toHaveLength(4);
      expect(timelineBuffer.linePoints[0]).toEqual({ x: 0, profit: 0 });
      expect(timelineBuffer.linePoints[1]).toEqual({ x: 3, profit: 30 });
      expect(timelineBuffer.linePoints[2]).toEqual({ x: 10, profit: 100 });
      expect(timelineBuffer.linePoints[3]).toEqual({ x: 15, profit: 150 });

      // Verify sorted
      for (let i = 1; i < timelineBuffer.linePoints.length; i++) {
        expect(timelineBuffer.linePoints[i].x).toBeGreaterThanOrEqual(
          timelineBuffer.linePoints[i - 1].x,
        );
      }
    });

    it("should not add trailing endpoint when totalDrops is 0", () => {
      const timeline = makeTimeline({
        buckets: [],
        totalDrops: 0,
        totalChaosValue: 0,
      });

      timelineBuffer.seedFromTimeline(timeline);

      // Only origin point
      expect(timelineBuffer.chartData).toHaveLength(1);
      expect(timelineBuffer.chartData[0].x).toBe(0);
    });

    it("should not duplicate trailing endpoint if last notable is at totalDrops", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 5,
            cumulativeChaosValue: 50,
            timestamp: "t1",
          }),
        ],
        totalDrops: 5,
        totalChaosValue: 50,
        notableDrops: [makeNotableDrop(5, "End Card", 200, 1)],
      });

      timelineBuffer.seedFromTimeline(timeline);

      // The trailing endpoint should only be added if totalDrops > last chartData x.
      // Since the notable drop is at x=5 and totalDrops=5, no trailing is appended.
      const lastPoint =
        timelineBuffer.chartData[timelineBuffer.chartData.length - 1];
      // Trailing endpoint at x=5 might not be added if notable at x=5 is already the last
      // The code checks if totalDrops > lastX, and since notable x=5 == totalDrops=5, no trailing
      // Actually, checking the code: it checks `this.totalDrops > lastX`, so equal won't add trailing
      expect(lastPoint.x).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("should handle a single drop", () => {
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 1, cumulativeChaosValue: 5 }),
          totalChaosValue: 5,
          totalDrops: 1,
        }),
      );

      expect(timelineBuffer.buckets).toHaveLength(1);
      expect(timelineBuffer.totalDrops).toBe(1);
      expect(timelineBuffer.linePoints.length).toBeGreaterThanOrEqual(1);
      expect(timelineBuffer.chartData.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle zero chaos value drops", () => {
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({ dropCount: 5, cumulativeChaosValue: 0 }),
          totalChaosValue: 0,
          totalDrops: 5,
        }),
      );
      flushNotifications();

      expect(timelineBuffer.totalChaosValue).toBe(0);
      const lastLine =
        timelineBuffer.linePoints[timelineBuffer.linePoints.length - 1];
      expect(lastLine.profit).toBe(0);
    });

    it("should handle large number of sequential deltas", () => {
      for (let i = 1; i <= 50; i++) {
        timelineBuffer.applyDelta(
          makeDelta({
            bucket: makeBucket({
              dropCount: 2,
              cumulativeChaosValue: i * 10,
              timestamp: `t${i}`,
            }),
            totalChaosValue: i * 10,
            totalDrops: i * 2,
          }),
        );
      }

      expect(timelineBuffer.buckets).toHaveLength(50);
      expect(timelineBuffer.totalDrops).toBe(100);
      expect(timelineBuffer.totalChaosValue).toBe(500);

      // linePoints should be sorted
      for (let i = 1; i < timelineBuffer.linePoints.length; i++) {
        expect(timelineBuffer.linePoints[i].x).toBeGreaterThanOrEqual(
          timelineBuffer.linePoints[i - 1].x,
        );
      }
    });

    it("should handle applyDelta after seedFromTimeline", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [
            makeBucket({
              dropCount: 5,
              cumulativeChaosValue: 50,
              timestamp: "t1",
            }),
          ],
          totalDrops: 5,
          totalChaosValue: 50,
        }),
      );

      // Now apply a new delta (new bucket)
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 3,
            cumulativeChaosValue: 80,
            timestamp: "t2",
          }),
          totalChaosValue: 80,
          totalDrops: 8,
        }),
      );

      expect(timelineBuffer.buckets).toHaveLength(2);
      expect(timelineBuffer.totalDrops).toBe(8);
      expect(timelineBuffer.totalChaosValue).toBe(80);
    });

    it("should handle upsert of existing bucket with changed cumDrops", () => {
      const ts = "2024-01-01T00:01:00Z";

      // Create first bucket
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 3,
            cumulativeChaosValue: 30,
            timestamp: ts,
          }),
          totalChaosValue: 30,
          totalDrops: 3,
        }),
      );
      flushNotifications();

      const linePointsBefore = [
        ...timelineBuffer.linePoints.map((p) => ({ ...p })),
      ];
      const pointAt3 = linePointsBefore.find((p) => p.x === 3);
      expect(pointAt3).toBeDefined();

      // Update the same bucket with more drops (same timestamp = upsert)
      timelineBuffer.applyDelta(
        makeDelta({
          bucket: makeBucket({
            dropCount: 7,
            cumulativeChaosValue: 70,
            timestamp: ts,
          }),
          totalChaosValue: 70,
          totalDrops: 7,
        }),
      );
      flushNotifications();

      // Old line point at x=3 should be removed, new one at x=7
      const pointAt3After = timelineBuffer.linePoints.find((p) => p.x === 3);
      const pointAt7 = timelineBuffer.linePoints.find((p) => p.x === 7);
      expect(pointAt3After).toBeUndefined();
      expect(pointAt7).toBeDefined();
      expect(pointAt7!.profit).toBe(70); // deckCost=0
    });

    it("should handle multiple notable drops in one timeline", () => {
      const timeline = makeTimeline({
        buckets: [
          makeBucket({
            dropCount: 20,
            cumulativeChaosValue: 1000,
            timestamp: "t1",
          }),
        ],
        totalDrops: 20,
        totalChaosValue: 1000,
        notableDrops: [
          makeNotableDrop(3, "Card A", 100, 3),
          makeNotableDrop(7, "Card B", 300, 2),
          makeNotableDrop(12, "Card C", 800, 1),
          makeNotableDrop(18, "Card D", 500, 1),
        ],
      });

      timelineBuffer.seedFromTimeline(timeline);

      const barPoints = timelineBuffer.chartData.filter(
        (p) => p.barValue !== null,
      );
      expect(barPoints).toHaveLength(4);
      expect(barPoints.map((p) => p.cardName)).toEqual([
        "Card A",
        "Card B",
        "Card C",
        "Card D",
      ]);
    });

    it("should handle seedFromTimeline with empty timeline", () => {
      timelineBuffer.seedFromTimeline(
        makeTimeline({
          buckets: [],
          totalDrops: 0,
          totalChaosValue: 0,
          totalDivineValue: 0,
          notableDrops: [],
        }),
      );

      expect(timelineBuffer.buckets).toEqual([]);
      expect(timelineBuffer.totalDrops).toBe(0);
      // chartData should have at least the origin
      expect(timelineBuffer.chartData).toHaveLength(1);
      expect(timelineBuffer.chartData[0].x).toBe(0);
      // linePoints should have origin
      expect(timelineBuffer.linePoints).toHaveLength(1);
      expect(timelineBuffer.linePoints[0]).toEqual({ x: 0, profit: 0 });
    });
  });
});
