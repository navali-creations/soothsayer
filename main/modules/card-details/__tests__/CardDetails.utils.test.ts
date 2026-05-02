import { describe, expect, it } from "vitest";

import { buildPreparedDropTimeline } from "../CardDetails.utils";

describe("buildPreparedDropTimeline", () => {
  it("aggregates sessions by day and carries cumulative drops across zero-drop days", () => {
    const result = buildPreparedDropTimeline({
      rows: [
        {
          sessionId: "s1",
          sessionStartedAt: "2025-06-01T10:00:00Z",
          count: 1,
          totalDecksOpened: 100,
          league: "Settlers",
        },
        {
          sessionId: "s2",
          sessionStartedAt: "2025-06-01T14:00:00Z",
          count: 0,
          totalDecksOpened: 80,
          league: "Settlers",
        },
        {
          sessionId: "s3",
          sessionStartedAt: "2025-06-02T10:00:00Z",
          count: 2,
          totalDecksOpened: 60,
          league: "Settlers",
        },
      ],
      leagueDateRanges: [],
      firstSessionStartedAt: null,
      timelineEndDate: "",
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      count: 1,
      cumulativeCount: 1,
      totalDecksOpened: 180,
      sessionId: "s1,s2",
      sessionCount: 2,
    });
    expect(result[1]).toMatchObject({
      count: 2,
      cumulativeCount: 3,
      totalDecksOpened: 60,
      sessionId: "s3",
      sessionCount: 1,
    });
  });

  it("inserts gap and boundary points in the main process", () => {
    const result = buildPreparedDropTimeline({
      rows: [
        {
          sessionId: "s1",
          sessionStartedAt: "2025-06-10T10:00:00Z",
          count: 1,
          totalDecksOpened: 100,
          league: "Settlers",
        },
        {
          sessionId: "s2",
          sessionStartedAt: "2025-07-10T10:00:00Z",
          count: 0,
          totalDecksOpened: 80,
          league: "Settlers",
        },
      ],
      leagueDateRanges: [
        {
          name: "Settlers",
          startDate: "2025-06-01T00:00:00Z",
          endDate: "2025-08-01T00:00:00Z",
        },
      ],
      firstSessionStartedAt: "2025-06-05T00:00:00Z",
      timelineEndDate: "2025-08-01T00:00:00Z",
    });

    expect(result[0].isBoundary).toBe(true);
    expect(result.some((point) => point.isGap)).toBe(true);
    expect(result[result.length - 1]).toMatchObject({
      isBoundary: true,
      cumulativeCount: 1,
    });
  });
});
