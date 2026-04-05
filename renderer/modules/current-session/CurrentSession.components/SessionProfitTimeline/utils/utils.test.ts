import type { AggregatedTimeline } from "~/types/data-stores";

import { buildLinePoints } from "./utils";

/** Helper to build a minimal valid AggregatedTimeline with sensible defaults. */
function makeTimeline(
  buckets: AggregatedTimeline["buckets"] = [],
  overrides: Partial<AggregatedTimeline> = {},
): AggregatedTimeline {
  return {
    buckets,
    liveEdge: [],
    totalChaosValue: 0,
    totalDivineValue: 0,
    totalDrops: 0,
    notableDrops: [],
    ...overrides,
  };
}

/** Shorthand for creating a bucket. */
function makeBucket(
  dropCount: number,
  cumulativeChaosValue: number,
  overrides: Partial<AggregatedTimeline["buckets"][number]> = {},
): AggregatedTimeline["buckets"][number] {
  return {
    timestamp: new Date().toISOString(),
    dropCount,
    cumulativeChaosValue,
    cumulativeDivineValue: 0,
    topCard: null,
    topCardChaosValue: 0,
    ...overrides,
  };
}

describe("buildLinePoints", () => {
  it("should return an empty array for an empty timeline", () => {
    const timeline = makeTimeline([]);
    const result = buildLinePoints(timeline, 0);
    expect(result).toEqual([]);
  });

  it("should return origin plus one point for a single bucket", () => {
    const timeline = makeTimeline([makeBucket(5, 100)]);
    const result = buildLinePoints(timeline, 0);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0, profit: 0 });
    expect(result[1]).toEqual({ x: 5, profit: 100 });
  });

  it("should compute cumulative drops correctly across multiple buckets", () => {
    const timeline = makeTimeline([
      makeBucket(3, 50),
      makeBucket(7, 200),
      makeBucket(2, 350),
    ]);
    const result = buildLinePoints(timeline, 0);

    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 3, profit: 50 },
      { x: 10, profit: 200 },
      { x: 12, profit: 350 },
    ]);
  });

  it("should return raw chaos values when deckCost is 0", () => {
    const timeline = makeTimeline([makeBucket(4, 80), makeBucket(6, 200)]);
    const result = buildLinePoints(timeline, 0);

    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 4, profit: 80 },
      { x: 10, profit: 200 },
    ]);
  });

  it("should subtract deckCost per drop from profit when deckCost > 0", () => {
    const deckCost = 5;
    const timeline = makeTimeline([makeBucket(4, 80), makeBucket(6, 200)]);
    const result = buildLinePoints(timeline, deckCost);

    // Origin: net(0, 0) = 0 - 0*5 = 0
    // Bucket 1: cumDrops=4, net(80, 4) = 80 - 4*5 = 60
    // Bucket 2: cumDrops=10, net(200, 10) = 200 - 10*5 = 150
    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 4, profit: 60 },
      { x: 10, profit: 150 },
    ]);
  });

  it("should produce negative profit when deckCost exceeds chaos value", () => {
    const deckCost = 50;
    const timeline = makeTimeline([makeBucket(10, 100)]);
    const result = buildLinePoints(timeline, deckCost);

    // net(100, 10) = 100 - 10*50 = -400
    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 10, profit: -400 },
    ]);
  });

  it("should sort points by x (cumulative drops)", () => {
    // Even though buckets are processed sequentially and cumDrops should
    // naturally increase, the sort still applies. Verify order is correct
    // for a normal case.
    const timeline = makeTimeline([
      makeBucket(1, 10),
      makeBucket(5, 60),
      makeBucket(3, 90),
    ]);
    const result = buildLinePoints(timeline, 0);

    const xValues = result.map((p) => p.x);
    expect(xValues).toEqual([0, 1, 6, 9]);

    // Verify sorted ascending
    for (let i = 1; i < xValues.length; i++) {
      expect(xValues[i]).toBeGreaterThan(xValues[i - 1]);
    }
  });

  it("should deduplicate points with the same x value", () => {
    // If a bucket has dropCount=0, its cumDrops stays the same as the
    // previous bucket's cumDrops, causing a collision. The Map deduplication
    // means the later value (from the second bucket) overwrites the earlier.
    const timeline = makeTimeline([
      makeBucket(5, 100),
      makeBucket(0, 150), // cumDrops stays at 5 → same x as previous bucket
    ]);
    const result = buildLinePoints(timeline, 0);

    // x=0 (origin), x=5 (from first bucket, then overwritten by second bucket)
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 5, profit: 150 }, // second bucket's value wins
    ]);
  });

  it("should always start with origin point {x: 0, profit: 0} when buckets exist", () => {
    const timeline = makeTimeline([makeBucket(10, 500)]);
    const result = buildLinePoints(timeline, 0);

    expect(result[0]).toEqual({ x: 0, profit: 0 });
  });

  it("should apply deckCost=0 to origin as net(0, 0) = 0", () => {
    const timeline = makeTimeline([makeBucket(1, 10)]);
    const result = buildLinePoints(timeline, 0);

    expect(result[0]).toEqual({ x: 0, profit: 0 });
  });

  it("should apply positive deckCost to origin as net(0, 0) = 0 - 0*cost = 0", () => {
    // Origin with deckCost: net(0, 0) = 0 - 0 * deckCost = 0
    const timeline = makeTimeline([makeBucket(1, 10)]);
    const result = buildLinePoints(timeline, 100);

    expect(result[0]).toEqual({ x: 0, profit: 0 });
  });

  it("should handle a single bucket with dropCount=0", () => {
    // cumDrops = 0, same as origin → deduplication means only one point at x=0
    const timeline = makeTimeline([makeBucket(0, 0)]);
    const result = buildLinePoints(timeline, 0);

    // Origin (0, 0) and bucket (0, 0) collapse into a single point
    expect(result).toEqual([{ x: 0, profit: 0 }]);
  });

  it("should handle many buckets accumulating drops correctly", () => {
    const buckets = [
      makeBucket(1, 10),
      makeBucket(2, 30),
      makeBucket(3, 60),
      makeBucket(4, 100),
      makeBucket(5, 150),
    ];
    const timeline = makeTimeline(buckets);
    const result = buildLinePoints(timeline, 0);

    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 1, profit: 10 }, // cumDrops = 1
      { x: 3, profit: 30 }, // cumDrops = 1+2 = 3
      { x: 6, profit: 60 }, // cumDrops = 3+3 = 6
      { x: 10, profit: 100 }, // cumDrops = 6+4 = 10
      { x: 15, profit: 150 }, // cumDrops = 10+5 = 15
    ]);
  });

  it("should not include notable drops as extra points on the line", () => {
    // The function only uses buckets, not notableDrops.
    // notableDrops are used elsewhere for bars, not for the profit line.
    const timeline = makeTimeline([makeBucket(5, 100), makeBucket(5, 300)], {
      notableDrops: [
        {
          cumulativeDropIndex: 3,
          cardName: "The Doctor",
          chaosValue: 500,
          rarity: 1,
        },
        {
          cumulativeDropIndex: 8,
          cardName: "House of Mirrors",
          chaosValue: 1000,
          rarity: 1,
        },
      ],
    });
    const result = buildLinePoints(timeline, 0);

    // Should only have origin + 2 bucket boundary points, no extra points
    // at cumulativeDropIndex 3 or 8.
    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 5, profit: 100 },
      { x: 10, profit: 300 },
    ]);
  });

  it("should not be affected by liveEdge data", () => {
    const timeline = makeTimeline([makeBucket(2, 40)], {
      liveEdge: [
        {
          id: 1,
          sessionId: "s1",
          cardName: "Rain of Chaos",
          chaosValue: 5,
          divineValue: null,
          droppedAt: new Date().toISOString(),
        },
      ],
    });
    const result = buildLinePoints(timeline, 0);

    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 2, profit: 40 },
    ]);
  });

  it("should handle fractional deckCost values", () => {
    const timeline = makeTimeline([makeBucket(3, 10)]);
    const result = buildLinePoints(timeline, 2.5);

    // net(10, 3) = 10 - 3*2.5 = 10 - 7.5 = 2.5
    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 3, profit: 2.5 },
    ]);
  });

  it("should handle fractional cumulativeChaosValue", () => {
    const timeline = makeTimeline([makeBucket(2, 33.33)]);
    const result = buildLinePoints(timeline, 0);

    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 2, profit: 33.33 },
    ]);
  });

  it("should handle consecutive zero-drop buckets (multiple deduplication)", () => {
    // Multiple buckets with dropCount=0 all map to the same x.
    // The last one's cumulativeChaosValue wins.
    const timeline = makeTimeline([
      makeBucket(0, 0),
      makeBucket(0, 10),
      makeBucket(0, 20),
    ]);
    const result = buildLinePoints(timeline, 0);

    // All map to x=0, last one wins → profit=20. Origin also at x=0.
    expect(result).toEqual([{ x: 0, profit: 20 }]);
  });

  it("should handle a bucket after zero-drop buckets", () => {
    const timeline = makeTimeline([
      makeBucket(0, 0),
      makeBucket(0, 5),
      makeBucket(3, 30),
    ]);
    const result = buildLinePoints(timeline, 0);

    // x=0 overwritten multiple times (origin → bucket 1 → bucket 2), last value = 5
    // x=3 from bucket 3
    expect(result).toEqual([
      { x: 0, profit: 5 },
      { x: 3, profit: 30 },
    ]);
  });

  it("should correctly compute profit with large deckCost and many drops", () => {
    const deckCost = 10;
    const timeline = makeTimeline([
      makeBucket(100, 500),
      makeBucket(200, 2000),
    ]);
    const result = buildLinePoints(timeline, deckCost);

    expect(result).toEqual([
      { x: 0, profit: 0 },
      { x: 100, profit: 500 - 100 * 10 }, // 500 - 1000 = -500
      { x: 300, profit: 2000 - 300 * 10 }, // 2000 - 3000 = -1000
    ]);
  });
});
